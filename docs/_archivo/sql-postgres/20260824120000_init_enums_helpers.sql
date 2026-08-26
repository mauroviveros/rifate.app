-- =============================================================================
-- 01 · Extensiones, enums y helpers transversales
-- =============================================================================
-- Este archivo no crea tablas. Define el vocabulario (enums) y las funciones
-- que después usan las policies de RLS y los triggers.

-- Nota: no se usa pgcrypto. gen_random_uuid() es nativo desde PostgreSQL 13,
-- y gen_random_bytes() vive en el esquema `extensions` en Supabase (no en
-- `public`), lo que la haría irresoluble desde defaults de columna.

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Rol de aplicación. Deliberadamente sólo dos valores: no hay sistema de
-- permisos granular porque no hace falta. ADMIN existe para emitir vouchers.
create type public.app_role as enum ('USER', 'ADMIN');

-- Tipo de rifa. Se define al crearla y determina qué features se habilitan.
-- BASIC: el dueño administra números a mano. PRO: además el visitante puede
-- preseleccionar números y generar un pedido con reserva.
create type public.raffle_tier as enum ('BASIC', 'PRO');

-- Cómo se habilitó la rifa (para no tener que armar tablas de facturación
-- todavía, pero sin perder la trazabilidad de por qué está activa).
create type public.raffle_unlock as enum ('FREE', 'VOUCHER', 'PAYMENT');

create type public.raffle_status as enum ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED');

create type public.raffle_number_status as enum ('AVAILABLE', 'RESERVED', 'SOLD', 'BLOCKED');

create type public.raffle_order_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- `updated_at` automático. Se engancha como trigger en cada tabla mutable.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Normaliza un teléfono a E.164 (+549341...). Devuelve null si queda vacío.
-- Se aplica desde triggers para que la base sea la única fuente de verdad del
-- formato, en vez de confiar en que cada formulario lo haga bien.
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  if p_phone is null then
    return null;
  end if;

  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');

  if v_digits = '' then
    return null;
  end if;

  -- Heurística para Argentina: si no vino con código de país, se asume +54.
  if length(v_digits) <= 11 and left(v_digits, 2) <> '54' then
    v_digits := '54' || v_digits;
  end if;

  return '+' || v_digits;
end;
$$;

-- IMPORTANTE: las tres funciones que siguen son SECURITY DEFINER a propósito.
-- Se usan DENTRO de las policies de RLS. Si consultaran las tablas con los
-- permisos del usuario que llama, cada policy dispararía la evaluación de otra
-- policy y Postgres entraría en recursión infinita (error 42P17).
-- `set search_path` es obligatorio en toda función SECURITY DEFINER: sin eso,
-- un search_path manipulado permitiría ejecutar código arbitrario como owner.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  );
$$;

create or replace function public.owns_raffle(p_raffle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.raffles r
    where r.id = p_raffle_id and r.owner_id = auth.uid()
  );
$$;

-- Una rifa es "pública" si está publicada o ya cerrada. CLOSED sigue siendo
-- visible a propósito: el visitante tiene que poder entrar al link viejo y ver
-- el resultado y el ganador.
create or replace function public.raffle_is_public(p_raffle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.raffles r
    where r.id = p_raffle_id and r.status in ('PUBLISHED', 'CLOSED')
  );
$$;
