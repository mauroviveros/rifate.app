-- =============================================================================
-- 06 · vouchers  (habilitación de rifas sin pago)
-- =============================================================================
-- El modelo de precio es POR RIFA, no por suscripción: al crear una rifa se
-- elige BASIC (barato) o PRO (un poco más caro) y se paga esa rifa.
-- Los vouchers son la vía para regalar rifas: promos, casos benéficos, pruebas,
-- early adopters. Sólo el ADMIN los emite; ese es el motivo por el que existe
-- el rol admin y no una decoración "por las dudas".

create table public.vouchers (
  id          uuid primary key default gen_random_uuid(),

  -- Se guarda siempre en mayúsculas (trigger). Es lo que la persona tipea.
  code        text not null unique,

  -- Qué tipo de rifa habilita este voucher.
  tier        public.raffle_tier not null default 'BASIC',

  max_uses    integer not null default 1,
  used_count  integer not null default 0,

  expires_at  timestamptz,
  note        text,

  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint vouchers_code_format check (code ~ '^[A-Z0-9-]{4,32}$'),
  constraint vouchers_max_uses    check (max_uses between 1 and 10000),
  constraint vouchers_used_count  check (used_count >= 0 and used_count <= max_uses),
  constraint vouchers_note_len    check (note is null or char_length(note) <= 280)
);

create trigger vouchers_set_updated_at
  before update on public.vouchers
  for each row execute function public.set_updated_at();

create or replace function public.normalize_voucher_code()
returns trigger
language plpgsql
as $$
begin
  new.code := upper(trim(new.code));
  return new;
end;
$$;

create trigger vouchers_normalize_code
  before insert or update of code on public.vouchers
  for each row execute function public.normalize_voucher_code();

-- -----------------------------------------------------------------------------
-- voucher_redemptions
-- -----------------------------------------------------------------------------
-- Registro de uso. Tabla aparte (y no un contador suelto) para poder auditar
-- quién canjeó qué y en qué rifa.

create table public.voucher_redemptions (
  id          uuid primary key default gen_random_uuid(),
  voucher_id  uuid not null references public.vouchers (id) on delete cascade,

  -- Una rifa se habilita con un solo voucher.
  raffle_id   uuid not null unique references public.raffles (id) on delete cascade,

  redeemed_by uuid not null references public.profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now()
);

create index voucher_redemptions_voucher_idx on public.voucher_redemptions (voucher_id);
create index voucher_redemptions_user_idx    on public.voucher_redemptions (redeemed_by);
