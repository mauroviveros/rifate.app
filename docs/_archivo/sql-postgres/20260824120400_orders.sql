-- =============================================================================
-- 05 · raffle_orders  (flujo PRO)
-- =============================================================================
-- Un "pedido" es lo que genera el visitante desde la página pública cuando
-- preselecciona números y manda el WhatsApp. Reserva los números por un tiempo
-- limitado para que dos personas no pidan el mismo, y le da al organizador una
-- bandeja de entrada donde confirmar o rechazar con un click en vez de tener
-- que cargar la venta a mano leyendo el chat.
--
-- Sólo aplica a rifas tier = 'PRO'. Es el diferencial concreto del plan.

create table public.raffle_orders (
  id           uuid primary key default gen_random_uuid(),
  raffle_id    uuid not null references public.raffles (id) on delete cascade,

  -- Código corto para referenciar el pedido en el mensaje de WhatsApp
  -- ("Pedido #A3F91C"). Más usable que un uuid en una conversación.
  code         text not null unique
                 default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),

  -- Token secreto que se le entrega al visitante en la URL de vuelta. Le
  -- permite consultar el estado de SU pedido sin tener cuenta. No es adivinable.
  visitor_token uuid not null default gen_random_uuid(),

  -- Datos que dejó el visitante. Se guardan acá (y no en raffle_buyers) porque
  -- todavía no es un comprador: puede no concretar nunca.
  buyer_name   text not null,
  buyer_phone  text,

  -- Se completa cuando el organizador confirma el pedido.
  buyer_id     uuid references public.raffle_buyers (id) on delete set null,

  status       public.raffle_order_status not null default 'PENDING',
  expires_at   timestamptz not null,

  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint raffle_orders_name_len  check (char_length(buyer_name) between 1 and 100),
  constraint raffle_orders_phone_fmt check (
    buyer_phone is null or buyer_phone ~ '^\+[1-9][0-9]{7,14}$'
  ),
  constraint raffle_orders_confirmed_has_buyer check (
    status <> 'CONFIRMED' or buyer_id is not null
  )
);

create index raffle_orders_raffle_id_idx on public.raffle_orders (raffle_id);
create index raffle_orders_pending_idx   on public.raffle_orders (raffle_id, created_at desc)
  where status = 'PENDING';
create index raffle_orders_expiring_idx  on public.raffle_orders (expires_at)
  where status = 'PENDING';

comment on column public.raffle_orders.visitor_token is
  'Secreto que permite al visitante anónimo consultar su propio pedido. Nunca se expone en listados.';

create trigger raffle_orders_set_updated_at
  before update on public.raffle_orders
  for each row execute function public.set_updated_at();

create or replace function public.normalize_order_phone()
returns trigger
language plpgsql
as $$
begin
  new.buyer_phone := public.normalize_phone(new.buyer_phone);
  return new;
end;
$$;

create trigger raffle_orders_normalize_phone
  before insert or update of buyer_phone on public.raffle_orders
  for each row execute function public.normalize_order_phone();

-- Cierra la FK que quedó pendiente en la migración 04.
alter table public.raffle_numbers
  add constraint raffle_numbers_order_fk
  foreign key (order_id) references public.raffle_orders (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Integridad entre rifas
-- -----------------------------------------------------------------------------
-- La policy raffle_numbers_update_owner deja que el organizador edite las filas
-- de SU rifa, pero RLS no valida el CONTENIDO de lo que escribe: podría setear
-- un buyer_id o un order_id que pertenece a otra rifa suya y mezclar los datos.
-- Las FK sólo garantizan que la fila referenciada existe, no que sea de la
-- misma rifa. Este trigger cierra esa puerta.

create or replace function public.validate_number_references()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.buyer_id is not null and not exists (
    select 1 from public.raffle_buyers b
    where b.id = new.buyer_id and b.raffle_id = new.raffle_id
  ) then
    raise exception 'BUYER_FROM_ANOTHER_RAFFLE' using errcode = 'P0001';
  end if;

  if new.order_id is not null and not exists (
    select 1 from public.raffle_orders o
    where o.id = new.order_id and o.raffle_id = new.raffle_id
  ) then
    raise exception 'ORDER_FROM_ANOTHER_RAFFLE' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger raffle_numbers_validate_refs
  before insert or update of buyer_id, order_id on public.raffle_numbers
  for each row execute function public.validate_number_references();
