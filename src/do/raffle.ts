import { DurableObject } from 'cloudflare:workers';

import { getMeta, migrate, seedNumbers, setMeta } from './schema';

/** La config que el DO copia de D1 para poder validar por su cuenta. */
export type RaffleInit = {
  raffleId: string;
  ownerId: string;
  tier: 'BASIC' | 'PRO';
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
  numberStart: number;
  totalNumbers: number;
};

/** Lo que ve el visitante. No tiene campo para el comprador: no existe. */
export type PublicNumber = {
  number: number;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'BLOCKED';
};

export type RaffleStats = {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  blocked: number;
};

export class Raffle extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // blockConcurrencyWhile SÓLO acá, para el esquema. Nunca por request:
    // usarlo en cada request mata el throughput y suma duración facturable.
    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage.sql);
    });
  }

  /**
   * Materializa la rifa: guarda la copia local de la config y crea la grilla.
   *
   * Es idempotente porque el flujo de creación escribe primero en D1 (que es
   * quien puede responder si el slug es único) y recién después llama acá. Si
   * esta llamada falla, queda una fila huérfana en D1 y se reintenta.
   */
  init(input: RaffleInit): void {
    const sql = this.ctx.storage.sql;

    if (getMeta(sql, 'owner_id') !== null) return; // ya inicializada

    setMeta(sql, 'raffle_id', input.raffleId);
    setMeta(sql, 'owner_id', input.ownerId);
    setMeta(sql, 'tier', input.tier);
    setMeta(sql, 'status', input.status);
    setMeta(sql, 'number_start', String(input.numberStart));
    setMeta(sql, 'total_numbers', String(input.totalNumbers));

    seedNumbers(sql, input.numberStart, input.totalNumbers);
  }

  /** Superficie pública: número y estado, nunca por quién. */
  publicGrid(): PublicNumber[] {
    return this.ctx.storage.sql
      .exec<PublicNumber>('SELECT number, status FROM numbers ORDER BY number')
      .toArray();
  }

  /** Contadores. Es lo que la fase 5 va a proyectar a D1. */
  stats(): RaffleStats {
    return this.ctx.storage.sql
      .exec<RaffleStats>(
        `SELECT
           COUNT(*)                                     AS total,
           COUNT(*) FILTER (WHERE status = 'AVAILABLE') AS available,
           COUNT(*) FILTER (WHERE status = 'RESERVED')  AS reserved,
           COUNT(*) FILTER (WHERE status = 'SOLD')      AS sold,
           COUNT(*) FILTER (WHERE status = 'BLOCKED')   AS blocked
         FROM numbers`,
      )
      .one();
  }

  /**
   * Deja el objeto vacío. Un DO factura storage hasta que le vaciás los datos:
   * borrar la fila de `raffles` en D1 no borra nada de acá.
   *
   * El orden del borrado es: primero esto, después D1. Al revés, si esto falla
   * quedás con un objeto que cobra y al que ya no podés llegar (perdiste su id).
   */
  async destroy(): Promise<void> {
    await this.ctx.storage.deleteAll();

    // `deleteAll()` borra TAMBIÉN el esquema, y `migrate()` sólo corre en el
    // constructor — que para esta instancia ya corrió. Sin esto el objeto
    // queda vivo y sin tablas, y cualquier llamada posterior falla con
    // "no such table": entre ellas un segundo `destroy()`, que es exactamente
    // lo que hay que poder hacer si el DELETE de D1 falló y se reintenta.
    //
    // La alternativa era `ctx.abort()`, que desaloja la instancia pero hace
    // que esta misma llamada tire excepción: el que llama no podría
    // distinguir "se borró" de "falló".
    migrate(this.ctx.storage.sql);
  }
}
