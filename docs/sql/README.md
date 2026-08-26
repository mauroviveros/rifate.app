# Esquema — D1 + Durable Object

> Listo para copiar. Cuando el proyecto esté scaffoldeado, cada archivo va a su
> lugar; hasta entonces vive acá.

| Archivo | Va a | Qué es |
|---|---|---|
| `d1/0002_profiles.sql` | `migrations/` | Perfiles de la app |
| `d1/0003_raffles.sql` | `migrations/` | Catálogo de rifas |
| `d1/0004_vouchers.sql` | `migrations/` | Vouchers y canjes |
| `d1/0005_guards.sql` | `migrations/` | La tabla `_abort` |
| `do/schema.ts` | `src/do/schema.ts` | Esquema del Durable Object, versionado |

> **`0001` lo genera Better Auth**, no se escribe a mano:
> ```bash
> npx @better-auth/cli generate --output migrations/0001_better_auth.sql
> ```
> Crea `user`, `session`, `account` y `verification`. Si Better Auth cambia su
> modelo, se regenera y se aplica como una migración más.

## Aplicar

```bash
npx wrangler d1 create rifate-db          # una sola vez
npx wrangler d1 migrations apply rifate-db --local
npx wrangler d1 migrations apply rifate-db --remote
```

El esquema del Durable Object **no se aplica con wrangler**: cada objeto lo
corre solo al despertar. Ver `do/schema.ts`.

---

## El reparto de verdades

Esta es la regla que evita confusión sobre dónde vive cada dato:

> **D1 es la verdad de la CONFIGURACIÓN.**
> Título, precio, tier, estado, slug, fecha de sorteo.
>
> **El Durable Object es la verdad del ESTADO.**
> Quién tiene cada número, los compradores, los pedidos.

De ahí salen tres consecuencias:

1. **Crear una rifa escribe primero en D1**, porque la unicidad del slug es una
   pregunta global y un DO no puede responderla. Después se llama a `init()`
   del objeto. Si `init()` falla, queda una fila huérfana en D1 y se reintenta:
   es idempotente.

2. **El DO guarda en `meta` una copia de la config que necesita para validar**
   (dueño, tier, estado, rango). No es duplicación gratuita: le permite decidir
   sin una llamada asíncrona en medio de una operación atómica.

3. **Los contadores viajan del DO a D1** (`sold_count`, `reserved_count`). Son
   caché reconstruible: si divergen, gana el DO y se arreglan con `resync()`.

## Decisiones que vale conocer

**`STRICT` en todas las tablas.** SQLite es de tipado laxo y aceptaría un texto
en una columna `INTEGER`. `STRICT` lo prohíbe. Es lo más parecido a los tipos de
Postgres que se puede tener acá, y sale gratis.

> Verificá que la versión de SQLite de D1 lo soporte en el primer
> `migrations apply --local`. Si fallara, se quitan los `STRICT` — pero se
> pierde esa red.

**La plata en `INTEGER` de centavos.** $2.500,50 → `250050`. `REAL` es punto
flotante: `0.1 + 0.2 ≠ 0.3`. Si aparece un `REAL` para dinero en este proyecto,
es un bug.

**Timestamps en `INTEGER` (epoch en ms).** Ordenan bien, comparan barato, sin
ambigüedad de zona horaria. Los `DEFAULT (unixepoch() * 1000)` son red de
contención: la app siempre pasa el valor explícito, porque `updated_at` vive en
un solo lugar (ver [03](../03-modelo-de-datos.md)).

**Sin `raffle_id` dentro del Durable Object.** El objeto *es* la rifa. Desaparece
toda la clase de bugs de "un comprador de otra rifa" que en Postgres había que
atajar con un trigger.

**Los `CHECK` sobreviven a SQLite y valen la pena.** El límite de números por
tier, que una rifa publicada tenga teléfono, que un número vendido tenga
comprador: lo aplica la base, no el formulario de turno.

## Lo que no se pudo traer de Postgres

| Se perdió | Compensación |
|---|---|
| Enums | `TEXT` + `CHECK (x IN (...))` |
| `numeric(12,2)` | `INTEGER` de centavos |
| Regex en `CHECK` | `GLOB` para lo grueso + `normalizePhone()` en un solo lugar |
| Triggers de `updated_at` | Se setea en cada repositorio, sin excepción |
| Funciones plpgsql | Métodos del DO (atómicos) y `batch()` + `_abort` en D1 |
| RLS | Capa de autorización tipada → [04](../04-rls-y-roles.md) |

Las dos del medio son las que más fácil se rompen: sin trigger, alcanza con que
un repositorio se olvide de `updated_at` o de normalizar el teléfono para que el
índice único de compradores deje de servir. **Por eso ambas viven en una función
y los repositorios la llaman** — nunca escriben el campo a mano.

---

## Referencia

La propuesta original en PostgreSQL —con enums, RLS y las 9 funciones plpgsql—
quedó en [`../_archivo/sql-postgres/`](../_archivo/sql-postgres/). No es
ejecutable acá, pero sigue siendo la mejor especificación de **qué** tiene que
hacer cumplir el sistema.
