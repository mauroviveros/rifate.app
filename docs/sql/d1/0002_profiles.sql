-- ============================================================================
-- 0002 · profiles
-- ----------------------------------------------------------------------------
-- 0001 lo genera la CLI de Better Auth (`user`, `session`, `account`,
-- `verification`) y NO se edita a mano. Esta migración va después.
--
-- STRICT: SQLite es de tipado laxo por defecto y aceptaría un texto en una
-- columna INTEGER. STRICT lo prohíbe. Es lo más parecido a los tipos de
-- Postgres que se puede tener acá, y sale gratis.
-- ============================================================================

CREATE TABLE profiles (
  id            TEXT    PRIMARY KEY,        -- = user.id de Better Auth
  display_name  TEXT    NOT NULL,
  avatar_url    TEXT,
  contact_phone TEXT,                       -- E.164 normalizado por la app
  role          TEXT    NOT NULL DEFAULT 'USER',

  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  CHECK (role IN ('USER', 'ADMIN')),
  CHECK (length(display_name) BETWEEN 1 AND 80),
  -- SQLite no tiene regex. Esto atrapa lo grueso; la forma real la garantiza
  -- normalizePhone() en la app, que es el único lugar que escribe este campo.
  CHECK (contact_phone IS NULL
         OR (contact_phone GLOB '+[1-9]*' AND length(contact_phone) BETWEEN 9 AND 16))
) STRICT;

-- Para buscar admins sin escanear la tabla.
CREATE INDEX profiles_admin_idx ON profiles (role) WHERE role = 'ADMIN';
