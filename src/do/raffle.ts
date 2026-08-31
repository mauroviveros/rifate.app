import { DurableObject } from 'cloudflare:workers';

import { AppError } from '@/lib/errors';
import { normalizePhone, now } from '@/lib/normalize';
import type {
  BuyerInput,
  OwnerNumber,
  PublicNumber,
  RaffleConfigPatch,
  RaffleInit,
  RaffleStats,
  SellResult,
} from '@/types/raffle';

import { getMeta, migrate, seedNumbers, setMeta } from './schema';

/** Tope por operación. Mismo número que el máximo de un pedido del visitante. */
const MAX_NUMEROS_POR_OPERACION = 50;

/**
 * LA CONVENCIÓN QUE HAY QUE SOSTENER EN ESTE ARCHIVO
 *
 *   Todo método que empieza con `owner`, o que escribe, recibe `userId` como
 *   primer parámetro y llama a `assertOwner()` en la primera línea.
 *
 *   Un método sin `userId` es, por definición, público — y por lo tanto su tipo
 *   de retorno no puede contener datos de compradores.
 *
 * Se revisa de un vistazo en el code review, y ese es el punto.
 */
export class Raffle extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // blockConcurrencyWhile SÓLO acá, para el esquema. Nunca por request:
    // usarlo en cada request mata el throughput y suma duración facturable.
    ctx.blockConcurrencyWhile(async () => {
      migrate(ctx.storage.sql);
    });
  }

  // ══ AUTORIZACIÓN ════════════════════════════════════════════════════════
  // El Worker ya autorizó antes de llamar. El DO no confía: guarda el ownerId
  // de su rifa y lo verifica de nuevo. Si el Worker se equivoca, el objeto
  // igual se niega. Es la capa que más se parece a RLS, porque el chequeo vive
  // pegado a los datos.

  private ownerId(): string | null {
    return getMeta(this.ctx.storage.sql, 'owner_id');
  }

  private assertOwner(userId: string | null): void {
    const owner = this.ownerId();
    // Sin init() no hay dueño, y sin dueño no hay nadie autorizado: un objeto
    // a medio crear se niega a todo. Falla cerrado, no abierto.
    if (owner === null || userId === null || userId !== owner) {
      throw new AppError('FORBIDDEN');
    }
  }

  /**
   * Materializa la rifa: guarda la copia local de la config y crea la grilla.
   *
   * Es idempotente porque el flujo de creación escribe primero en D1 (que es
   * quien puede responder si el slug es único) y recién después llama acá. Si
   * esta llamada falla, queda una fila huérfana en D1 y se reintenta.
   *
   * No lleva assertOwner: es el método que ESTABLECE al dueño. Sólo lo puede
   * llamar el flujo de creación, que ya sabe quién es el actor, y una segunda
   * llamada no puede cambiar nada porque sale por el `return` de arriba.
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

  // ══ SUPERFICIE PÚBLICA ══════════════════════════════════════════════════
  // Cualquiera. No recibe actor porque no lo necesita: el tipo de retorno ya
  // garantiza que no puede filtrar nada privado.

  /** Superficie pública: número y estado, nunca por quién. */
  publicGrid(): PublicNumber[] {
    return this.ctx.storage.sql
      .exec<PublicNumber>('SELECT number, status FROM numbers ORDER BY number')
      .toArray();
  }

  /** Contadores. Es lo que se proyecta a D1. */
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

  // ══ SUPERFICIE DEL ORGANIZADOR ══════════════════════════════════════════
  // Todas exigen userId y todas empiezan con assertOwner.

  ownerGrid(userId: string): OwnerNumber[] {
    this.assertOwner(userId);

    return this.ctx.storage.sql
      .exec<OwnerNumber>(
        `
        SELECT n.number,
               n.status,
               n.buyer_id       AS buyerId,
               n.order_id       AS orderId,
               n.reserved_until AS reservedUntil,
               n.note           AS note,
               b.name           AS buyerName,
               b.phone          AS buyerPhone
          FROM numbers n
          LEFT JOIN buyers b ON b.id = n.buyer_id
         ORDER BY n.number
      `,
      )
      .toArray();
  }

  /**
   * Venta manual: el organizador cobró por fuera y carga la venta.
   *
   * O pasa todo o no pasa nada. En v1 esto eran dos INSERT desde Node y, si el
   * segundo fallaba, se borraba el comprador a mano para compensar; si el
   * proceso se caía en el medio quedaba un comprador huérfano. Acá el
   * transactionSync revierte el upsert del comprador si un número no estaba
   * libre.
   */
  sell(userId: string, numeros: number[], buyer: BuyerInput): SellResult {
    this.assertOwner(userId);

    const unicos = [...new Set(numeros)];
    if (unicos.length === 0) throw new AppError('INVALID_NUMBERS');
    if (unicos.length > MAX_NUMEROS_POR_OPERACION) {
      throw new AppError('TOO_MANY_NUMBERS');
    }

    const nombre = buyer.name.trim();
    if (nombre === '') throw new AppError('INVALID_NUMBERS');

    const telefono = normalizePhone(buyer.phone);
    const ts = now();
    const sql = this.ctx.storage.sql;

    const resultado = this.ctx.storage.transactionSync<SellResult>(() => {
      const buyerId = this.upsertBuyer(
        nombre,
        telefono,
        buyer.note ?? null,
        ts,
      );

      for (const n of unicos) {
        // Se lee y después se escribe, número por número. Dentro de un DO es
        // seguro: atiende un pedido por vez, así que no hay carrera entre el
        // SELECT y el UPDATE. Es lo que en D1 obligaba a la tabla _abort.
        const fila = sql
          .exec<{ status: string }>(
            'SELECT status FROM numbers WHERE number = ?',
            n,
          )
          .toArray()[0];

        if (fila === undefined) throw new AppError('INVALID_NUMBERS');
        if (fila.status !== 'AVAILABLE' && fila.status !== 'RESERVED') {
          throw new AppError('NUMBERS_UNAVAILABLE');
        }

        sql.exec(
          `UPDATE numbers
              SET status = 'SOLD', buyer_id = ?, order_id = NULL,
                  reserved_until = NULL, sold_at = ?, updated_at = ?
            WHERE number = ?`,
          buyerId,
          ts,
          ts,
          n,
        );
      }

      return { buyerId, sold: unicos };
    });

    this.proyectar();
    return resultado;
  }

  /**
   * Actualiza la copia local de la config cuando D1 cambia.
   *
   * `owner_id` no está: el dueño se fija en init() y no se mueve más. Un patch
   * que pudiera reescribirlo sería una forma elegante de anular assertOwner.
   */
  syncConfig(userId: string, patch: RaffleConfigPatch): void {
    this.assertOwner(userId);

    const sql = this.ctx.storage.sql;
    if (patch.tier !== undefined) setMeta(sql, 'tier', patch.tier);
    if (patch.status !== undefined) setMeta(sql, 'status', patch.status);
  }

  /**
   * Recalcula los contadores desde acá y pisa D1. Es la salida cuando algo
   * divergió: el storage del DO es la verdad, D1 es caché reconstruible.
   *
   * A diferencia de la proyección normal, este método SÍ espera a que D1
   * responda — el que llama a resync() lo hace justamente para saber si quedó.
   */
  async resync(userId: string): Promise<RaffleStats> {
    this.assertOwner(userId);

    const stats = this.stats();
    const raffleId = getMeta(this.ctx.storage.sql, 'raffle_id');
    if (raffleId === null) throw new AppError('RAFFLE_NOT_INITIALIZED');

    await this.escribirContadores(raffleId, stats.sold, stats.reserved);
    return stats;
  }

  /**
   * Deja el objeto vacío. Un DO factura storage hasta que le vaciás los datos:
   * borrar la fila de `raffles` en D1 no borra nada de acá.
   *
   * El orden del borrado es: primero esto, después D1. Al revés, si esto falla
   * quedás con un objeto que cobra y al que ya no podés llegar (perdiste su id).
   */
  async destroy(userId: string): Promise<void> {
    this.assertOwner(userId);

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

  // ══ PRIVADO ═════════════════════════════════════════════════════════════

  /**
   * Un teléfono es una persona dentro de la rifa: si ya compró, es el mismo
   * comprador. Sin teléfono no hay con qué deduplicar y se crea uno nuevo.
   */
  private upsertBuyer(
    nombre: string,
    telefono: string | null,
    nota: string | null,
    ts: number,
  ): string {
    const sql = this.ctx.storage.sql;

    if (telefono !== null) {
      const existente = sql
        .exec<{ id: string }>('SELECT id FROM buyers WHERE phone = ?', telefono)
        .toArray()[0];

      if (existente !== undefined) {
        sql.exec(
          'UPDATE buyers SET name = ?, updated_at = ? WHERE id = ?',
          nombre,
          ts,
          existente.id,
        );
        return existente.id;
      }
    }

    const id = crypto.randomUUID();
    sql.exec(
      `INSERT INTO buyers (id, name, phone, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      nombre,
      telefono,
      nota,
      ts,
      ts,
    );
    return id;
  }

  /**
   * Proyección DO → D1, sin bloquear la respuesta al organizador.
   *
   * Si falla, no se revierte nada: la venta ya está registrada acá, que es la
   * verdad. D1 queda desactualizado hasta el próximo movimiento o hasta un
   * resync(). Es la decisión de diseño, no un descuido — por eso el catch
   * loguea en vez de propagar.
   */
  private proyectar(): void {
    const raffleId = getMeta(this.ctx.storage.sql, 'raffle_id');
    if (raffleId === null) return;

    const { sold, reserved } = this.stats();

    this.ctx.waitUntil(
      this.escribirContadores(raffleId, sold, reserved).catch((e: unknown) => {
        console.error('proyección a D1 falló', { raffleId, error: e });
      }),
    );
  }

  private async escribirContadores(
    raffleId: string,
    sold: number,
    reserved: number,
  ): Promise<void> {
    await this.env.DB.prepare(
      `UPDATE raffles
          SET sold_count = ?, reserved_count = ?, synced_at = ?, updated_at = ?
        WHERE id = ?`,
    )
      .bind(sold, reserved, Date.now(), Date.now(), raffleId)
      .run();
  }
}
