import { type Actor, isAdmin, userIdOf } from '@/lib/auth/actor';
import type {
  DrawResult,
  NewRaffle,
  OwnerRaffle,
  PublicRaffle,
  RaffleCard,
  RaffleListItem,
  RaffleStatus,
  RaffleTier,
  UnlockMethod,
} from '@/types/raffle';
import { AppError } from '@/utils/errors';
import { genSlug, now, phone } from '@/utils/normalize';

type RaffleRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  prize: string | null;
  tier: string;
  status: string;
  unlock_method: string;
  ticket_price: number;
  currency: string;
  total_numbers: number;
  number_start: number;
  draw_date: string;
  contact_phone: string | null;
  sold_count: number;
  reserved_count: number;
  winner_number: number | null;
  winner_name: string | null;
  synced_at: number | null;
  published_at: number | null;
  closed_at: number | null;
  created_at: number;
  updated_at: number;
};

const COLUMNAS = `id, slug, title, description, prize, tier, status, unlock_method,
                  ticket_price, currency, total_numbers, number_start, draw_date,
                  contact_phone, sold_count, reserved_count, winner_number,
                  winner_name, synced_at, published_at, closed_at, created_at,
                  updated_at`;

const toCard = (r: RaffleRow): RaffleCard => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  tier: r.tier as RaffleTier,
  status: r.status as RaffleStatus,
  ticketPrice: r.ticket_price,
  currency: r.currency,
  totalNumbers: r.total_numbers,
  numberStart: r.number_start,
  drawDate: r.draw_date,
  soldCount: r.sold_count,
  reservedCount: r.reserved_count,
  createdAt: r.created_at,
});

/**
 * La tarjeta del listado del panel. Los tres campos de más salen de columnas
 * que `COLUMNAS` ya pedía y `toCard()` descarta — no hay consulta nueva.
 */
const toListItem = (r: RaffleRow): RaffleListItem => ({
  ...toCard(r),
  prize: r.prize,
  winnerNumber: r.winner_number,
  winnerName: r.winner_name,
});

const toOwner = (r: RaffleRow): OwnerRaffle => ({
  ...toCard(r),
  description: r.description,
  prize: r.prize,
  unlockMethod: r.unlock_method as UnlockMethod,
  contactPhone: r.contact_phone,
  winnerNumber: r.winner_number,
  winnerName: r.winner_name,
  syncedAt: r.synced_at,
  publishedAt: r.published_at,
  closedAt: r.closed_at,
  updatedAt: r.updated_at,
});

/** Sin ownerId: el visitante no tiene por qué saber quién es el dueño. */
const toPublic = (r: RaffleRow): PublicRaffle => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  description: r.description,
  prize: r.prize,
  tier: r.tier as RaffleTier,
  status: r.status as RaffleStatus,
  ticketPrice: r.ticket_price,
  currency: r.currency,
  totalNumbers: r.total_numbers,
  numberStart: r.number_start,
  drawDate: r.draw_date,
  contactPhone: r.contact_phone,
  soldCount: r.sold_count,
  reservedCount: r.reserved_count,
  winnerNumber: r.winner_number,
  winnerName: r.winner_name,
});

export const listOwnRaffles = async (
  db: D1Database,
  actor: Actor, // ← sin `?`, sin valor por defecto. Si te lo olvidás, no compila.
): Promise<RaffleListItem[]> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const { results } = await db
    .prepare(
      `SELECT ${COLUMNAS} FROM raffles WHERE owner_id = ? ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<RaffleRow>();

  return results.map(toListItem);
};

/** La rifa completa, para el dashboard. Ajena → FORBIDDEN, no un null ambiguo. */
export const getOwnRaffle = async (
  db: D1Database,
  actor: Actor,
  id: string,
): Promise<OwnerRaffle> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  // `owner_id` se pide sólo acá, y no entra en COLUMNAS: así ninguna de las
  // otras consultas lo trae "por las dudas" y después se escapa en un JSON.
  const row = await db
    .prepare(`SELECT ${COLUMNAS}, owner_id FROM raffles WHERE id = ?`)
    .bind(id)
    .first<RaffleRow & { owner_id: string }>();

  if (row === null) throw new AppError('NOT_FOUND');

  // La comparación se hace acá y no en el WHERE a propósito: así "no existe" y
  // "no es tuya" son dos caminos distintos y ninguno se confunde con el otro.
  if (row.owner_id !== userId && !isAdmin(actor)) {
    throw new AppError('FORBIDDEN');
  }

  return toOwner(row);
};

/**
 * El link público. `CLOSED` entra a propósito: el link viejo tiene que seguir
 * mostrando quién ganó.
 *
 * Recibe actor aunque sea una lectura pública porque es lo que permite que el
 * dueño (y el admin) previsualicen su propio borrador con la misma función.
 */
export const getPublicRaffleBySlug = async (
  db: D1Database,
  actor: Actor,
  slug: string,
): Promise<PublicRaffle | null> => {
  const row = await db
    .prepare(
      `SELECT ${COLUMNAS} FROM raffles
        WHERE slug = ?1
          AND (status IN ('PUBLISHED', 'CLOSED') OR owner_id = ?2 OR ?3 = 1)`,
    )
    .bind(slug, userIdOf(actor), isAdmin(actor) ? 1 : 0)
    .first<RaffleRow>();

  return row === null ? null : toPublic(row);
};

/**
 * Crea la fila en DRAFT. NO toca el Durable Object: el orden lo decide
 * `createRaffleWithGrid()` en `src/lib/raffles.ts`, porque D1 es quien puede
 * responder si el slug es único y por eso va primero.
 */
export const createRaffle = async (
  db: D1Database,
  actor: Actor,
  input: NewRaffle,
): Promise<{ id: string; slug: string; ownerId: string }> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const id = crypto.randomUUID();
  const slug = genSlug(input.title);
  const ts = now();

  await db
    .prepare(
      `INSERT INTO raffles
         (id, owner_id, slug, title, description, prize, ticket_price,
          total_numbers, number_start, draw_date, contact_phone,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      slug,
      input.title.trim(),
      input.description,
      input.prize,
      input.ticketPrice,
      input.totalNumbers,
      input.numberStart,
      input.drawDate,
      phone(input.contactPhone),
      ts,
      ts,
    )
    .run();

  return { id, slug, ownerId: userId };
};

/** Sólo la fila de D1. El DO se entera por `publishRaffle()`. */
export const markPublished = async (
  db: D1Database,
  actor: Actor,
  id: string,
): Promise<void> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const ts = now();
  const res = await db
    .prepare(
      `UPDATE raffles
          SET status = 'PUBLISHED', published_at = ?1, updated_at = ?1
        WHERE id = ?2 AND owner_id = ?3 AND status = 'DRAFT'`,
    )
    .bind(ts, id, userId)
    .run();

  // Un UPDATE que no tocó nada es exactamente el modo de falla que describe
  // docs/04: permite de más y no dice nada. Acá se convierte en un error.
  if (res.meta.changes === 0) throw new AppError('FORBIDDEN');
};

/**
 * Cierra la fila con el resultado del sorteo. Sólo la fila: el sorteo lo hace
 * y lo registra el Durable Object, y esto es la copia (`drawRaffle()`).
 *
 * `CLOSED` entra en el WHERE a propósito: es el reintento. Si el DO ya cerró y
 * la escritura anterior falló a mitad de camino, el DO devuelve el mismo
 * ganador y esto lo vuelve a escribir igual. El `COALESCE` conserva la fecha
 * del primer cierre.
 */
export const markClosed = async (
  db: D1Database,
  actor: Actor,
  id: string,
  winner: DrawResult,
): Promise<void> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const ts = now();
  const res = await db
    .prepare(
      `UPDATE raffles
          SET status = 'CLOSED', winner_number = ?1, winner_name = ?2,
              closed_at = COALESCE(closed_at, ?3), updated_at = ?3
        WHERE id = ?4 AND owner_id = ?5 AND status IN ('PUBLISHED', 'CLOSED')`,
    )
    .bind(winner.number, winner.buyerName, ts, id, userId)
    .run();

  if (res.meta.changes === 0) throw new AppError('FORBIDDEN');
};

/**
 * Anula la fila. Como `markClosed`, es la copia de lo que ya decidió el DO, y
 * `CANCELLED` entra en el WHERE para que el reintento no falle. Una sorteada
 * no: el WHERE la deja afuera aunque el flujo se equivoque.
 */
export const markCancelled = async (
  db: D1Database,
  actor: Actor,
  id: string,
): Promise<void> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const ts = now();
  const res = await db
    .prepare(
      `UPDATE raffles
          SET status = 'CANCELLED', closed_at = COALESCE(closed_at, ?1),
              updated_at = ?1
        WHERE id = ?2 AND owner_id = ?3
          AND status IN ('DRAFT', 'PUBLISHED', 'CANCELLED')`,
    )
    .bind(ts, id, userId)
    .run();

  if (res.meta.changes === 0) throw new AppError('FORBIDDEN');
};

/**
 * Borra la fila. Va SEGUNDO, después de vaciar el Durable Object
 * (`deleteRaffle()`): al revés, si el objeto fallara quedaría cobrando storage
 * sin que nadie tenga ya su id para llegar a él (docs/09).
 *
 * Una sorteada no se borra ni aunque el flujo se equivoque: es el registro de
 * a quién le tocó el premio.
 */
export const deleteRaffleRow = async (
  db: D1Database,
  actor: Actor,
  id: string,
): Promise<void> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const res = await db
    .prepare(
      `DELETE FROM raffles WHERE id = ? AND owner_id = ? AND status <> 'CLOSED'`,
    )
    .bind(id, userId)
    .run();

  if (res.meta.changes === 0) throw new AppError('FORBIDDEN');
};

/** Los campos que se editan en cualquier estado. */
export type RaffleDetailsInput = {
  title: string;
  description: string | null;
  prize: string | null;
  drawDate: string;
  contactPhone: string | null;
};

/** Cantidad, arranque y precio: sólo se tocan en DRAFT (lo decide el flujo). */
export type RaffleRangeInput = {
  totalNumbers: number;
  numberStart: 0 | 1;
  ticketPrice: number; // centavos
};

/**
 * Edita una rifa. Owner-scoped y con la misma guarda que `markPublished`: un
 * UPDATE que no tocó ninguna fila es el modo de falla de docs/04 —permite de
 * más y no dice nada— así que se convierte en FORBIDDEN.
 *
 * `range` sólo llega cuando la rifa está en DRAFT. El `AND status = 'DRAFT'` del
 * WHERE es el segundo cerrojo: aunque el flujo se equivoque, `total_numbers` y
 * `ticket_price` no se reescriben sobre una rifa publicada.
 */
export const updateRaffle = async (
  db: D1Database,
  actor: Actor,
  id: string,
  details: RaffleDetailsInput,
  range?: RaffleRangeInput,
): Promise<void> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const ts = now();
  const res = range
    ? await db
        .prepare(
          `UPDATE raffles
              SET title = ?1, description = ?2, prize = ?3, draw_date = ?4,
                  contact_phone = ?5, total_numbers = ?6, number_start = ?7,
                  ticket_price = ?8, updated_at = ?9
            WHERE id = ?10 AND owner_id = ?11 AND status = 'DRAFT'`,
        )
        .bind(
          details.title.trim(),
          details.description,
          details.prize,
          details.drawDate,
          phone(details.contactPhone),
          range.totalNumbers,
          range.numberStart,
          range.ticketPrice,
          ts,
          id,
          userId,
        )
        .run()
    : await db
        .prepare(
          `UPDATE raffles
              SET title = ?1, description = ?2, prize = ?3, draw_date = ?4,
                  contact_phone = ?5, updated_at = ?6
            WHERE id = ?7 AND owner_id = ?8`,
        )
        .bind(
          details.title.trim(),
          details.description,
          details.prize,
          details.drawDate,
          phone(details.contactPhone),
          ts,
          id,
          userId,
        )
        .run();

  // Un UPDATE que no tocó nada: rifa ajena, inexistente, o (en la variante con
  // rango) ya no está en DRAFT. Los tres se responden igual.
  if (res.meta.changes === 0) throw new AppError('FORBIDDEN');
};

/**
 * Sólo el teléfono de contacto. Existe aparte de `updateRaffle` porque el
 * renglón «Cargar el teléfono» del detalle en DRAFT manda un único campo, y
 * `raffleUpdateSchema` pide todos. Owner-scoped, misma guarda que el resto.
 *
 * `contactPhone` llega ya validado por el esquema; `phone()` sólo lo normaliza
 * a E.164. Un `null` borra el teléfono — la usa `raffle.setPhone` para un
 * borrador; sobre una rifa publicada el CHECK de la tabla lo rechaza.
 */
export const setContactPhone = async (
  db: D1Database,
  actor: Actor,
  id: string,
  contactPhone: string | null,
): Promise<void> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const ts = now();
  const res = await db
    .prepare(
      `UPDATE raffles SET contact_phone = ?1, updated_at = ?2
        WHERE id = ?3 AND owner_id = ?4`,
    )
    .bind(phone(contactPhone), ts, id, userId)
    .run();

  if (res.meta.changes === 0) throw new AppError('FORBIDDEN');
};
