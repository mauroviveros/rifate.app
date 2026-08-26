-- =============================================================================
-- 02 · profiles
-- =============================================================================
-- Espejo de auth.users con los datos de la app. auth.users es de Supabase y no
-- se puede extender ni referenciar cómodamente desde PostgREST, por eso toda
-- FK de la app apunta acá y no a auth.users.

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null,
  avatar_url    text,

  -- Teléfono por defecto del organizador. Cada rifa puede pisarlo con el suyo.
  contact_phone text,

  role          public.app_role not null default 'USER',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_display_name_len check (char_length(display_name) between 1 and 80),
  constraint profiles_contact_phone_format check (
    contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{7,14}$'
  )
);

comment on table public.profiles is
  'Datos de aplicación del usuario. Se crea automáticamente al registrarse.';
comment on column public.profiles.role is
  'USER para todos. ADMIN sólo para el operador de la plataforma (emite vouchers).';

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.normalize_profile_phone()
returns trigger
language plpgsql
as $$
begin
  new.contact_phone := public.normalize_phone(new.contact_phone);
  return new;
end;
$$;

create trigger profiles_normalize_phone
  before insert or update of contact_phone on public.profiles
  for each row execute function public.normalize_profile_phone();

-- Blindaje de escalada de privilegios: un usuario puede editar su propio
-- perfil, y la policy de UPDATE se lo permite. Sin esto podría mandar
-- `{ role: 'ADMIN' }` en el mismo update y auto-promoverse. RLS no filtra
-- columnas, así que el bloqueo va acá.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Alta automática del perfil al registrarse (Google OAuth o el provider que sea).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, 'usuario'), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
