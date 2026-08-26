-- ============================================================================
-- 0003 · raffles  ·  el CATÁLOGO, no la grilla
-- ----------------------------------------------------------------------------
-- Reparto de verdades, para que no haya dudas:
--
--   D1  es la verdad de la CONFIGURACIÓN  → título, precio, tier, estado, slug
--   DO  es la verdad del ESTADO           → quién tiene cada número, compradores
--
-- El DO guarda una copia de la config que necesita para validar (dueño, tier,
-- estado, rango) y proyecta sus contadores acá. Si los contadores divergen,
-- gana el DO: se arreglan con resync().
-- ============================================================================

CREATE TABLE raffles (
  id             TEXT    PRIMARY KEY,        -- crypto.randomUUID() en el Worker
  owner_id       TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug           TEXT    NOT NULL UNIQUE,    -- el link que se comparte

  title          TEXT    NOT NULL,
  description    TEXT,
  prize          TEXT,

  tier           TEXT    NOT NULL DEFAULT 'BASIC',
  status         TEXT    NOT NULL DEFAULT 'DRAFT',

  unlock_method  TEXT    NOT NULL DEFAULT 'FREE',
  payment_ref    TEXT,
  paid_at        INTEGER,

  -- ⚠️ CENTAVOS. $2.500,50 se guarda como 250050.
  -- Nunca REAL para dinero: 0.1 + 0.2 no da 0.3.
  ticket_price   INTEGER NOT NULL,
  currency       TEXT    NOT NULL DEFAULT 'ARS',

  total_numbers  INTEGER NOT NULL,
  number_start   INTEGER NOT NULL DEFAULT 0,  -- 0 → 00..99 · 1 → 1..100
  draw_date      TEXT    NOT NULL,            -- ISO 'YYYY-MM-DD'
  contact_phone  TEXT,

  -- ── Proyección del Durable Object · SOLO LECTURA desde la app ────────
  sold_count     INTEGER NOT NULL DEFAULT 0,
  reserved_count INTEGER NOT NULL DEFAULT 0,
  winner_number  INTEGER,
  winner_name    TEXT,
  synced_at      INTEGER,
  -- ─────────────────────────────────────────────────────────────────────

  published_at   INTEGER,
  closed_at      INTEGER,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at     INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  CHECK (tier          IN ('BASIC', 'PRO')),
  CHECK (status        IN ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED')),
  CHECK (unlock_method IN ('FREE', 'VOUCHER', 'PAYMENT')),
  CHECK (currency = 'ARS'),

  CHECK (length(title) BETWEEN 3 AND 100),
  CHECK (description IS NULL OR length(description) <= 500),
  CHECK (prize       IS NULL OR length(prize)       <= 200),

  CHECK (ticket_price > 0 AND ticket_price <= 1000000000),
  CHECK (number_start IN (0, 1)),
  CHECK (draw_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),

  -- El límite de números depende del plan, y lo aplica la base: no depende de
  -- que el formulario de turno se acuerde de chequearlo.
  CHECK (total_numbers >= 1
         AND total_numbers <= (CASE WHEN tier = 'PRO' THEN 10000 ELSE 1000 END)),

  -- Una rifa publicada sin teléfono es una rifa donde nadie puede comprar.
  CHECK (status <> 'PUBLISHED' OR contact_phone IS NOT NULL),

  -- El ganador tiene que caer dentro del rango real.
  CHECK (winner_number IS NULL
         OR (winner_number >= number_start
             AND winner_number < number_start + total_numbers)),

  CHECK (sold_count >= 0 AND reserved_count >= 0),
  CHECK (sold_count + reserved_count <= total_numbers)
) STRICT;

-- Listado del dashboard: por dueño, más recientes primero.
CREATE INDEX raffles_owner_idx ON raffles (owner_id, created_at DESC);

-- Resolución del link público por slug ya la cubre el UNIQUE de la columna.
CREATE INDEX raffles_public_idx ON raffles (status)
  WHERE status IN ('PUBLISHED', 'CLOSED');
