# 01 · Stack

## Decisión: seguir en Astro 6

No se migra el framework. El refactor es de **datos y arquitectura**, no de
tecnología de front.

### Por qué

La app tiene tres superficies con requisitos opuestos, y Astro es el único de los
cuatro candidatos que las resuelve sin comprometer ninguna:

| Superficie | Necesita | Astro |
|---|---|---|
| Landing (`/`) | HTML estático, cero JS, SEO | `prerender = true` |
| Página pública (`/r/[slug]`) | SSR fresco, OG dinámico, mínimo JS, abre en celular con datos móviles | SSR + una isla |
| Dashboard (`/dashboard/*`) | Interactividad real, estado de cliente | Islas React `client:only` |

El punto que decide es **la página pública**. Es la que abre alguien en un
colectivo con 3G desde un link de WhatsApp, y es la que Google y el preview de
WhatsApp tienen que poder leer. Cada KB de JavaScript ahí es dinero perdido en
conversión. Astro manda HTML y sólo hidrata la grilla de números.

### Las alternativas, honestamente

**Next.js 16** — La opción defendible. Con RSC podés acercarte bastante al JS
mínimo de Astro. Ganás un solo modelo mental (todo React), mejor ecosistema y
más gente que lo conoce.
Pero: seguís mandando el runtime de React a la página pública, reescribís el
100% de las vistas `.astro`, y a cambio de eso no resolvés ninguno de los
problemas que este refactor viene a resolver — que están todos en la base de
datos. **Es la migración correcta para el problema equivocado.**

**TanStack Start** — DX y type-safety excelentes. Pero es SPA-first: la página
pública y la generación de OG quedan peor servidas, el ecosistema es más chico y
la superficie de riesgo para un proyecto de una sola persona es alta. No.

**Angular** — Pensado para aplicaciones internas grandes con equipos grandes.
Acá la mitad del producto es una página pública que tiene que pesar poco y
posicionar bien: es exactamente el escenario donde Angular rinde peor. No.

### Lo que sí se toca del front

Que no se migre el framework no significa que no haya trabajo:

- Reemplazar los inserts encadenados por llamadas a las funciones RPC → [05](./05-flujos.md)
- Unificar la librería de UI. **Hoy conviven `shadcn` (React) y `starwind`
  (Astro) con componentes duplicados** — hay un `Button`, un `Card`, un `Dialog`
  y un `Input` en cada una. Hay que elegir cuál es la fuente de verdad.
- Regenerar `src/types/database.ts` desde el esquema nuevo.
- Rehacer `src/lib/repositories/raffle.ts` contra las vistas públicas y las RPC.

---

## Landing y app: ¿pueden convivir?

**Sí, y ya conviven.** Es una de las cosas que v1 hace bien y hay que mantener.

Astro decide el modo de render **por página**, no por proyecto:

```
src/pages/
  index.astro            → export const prerender = true    · HTML estático
  r/[slug].astro         → SSR + cache header               · pública
  dashboard/**           → SSR, protegida por middleware     · app
  og/raffle/[id].png.ts  → endpoint, genera la imagen        · pública
```

No hace falta separar en dos proyectos. Un solo repo, un solo deploy, un solo
sistema de diseño, y las tres superficies comparten tipos y componentes.

### Lo único a decidir: dominio

| Opción | A favor | En contra |
|---|---|---|
| Todo en `rifate.app` **(recomendado)** | Un deploy, un certificado, links más cortos, el SEO de la landing y de las rifas se suma | El dashboard comparte dominio con lo público |
| `app.rifate.app` aparte | Separación de cookies más limpia | Dos deploys, dos configs, sin ganancia real a esta escala |

Recomiendo el dominio único. La separación de cookies no es un problema real acá:
Supabase ya scopea la sesión y el visitante anónimo no recibe ninguna.

---

## Cloudflare y D1

> ⚠️ **Esta sección quedó desactualizada.** Se revisó asumiendo proyecto de cero
> y la conclusión cambió: el hosting **sí** se mueve a Cloudflare desde el
> arranque, y el bloqueo del OG resultó ser falso.
> Ver **[01b · Infraestructura](./01b-infraestructura.md)** y la guía de
> implementación en **[07](./07-guia-cloudflare.md)**.

Preguntaste si era viable ir a Cloudflare con D1. Separo las dos cosas porque
tienen respuestas distintas.

### D1 como base de datos: **no**

| | Supabase (Postgres) | D1 (SQLite) |
|---|---|---|
| Row Level Security | Nativo | **No existe** |
| Autenticación | Incluida, ya andando con Google | Hay que sumar Better Auth y construirla |
| Realtime | Incluido | No hay |
| Tipos ricos (enums, `numeric`, arrays) | Sí | No: SQLite tiene 5 tipos |
| Constraints de coherencia | Completos | Limitados |
| Funciones del lado del servidor | plpgsql | No hay |

El bloqueante es el primero. Vos pediste *"RLS para todos los casos y roles"*, y
D1 no tiene RLS en absoluto. Sin RLS, **toda** la autorización pasa a vivir en
código de aplicación: cada query tiene que acordarse de filtrar por dueño. Un
solo `where owner_id = ?` olvidado en un solo endpoint expone los nombres y
teléfonos de los compradores de todas las rifas del sistema.

Esa es la data más sensible que guarda esta app, y son personas que no aceptaron
ningún término de uso: le dieron el teléfono a la vecina que les vendió el número.

Con Postgres, esa regla se escribe **una vez** por tabla y la base la aplica
siempre, aunque el código tenga un bug. Es una diferencia de categoría, no de
grado.

Sumado a eso: perdés el Google OAuth que ya funciona, perdés Realtime (que es
justo lo que da el "estado en vivo" de la rifa sin polling), y todo eso a cambio
de una migración grande que a esta escala no compra performance — el free tier de
Supabase cubre esta app con holgura.

### Cloudflare como hosting: **sí, pero después**

Esto es otra discusión y la respuesta es distinta. Astro tiene adapter oficial de
Cloudflare Workers, y `supabase-js` funciona ahí sin problema. Ventajas reales:
red más rápida, precios previsibles, buen free tier.

El costo concreto a resolver antes:

> **`@resvg/resvg-js` no corre en Workers.** Es un binding nativo de Node y
> Workers no ejecuta binarios nativos. Hoy es lo que rasteriza la imagen OG en
> `src/pages/og/raffle/[id].png.ts`. Migrar implica portarlo a una alternativa
> WASM (`workers-og` o `@resvg/resvg-wasm`) y verificar que el render salga igual.

**Por eso queda como hito posterior y opcional.** Hacer la migración de base de
datos y la de runtime al mismo tiempo significa que, cuando algo se rompa, no vas
a saber cuál de las dos lo rompió. Una cosa por vez.

Ver [06 · Roadmap](./06-roadmap.md), fase 6.
