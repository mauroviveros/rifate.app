# 04 · RLS y roles

> ## ⚠️ SUPERADO POR LA DECISIÓN DE STACK
>
> Se decidió ir a **Cloudflare Workers + D1 + Better Auth**, priorizando el
> aprendizaje del stack por encima de la eficiencia de construcción.
> **D1 no tiene RLS.** Toda esta matriz pasa a ser una capa de autorización en TypeScript. El contenido sigue siendo la especificación de QUÉ debe permitirse — cambia el CÓMO.
>
> Ver [README · decisiones](./README.md).

---

> SQL en [`docs/sql/…_rls.sql`](./sql/20260824120700_rls.sql).

## Los actores

| Actor | Rol Postgres | Cómo se identifica |
|---|---|---|
| Visitante sin cuenta | `anon` | No se identifica. `auth.uid()` es null |
| Organizador | `authenticated` | `auth.uid()` = su `profiles.id` |
| Admin | `authenticated` + `is_admin()` | `profiles.role = 'ADMIN'` |
| Sistema (webhooks, cron) | `service_role` | Bypassea RLS. **Nunca en el navegador** |

## La decisión central: el visitante no toca tablas

`anon` no tiene ningún GRANT sobre ninguna tabla base. Accede por dos vistas.

**Por qué, concretamente:**

> **RLS filtra FILAS, no COLUMNAS.**

Si el visitante tuviera una policy de SELECT sobre `raffles`, un `?select=*`
le devolvería `owner_id`, `unlock_method`, `payment_ref` y `paid_at`.

Y esto es lo grave: si tuviera policy sobre `raffle_numbers`, un `?select=*` le
devolvería `buyer_id`. Con eso puede cruzar qué números tiene cada comprador —
y aunque no vea el nombre, agrupar por `buyer_id` ya le dice "esta persona compró
los números 12, 45 y 77".

En v1 esto se "resuelve" pidiendo sólo algunas columnas:

```ts
const PUBLIC_SELECT = '*, numbers:raffle_numbers(number, status)';
```

Pero eso es el *cliente* pidiendo poco, no el *servidor* dando poco. Cualquiera
puede armar el request a PostgREST a mano y pedir todo. **No es una restricción,
es una convención.**

### Las dos vistas

```sql
create view public.public_raffles as
select id, slug, title, description, prize, tier, status, ticket_price,
       currency, total_numbers, number_start, draw_date, contact_phone,
       winner_number, published_at, closed_at
from public.raffles
where status in ('PUBLISHED', 'CLOSED');
```

Excluye `owner_id`, `unlock_method`, `payment_ref`, `paid_at`, `winner_buyer_id`.

```sql
create view public.public_raffle_numbers as
select n.raffle_id, n.number, n.status, n.reserved_until
from public.raffle_numbers n
join public.raffles r on r.id = n.raffle_id
where r.status in ('PUBLISHED', 'CLOSED');
```

Excluye `buyer_id` y `order_id`. **El visitante ve QUÉ está ocupado, nunca POR QUIÉN.**

`CLOSED` se incluye a propósito: alguien tiene que poder abrir el link viejo que
le quedó en el chat y ver quién ganó.

> **Nota técnica.** Estas vistas son SECURITY DEFINER (el default de Postgres
> para vistas). Es deliberado: su `WHERE` es toda la frontera de seguridad, y una
> condición fija en un solo lugar es más fácil de auditar que grants por columna
> repartidos.
> El linter de Supabase las va a marcar como advertencia — es un falso positivo
> acá. **Pero hay una condición que hay que respetar:** las vistas funcionan
> porque su dueño (`postgres`) es también el dueño de las tablas y por lo tanto
> no está sujeto a RLS. Si alguna vez se corre
> `alter table … force row level security`, las vistas dejan de devolver filas.

## Matriz de permisos

`✅` permitido · `❌` denegado · `🔒` sólo vía función RPC

### Tablas base

| Tabla | Operación | `anon` | Organizador (propio) | Organizador (ajeno) | Admin |
|---|---|:--:|:--:|:--:|:--:|
| `profiles` | select | ❌ | ✅ | ❌ | ✅ |
| | insert | ❌ | ✅ | ❌ | ✅ |
| | update | ❌ | ✅ ¹ | ❌ | ✅ |
| | delete | ❌ | ❌ ² | ❌ | ❌ |
| `raffles` | select | ❌ | ✅ | ❌ | ✅ |
| | insert | ❌ | ✅ ³ | — | ✅ |
| | update | ❌ | ✅ | ❌ | ✅ |
| | delete | ❌ | ✅ ⁴ | ❌ | ✅ |
| `raffle_buyers` | select | ❌ | ✅ | ❌ | ✅ |
| | insert/update/delete | ❌ | ✅ | ❌ | ✅ |
| `raffle_numbers` | select | ❌ | ✅ | ❌ | ✅ |
| | insert | ❌ | ❌ ⁵ | ❌ | ❌ |
| | update | ❌ | ✅ ⁶ | ❌ | ❌ |
| | delete | ❌ | ❌ ⁵ | ❌ | ❌ |
| `raffle_orders` | select | ❌ ⁷ | ✅ | ❌ | ✅ |
| | insert | 🔒 | 🔒 | 🔒 | 🔒 |
| | update | ❌ | ✅ | ❌ | ✅ |
| `vouchers` | todo | ❌ | ❌ | ❌ | ✅ |
| `voucher_redemptions` | select | ❌ | ✅ propias | ❌ | ✅ |
| | insert | ❌ | 🔒 | ❌ | ✅ |

1. El cambio de `role` lo revierte el trigger `profiles_guard_role`.
2. Se borra en cascada al borrar la cuenta en `auth.users`.
3. Sólo con `status = 'DRAFT'` y `unlock_method = 'FREE'`. El tier no se
   auto-otorga: se mueve por canje de voucher o por el webhook de pago.
4. Bloqueado por trigger si hay números vendidos: una rifa con ventas se
   **cancela**, no se borra. Borrarla destruye el registro de a quién le
   corresponde cada número.
5. Sin policy = denegado. Las filas las materializa el trigger al crear la rifa.
   Nadie inserta números a mano.
6. Para bloquear un número o dejarle una nota. Las ventas y reservas van por RPC.
   Un trigger valida que el `buyer_id`/`order_id` que se escriba pertenezca a la
   misma rifa — las FK garantizan que la fila existe, no que sea de esta rifa.
7. El visitante consulta su propio pedido con `get_order_by_token()`.

### Vistas públicas

| Vista | `anon` | `authenticated` |
|---|:--:|:--:|
| `public_raffles` | ✅ select | ✅ select |
| `public_raffle_numbers` | ✅ select | ✅ select |

### Funciones RPC

En Postgres, **toda función nueva otorga EXECUTE a `PUBLIC` por defecto.** Hay
que revocarlo explícitamente y volver a otorgarlo. Es un error fácil de cometer y
difícil de notar.

| Función | `anon` | Organizador | Admin | Validación interna |
|---|:--:|:--:|:--:|---|
| `create_raffle_order` | ✅ | ✅ | ✅ | rifa PUBLISHED + tier PRO + máx 50 números |
| `get_order_by_token` | ✅ | ✅ | ✅ | el token es la credencial |
| `confirm_raffle_order` | ❌ | ✅ | ✅ | `owns_raffle()` |
| `cancel_raffle_order` | ❌ | ✅ | ✅ | `owns_raffle()` |
| `sell_raffle_numbers` | ❌ | ✅ | ✅ | `owns_raffle()` |
| `release_raffle_numbers` | ❌ | ✅ | ✅ | `owns_raffle()` |
| `draw_raffle_winner` | ❌ | ✅ | ✅ | `owns_raffle()` |
| `redeem_voucher` | ❌ | ✅ | ✅ | `owns_raffle()` + vigencia + usos |
| `upsert_raffle_buyer` | ❌ | ❌ | ❌ | interna |
| `expire_raffle_orders` | ❌ | ❌ | ❌ | sólo cron |

> **Por qué `raffle_orders` no tiene policy de INSERT** aunque el visitante crea
> pedidos: si `anon` pudiera insertar por PostgREST, un bot llenaría la tabla de
> pedidos basura y reservaría toda la grilla de cualquier rifa publicada. Pasando
> por `create_raffle_order()`, la función valida que la rifa esté publicada, que
> sea PRO y que no pida más de 50 números, todo del lado del servidor.

## Los helpers y la recursión infinita

```sql
create or replace function public.is_admin()
returns boolean language sql stable
security definer                      -- ← clave
set search_path = public, pg_temp     -- ← obligatorio
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  );
$$;
```

Dos cosas que no son opcionales:

**`security definer`** — `is_admin()` se usa *dentro* de la policy de `profiles`
y consulta `profiles`. Si corriera con los permisos de quien llama, evaluar la
policy dispararía la evaluación de la policy, y Postgres cortaría con
`42P17: infinite recursion detected in policy`. Como SECURITY DEFINER corre con
los permisos del dueño, que no está sujeto a RLS, la consulta interna no vuelve
a evaluar policies.

**`set search_path`** — en toda función SECURITY DEFINER. Sin eso, alguien que
pueda manipular el `search_path` de la sesión puede hacer que una llamada sin
esquema resuelva a una función suya, que se ejecutaría con permisos de `postgres`.
Es el vector de escalada clásico de Postgres.

Mismo patrón en `owns_raffle()` y `raffle_is_public()`.

## Cómo probar que esto funciona

Escribir la policy no alcanza: hay que verificar que **deniega**. Chequeo mínimo
antes de dar por buena la fase:

```sql
-- Como anon: las tablas base tienen que fallar, las vistas tienen que andar.
set role anon;
select * from raffle_buyers;            -- ✗ permission denied
select * from raffle_numbers;           -- ✗ permission denied
select * from public_raffles;           -- ✓ sólo PUBLISHED/CLOSED
select * from public_raffle_numbers;    -- ✓ sin buyer_id

-- Como organizador B mirando la rifa de A:
select set_config('request.jwt.claims', '{"sub":"<uuid-B>","role":"authenticated"}', true);
set role authenticated;
select * from raffles where id = '<rifa-de-A>';        -- ✓ 0 filas
select * from raffle_buyers where raffle_id = '<de-A>'; -- ✓ 0 filas
select public.sell_raffle_numbers('<rifa-de-A>', '{1}', 'X');  -- ✗ FORBIDDEN

-- Escalada de privilegios:
update profiles set role = 'ADMIN' where id = '<uuid-B>';
select role from profiles where id = '<uuid-B>';        -- ✓ sigue USER
```

> El test que más importa es el que espera **cero filas** o un error. Una policy
> mal escrita casi siempre se manifiesta permitiendo de más, no de menos, y eso
> nunca rompe la app: sólo filtra datos en silencio.
