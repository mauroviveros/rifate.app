-- =============================================================================
-- 07 · Funciones RPC (la única vía de escritura no trivial)
-- =============================================================================
-- Criterio de diseño: toda operación que toca más de una tabla o que necesita
-- ser atómica vive acá, como función SECURITY DEFINER que valida permisos por
-- su cuenta. La app NO hace inserts sueltos encadenados.
--
-- El motivo es concreto: en v1, vender números eran dos INSERT separados desde
-- Node y, si el segundo fallaba, se borraba el comprador "a mano" (ver
-- src/lib/repositories/raffle.ts). Si el proceso se caía en el medio quedaba
-- basura. Acá cada función es una transacción: o pasa todo o no pasa nada.

-- -----------------------------------------------------------------------------
-- Helper interno: comprador por teléfono dentro de la rifa
-- -----------------------------------------------------------------------------
create or replace function public.upsert_raffle_buyer(
  p_raffle_id uuid,
  p_name      text,
  p_phone     text,
  p_note      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phone    text := public.normalize_phone(p_phone);
  v_buyer_id uuid;
begin
  if v_phone is not null then
    select id into v_buyer_id
    from public.raffle_buyers
    where raffle_id = p_raffle_id and phone = v_phone;

    if found then
      -- Se refresca el nombre por si lo escribió distinto la segunda vez.
      update public.raffle_buyers
         set name = coalesce(nullif(trim(p_name), ''), name),
             note = coalesce(p_note, note)
       where id = v_buyer_id;

      return v_buyer_id;
    end if;
  end if;

  insert into public.raffle_buyers (raffle_id, name, phone, note)
  values (p_raffle_id, trim(p_name), v_phone, p_note)
  returning id into v_buyer_id;

  return v_buyer_id;
end;
$$;

revoke all on function public.upsert_raffle_buyer(uuid, text, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- VISITANTE · crear pedido con reserva  (rifas PRO)
-- -----------------------------------------------------------------------------
create or replace function public.create_raffle_order(
  p_raffle_id   uuid,
  p_numbers     integer[],
  p_buyer_name  text,
  p_buyer_phone text default null,
  p_hold_hours  integer default 24
)
returns table (
  order_id      uuid,
  order_code    text,
  expires_at    timestamptz,
  visitor_token uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_raffle   public.raffles;
  v_order    public.raffle_orders;
  v_expires  timestamptz;
  v_reserved integer;
  v_wanted   integer := coalesce(array_length(p_numbers, 1), 0);
begin
  if v_wanted = 0 then
    raise exception 'NO_NUMBERS_SELECTED' using errcode = 'P0001';
  end if;

  if v_wanted > 50 then
    raise exception 'TOO_MANY_NUMBERS' using errcode = 'P0001';
  end if;

  select * into v_raffle from public.raffles where id = p_raffle_id;

  if not found then
    raise exception 'RAFFLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_raffle.status <> 'PUBLISHED' then
    raise exception 'RAFFLE_NOT_PUBLISHED' using errcode = 'P0001';
  end if;

  -- La reserva desde la página pública es exclusiva del plan PRO.
  if v_raffle.tier <> 'PRO' then
    raise exception 'RAFFLE_NOT_PRO' using errcode = 'P0001';
  end if;

  v_expires := now() + make_interval(hours => greatest(1, least(p_hold_hours, 168)));

  insert into public.raffle_orders (raffle_id, buyer_name, buyer_phone, expires_at)
  values (p_raffle_id, p_buyer_name, p_buyer_phone, v_expires)
  returning * into v_order;

  -- ATOMICIDAD: este UPDATE es el que evita que dos visitantes se lleven el
  -- mismo número. El predicado exige que el número siga disponible (o que su
  -- reserva previa ya haya vencido). Bajo READ COMMITTED, la segunda
  -- transacción espera el lock de fila, vuelve a evaluar el predicado, ya no
  -- matchea, y el conteo de abajo no da → excepción → rollback de todo.
  update public.raffle_numbers n
     set status         = 'RESERVED',
         order_id       = v_order.id,
         reserved_until = v_expires
   where n.raffle_id = p_raffle_id
     and n.number = any (p_numbers)
     and (
       n.status = 'AVAILABLE'
       or (n.status = 'RESERVED' and n.reserved_until < now())
     );

  get diagnostics v_reserved = row_count;

  if v_reserved <> v_wanted then
    raise exception 'NUMBERS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  return query
    select v_order.id, v_order.code, v_order.expires_at, v_order.visitor_token;
end;
$$;

-- -----------------------------------------------------------------------------
-- VISITANTE · consultar su propio pedido
-- -----------------------------------------------------------------------------
-- No se resuelve con RLS porque el visitante es anónimo y no hay auth.uid()
-- contra el que comparar. El token de la URL hace de credencial.
create or replace function public.get_order_by_token(p_token uuid)
returns table (
  order_code text,
  status     public.raffle_order_status,
  expires_at timestamptz,
  numbers    integer[],
  raffle_id  uuid,
  raffle_title text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    o.code,
    o.status,
    o.expires_at,
    coalesce(array_agg(n.number order by n.number) filter (where n.number is not null), '{}'::integer[]),
    r.id,
    r.title
  from public.raffle_orders o
  join public.raffles r on r.id = o.raffle_id
  left join public.raffle_numbers n on n.order_id = o.id
  where o.visitor_token = p_token
  group by o.code, o.status, o.expires_at, r.id, r.title;
$$;

-- -----------------------------------------------------------------------------
-- ORGANIZADOR · confirmar un pedido
-- -----------------------------------------------------------------------------
create or replace function public.confirm_raffle_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order    public.raffle_orders;
  v_buyer_id uuid;
begin
  select * into v_order from public.raffle_orders where id = p_order_id for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.owns_raffle(v_order.raffle_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_order.status <> 'PENDING' then
    raise exception 'ORDER_NOT_PENDING' using errcode = 'P0001';
  end if;

  v_buyer_id := public.upsert_raffle_buyer(
    v_order.raffle_id, v_order.buyer_name, v_order.buyer_phone, null
  );

  update public.raffle_numbers
     set status         = 'SOLD',
         buyer_id       = v_buyer_id,
         reserved_until = null,
         sold_at        = now()
   where order_id = p_order_id
     and status = 'RESERVED';   -- no pisar números liberados o ya vendidos aparte

  if not found then
    raise exception 'ORDER_HAS_NO_RESERVED_NUMBERS' using errcode = 'P0001';
  end if;

  update public.raffle_orders
     set status = 'CONFIRMED', buyer_id = v_buyer_id, confirmed_at = now()
   where id = p_order_id;

  return v_buyer_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- ORGANIZADOR · cancelar un pedido (libera los números)
-- -----------------------------------------------------------------------------
create or replace function public.cancel_raffle_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.raffle_orders;
begin
  select * into v_order from public.raffle_orders where id = p_order_id for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.owns_raffle(v_order.raffle_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_order.status <> 'PENDING' then
    raise exception 'ORDER_NOT_PENDING' using errcode = 'P0001';
  end if;

  update public.raffle_numbers
     set status = 'AVAILABLE', order_id = null, reserved_until = null
   where order_id = p_order_id and status = 'RESERVED';

  update public.raffle_orders
     set status = 'CANCELLED', cancelled_at = now()
   where id = p_order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- ORGANIZADOR · venta manual  (BASIC y PRO)
-- -----------------------------------------------------------------------------
-- Reemplaza a sellRaffleNumbers() de v1, ahora en una sola transacción.
create or replace function public.sell_raffle_numbers(
  p_raffle_id   uuid,
  p_numbers     integer[],
  p_buyer_name  text,
  p_buyer_phone text default null,
  p_note        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_buyer_id uuid;
  v_sold     integer;
  v_wanted   integer := coalesce(array_length(p_numbers, 1), 0);
begin
  if not public.owns_raffle(p_raffle_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_wanted = 0 then
    raise exception 'NO_NUMBERS_SELECTED' using errcode = 'P0001';
  end if;

  v_buyer_id := public.upsert_raffle_buyer(p_raffle_id, p_buyer_name, p_buyer_phone, p_note);

  -- El organizador puede vender un número que estaba reservado por un pedido:
  -- es su rifa y puede haber cobrado por fuera. No puede pisar uno ya vendido.
  update public.raffle_numbers n
     set status         = 'SOLD',
         buyer_id       = v_buyer_id,
         order_id       = null,
         reserved_until = null,
         sold_at        = now()
   where n.raffle_id = p_raffle_id
     and n.number = any (p_numbers)
     and n.status in ('AVAILABLE', 'RESERVED', 'BLOCKED');

  get diagnostics v_sold = row_count;

  if v_sold <> v_wanted then
    raise exception 'NUMBERS_UNAVAILABLE' using errcode = 'P0001';
  end if;

  return v_buyer_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- ORGANIZADOR · liberar números
-- -----------------------------------------------------------------------------
create or replace function public.release_raffle_numbers(
  p_raffle_id uuid,
  p_numbers   integer[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_released integer;
begin
  if not public.owns_raffle(p_raffle_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  update public.raffle_numbers n
     set status         = 'AVAILABLE',
         buyer_id       = null,
         order_id       = null,
         reserved_until = null,
         sold_at        = null
   where n.raffle_id = p_raffle_id
     and n.number = any (p_numbers);

  get diagnostics v_released = row_count;
  return v_released;
end;
$$;

-- -----------------------------------------------------------------------------
-- ORGANIZADOR · sortear ganador
-- -----------------------------------------------------------------------------
-- Si no se pasa número, elige al azar entre los VENDIDOS (que es lo justo:
-- sortear entre todos incluiría números que nadie compró).
create or replace function public.draw_raffle_winner(
  p_raffle_id uuid,
  p_number    integer default null
)
returns table (winner_number integer, buyer_name text, buyer_phone text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_number integer;
  v_buyer  uuid;
begin
  if not public.owns_raffle(p_raffle_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if p_number is null then
    select n.number, n.buyer_id into v_number, v_buyer
    from public.raffle_numbers n
    where n.raffle_id = p_raffle_id and n.status = 'SOLD'
    order by random()
    limit 1;

    if v_number is null then
      raise exception 'NO_SOLD_NUMBERS' using errcode = 'P0001';
    end if;
  else
    select n.number, n.buyer_id into v_number, v_buyer
    from public.raffle_numbers n
    where n.raffle_id = p_raffle_id and n.number = p_number;

    if v_number is null then
      raise exception 'NUMBER_NOT_IN_RAFFLE' using errcode = 'P0002';
    end if;
  end if;

  update public.raffles
     set winner_number   = v_number,
         winner_buyer_id = v_buyer,
         status          = 'CLOSED'
   where id = p_raffle_id;

  -- LEFT JOIN sobre una fila sintética: si el número ganador no tenía
  -- comprador, igual se devuelve el número con nombre/teléfono en null.
  return query
    select v_number, b.name, b.phone
    from (select v_buyer as id) sel
    left join public.raffle_buyers b on b.id = sel.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- ORGANIZADOR · canjear voucher para habilitar una rifa
-- -----------------------------------------------------------------------------
create or replace function public.redeem_voucher(
  p_code      text,
  p_raffle_id uuid
)
returns public.raffle_tier
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_voucher public.vouchers;
begin
  if not public.owns_raffle(p_raffle_id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  -- FOR UPDATE serializa el canje: sin esto, dos canjes simultáneos del último
  -- uso disponible pasarían los dos.
  select * into v_voucher
  from public.vouchers
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'VOUCHER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_voucher.expires_at is not null and v_voucher.expires_at < now() then
    raise exception 'VOUCHER_EXPIRED' using errcode = 'P0001';
  end if;

  if v_voucher.used_count >= v_voucher.max_uses then
    raise exception 'VOUCHER_EXHAUSTED' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.voucher_redemptions where raffle_id = p_raffle_id) then
    raise exception 'RAFFLE_ALREADY_UNLOCKED' using errcode = 'P0001';
  end if;

  insert into public.voucher_redemptions (voucher_id, raffle_id, redeemed_by)
  values (v_voucher.id, p_raffle_id, auth.uid());

  update public.vouchers
     set used_count = used_count + 1
   where id = v_voucher.id;

  update public.raffles
     set tier          = v_voucher.tier,
         unlock_method = 'VOUCHER'
   where id = p_raffle_id;

  return v_voucher.tier;
end;
$$;

-- -----------------------------------------------------------------------------
-- SISTEMA · vencimiento de reservas
-- -----------------------------------------------------------------------------
-- Se agenda con pg_cron (ver docs/05-operacion.md). Es idempotente.
create or replace function public.expire_raffle_orders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expired integer;
begin
  update public.raffle_numbers n
     set status = 'AVAILABLE', order_id = null, reserved_until = null
    from public.raffle_orders o
   where n.order_id = o.id
     and o.status = 'PENDING'
     and o.expires_at < now()
     and n.status = 'RESERVED';

  update public.raffle_orders
     set status = 'EXPIRED'
   where status = 'PENDING' and expires_at < now();

  get diagnostics v_expired = row_count;
  return v_expired;
end;
$$;

revoke all on function public.expire_raffle_orders() from public, anon, authenticated;
