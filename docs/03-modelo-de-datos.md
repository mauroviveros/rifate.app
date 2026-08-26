# 03 · Modelo de datos — D1 + Durable Objects

> Reescrito para el stack final. La versión Postgres quedó archivada en
> [`_archivo/03-modelo-de-datos-postgres.md`](./_archivo/03-modelo-de-datos-postgres.md)
> — sigue siendo útil como referencia del diseño conceptual y de los constraints
> de coherencia.

## El reparto

La regla que decide dónde va cada tabla:

> **¿Se consulta esto atravesando varias rifas?**
> Sí → D1. No → el Durable Object de esa rifa.

```
┌─ D1 · lo que se consulta entre rifas ────────────────────┐
│  user · session · account · verification   (Better Auth) │
│  profiles          rol y teléfono del organizador        │
│  raffles           catálogo + contadores proyectados     │
│  vouchers                                                 │
│  voucher_redemptions                                      │
└───────────────────────────────────────────────────────────┘
                          ▲
                          │ el DO proyecta sus contadores acá
                          │
┌─ Durable Object · uno por rifa ──────────────────────────┐
│  numbers           la grilla completa                     │
│  buyers            nombres y teléfonos ← lo más sensible  │
│  orders            pedidos con reserva (PRO)              │
│  + WebSockets de quienes miran la rifa                    │
│  + alarm que vence las reservas                           │
└───────────────────────────────────────────────────────────┘
```

**Por qué `buyers` vive en el DO y no en D1:** los teléfonos de los compradores
son el dato más sensible del sistema, y nunca se consultan entre rifas — siempre
en el contexto de una. Tenerlos dentro del DO significa que ni siquiera existe
una tabla global que alguien pueda leer de más.

---

## Lo que cambia por ser SQLite

Cinco reglas que hay que aplicar en todo el esquema:

| Postgres | SQLite / D1 | Por qué importa |
|---|---|---|
| `create type ... as enum` | `TEXT` + `CHECK (x IN (...))` | Mismo efecto, la base sigue validando |
| `numeric(12,2)` | **`INTEGER` de centavos** | `REAL` es punto flotante: `0.1 + 0.2 ≠ 0.3`. Nunca plata en REAL |
| `timestamptz` | `INTEGER` (epoch en ms) | Ordena bien, compara barato, sin ambigüedad de zona |
| `gen_random_uuid()` | `crypto.randomUUID()` en el Worker | La base no genera ids |
| `boolean` | `INTEGER` 0/1 | SQLite no tiene booleano |
| `generate_series()` | Un `for` en TypeScript | Es lo que materializa la grilla |

> **La plata en centavos no es opcional.** Un precio de $2.500,50 se guarda como
> `250050`. Si alguna vez ves un `REAL` para dinero en este proyecto, es un bug.

---

## D1 · el catálogo

### Better Auth
Las tablas `user`, `session`, `account` y `verification` **las genera la CLI de
Better Auth**. No se escriben a mano ni se modifican: se tratan como esquema de
librería.

### `profiles`

```sql
CREATE TABLE profiles (
  id            TEXT PRIMARY KEY,          -- = user.id de Better Auth
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  contact_phone TEXT,                      -- E.164, default de sus rifas
  role          TEXT NOT NULL DEFAULT 'USER'
                  CHECK (role IN ('USER', 'ADMIN')),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,

  CHECK (length(display_name) BETWEEN 1 AND 80),
  CHECK (contact_phone IS NULL OR contact_phone GLOB '+[1-9]*')
);
```

> `role` sólo lo puede cambiar un ADMIN. Sin RLS ni triggers, **eso lo garantiza
> la capa de autorización** — y por eso `updateProfile()` nunca debe aceptar un
> objeto suelto del cliente: se listan los campos permitidos a mano.
> Ver [04](./04-rls-y-roles.md).

### `raffles` — catálogo, no grilla

```sql
CREATE TABLE raffles (
  id             TEXT PRIMARY KEY,
  owner_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL UNIQUE,

  title          TEXT NOT NULL,
  description    TEXT,
  prize          TEXT,

  tier           TEXT NOT NULL DEFAULT 'BASIC' CHECK (tier IN ('BASIC','PRO')),
  status         TEXT NOT NULL DEFAULT 'DRAFT'
                   CHECK (status IN ('DRAFT','PUBLISHED','CLOSED','CANCELLED')),

  unlock_method  TEXT NOT NULL DEFAULT 'FREE'
                   CHECK (unlock_method IN ('FREE','VOUCHER','PAYMENT')),
  payment_ref    TEXT,
  paid_at        INTEGER,

  ticket_price   INTEGER NOT NULL CHECK (ticket_price > 0),  -- CENTAVOS
  currency       TEXT NOT NULL DEFAULT 'ARS',

  total_numbers  INTEGER NOT NULL,
  number_start   INTEGER NOT NULL DEFAULT 0 CHECK (number_start IN (0,1)),
  draw_date      TEXT NOT NULL,                              -- ISO 'YYYY-MM-DD'
  contact_phone  TEXT,

  -- ── Proyección del Durable Object ──────────────────────────────
  -- Copia de solo lectura para poder listar y ordenar sin abrir 50 DOs.
  -- La fuente de verdad es SIEMPRE el DO. Si divergen, gana el DO.
  sold_count     INTEGER NOT NULL DEFAULT 0,
  reserved_count INTEGER NOT NULL DEFAULT 0,
  winner_number  INTEGER,
  winner_name    TEXT,
  synced_at      INTEGER,
  -- ───────────────────────────────────────────────────────────────

  published_at   INTEGER,
  closed_at      INTEGER,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,

  CHECK (length(title) BETWEEN 3 AND 100),
  CHECK (description IS NULL OR length(description) <= 500),
  CHECK (total_numbers >= 1),
  CHECK (total_numbers <= (CASE WHEN tier = 'PRO' THEN 10000 ELSE 1000 END)),
  CHECK (status <> 'PUBLISHED' OR contact_phone IS NOT NULL)
);

CREATE INDEX raffles_owner_idx  ON raffles (owner_id, created_at DESC);
CREATE INDEX raffles_public_idx ON raffles (status) WHERE status IN ('PUBLISHED','CLOSED');
```

> Los `CHECK` sobreviven el paso a SQLite y siguen valiendo la pena: el límite de
> números por tier lo aplica la base, no el formulario de turno.

### `vouchers` y `voucher_redemptions`

```sql
CREATE TABLE vouchers (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  tier       TEXT NOT NULL DEFAULT 'BASIC' CHECK (tier IN ('BASIC','PRO')),
  max_uses   INTEGER NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 10000),
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  note       TEXT,
  created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  CHECK (used_count >= 0 AND used_count <= max_uses)
);

CREATE TABLE voucher_redemptions (
  id          TEXT PRIMARY KEY,
  voucher_id  TEXT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  raffle_id   TEXT NOT NULL UNIQUE REFERENCES raffles(id) ON DELETE CASCADE,
  redeemed_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  redeemed_at INTEGER NOT NULL
);
```

> **El canje de un voucher es la única escritura de la app que necesita
> atomicidad y NO vive en un DO.** Dos canjes simultáneos del último uso
> disponible pasarían los dos. Se resuelve con el `UPDATE` condicional:
> ```sql
> UPDATE vouchers SET used_count = used_count + 1
>  WHERE id = ?1 AND used_count < max_uses;
> -- luego verificar meta.changes === 1
> ```
> Dentro de un `batch()` junto al INSERT del canje, con el statement guarda.

### La tabla guarda

```sql
-- Existe sólo para poder abortar un batch() desde una condición SQL.
-- Insertar 1 viola el CHECK, tira error y revierte todo el batch.
CREATE TABLE _abort (id INTEGER PRIMARY KEY CHECK (id = -1));
```

Es fea. Es el precio de no tener plpgsql. Documentada acá para que dentro de seis
meses se entienda qué hace.

---

## Durable Object · el esquema de una rifa

Se crea en el constructor con `blockConcurrencyWhile`, una sola vez.

```sql
CREATE TABLE numbers (
  number         INTEGER PRIMARY KEY,
  status         TEXT NOT NULL DEFAULT 'AVAILABLE'
                   CHECK (status IN ('AVAILABLE','RESERVED','SOLD','BLOCKED')),
  buyer_id       TEXT REFERENCES buyers(id) ON DELETE SET NULL,
  order_id       TEXT REFERENCES orders(id) ON DELETE SET NULL,
  reserved_until INTEGER,
  sold_at        INTEGER,
  note           TEXT,

  CHECK (status <> 'SOLD'     OR buyer_id       IS NOT NULL),
  CHECK (status <> 'RESERVED' OR reserved_until IS NOT NULL)
);

CREATE TABLE buyers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  note       TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Un teléfono es una persona dentro de la rifa.
CREATE UNIQUE INDEX buyers_phone_key ON buyers (phone) WHERE phone IS NOT NULL;

CREATE TABLE orders (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,     -- 'A3F91C', para nombrarlo en el chat
  visitor_token TEXT NOT NULL UNIQUE,     -- credencial del visitante sin cuenta
  buyer_name    TEXT NOT NULL,
  buyer_phone   TEXT,
  buyer_id      TEXT REFERENCES buyers(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','EXPIRED')),
  expires_at    INTEGER NOT NULL,
  confirmed_at  INTEGER,
  cancelled_at  INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,

  CHECK (status <> 'CONFIRMED' OR buyer_id IS NOT NULL)
);

CREATE INDEX numbers_status_idx ON numbers (status);
CREATE INDEX orders_pending_idx ON orders (status, created_at DESC);
```

**Sin `raffle_id` en ninguna tabla.** El DO *es* la rifa: no hay con qué
confundirse, y desaparece toda la clase de bugs de "un comprador de otra rifa"
que en Postgres había que atajar con un trigger.

### La grilla se materializa en TypeScript

```ts
// Reemplaza al generate_series de Postgres. Va en el constructor del DO,
// la primera vez, o en un método init() llamado al crear la rifa.
init(totalNumbers: number, numberStart: number) {
  const stmts = [];
  for (let n = numberStart; n < numberStart + totalNumbers; n++) {
    stmts.push(n);
  }
  // SQLite acepta multi-row VALUES; se inserta en lotes para no armar
  // una sentencia gigante con 10.000 parámetros.
  for (let i = 0; i < stmts.length; i += 500) {
    const lote = stmts.slice(i, i + 500);
    this.ctx.storage.sql.exec(
      `INSERT INTO numbers (number) VALUES ${lote.map(() => '(?)').join(',')}`,
      ...lote,
    );
  }
}
```

---

## La sincronización DO → D1

El punto delicado de esta arquitectura. Reglas:

1. **El DO escribe lo suyo primero.** Su storage es la verdad.
2. **Después proyecta a D1**, sin bloquear la respuesta al usuario.
3. **Si la proyección falla, no se revierte nada.** D1 es caché reconstruible.
4. **Existe un método `resync()`** que recalcula los contadores desde el DO y
   pisa D1. Es la salida cuando algo divergió.

```ts
private async proyectar() {
  const [{ sold, reserved }] = this.ctx.storage.sql.exec<{ sold: number; reserved: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'SOLD')     AS sold,
       COUNT(*) FILTER (WHERE status = 'RESERVED') AS reserved
     FROM numbers`,
  ).toArray();

  // waitUntil: no demora la respuesta al organizador.
  this.ctx.waitUntil(
    this.env.DB.prepare(
      `UPDATE raffles SET sold_count = ?, reserved_count = ?, synced_at = ?
        WHERE id = ?`,
    ).bind(sold, reserved, Date.now(), this.ctx.id.name).run(),
  );
}
```

> `this.ctx.id.name` devuelve el nombre con el que se creó el DO — usá el
> `raffle.id` como nombre (`getByName(raffleId)`) y no hace falta guardarlo.

---

## Lo que se pierde y cómo se compensa

| Se pierde | Compensación |
|---|---|
| Enums | `TEXT` + `CHECK` — la base sigue validando |
| `numeric` | `INTEGER` de centavos, formateado en la UI |
| Triggers de `updated_at` | Se setea en cada repositorio, sin excepción |
| Normalización de teléfono en la base | Función `normalizePhone()` llamada en **un solo** punto de entrada |
| FK entre rifas | Innecesaria: el DO ya aísla cada rifa |
| RLS | Capa de autorización tipada → [04](./04-rls-y-roles.md) |

> Las dos filas del medio son las que más fácil se rompen: sin trigger, alcanza
> con que un repositorio se olvide de `updated_at` o de normalizar el teléfono
> para que el índice único de compradores deje de servir. Por eso ambas cosas
> viven en **una** función y los repositorios la llaman — nunca escriben el
> campo a mano.
