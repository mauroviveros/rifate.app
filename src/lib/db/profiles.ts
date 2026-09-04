import type { Actor } from '@/lib/auth/actor';
import { isAdmin, userIdOf } from '@/lib/auth/actor';
import type { Profile, Role } from '@/types/profile';
import { AppError } from '@/utils/errors';
import { now, phone } from '@/utils/normalize';

/**
 * ⚠️ `role` NO está acá, y no es un olvido: es la única defensa contra la
 * auto-promoción a ADMIN. El UPDATE de abajo bindea campo por campo, así que
 * un `role` que venga en el input no tiene por dónde llegar a la base.
 */
export type ProfileInput = Pick<
  Profile,
  'displayName' | 'avatarUrl' | 'contactPhone'
>;

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  contact_phone: string | null;
  role: string;
  created_at: number;
  updated_at: number;
};

const mapProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
  contactPhone: row.contact_phone,
  role: row.role as Role,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const COLUMNAS = `id, display_name, avatar_url, contact_phone, role, created_at, updated_at`;

/** Propio siempre; ajeno sólo el admin. El visitante, nunca. */
export const getProfile = async (
  db: D1Database,
  actor: Actor,
  id: string,
): Promise<Profile | null> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');
  if (id !== userId && !isAdmin(actor)) throw new AppError('FORBIDDEN');

  const row = await db
    .prepare(`SELECT ${COLUMNAS} FROM profiles WHERE id = ?`)
    .bind(id)
    .first<ProfileRow>();

  return row === null ? null : mapProfile(row);
};

/**
 * `WHERE id = <el del actor>`, nunca uno que venga del input.
 * Es la línea que en Postgres escribía la policy. Acá la escribís vos, en un
 * solo lugar, y por eso ese lugar tiene que ser uno solo.
 */
export const updateProfile = async (
  db: D1Database,
  actor: Actor,
  input: ProfileInput,
): Promise<void> => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  await db
    .prepare(
      `UPDATE profiles
          SET display_name = ?, avatar_url = ?, contact_phone = ?, updated_at = ?
        WHERE id = ?`,
    )
    .bind(
      input.displayName.trim(),
      input.avatarUrl,
      phone(input.contactPhone),
      now(),
      userId,
    )
    .run();
};
