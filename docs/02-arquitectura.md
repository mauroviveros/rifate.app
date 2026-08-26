# 02 · Arquitectura

## El principio, corregido

La versión anterior de este documento decía:

> ~~«La base de datos hace cumplir las reglas. La app las expresa.»~~

Eso valía con Postgres. **Con D1 no hay RLS ni plpgsql, así que es falso.**
Reemplazarlo por «la app tiene que acordarse» sería peor: es exactamente cómo se
filtran datos.

El principio real de este stack:

> **Cada regla vive en el mecanismo que puede hacerla cumplir. Ninguna depende
> de que alguien se acuerde.**

Y son tres mecanismos, cada uno con un trabajo distinto:

| Mecanismo | Qué garantiza | Ejemplo |
|---|---|---|
| **`CHECK` de SQLite** | Coherencia del dato | Un número `SOLD` no puede tener `buyer_id` nulo |
| **El Durable Object** | Atomicidad y propiedad | Dos personas no pueden reservar el mismo número; `assertOwner` |
| **El sistema de tipos** | Qué puede salir | `PublicNumber` no tiene dónde poner un teléfono |

Lo que no encaja en ninguno de los tres es un riesgo, y hay que tratarlo como
tal. Hoy queda uno solo: el canje de vouchers, que necesita atomicidad y **no**
vive en un DO. Se resuelve con `batch()` + la tabla `_abort`, y está documentado
como la excepción que es.

---

## Las capas

```
┌──────────────────────────────────────────────────────────────┐
│  Páginas .astro          SSR, layout, meta tags               │
│  Islas React             sólo donde hay interacción real      │
├──────────────────────────────────────────────────────────────┤
│  src/actions/            valida input (Zod) · traduce errores  │
├──────────────────────────────────────────────────────────────┤
│  src/lib/db/             repositorios D1 · actor OBLIGATORIO   │
│  src/lib/raffle/         cliente del Durable Object            │
│  src/lib/domain/         cálculos puros · sin I/O              │
├──────────────────────────────────────────────────────────────┤
│  D1                      configuración y catálogo              │
│  Durable Object          estado de una rifa                    │
└──────────────────────────────────────────────────────────────┘
```

Reglas de la casa:

- **`env.DB` no se toca fuera de `src/lib/db/`.** Hay una regla de ESLint que
  hace fallar CI si alguien busca el atajo desde una página.
- **`env.RAFFLE` no se toca fuera de `src/lib/raffle/`.** Mismo criterio.
- **`domain/` no importa nada de Cloudflare.** Son funciones puras sobre datos
  ya traídos. Es lo único testeable sin levantar nada, y es donde va la lógica
  de negocio de verdad.
- **Las actions no contienen lógica.** Si una action tiene un `if` de negocio,
  ese `if` está en el lugar equivocado.

---

## Estructura de carpetas

```
src/
├── actions/
│   ├── index.ts
│   ├── raffle/          create · publish · sell · release · draw
│   ├── order/           create · confirm · cancel
│   └── voucher/         issue · redeem
│
├── do/
│   ├── raffle.ts        la clase Durable Object
│   ├── schema.ts        migración versionada  ← docs/sql/do/schema.ts
│   └── raffle.test.ts   tests de denegación
│
├── lib/
│   ├── auth/
│   │   ├── index.ts     createAuth(env) — por request, nunca a nivel de módulo
│   │   └── actor.ts     Actor · actorFromSession · isAdmin
│   ├── db/              ← ÚNICO módulo que toca env.DB
│   │   ├── index.ts     re-exporta funciones; NO exporta el binding
│   │   ├── profiles.ts
│   │   ├── raffles.ts
│   │   └── vouchers.ts
│   ├── raffle/
│   │   └── client.ts    ← ÚNICO módulo que toca env.RAFFLE
│   ├── domain/
│   │   └── raffle.ts    padding, rangos, agregados. Sin I/O
│   ├── og/              template.ts · render.ts · fonts.ts
│   ├── formatters/      moneda (desde centavos) y fechas
│   ├── whatsapp/        armado de los mensajes
│   └── errors.ts        código → mensaje en castellano
│
├── components/
├── layouts/
├── pages/
├── middleware.ts        resuelve el Actor · protege rutas
└── env.d.ts
```

### El cliente del Durable Object

Existe para que la convención de nombres viva en un solo lugar:

```ts
// src/lib/raffle/client.ts
import type { Raffle } from '@/do/raffle';

/**
 * El nombre del DO es el id de la rifa. Con eso, `this.ctx.id.name` dentro del
 * objeto devuelve su propio id y no hace falta guardarlo aparte.
 */
export const raffleStub = (env: Env, raffleId: string): DurableObjectStub<Raffle> =>
  env.RAFFLE.getByName(raffleId);
```

Si mañana hace falta un `locationHint` o un reintento, se agrega acá y no en
treinta llamadas.

---

## Por dónde pasa cada request

| Ruta | D1 | Durable Object | Cache |
|---|:--:|:--:|---|
| `/` landing | — | — | prerenderizada |
| `/r/[slug]` pública | ✓ catálogo | ✓ `publicGrid()` | **s-maxage 30** |
| `/og/raffle/[id]/[v].png` | ✓ | ✓ | **immutable** |
| `/dashboard/raffle` listado | ✓ | — | no |
| `/dashboard/raffle/[id]` | ✓ | ✓ `ownerGrid()` | no |
| acciones de venta | — | ✓ | no |
| `/admin/vouchers` | ✓ | — | no |

Dos cosas a notar:

**El listado del dashboard no abre ni un DO.** Lee los contadores proyectados en
`raffles`. Por eso existe esa proyección: sin ella, mostrar 20 rifas serían 20
round-trips a Norteamérica.

**El cache de la página pública no es una optimización, es estructural.** El DO
vive en ENAM (~120 ms desde Argentina). Con `s-maxage=30`, si una rifa se
comparte en un grupo y entran 200 personas en un minuto, el DO recibe ~2
llamadas en vez de 200.

```
Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=300
```

30 segundos de desfase es aceptable: el número lo confirma el organizador por
WhatsApp igual, y **la reserva del plan PRO se valida contra el DO en el momento
del pedido**, no contra lo que muestra la página. Alguien puede pedir un número
que la pantalla mostraba libre y recibir `NUMBERS_UNAVAILABLE` — está previsto y
tiene su mensaje.

---

## Rutas

| Ruta | Render | Quién entra |
|---|---|---|
| `/` | prerender | cualquiera |
| `/login` | SSR | visitante |
| `/r/[slug]` | SSR + cache | **visitante sin cuenta** |
| `/r/[slug]/pedido?t=` | SSR | visitante, con su token |
| `/og/raffle/[id]/[v].png` | endpoint | crawlers |
| `/dashboard/raffle` | SSR | organizador |
| `/dashboard/raffle/create` | SSR | organizador |
| `/dashboard/raffle/[id]` | SSR + isla | organizador |
| `/admin/vouchers` | SSR | **ADMIN** — si no, 404 |
| `/api/auth/[...all]` | endpoint | Better Auth |

**El slug es para lo público, el uuid para lo privado.** Un uuid en un estado de
WhatsApp es ilegible; `rifate.app/r/rifa-del-club-2026` se lee, se dicta por
teléfono y se comparte. El dashboard sigue con uuid porque no se comparte.

> `/admin` devuelve **404, no 403**. Un 403 confirma que la ruta existe.

---

## Landing y app en el mismo proyecto

Astro decide el modo de render **por página**, así que la landing estática, la
página pública SSR y el dashboard interactivo conviven sin separar proyectos.
Un repo, un deploy, un sistema de diseño, tipos compartidos.

Queda una decisión abierta: si el dashboard vive en `rifate.app/dashboard` o en
`app.rifate.app`. Recomiendo el dominio único — un deploy, un certificado, links
más cortos, y la separación de cookies no es un problema real acá porque el
visitante anónimo no recibe ninguna.

---

## La deuda de UI, todavía sin resolver

En v1 convivían **dos librerías completas**: `starwind` (Astro, 2.784 líneas) y
`shadcn` (React, 685). Siete componentes duplicados —button, card, dialog,
input, label, progress, textarea— más la grilla de rifa, que existía en las dos
tecnologías.

**Elegir antes de portar un solo componente.** Recomendación: starwind como
base, porque es Astro y no manda JavaScript al cliente; shadcn **sólo** para lo
que vive dentro de una isla React con estado — el diálogo de venta y la
selección de números de la página pública.

Regla para escribir en el README y no volver a romper:

> Si el componente necesita estado de cliente, es React. Si no, es Astro.
> Nunca los dos.

---

## Errores

Las operaciones levantan códigos estables; `src/lib/errors.ts` los traduce en un
solo lugar. Ninguna página muestra un error crudo.

| Código | Mensaje | HTTP |
|---|---|---|
| `NUMBERS_UNAVAILABLE` | Alguien tomó uno de esos números. Elegí otros. | 409 |
| `RAFFLE_NOT_PUBLISHED` | Esta rifa todavía no está publicada. | 400 |
| `RAFFLE_NOT_PRO` | Esta rifa no acepta pedidos online. | 400 |
| `TOO_MANY_NUMBERS` | Podés pedir hasta 50 números por vez. | 400 |
| `FORBIDDEN` | No tenés permiso para hacer esto. | 403 |
| `ORDER_NOT_PENDING` | Este pedido ya fue confirmado o cancelado. | 409 |
| `VOUCHER_EXPIRED` | Este código venció. | 400 |
| `VOUCHER_EXHAUSTED` | Este código ya se usó todas las veces. | 400 |
| `RAFFLE_HAS_SALES` | Tiene números vendidos: cancelala en lugar de borrarla. | 409 |
| `RAFFLE_NOT_RESIZABLE` | Sólo podés cambiar el rango en borrador. | 409 |

Si el mensaje se arma en cada action, tarde o temprano dos actions dicen cosas
distintas para el mismo error.
