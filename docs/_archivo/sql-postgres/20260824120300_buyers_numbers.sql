-- =============================================================================
-- 04 · raffle_buyers + raffle_numbers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- raffle_buyers
-- -----------------------------------------------------------------------------
-- Los compradores viven dentro de una rifa, no son usuarios de la plataforma.
-- Esta tabla es la que reemplaza el cuaderno / el Excel: nombre + teléfono para
-- poder avisarle si ganó. Es la data más sensible del sistema y NUNCA es
-- legible por el visitante anónimo (ver 06-rls).

create table public.raffle_buyers (
  id         uuid primary key default gen_random_uuid(),
  raffle_id  uuid not null references public.raffles (id) on delete cascade,

  name       text not null,
  phone      text,
  note       text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint raffle_buyers_name_len  check (char_length(name) between 1 and 100),
  constraint raffle_buyers_note_len  check (note is null or char_length(note) <= 500),
  constraint raffle_buyers_phone_fmt check (
    phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'
  )
);

create index raffle_buyers_raffle_id_idx on public.raffle_buyers (raffle_id);

-- Un mismo teléfono es una misma persona dentro de una rifa. Evita que el
-- vecino que compró tres veces aparezca como tres compradores distintos.
create unique index raffle_buyers_raffle_phone_key
  on public.raffle_buyers (raffle_id, phone)
  where phone is not null;

create trigger raffle_buyers_set_updated_at
  before update on public.raffle_buyers
  for each row execute function public.set_updated_at();

create or replace function public.normalize_buyer_phone()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.normalize_phone(new.phone);
  return new;
end;
$$;

create trigger raffle_buyers_normalize_phone
  before insert or update of phone on public.raffle_buyers
  for each row execute function public.normalize_buyer_phone();

-- Ahora que existe raffle_buyers se puede cerrar la FK del ganador.
alter table public.raffles
  add constraint raffles_winner_buyer_fk
  foreign key (winner_buyer_id) references public.raffle_buyers (id) on delete set null;

-- -----------------------------------------------------------------------------
-- raffle_numbers
-- -----------------------------------------------------------------------------
-- CAMBIO DE FONDO respecto de v1: las filas se crean TODAS al crear la rifa,
-- no sólo cuando alguien compra.
--
-- Antes "disponible" era la ausencia de fila, lo que obligaba a reconstruir el
-- estado en memoria en cada request y hacía imposible reservar un número o
-- dejarle una nota. Con la grilla materializada:
--   · reservar es un UPDATE con predicado → atómico y sin race conditions
--   · el estado de la rifa es una sola query agregada
--   · cada número puede tener su propia nota / historial
-- Costo: hasta 10.000 filas por rifa. Para Postgres es nada.

create table public.raffle_numbers (
  raffle_id      uuid not null references public.raffles (id) on delete cascade,
  number         integer not null,

  status         public.raffle_number_status not null default 'AVAILABLE',
  buyer_id       uuid references public.raffle_buyers (id) on delete set null,
  order_id       uuid,  -- FK a raffle_orders, se agrega en la migración 05

  -- Sólo tiene sentido con status = 'RESERVED'.
  reserved_until timestamptz,

  sold_at        timestamptz,
  note           text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  primary key (raffle_id, number),

  constraint raffle_numbers_note_len check (note is null or char_length(note) <= 280),

  -- Coherencia de estado. Estas dos reglas son las que impiden que la grilla
  -- quede en un estado imposible (un número vendido sin comprador, o una
  -- reserva sin vencimiento que quedaría trabada para siempre).
  constraint raffle_numbers_sold_has_buyer check (
    status <> 'SOLD' or buyer_id is not null
  ),
  constraint raffle_numbers_reserved_has_deadline check (
    status <> 'RESERVED' or reserved_until is not null
  )
);

create index raffle_numbers_buyer_id_idx on public.raffle_numbers (buyer_id) where buyer_id is not null;
create index raffle_numbers_order_id_idx on public.raffle_numbers (order_id) where order_id is not null;

-- Para el job que libera reservas vencidas.
create index raffle_numbers_expiring_idx
  on public.raffle_numbers (reserved_until)
  where status = 'RESERVED';

create trigger raffle_numbers_set_updated_at
  before update on public.raffle_numbers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Materialización de la grilla
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER porque corre dentro del INSERT de la rifa y tiene que poder
-- escribir en raffle_numbers antes de que exista contexto de policy para esas filas.
create or replace function public.seed_raffle_numbers()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.raffle_numbers (raffle_id, number)
  select new.id, gs
  from generate_series(
    new.number_start,
    new.number_start + new.total_numbers - 1
  ) as gs;

  return new;
end;
$$;

create trigger raffles_seed_numbers
  after insert on public.raffles
  for each row execute function public.seed_raffle_numbers();

-- Si el organizador corrige el tamaño de la rifa mientras está en borrador,
-- la grilla se reajusta. Sólo en DRAFT: una vez publicada, cambiar el rango
-- rompería los números ya vendidos.
create or replace function public.resize_raffle_numbers()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_min int := new.number_start;
  v_new_max int := new.number_start + new.total_numbers - 1;
begin
  if new.total_numbers = old.total_numbers and new.number_start = old.number_start then
    return new;
  end if;

  if old.status <> 'DRAFT' then
    raise exception 'RAFFLE_NOT_RESIZABLE'
      using detail = 'Sólo se puede cambiar el rango de números mientras la rifa está en borrador.';
  end if;

  if exists (
    select 1 from public.raffle_numbers n
    where n.raffle_id = new.id and n.status <> 'AVAILABLE'
  ) then
    raise exception 'RAFFLE_HAS_ASSIGNED_NUMBERS'
      using detail = 'Hay números ya asignados: liberalos antes de cambiar el rango.';
  end if;

  delete from public.raffle_numbers n
  where n.raffle_id = new.id
    and (n.number < v_new_min or n.number > v_new_max);

  insert into public.raffle_numbers (raffle_id, number)
  select new.id, gs
  from generate_series(v_new_min, v_new_max) as gs
  on conflict (raffle_id, number) do nothing;

  return new;
end;
$$;

create trigger raffles_resize_numbers
  after update of total_numbers, number_start on public.raffles
  for each row execute function public.resize_raffle_numbers();
