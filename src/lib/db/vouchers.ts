import { type Actor, isAdmin, userIdOf } from '@/lib/auth/actor';
import type { RaffleTier } from '@/types/raffle';
import { AppError } from '@/utils/errors';
import { now, voucherCode } from '@/utils/normalize';

export type NewVoucher = {
  code: string;
  tier: RaffleTier;
  maxUses: number;
  expiresAt: number | null;
  note: string | null;
};

/** Emitir vouchers es la razón por la que existe el rol ADMIN. */
export const issueVoucher = async (
  db: D1Database,
  actor: Actor,
  input: NewVoucher,
): Promise<{ id: string; code: string }> => {
  if (!isAdmin(actor)) throw new AppError('FORBIDDEN');

  const id = crypto.randomUUID();
  const code = voucherCode(input.code);
  const ts = now();

  await db
    .prepare(
      `INSERT INTO vouchers
         (id, code, tier, max_uses, expires_at, note, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      code,
      input.tier,
      input.maxUses,
      input.expiresAt,
      input.note,
      actor.userId,
      ts,
      ts,
    )
    .run();

  return { id, code };
};

/**
 * Canje. Reemplaza al `FOR UPDATE` de Postgres.
 *
 * Está partido en dos mitades y conviene entender por qué:
 *
 *   · Las lecturas de arriba existen SÓLO para elegir un mensaje decente. Un
 *     error del batch no puede decirte cuál de las guardas saltó — todas fallan
 *     con el mismo "CHECK constraint failed: _abort" — así que "no es tu rifa"
 *     y "ya está habilitada" tienen que distinguirse antes de entrar.
 *   · El batch() es la verdad. Es una transacción real con rollback: si dos
 *     canjes del último uso disponible entran a la vez, la lectura de arriba
 *     los deja pasar a los dos, y es el CHECK `used_count <= max_uses` el que
 *     tumba a uno de los dos, entero.
 *
 * Los INSERT en `_abort` son la única forma de abortar un batch desde una
 * condición SQL (no se puede leer, decidir en JavaScript y seguir dentro de la
 * misma transacción). Insertar 1 viola su CHECK y tira todo abajo. Es fea; es
 * el precio de no tener plpgsql. Ver migrations/0005_guards.sql.
 */
export const redeemVoucher = async (
  db: D1Database,
  actor: Actor,
  rawCode: string,
  raffleId: string,
): Promise<{ tier: RaffleTier }> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const code = voucherCode(rawCode);
  const ts = now();

  // La rifa primero: si no es tuya, no llegás siquiera a saber si el código
  // existe. Las mismas tres condiciones vuelven a chequearse dentro del batch.
  const rifa = await db
    .prepare('SELECT owner_id, unlock_method FROM raffles WHERE id = ?')
    .bind(raffleId)
    .first<{ owner_id: string; unlock_method: string }>();

  if (rifa === null) throw new AppError('NOT_FOUND');
  if (rifa.owner_id !== userId) throw new AppError('FORBIDDEN');
  if (rifa.unlock_method !== 'FREE') {
    throw new AppError('RAFFLE_ALREADY_UNLOCKED');
  }

  const voucher = await db
    .prepare(
      `SELECT id, tier, max_uses, used_count, expires_at
         FROM vouchers WHERE code = ?`,
    )
    .bind(code)
    .first<{
      id: string;
      tier: string;
      max_uses: number;
      used_count: number;
      expires_at: number | null;
    }>();

  if (voucher === null) throw new AppError('VOUCHER_NOT_FOUND');
  if (voucher.expires_at !== null && voucher.expires_at <= ts) {
    throw new AppError('VOUCHER_EXPIRED');
  }
  if (voucher.used_count >= voucher.max_uses) {
    throw new AppError('VOUCHER_EXHAUSTED');
  }

  const tier = voucher.tier as RaffleTier;

  try {
    await db.batch([
      // Guarda 1 · la rifa es del actor y todavía no está habilitada.
      db
        .prepare(
          `INSERT INTO _abort (id)
           SELECT 1 WHERE NOT EXISTS (
             SELECT 1 FROM raffles
              WHERE id = ?1 AND owner_id = ?2 AND unlock_method = 'FREE')`,
        )
        .bind(raffleId, userId),

      // Guarda 2 · el voucher sigue vigente y con usos, ahora sí en serio.
      db
        .prepare(
          `INSERT INTO _abort (id)
           SELECT 1 WHERE NOT EXISTS (
             SELECT 1 FROM vouchers
              WHERE id = ?1 AND used_count < max_uses
                AND (expires_at IS NULL OR expires_at > ?2))`,
        )
        .bind(voucher.id, ts),

      // El UNIQUE de raffle_id es lo que impide habilitar dos veces la misma rifa.
      db
        .prepare(
          `INSERT INTO voucher_redemptions
             (id, voucher_id, raffle_id, redeemed_by, redeemed_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), voucher.id, raffleId, userId, ts),

      db
        .prepare(
          `UPDATE vouchers SET used_count = used_count + 1, updated_at = ?1
            WHERE id = ?2`,
        )
        .bind(ts, voucher.id),

      db
        .prepare(
          `UPDATE raffles
              SET tier = ?1, unlock_method = 'VOUCHER', updated_at = ?2
            WHERE id = ?3 AND owner_id = ?4`,
        )
        .bind(tier, ts, raffleId, userId),
    ]);
  } catch (e) {
    throw traducirFalloDeCanje(e);
  }

  return { tier };
};

/**
 * Acá sólo caen las carreras: todo lo que se podía distinguir con una lectura
 * ya se distinguió antes del batch. Si llegaste hasta acá es porque entre esa
 * lectura y la transacción alguien más te ganó de mano.
 */
const traducirFalloDeCanje = (e: unknown): AppError => {
  const msg = e instanceof Error ? e.message : '';

  // El UNIQUE de raffle_id: otro canje habilitó esta rifa en el medio.
  if (msg.includes('voucher_redemptions')) {
    return new AppError('RAFFLE_ALREADY_UNLOCKED');
  }

  // El CHECK del voucher: otro se llevó el último uso disponible.
  if (msg.includes('used_count')) return new AppError('VOUCHER_EXHAUSTED');

  // El _abort no dice cuál de las guardas saltó, y en este punto puede ser
  // cualquiera de las dos. Se elige la que le sirve al usuario: volver a
  // intentar con otro código.
  if (msg.includes('_abort')) return new AppError('VOUCHER_EXHAUSTED');

  return new AppError('NOT_FOUND');
};
