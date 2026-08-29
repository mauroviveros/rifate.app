-- Migration number: 0002    2026-08-27T00:32:43.384Z
-- ============================================================================
-- 0002 · account.issuer
-- ----------------------------------------------------------------------------
-- @better-auth/cli@1.4.21 generó 0000_better_auth.sql usando su copia interna
-- de better-auth 1.4.21, que no tiene esta columna. El runtime real corre
-- better-auth 1.7.2 y la necesita (SELECT en internal-adapter.mjs). SQLite
-- exige un DEFAULT para agregar una columna NOT NULL a una tabla existente,
-- aunque esté vacía — nunca se va a leer, better-auth completa el valor real
-- en cada INSERT.
-- ============================================================================

ALTER TABLE account ADD COLUMN issuer TEXT NOT NULL DEFAULT '';
