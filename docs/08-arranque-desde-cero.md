# 08 · Arranque desde cero: qué rescatar de v1

> **Leé esto ANTES de borrar.** Todo v1 está en el tag `v1.0.0`, así que nada se
> pierde de verdad — pero después de borrar no vas a recordar qué había. Este
> documento es el inventario.
>
> Para recuperar cualquier archivo:
> ```bash
> git checkout v1.0.0 -- <ruta>
> ```

## Decisiones que acompañan este arranque

1. **Cloudflare Workers + D1 + Durable Objects + Better Auth.** Elegido
   priorizando aprender el stack → [01b](./01b-infraestructura.md) · [09](./09-durable-objects.md)
2. **Una sola app, sin monorepo.** Justificación abajo.
3. **Proyecto nuevo, no edición del viejo.** Se arranca con `pnpm create astro`
   y se portan archivos deliberadamente, uno por uno.

---

## ¿Turborepo?

**No.** Turborepo resuelve problemas que no tenés:

| Lo que resuelve | Tu caso |
|---|---|
| Varias apps compartiendo código | Una sola app |
| Equipos con cadencias de deploy distintas | Una persona |
| CI lento que necesita cache de tareas | Build de minutos |
| Publicar paquetes versionados | Nada que publicar |

Astro ya resuelve el único motivo real que tendrías para separar: la landing
prerenderizada, la página pública SSR y el dashboard **conviven en un proyecto**
porque el modo de render se decide por página, no por proyecto.

> Tu `pnpm-workspace.yaml` actual **no** es un monorepo: no tiene clave
> `packages:`, sólo configuración de pnpm (`allowBuilds`, `minimumReleaseAgeExclude`).
> Conservalo tal cual.

**El seguro barato**, si algún día querés extraer código: mantener
`src/lib/domain/` sin ninguna importación de Cloudflare ni de UI. Ya está así en
v1 y hay que sostenerlo. Esa disciplina te da el 90 % del beneficio de un
monorepo con el 0 % del costo. Si algún día aparece una app móvil que comparta
la lógica, ahí se evalúa — no antes.

---

## Inventario de v1

### 🟢 Rescatar tal cual — funciona y es aburrido de reescribir

| Ruta | Líneas | Por qué |
|---|---|---|
| ~~`src/pages/api/auth/*`~~ | 54 | **Ya no se rescatan.** Las tres rutas las reemplaza el catch-all de Better Auth → [10](./10-better-auth.md) |
| `src/lib/formatters/index.ts` | — | `formatCurrency`, `formatDate` con locale AR |
| `src/lib/utils/index.ts` · `utils/react.ts` | — | El helper `cn()` |
| `src/global.css` · `src/styles/*` | — | Tokens de Tailwind v4 y tema |
| `.editorconfig` · `.prettierrc` · `eslint.config.mjs` | — | Configuración ya afinada |
| `tsconfig.json` · `pnpm-workspace.yaml` | — | Alias `@/` y config de pnpm |
| `public/favicon.*` | — | — |

> Con Supabase esas tres rutas valían la pena rescatarlas. Con Better Auth
> desaparecen: una sola ruta catch-all las reemplaza. Es de las pocas cosas que
> el cambio de stack simplificó.

### 🟡 Rescatar y adaptar

| Ruta | Qué cambia |
|---|---|
| ~~`src/lib/supabase/server.ts`~~ | **No se porta.** Lo reemplaza Better Auth + D1 → [10](./10-better-auth.md) |
| `src/lib/domain/raffle.ts` | Lógica pura, se mantiene. Sumar padding y `number_start` |
| `src/middleware.ts` | 25 líneas. Sumar la ruta `/admin` a las protegidas |
| `src/layouts/*` | 205 líneas. Revisar, probablemente sirven |
| `src/lib/whatsapp/index.ts` | Ampliar con el mensaje de pedido (plan PRO) |

### 🔴 Reescribir — v1 lo hace de una forma que ya decidimos cambiar

| Ruta | Por qué |
|---|---|
| `src/lib/repositories/raffle.ts` | Va contra las vistas públicas y las RPC → [03](./03-modelo-de-datos.md) |
| `src/actions/*` | Pasan a ser envoltorios finos sobre las funciones RPC |
| `src/types/database.ts` | Se escribe a mano contra el esquema de [`docs/sql/`](./sql/) |
| `src/types/raffle/index.ts` | Deriva del esquema nuevo |
| `src/schemas/*` | Campos nuevos: `tier`, `number_start`, `prize` |
| `src/pages/**` | Rutas nuevas (`/r/[slug]`) y datos nuevos |
| `src/pages/og/raffle/[id].png.ts` | URL versionada + plantilla nueva → [07](./07-guia-cloudflare.md) |

### ⚫ No rescatar

| Ruta | Por qué |
|---|---|
| `src/components/ui/shadcn/*` **o** `starwind/*` | **Elegí uno.** Hay 7 componentes duplicados |
| `src/components/raffle/grid/astro/` **o** `react/` | **También duplicado**: la grilla existe en las dos tecnologías |
| `src/components/raffle/RaffleGridExample.astro` | Demo de la landing, se rehace |
| `.vercel/` · `dist/` · `.astro/` · `node_modules/` | Generados |
| `supabase/` completo | El proyecto ya no usa Supabase |

---

## La deuda de UI: decidila antes de portar

Es el momento. Después es más caro.

```
starwind (Astro)   2.784 líneas   button card dialog input label progress
                                  textarea avatar dropdown input-group skeleton
shadcn   (React)     685 líneas   button card dialog input label progress
                                  textarea field separator
```

Siete componentes están en las dos. Además la grilla de rifa existe duplicada
en `grid/astro/` y `grid/react/`.

**Recomendación:** starwind como base — es Astro, no manda JavaScript al
cliente, y es donde está la inversión (2.784 líneas contra 685). shadcn queda
**sólo** para lo que vive dentro de una isla React con estado: el diálogo de
venta y la selección de números de la página pública.

Regla para escribir en el README y no romper: *si el componente necesita estado
de cliente, es React; si no, es Astro. Nunca los dos.*

---

## Orden sugerido

1. `pnpm create astro@latest` en una carpeta nueva, con TypeScript estricto
2. Portar la fila 🟢 completa (`git checkout v1.0.0 -- <ruta>` desde el repo viejo)
3. Configurar Cloudflare + D1 + Better Auth y verificar que el **login funcione**
4. Recién ahí, el esquema → [06 · Roadmap](./06-roadmap.md), fases 3 y 4
5. Construir hacia arriba: repositorios → actions → páginas

> El paso 3 es el checkpoint que importa. Si el login anda sobre el proyecto
> nuevo, todo lo demás es trabajo tuyo sin sorpresas de plataforma.
