-- ============================================================================
-- 0006 · rateLimit  ·  esquema de Better Auth
-- ----------------------------------------------------------------------------
-- Better Auth crea esta tabla sólo si `rateLimit.storage === 'database'`, que
-- es lo que configuramos en src/lib/auth/index.ts. Con el default ("memory")
-- el límite sería por isolate y no global: en Workers eso no limita nada.
--
-- Los campos salen del código instalado de @better-auth/core 1.7.2
-- (db/get-tables.mjs): key TEXT UNIQUE, count number, lastRequest number.
-- NO se generó con `@better-auth/cli`, que pinea su propia copia de
-- better-auth en 1.4.21 y ya nos hizo perder la columna `account.issuer`.
--
-- Sin STRICT, igual que 0000_better_auth.sql: es esquema de librería y se
-- imita su estilo, no el nuestro.
-- ============================================================================

create table "rateLimit" (
  "id"          text    not null primary key,
  "key"         text    not null unique,
  "count"       integer not null,
  "lastRequest" integer not null
);
