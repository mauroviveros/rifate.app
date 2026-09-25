import { DurableObject } from 'cloudflare:workers';

import type {
  BuyerInput,
  LiveMessage,
  OwnerNumber,
  PublicNumber,
  RaffleConfigPatch,
  RaffleInit,
  RaffleStats,
  SellResult,
} from '@/types/raffle';
import { AppError } from '@/utils/errors';
import { LIVE_GONE } from '@/utils/live';
import { now, phone } from '@/utils/normalize';

import { getMeta, migrate, seedNumbers, setMeta } from './schema';

/** Tope por operación. Mismo número que el máximo de un pedido del visitante. */
const MAX_NUMEROS_POR_OPERACION = 50;

/**
 * La etiqueta de los WebSockets de la página pública. Cuando exista otra
 * audiencia (el panel en vivo, con compradores) va a tener la suya, y
 * `broadcast()` no le puede mandar la grilla del organizador a un visitante
 * por equivocación: cada uno se busca por su etiqueta.
 */
const PUBLICO = 'public';

/**
 * Cuántos pueden mirar una rifa a la vez. Una rifa real, compartida en grupos
 * de WhatsApp, tiene decenas mirando; mil es holgura, no un número de diseño.
 *
 * El tope no es por plata —una conexión quieta hibernada no factura—, es por
 * el organizador: cada venta le manda la grilla a todos los que miran, y con
 * decenas de miles de sockets truchos su venta tardaría más. El que queda
 * afuera no pierde la página, sólo el vivo: ve la grilla del HTML y
 * `liveGrid` reintenta más tarde.
 */
export const MAX_ESPECTADORES = 1000;

/**
 * El código con el que se corta a un socket que habla. Es el 1008 del
 * protocolo: violación de política.
 */
export const SOLO_ESCUCHA = 1008;

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

    // El runtime contesta el `ping` del cliente sin despertar al objeto. Sin
    // esto cada latido de cada visitante sería un request facturado y un
    // objeto despierto. No es de esquema: no va en el blockConcurrencyWhile.
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    );
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

  // ══ EN VIVO ═════════════════════════════════════════════════════════════
  // Quien mira la página pública se queda escuchando. Es superficie pública:
  // no recibe actor y lo único que viaja es `PublicNumber[]`.

  /**
   * Acepta el WebSocket de un visitante y le manda la grilla de entrada.
   *
   * ⚠️ `acceptWebSocket()`, NUNCA `server.accept()`. Con el primero el objeto
   * hiberna con las conexiones abiertas y no factura mientras nadie vende. Con
   * el segundo queda en memoria todo lo que dure la conexión: es la única
   * línea de este archivo que puede hacer explotar la factura (docs/09).
   *
   * La grilla de entrada no es un detalle: la página pública se cachea 30 s en
   * la CDN, así que el HTML puede llegar viejo. Lo que manda este método la
   * corrige apenas se conecta.
   */
  override fetch(request: Request): Response {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Se espera un WebSocket', { status: 426 });
    }

    // Una rifa sin init() no tiene grilla que mirar.
    if (this.ownerId() === null) {
      return new Response('No existe', { status: 404 });
    }

    if (this.ctx.getWebSockets(PUBLICO).length >= MAX_ESPECTADORES) {
      return new Response('Hay demasiada gente mirando', {
        status: 503,
        headers: { 'Retry-After': '30' },
      });
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [PUBLICO]);
    server.send(this.gridMessage());

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Los visitantes sólo escuchan. El `ping` lo contesta el runtime sin llegar
   * acá (ver el constructor), así que si algo llega a este método no lo mandó
   * `liveGrid`: se lo corta.
   *
   * Ignorarlo no alcanzaba. Cada mensaje que llega acá despierta al objeto, y
   * eso es duración facturada y un request cada 20 mensajes: un script que
   * manda basura todo el día lo tendría despierto todo el día.
   *
   * El cierre no necesita handler: desde la compatibility_date 2026-04-07
   * (`web_socket_auto_reply_to_close`) el runtime contesta el Close solo.
   */
  webSocketMessage(ws: WebSocket): void {
    ws.close(SOLO_ESCUCHA, 'Este canal sólo se escucha');
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

    const telefono = phone(buyer.phone);
    // La nota es de la venta, no de cada número: se copia igual en cada fila de
    // `numbers` para que `ownerGrid()` la devuelva (lee `n.note`). `release()`
    // la limpia. En `buyers.note` queda sólo la de la primera compra.
    const nota = buyer.note ?? null;
    const ts = now();
    const sql = this.ctx.storage.sql;

    const resultado = this.ctx.storage.transactionSync<SellResult>(() => {
      const buyerId = this.upsertBuyer(nombre, telefono, nota, ts);

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
                  reserved_until = NULL, note = ?, sold_at = ?, updated_at = ?
            WHERE number = ?`,
          buyerId,
          nota,
          ts,
          ts,
          n,
        );
      }

      return { buyerId, sold: unicos };
    });

    this.proyectar();
    this.broadcast();
    return resultado;
  }

  /**
   * Libera números vendidos o reservados: vuelven a AVAILABLE.
   *
   * Es la contracara de sell() y existe porque el organizador se equivoca —
   * cargó el 47 en vez del 74, o la venta se cayó. Sin esto, el único arreglo
   * es borrar la rifa entera.
   *
   * Mismo transactionSync y mismo todo-o-nada que sell(): si el tercero de
   * cuatro números no se podía liberar, los dos primeros vuelven atrás. Media
   * liberación es peor que ninguna, porque nadie se entera de cuál quedó.
   *
   * ⚠️ NO borra al comprador aunque se quede sin números, y es a propósito:
   *   · el teléfono ES la identidad con la que deduplica upsertBuyer(), así
   *     que si vuelve a comprar tiene que seguir siendo la misma persona;
   *   · desde la fase 8 `orders.buyer_id` lo referencia con un CHECK que no
   *     tolera NULL en un pedido confirmado — borrarlo acá lo rompería.
   * Que quede el teléfono de alguien que ya no tiene números es deuda de
   * privacidad, anotada para la fase 10.
   */
  release(userId: string, numeros: number[]): number[] {
    this.assertOwner(userId);

    const unicos = [...new Set(numeros)];
    if (unicos.length === 0) throw new AppError('INVALID_NUMBERS');
    if (unicos.length > MAX_NUMEROS_POR_OPERACION) {
      throw new AppError('TOO_MANY_NUMBERS');
    }

    const ts = now();
    const sql = this.ctx.storage.sql;

    const liberados = this.ctx.storage.transactionSync<number[]>(() => {
      for (const n of unicos) {
        const fila = sql
          .exec<{ status: string }>(
            'SELECT status FROM numbers WHERE number = ?',
            n,
          )
          .toArray()[0];

        if (fila === undefined) throw new AppError('INVALID_NUMBERS');

        // Liberar algo que ya está libre no es inofensivo: significa que el
        // que llamó estaba mirando una grilla vieja, y conviene que se entere.
        if (fila.status !== 'SOLD' && fila.status !== 'RESERVED') {
          throw new AppError('NUMBERS_NOT_RELEASABLE');
        }

        sql.exec(
          `UPDATE numbers
              SET status = 'AVAILABLE', buyer_id = NULL, order_id = NULL,
                  reserved_until = NULL, sold_at = NULL, note = NULL,
                  updated_at = ?
            WHERE number = ?`,
          ts,
          n,
        );
      }

      return unicos;
    });

    this.proyectar();
    this.broadcast();
    return liberados;
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

    // Primero se cierra a los que están mirando, con un código que les dice
    // que no vuelvan a intentar: la rifa no va a volver.
    for (const ws of this.ctx.getWebSockets(PUBLICO)) {
      ws.close(LIVE_GONE, 'La rifa ya no existe');
    }

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

  private gridMessage(): string {
    const message: LiveMessage = { type: 'grid', numbers: this.publicGrid() };
    return JSON.stringify(message);
  }

  /**
   * Le manda la grilla nueva a todos los que están mirando. Va después de cada
   * escritura que cambia un estado, y después de `proyectar()`: primero queda
   * registrado, después se avisa.
   *
   * Se arma el mensaje una sola vez, no una por conexión. Y un socket que ya
   * se estaba cerrando no puede tirar abajo la venta: la venta ya pasó.
   */
  private broadcast(): void {
    const sockets = this.ctx.getWebSockets(PUBLICO);
    if (sockets.length === 0) return;

    const message = this.gridMessage();
    for (const ws of sockets) {
      try {
        ws.send(message);
      } catch {
        // Se estaba cerrando. El runtime lo saca de getWebSockets() solo.
      }
    }
  }

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
