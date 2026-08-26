# 04 · Autorización

> Reemplaza a RLS. La versión Postgres quedó en
> [`_archivo/04-rls-postgres.md`](./_archivo/04-rls-postgres.md): sigue siendo la
> especificación de **qué** debe permitirse. Este documento define **cómo** se
> hace cumplir sin motor de base de datos.

## El problema, dicho sin vueltas

Con RLS, la regla se escribe una vez por tabla y Postgres la aplica siempre,
aunque el código tenga un bug. Sin RLS, **cada consulta tiene que acordarse de
filtrar**. Un solo `WHERE owner_id = ?` olvidado expone los nombres y teléfonos
de los compradores de todas las rifas del sistema.

Y son personas que no aceptaron ningún término de uso: le dieron el teléfono a
la vecina que les vendió el número.

> El objetivo de este diseño no es *recordar* filtrar. Es **hacer que olvidarse
> no compile.**

## Las cinco defensas, de más fuerte a más débil

| # | Mecanismo | Qué atrapa |
|---|---|---|
| 1 | **Tipos que no pueden cargar el secreto** | Fugas por construcción |
| 2 | **Actor obligatorio, sin default** | Consultas sin identidad |
| 3 | **Un solo punto de acceso a los datos** | Consultas fuera de los repositorios |
| 4 | **El DO revalida al dueño** | Un error del Worker |
| 5 | **Tests que afirman denegación** | Errores de lógica |

Las capas 1 y 4 son las que reemplazan de verdad a RLS. Las otras tres son
disciplina.

---

## 1 · Tipos que no pueden cargar el secreto

La defensa más fuerte, y la más barata.

En Postgres, la vista `public_raffle_numbers` recortaba columnas. Acá el
equivalente es que **el tipo de retorno no tenga dónde poner el dato**:

```ts
// src/lib/types/raffle.ts

/** Lo que ve el visitante. No tiene campo para el comprador: no existe. */
export interface PublicNumber {
  number: number;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'BLOCKED';
}

/** Lo que ve el organizador de SU rifa. */
export interface OwnerNumber extends PublicNumber {
  buyerId: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  orderId: string | null;
  reservedUntil: number | null;
  note: string | null;
}
```

> No se puede filtrar lo que el tipo no puede contener. Si `publicGrid()`
> devuelve `PublicNumber[]`, no hay forma de que se escape un teléfono — ni por
> un `select *` distraído, ni por un `JSON.stringify` de más.

**Regla de la casa:** ningún tipo público extiende uno privado ni al revés en la
dirección peligrosa. `OwnerNumber extends PublicNumber` está bien; lo inverso
sería un agujero.

---

## 2 · El actor, obligatorio

```ts
// src/lib/auth/actor.ts

export type Actor =
  | { kind: 'visitor' }
  | { kind: 'organizer'; userId: string }
  | { kind: 'admin'; userId: string };

/** Se resuelve una sola vez, en el middleware, desde la sesión de Better Auth. */
export const actorFromSession = async (
  db: D1Database,
  session: { userId: string } | null,
): Promise<Actor> => {
  if (!session) return { kind: 'visitor' };

  const row = await db
    .prepare('SELECT role FROM profiles WHERE id = ?')
    .bind(session.userId)
    .first<{ role: string }>();

  return row?.role === 'ADMIN'
    ? { kind: 'admin', userId: session.userId }
    : { kind: 'organizer', userId: session.userId };
};

export const isAdmin = (a: Actor): a is Extract<Actor, { kind: 'admin' }> =>
  a.kind === 'admin';

/** Devuelve el userId si el actor tiene cuenta, o null si es visitante. */
export const userIdOf = (a: Actor): string | null =>
  a.kind === 'visitor' ? null : a.userId;
```

Y **todo repositorio lo recibe como primer parámetro, sin default**:

```ts
export const listOwnRaffles = async (
  db: D1Database,
  actor: Actor,           // ← sin `?`, sin valor por defecto
): Promise<RaffleCard[]> => { /* … */ };
```

Si te olvidás del actor, TypeScript no compila. No es una convención: es el
compilador.

---

## 3 · Un solo punto de acceso

El binding crudo **no se usa fuera de `src/lib/db/`**. Las páginas y las actions
no ven `env.DB` nunca.

```ts
// src/lib/db/index.ts — el único módulo que toca el binding.
export { listOwnRaffles, getPublicRaffleBySlug, createRaffle } from './raffles';
export { issueVoucher, redeemVoucher } from './vouchers';
export { getProfile, updateProfile } from './profiles';
// No se exporta el D1Database.
```

Reforzado con ESLint, para que el intento de atajo falle en CI:

```js
// eslint.config.mjs
{
  files: ['src/pages/**', 'src/actions/**', 'src/components/**'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "MemberExpression[property.name='DB']",
        message: 'No accedas a env.DB directamente. Usá un repositorio de src/lib/db/.',
      },
    ],
  },
}
```

---

## 4 · El Durable Object revalida al dueño

**Esta es la que más se parece a RLS**, porque el chequeo vive pegado a los datos.

El Worker ya autorizó antes de llamar. Pero el DO **no confía**: guarda el
`ownerId` de su rifa y lo verifica de nuevo. Si el Worker se equivoca, el objeto
igual se niega.

```ts
// src/do/raffle.ts
import { DurableObject } from 'cloudflare:workers';

export class Forbidden extends Error {
  constructor() { super('FORBIDDEN'); }
}

export class Raffle extends DurableObject<Env> {

  private ownerId(): string {
    const row = this.ctx.storage.sql
      .exec<{ v: string }>("SELECT v FROM meta WHERE k = 'owner_id'")
      .one();
    return row.v;
  }

  private assertOwner(userId: string | null): void {
    if (!userId || userId !== this.ownerId()) throw new Forbidden();
  }

  // ══ SUPERFICIE PÚBLICA ══════════════════════════════════════════
  // Cualquiera. No recibe actor porque no lo necesita: el tipo de
  // retorno ya garantiza que no puede filtrar nada privado.

  publicGrid(): PublicNumber[] {
    return this.ctx.storage.sql
      .exec<PublicNumber>('SELECT number, status FROM numbers ORDER BY number')
      .toArray();
  }

  /** El visitante consulta SU pedido. El token es la credencial. */
  orderByToken(token: string): PublicOrder | null {
    const order = this.ctx.storage.sql
      .exec<{ code: string; status: string; expires_at: number }>(
        'SELECT code, status, expires_at FROM orders WHERE visitor_token = ?',
        token,
      ).toArray()[0];

    if (!order) return null;

    const numbers = this.ctx.storage.sql
      .exec<{ number: number }>(
        `SELECT number FROM numbers
          WHERE order_id = (SELECT id FROM orders WHERE visitor_token = ?)
          ORDER BY number`, token,
      ).toArray().map((r) => r.number);

    return { code: order.code, status: order.status, expiresAt: order.expires_at, numbers };
  }

  // ══ SUPERFICIE DEL ORGANIZADOR ══════════════════════════════════
  // Todas exigen userId y todas empiezan con assertOwner.

  ownerGrid(userId: string): OwnerNumber[] {
    this.assertOwner(userId);
    return this.ctx.storage.sql.exec<OwnerNumber>(`
      SELECT n.number, n.status, n.buyer_id AS buyerId, n.order_id AS orderId,
             n.reserved_until AS reservedUntil, n.note,
             b.name AS buyerName, b.phone AS buyerPhone
        FROM numbers n LEFT JOIN buyers b ON b.id = n.buyer_id
       ORDER BY n.number
    `).toArray();
  }

  sell(userId: string, numbers: number[], buyer: BuyerInput): SellResult {
    this.assertOwner(userId);
    /* … */
  }

  confirmOrder(userId: string, orderId: string): void {
    this.assertOwner(userId);
    /* … */
  }
}
```

> **La convención que hay que sostener:** todo método que empieza con `owner` o
> que escribe **recibe `userId` como primer parámetro y llama a `assertOwner`
> en la primera línea.** Un método sin `userId` es, por definición, público — y
> por lo tanto su tipo de retorno no puede contener datos de compradores.
>
> Es una regla que se revisa de un vistazo en el code review, y ese es el punto.

---

## 5 · Tests que afirman denegación

El test que importa no es el que confirma que el dueño ve su rifa. Es el que
confirma que **otro no la ve**.

```ts
// src/do/raffle.test.ts
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('Raffle · autorización', () => {
  it('un usuario ajeno no puede leer la grilla del organizador', async () => {
    const rifa = env.RAFFLE.getByName('rifa-de-ana');
    await rifa.init({ ownerId: 'ana', totalNumbers: 100, numberStart: 0 });

    await expect(rifa.ownerGrid('beto')).rejects.toThrow('FORBIDDEN');
  });

  it('un usuario ajeno no puede vender', async () => {
    const rifa = env.RAFFLE.getByName('rifa-de-ana');
    await expect(
      rifa.sell('beto', [1], { name: 'X', phone: null }),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('la grilla pública nunca incluye datos del comprador', async () => {
    const rifa = env.RAFFLE.getByName('rifa-de-ana');
    await rifa.sell('ana', [7], { name: 'Carla', phone: '+5493411234567' });

    const grid = await rifa.publicGrid();
    const serializado = JSON.stringify(grid);

    expect(serializado).not.toContain('Carla');
    expect(serializado).not.toContain('3411234567');
  });

  it('un organizador no puede auto-promoverse a admin', async () => {
    await updateProfile(env.DB, { kind: 'organizer', userId: 'beto' }, {
      displayName: 'Beto',
      role: 'ADMIN',              // @ts-expect-error: no está en el tipo
    } as never);

    const p = await getProfile(env.DB, { kind: 'admin', userId: 'root' }, 'beto');
    expect(p?.role).toBe('USER');
  });
});
```

> El tercer test —serializar y buscar el teléfono en el string— es feo a
> propósito. Es el único que atrapa una fuga que se coló por un campo nuevo que
> alguien agregó sin pensar.

---

## Matriz: qué se permite y dónde se aplica

| Recurso | Visitante | Organizador (propio) | Organizador (ajeno) | Admin | Dónde se hace cumplir |
|---|:--:|:--:|:--:|:--:|---|
| `profiles` · leer | ✗ | ✓ | ✗ | ✓ | repo D1 + `actor` |
| `profiles` · editar | ✗ | ✓ ¹ | ✗ | ✓ | lista blanca de campos |
| `raffles` · listar | ✗ | ✓ | ✗ | ✓ | `WHERE owner_id = actor.userId` |
| `raffles` · pública por slug | ✓ ² | ✓ | ✓ | ✓ | `WHERE status IN (...)` + tipo público |
| `raffles` · crear/editar | ✗ | ✓ | ✗ | ✓ | repo D1 + `actor` |
| grilla · leer estado | ✓ ³ | ✓ | ✓ ³ | ✓ | `publicGrid()` vs `ownerGrid()` |
| grilla · quién compró qué | ✗ | ✓ | ✗ | ✓ | **`assertOwner` en el DO** |
| compradores | ✗ | ✓ | ✗ | ✓ | **`assertOwner` en el DO** |
| vender / liberar / sortear | ✗ | ✓ | ✗ | ✓ | **`assertOwner` en el DO** |
| crear pedido | ✓ ⁴ | ✓ | ✓ | ✓ | valida tier + estado + máx 50 |
| ver su pedido | ✓ ⁵ | — | — | ✓ | `visitor_token` |
| confirmar/cancelar pedido | ✗ | ✓ | ✗ | ✓ | **`assertOwner` en el DO** |
| `vouchers` | ✗ | ✗ | ✗ | ✓ | `isAdmin(actor)` |

1. Sólo campos de la lista blanca. `role` no está en ella.
2. Sólo `PUBLISHED` y `CLOSED`. `CLOSED` a propósito: el link viejo tiene que
   seguir mostrando quién ganó.
3. Devuelve `PublicNumber[]`: número y estado. Nunca por quién.
4. Sólo en rifas `PUBLISHED` con `tier = 'PRO'`.
5. El token de la URL es la credencial. No hay sesión.

### La lista blanca de perfil

```ts
/** `role` NO está acá. Es la única defensa contra la auto-promoción. */
const CAMPOS_EDITABLES = ['displayName', 'avatarUrl', 'contactPhone'] as const;

export const updateProfile = async (
  db: D1Database,
  actor: Actor,
  input: Pick<Profile, (typeof CAMPOS_EDITABLES)[number]>,
): Promise<void> => {
  const userId = userIdOf(actor);
  if (!userId) throw new Forbidden();

  await db.prepare(
    `UPDATE profiles SET display_name = ?, avatar_url = ?, contact_phone = ?,
            updated_at = ? WHERE id = ?`,
  ).bind(
    input.displayName,
    input.avatarUrl ?? null,
    normalizePhone(input.contactPhone),
    Date.now(),
    userId,                  // ← del actor, NUNCA del input
  ).run();
};
```

> **`WHERE id = userId` del actor, no del input.** Es la línea que en Postgres
> escribía la policy. Acá la escribís vos, en un solo lugar, y por eso ese lugar
> tiene que ser uno solo.

---

## El middleware

Un único punto donde se resuelve la identidad:

```ts
// src/middleware.ts
export const onRequest = defineMiddleware(async (ctx, next) => {
  const db = ctx.locals.runtime.env.DB;
  const session = await auth.api.getSession({ headers: ctx.request.headers });

  ctx.locals.actor = await actorFromSession(db, session?.user ?? null);

  const protegida = /^\/dashboard|^\/admin/.test(ctx.url.pathname);
  if (protegida && ctx.locals.actor.kind === 'visitor') {
    return ctx.redirect(`/login?next=${encodeURIComponent(ctx.url.pathname)}`);
  }

  if (ctx.url.pathname.startsWith('/admin') && !isAdmin(ctx.locals.actor)) {
    return new Response('No encontrado', { status: 404 });
  }

  return next();
});
```

> `/admin` devuelve **404, no 403**. Un 403 confirma que la ruta existe.

---

## Checklist de revisión

Antes de mergear cualquier cosa que toque datos:

- [ ] ¿La función nueva recibe `actor` o `userId`? ¿Sin default?
- [ ] Si escribe o lee datos privados, ¿la primera línea es `assertOwner`?
- [ ] ¿El tipo de retorno puede contener un teléfono que no debería?
- [ ] ¿Algún `WHERE` usa un id que vino del input en vez del actor?
- [ ] ¿Hay un test que afirme que **otro usuario recibe FORBIDDEN**?
- [ ] ¿Se tocó `env.DB` fuera de `src/lib/db/`?

> Una policy mal escrita casi nunca rompe la app: permite de más y filtra en
> silencio. Por eso el test que importa es el que espera un error.
