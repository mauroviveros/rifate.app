// El actor es el usuario que hace la petición
// Responde a la pregunta: "¿quién está haciendo esta petición?".
export type Actor =
  | { kind: 'visitor' }                   // sin sesión
  | { kind: 'organizer'; userId: string } // logeado, rol USER
  | { kind: 'admin'; userId: string };    // logeado, rol ADMIN

// Devuelve el actor a partir de la sesión.
export const actorFromSession = async (
  db: D1Database,
  session: { userId: string } | null,
): Promise<Actor> => {
  if (!session) return { kind: 'visitor' };

  const row = await db
    .prepare('SELECT role from profiles WHERE id = ?')
    .bind(session.userId)
    .first<{ role: string }>();

  return row?.role === 'ADMIN'
    ? { kind: 'admin', userId: session.userId }
    : { kind: 'organizer', userId: session.userId };
}

// Determina si el actor es un administrador.
export const isAdmin = (a: Actor): a is Extract<Actor, { kind: 'admin' }> => a.kind === 'admin';

// Devuelve el userId del actor, o null si es un visitante.
export const userIdOf = (a: Actor): string | null => a.kind === 'visitor' ? null : a.userId;
