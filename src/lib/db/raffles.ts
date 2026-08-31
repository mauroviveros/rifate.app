import { type Actor, isAdmin, userIdOf } from '@/lib/auth/actor';
import { AppError } from '@/lib/errors';
import { normalizePhone, now, slugUnique } from '@/lib/normalize';
import type {
  NewRaffle,
  OwnerRaffle,
  PublicRaffle,
  RaffleCard,
  RaffleStatus,
  RaffleTier,
  UnlockMethod,
} from '@/types/raffle';

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
  created_at: number;
  updated_at: number;
};

const COLUMNAS = `id, slug, title, description, prize, tier, status, unlock_method,
                  ticket_price, currency, total_numbers, number_start, draw_date,
                  contact_phone, sold_count, reserved_count, winner_number,
                  winner_name, synced_at, published_at, created_at, updated_at`;

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
): Promise<RaffleCard[]> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const { results } = await db
    .prepare(
      `SELECT ${COLUMNAS} FROM raffles WHERE owner_id = ? ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<RaffleRow>();

  return results.map(toCard);
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
  const slug = slugUnique(input.title);
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
      normalizePhone(input.contactPhone),
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
