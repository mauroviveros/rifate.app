-- ============================================================================
-- 0004 · vouchers y canjes
-- ----------------------------------------------------------------------------
-- El precio es POR RIFA, no una suscripción. Los vouchers son la vía para
-- regalar rifas: promos, casos benéficos, early adopters. Sólo el ADMIN emite,
-- y ése es el motivo por el que el rol admin existe.
-- ============================================================================

CREATE TABLE vouchers (
  id         TEXT    PRIMARY KEY,
  code       TEXT    NOT NULL UNIQUE,       -- SIEMPRE en mayúsculas (normaliza la app)
  tier       TEXT    NOT NULL DEFAULT 'BASIC',
  max_uses   INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  note       TEXT,

  created_by TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),

  CHECK (tier IN ('BASIC', 'PRO')),
  CHECK (code GLOB '[A-Z0-9-]*' AND length(code) BETWEEN 4 AND 32),
  CHECK (max_uses BETWEEN 1 AND 10000),
  CHECK (used_count >= 0 AND used_count <= max_uses),
  CHECK (note IS NULL OR length(note) <= 280)
) STRICT;

CREATE TABLE voucher_redemptions (
  id          TEXT    PRIMARY KEY,
  voucher_id  TEXT    NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,

  -- UNIQUE: una rifa se habilita con un solo voucher.
  raffle_id   TEXT    NOT NULL UNIQUE REFERENCES raffles(id) ON DELETE CASCADE,

  redeemed_by TEXT    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redeemed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
) STRICT;

CREATE INDEX voucher_redemptions_voucher_idx ON voucher_redemptions (voucher_id);
CREATE INDEX voucher_redemptions_user_idx    ON voucher_redemptions (redeemed_by);
