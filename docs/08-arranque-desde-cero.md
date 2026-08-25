# 08 · Arranque desde cero: qué rescatar de v1

> ## ⚠️ SUPERADO POR LA DECISIÓN DE STACK
>
> Se decidió ir a **Cloudflare Workers + D1 + Better Auth**, priorizando el
> aprendizaje del stack por encima de la eficiencia de construcción.
> El inventario de qué rescatar de v1 sigue valiendo. Lo que cambia: no se portan `src/lib/supabase/*` ni las rutas de auth de Supabase — se reemplazan por Better Auth.
>
> Ver [README · decisiones](./README.md).

---

> **Leé esto ANTES de borrar.** Todo v1 está en el tag `v1.0.0`, así que nada se
> pierde de verdad — pero después de borrar no vas a recordar qué había. Este
> documento es el inventario.
>
> Para recuperar cualquier archivo:
> ```bash
> git checkout v1.0.0 -- <ruta>
> ```

## Decisiones que acompañan este arranque

1. **Se queda en Vercel.** El cobro está lejos y no definido; Hobby es legítimo
   mientras no haya uso comercial, y Cloudflare Free no alcanza para Astro SSR
   (10 ms de CPU). Se migra cuando actives el cobro → [01b](./01b-infraestructura.md)
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
`src/lib/domain/` sin ninguna importación de Supabase ni de UI. Ya está así en
v1 y hay que sostenerlo. Esa disciplina te da el 90 % del beneficio de un
monorepo con el 0 % del costo. Si algún día aparece una app móvil que comparta
la lógica, ahí se evalúa — no antes.

---

## Inventario de v1

### 🟢 Rescatar tal cual — funciona y es aburrido de reescribir

| Ruta | Líneas | Por qué |
|---|---|---|
| `src/pages/api/auth/callback.ts` | ~20 | Flujo OAuth de Google, andando |
| `src/pages/api/auth/logout.ts` | ~15 | idem |
| `src/pages/api/auth/signin/google.ts` | ~20 | idem |
| `src/lib/formatters/index.ts` | — | `formatCurrency`, `formatDate` con locale AR |
| `src/lib/utils/index.ts` · `utils/react.ts` | — | El helper `cn()` |
| `src/global.css` · `src/styles/*` | — | Tokens de Tailwind v4 y tema |
| `.editorconfig` · `.prettierrc` · `eslint.config.mjs` | — | Configuración ya afinada |
| `tsconfig.json` · `pnpm-workspace.yaml` | — | Alias `@/` y config de pnpm |
| `public/favicon.*` | — | — |

> Las tres rutas de auth son **54 líneas en total**. Retipearlas no te enseña
> nada y es donde un error se paga caro. Rescatalas.

### 🟡 Rescatar y adaptar

| Ruta | Qué cambia |
|---|---|
| `src/lib/supabase/server.ts` | Sumar `runtimeEnv` opcional (queda listo para Cloudflare) |
| `src/lib/domain/raffle.ts` | Lógica pura, se mantiene. Sumar padding y `number_start` |
| `src/middleware.ts` | 25 líneas. Sumar la ruta `/admin` a las protegidas |
| `src/layouts/*` | 205 líneas. Revisar, probablemente sirven |
| `src/lib/whatsapp/index.ts` | Ampliar con el mensaje de pedido (plan PRO) |

### 🔴 Reescribir — v1 lo hace de una forma que ya decidimos cambiar

| Ruta | Por qué |
|---|---|
| `src/lib/repositories/raffle.ts` | Va contra las vistas públicas y las RPC → [03](./03-modelo-de-datos.md) |
| `src/actions/*` | Pasan a ser envoltorios finos sobre las funciones RPC |
| `src/types/database.ts` | Se regenera con `supabase gen types` |
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
| `supabase/.temp/` | Basura de la CLI |

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
3. Configurar Vercel + Supabase y verificar que el **login funcione**
4. Recién ahí, el esquema v2 → [06 · Roadmap](./06-roadmap.md), fase 2
5. Construir hacia arriba: repositorios → actions → páginas

> El paso 3 es el checkpoint que importa. Si el login anda sobre el proyecto
> nuevo, todo lo demás es trabajo tuyo sin sorpresas de plataforma.
