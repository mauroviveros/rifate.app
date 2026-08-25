-- =============================================================================
-- 08 · Row Level Security
-- =============================================================================
-- ESTRATEGIA
--
-- Hay tres actores y se resuelven distinto a propósito:
--
--   anon           → visitante sin cuenta. NO puede leer ninguna tabla base.
--                    Ve el mundo únicamente a través de dos vistas públicas que
--                    exponen sólo las columnas que corresponden.
--   authenticated  → organizador. Ve y escribe lo suyo, vía owns_raffle().
--   ADMIN          → is_admin(). Emite vouchers y tiene lectura global.
--
-- Por qué vistas y no policies sobre las tablas base para el visitante:
-- RLS filtra FILAS, no COLUMNAS. Si el visitante tuviera una policy de SELECT
-- sobre `raffles`, un `select=*` le devolvería también payment_ref, owner_id y
-- unlock_method. Y sobre `raffle_numbers` le devolvería buyer_id, con lo cual
-- podría cruzar quién compró qué. Las vistas recortan la superficie a nivel
-- columna, que es exactamente el control que hace falta.
--
-- Estas vistas son SECURITY DEFINER (el default de Postgres). Es deliberado:
-- su cláusula WHERE es toda la frontera de seguridad, y una condición fija en
-- un solo lugar es mucho más auditable que un set de grants por columna.
-- El linter de Supabase va a marcarlas — es un falso positivo acá.

-- -----------------------------------------------------------------------------
-- Superficie pública (visitante anónimo)
-- -----------------------------------------------------------------------------

create view public.public_raffles
with (security_barrier = true) as
select
  r.id,
  r.slug,
  r.title,
  r.description,
  r.prize,
  r.tier,
  r.status,
  r.ticket_price,
  r.currency,
  r.total_numbers,
  r.number_start,
  r.draw_date,
  r.contact_phone,
  r.winner_number,
  r.published_at,
  r.closed_at
from public.raffles r
where r.status in ('PUBLISHED', 'CLOSED');

comment on view public.public_raffles is
  'Única lectura de rifas para visitantes sin cuenta. Excluye owner_id, unlock_method, payment_ref, paid_at y winner_buyer_id.';

create view public.public_raffle_numbers
with (security_barrier = true) as
select
  n.raffle_id,
  n.number,
  n.status,
  n.reserved_until
from public.raffle_numbers n
join public.raffles r on r.id = n.raffle_id
where r.status in ('PUBLISHED', 'CLOSED');

comment on view public.public_raffle_numbers is
  'Estado de la grilla para visitantes. Excluye buyer_id y order_id: el visitante ve QUÉ está ocupado, nunca POR QUIÉN.';

revoke all on public.public_raffles         from public;
revoke all on public.public_raffle_numbers  from public;
grant select on public.public_raffles        to anon, authenticated;
grant select on public.public_raffle_numbers to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Habilitar RLS en todas las tablas base
-- -----------------------------------------------------------------------------
-- Sin esto, las policies de abajo no se aplican y la tabla queda abierta a
-- cualquiera que tenga el grant. Es el error de configuración más común.

alter table public.profiles            enable row level security;
alter table public.raffles             enable row level security;
alter table public.raffle_buyers       enable row level security;
alter table public.raffle_numbers      enable row level security;
alter table public.raffle_orders       enable row level security;
alter table public.vouchers            enable row level security;
alter table public.voucher_redemptions enable row level security;

-- El visitante anónimo no toca ninguna tabla base, sólo las vistas de arriba.
revoke all on public.profiles            from anon;
revoke all on public.raffles             from anon;
revoke all on public.raffle_buyers       from anon;
revoke all on public.raffle_numbers      from anon;
revoke all on public.raffle_orders       from anon;
revoke all on public.vouchers            from anon;
revoke all on public.voucher_redemptions from anon;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
-- Los perfiles no son públicos: guardan el teléfono personal del organizador.
-- La página pública de la rifa muestra el contacto de LA RIFA, no el del perfil.

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

-- El cambio de `role` lo bloquea el trigger profiles_guard_role (migración 02).
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- -----------------------------------------------------------------------------
-- raffles
-- -----------------------------------------------------------------------------

create policy raffles_select_own on public.raffles
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

-- Una rifa nace en borrador y sin habilitar. El tier y unlock_method sólo se
-- mueven por RPC (canje de voucher) o por el webhook de pago (service_role).
create policy raffles_insert_own on public.raffles
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'DRAFT'
    and unlock_method = 'FREE'
  );

create policy raffles_update_own on public.raffles
  for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());

create policy raffles_delete_own on public.raffles
  for delete to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

-- Borrar una rifa con ventas destruye el registro de a quién le corresponde
-- cada número. Se cancela, no se borra.
create or replace function public.prevent_sold_raffle_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.raffle_numbers n
    where n.raffle_id = old.id and n.status = 'SOLD'
  ) then
    raise exception 'RAFFLE_HAS_SALES'
      using detail = 'La rifa tiene números vendidos. Cancelala en lugar de borrarla.';
  end if;

  return old;
end;
$$;

create trigger raffles_prevent_sold_delete
  before delete on public.raffles
  for each row execute function public.prevent_sold_raffle_delete();

-- -----------------------------------------------------------------------------
-- raffle_buyers
-- -----------------------------------------------------------------------------
-- Tabla con nombres y teléfonos de personas reales. Acceso exclusivo del dueño
-- de la rifa. No hay ninguna policy que la exponga a anon, ni por vista.

create policy raffle_buyers_all_owner on public.raffle_buyers
  for all to authenticated
  using (public.owns_raffle(raffle_id) or public.is_admin())
  with check (public.owns_raffle(raffle_id));

-- -----------------------------------------------------------------------------
-- raffle_numbers
-- -----------------------------------------------------------------------------
-- INSERT y DELETE no tienen policy a propósito: las filas las materializa el
-- trigger seed_raffle_numbers y las ajusta resize_raffle_numbers. Nadie inserta
-- números a mano. Sin policy = denegado.

create policy raffle_numbers_select_owner on public.raffle_numbers
  for select to authenticated
  using (public.owns_raffle(raffle_id) or public.is_admin());

-- Permite bloquear un número o dejarle una nota desde el dashboard. Las ventas
-- y reservas pasan por las funciones RPC.
create policy raffle_numbers_update_owner on public.raffle_numbers
  for update to authenticated
  using (public.owns_raffle(raffle_id))
  with check (public.owns_raffle(raffle_id));

-- -----------------------------------------------------------------------------
-- raffle_orders
-- -----------------------------------------------------------------------------
-- Sólo lectura para el organizador. La creación es exclusiva de
-- create_raffle_order() y las transiciones de estado de confirm/cancel/expire.
-- No hay policy de INSERT: un bot no puede spamear pedidos por PostgREST,
-- tiene que pasar por la función, que valida tier, estado y cantidad.

create policy raffle_orders_select_owner on public.raffle_orders
  for select to authenticated
  using (public.owns_raffle(raffle_id) or public.is_admin());

create policy raffle_orders_update_owner on public.raffle_orders
  for update to authenticated
  using (public.owns_raffle(raffle_id))
  with check (public.owns_raffle(raffle_id));

-- -----------------------------------------------------------------------------
-- vouchers · voucher_redemptions
-- -----------------------------------------------------------------------------

create policy vouchers_all_admin on public.vouchers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- El organizador ve sus propios canjes (para mostrarlos en la rifa);
-- el admin los ve todos. Insertar es exclusivo de redeem_voucher().
create policy voucher_redemptions_select on public.voucher_redemptions
  for select to authenticated
  using (redeemed_by = (select auth.uid()) or public.is_admin());

create policy voucher_redemptions_admin on public.voucher_redemptions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Permisos de ejecución de las funciones RPC
-- -----------------------------------------------------------------------------
-- Postgres otorga EXECUTE a PUBLIC por defecto en toda función nueva. Hay que
-- revocarlo explícitamente y volver a otorgarlo sólo a quien corresponde.

revoke all on function public.create_raffle_order(uuid, integer[], text, text, integer) from public;
revoke all on function public.get_order_by_token(uuid)                                   from public;
revoke all on function public.confirm_raffle_order(uuid)                                 from public;
revoke all on function public.cancel_raffle_order(uuid)                                  from public;
revoke all on function public.sell_raffle_numbers(uuid, integer[], text, text, text)     from public;
revoke all on function public.release_raffle_numbers(uuid, integer[])                    from public;
revoke all on function public.draw_raffle_winner(uuid, integer)                          from public;
revoke all on function public.redeem_voucher(text, uuid)                                 from public;

-- Visitante sin cuenta: sólo puede pedir números y consultar su propio pedido.
grant execute on function public.create_raffle_order(uuid, integer[], text, text, integer) to anon, authenticated;
grant execute on function public.get_order_by_token(uuid)                                  to anon, authenticated;

-- Organizador.
grant execute on function public.confirm_raffle_order(uuid)                             to authenticated;
grant execute on function public.cancel_raffle_order(uuid)                              to authenticated;
grant execute on function public.sell_raffle_numbers(uuid, integer[], text, text, text) to authenticated;
grant execute on function public.release_raffle_numbers(uuid, integer[])                to authenticated;
grant execute on function public.draw_raffle_winner(uuid, integer)                      to authenticated;
grant execute on function public.redeem_voucher(text, uuid)                              to authenticated;

-- -----------------------------------------------------------------------------
-- Grants de tabla para `authenticated`
-- -----------------------------------------------------------------------------
-- RLS restringe, no otorga. Si el rol no tiene GRANT sobre la tabla, la policy
-- ni se evalúa: el acceso se rechaza antes. Supabase suele dejar estos grants
-- por default privileges, pero declararlos acá hace que el esquema sea
-- reproducible desde cero en cualquier proyecto nuevo.

grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, update, delete on public.raffles       to authenticated;
grant select, insert, update, delete on public.raffle_buyers to authenticated;
grant select, update                 on public.raffle_numbers to authenticated;
grant select, update                 on public.raffle_orders  to authenticated;
grant select, insert, update, delete on public.vouchers            to authenticated;
grant select, insert, update, delete on public.voucher_redemptions to authenticated;
