-- =============================================================================
-- 03 · raffles
-- =============================================================================

-- unaccent viene como extensión pero requiere habilitarla en el proyecto.
-- Este fallback evita depender de eso para las vocales que importan en español.
create or replace function public.unaccent_fallback(p_text text)
returns text
language sql
immutable
as $$
  select translate(
    p_text,
    'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
  );
$$;

-- Genera un slug legible a partir del título. El slug es lo que va en el link
-- que se comparte por WhatsApp: /r/rifa-del-club-2026 en vez de un uuid.
create or replace function public.slugify(p_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(public.unaccent_fallback(p_text)),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$;

create table public.raffles (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,

  -- Identificador público del link compartido. Único global.
  slug           text not null unique,

  title          text not null,
  description    text,
  prize          text,

  tier           public.raffle_tier   not null default 'BASIC',
  status         public.raffle_status not null default 'DRAFT',

  -- Trazabilidad de por qué la rifa está habilitada, sin montar todavía
  -- tablas de facturación. Cuando entre Mercado Pago, `payment_ref` guarda
  -- el id del pago y no hay que migrar nada.
  unlock_method  public.raffle_unlock not null default 'FREE',
  payment_ref    text,
  paid_at        timestamptz,

  ticket_price   numeric(12, 2) not null,
  currency       char(3) not null default 'ARS',

  total_numbers  integer  not null,
  -- 0 → rifa 00..99 (bolillero). 1 → rifa 1..100. Los dos formatos existen
  -- en la calle, así que es un dato de la rifa y no una constante del código.
  number_start   smallint not null default 0,

  draw_date      date not null,

  -- Teléfono al que llegan los mensajes de esta rifa. Si es null, la app cae
  -- al `contact_phone` del perfil del organizador.
  contact_phone  text,

  -- Resultado del sorteo.
  winner_number    integer,
  winner_buyer_id  uuid,

  published_at   timestamptz,
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint raffles_title_len       check (char_length(title) between 3 and 100),
  constraint raffles_description_len check (description is null or char_length(description) <= 500),
  constraint raffles_prize_len       check (prize is null or char_length(prize) <= 200),
  constraint raffles_price_positive  check (ticket_price > 0 and ticket_price <= 10000000),
  constraint raffles_number_start    check (number_start in (0, 1)),
  constraint raffles_phone_format    check (
    contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'
  ),

  -- El límite de números depende del tipo de rifa. Se valida en la base para
  -- que no dependa de que la action de turno se acuerde de chequearlo.
  constraint raffles_total_numbers_by_tier check (
    total_numbers >= 1
    and total_numbers <= (case when tier = 'PRO' then 10000 else 1000 end)
  ),

  -- El ganador tiene que caer dentro del rango real de la rifa.
  constraint raffles_winner_in_range check (
    winner_number is null
    or (winner_number >= number_start and winner_number < number_start + total_numbers)
  ),

  -- Una rifa publicada necesita sí o sí un teléfono de contacto resoluble;
  -- esto se completa en la action leyendo el perfil si vino vacío.
  constraint raffles_published_needs_phone check (
    status <> 'PUBLISHED' or contact_phone is not null
  )
);

create index raffles_owner_id_idx    on public.raffles (owner_id);
create index raffles_status_idx      on public.raffles (status) where status in ('PUBLISHED', 'CLOSED');
create index raffles_draw_date_idx   on public.raffles (draw_date);

comment on column public.raffles.number_start is
  '0 para rifas 00..99, 1 para rifas 1..N. El padding de dígitos se deriva de total_numbers.';
comment on column public.raffles.tier is
  'BASIC: administración manual. PRO: además habilita pedidos con reserva desde la página pública.';

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger raffles_set_updated_at
  before update on public.raffles
  for each row execute function public.set_updated_at();

create or replace function public.normalize_raffle_phone()
returns trigger
language plpgsql
as $$
begin
  new.contact_phone := public.normalize_phone(new.contact_phone);
  return new;
end;
$$;

create trigger raffles_normalize_phone
  before insert or update of contact_phone on public.raffles
  for each row execute function public.normalize_raffle_phone();

-- Slug único: se arma del título y, si ya existe, se le agrega un sufijo corto.
create or replace function public.assign_raffle_slug()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base   text;
  v_slug   text;
  v_try    int := 0;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  v_base := left(coalesce(nullif(public.slugify(new.title), ''), 'rifa'), 60);
  v_slug := v_base;

  while exists (select 1 from public.raffles r where r.slug = v_slug) loop
    v_try  := v_try + 1;
    v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    exit when v_try > 10;
  end loop;

  new.slug := v_slug;
  return new;
end;
$$;

create trigger raffles_assign_slug
  before insert on public.raffles
  for each row execute function public.assign_raffle_slug();

-- Sella las fechas de los cambios de estado sin que la app tenga que acordarse.
create or replace function public.stamp_raffle_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'PUBLISHED' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.status in ('CLOSED', 'CANCELLED') and new.closed_at is null then
    new.closed_at := now();
  end if;

  return new;
end;
$$;

create trigger raffles_stamp_status
  before insert or update of status on public.raffles
  for each row execute function public.stamp_raffle_status();
