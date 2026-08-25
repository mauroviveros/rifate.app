# 06 · Roadmap

> Cada fase es un commit (o pocos). El criterio: **cada fase deja el proyecto
> andando.** Nada de una rama gigante que rompe todo por tres semanas.
>
> Punto de retorno siempre disponible: tag `v1.0.0` / rama `v1-stable`.

---

## Fase 0 — Congelar v1 ✅

- [x] Commitear todo lo pendiente
- [x] Tag `v1.0.0`
- [x] Rama `v1-stable`
- [ ] Push del tag y la rama al remoto

---

## Fase 1 — Documentación y decisiones ← **acá estamos**

- [x] Analizar el esquema y el código de v1
- [x] Decidir stack → [01](./01-stack.md)
- [x] Diseñar el modelo de datos → [03](./03-modelo-de-datos.md)
- [x] Diseñar RLS por actor → [04](./04-rls-y-roles.md)
- [x] Escribir la propuesta SQL → [`docs/sql/`](./sql/)
- [x] Revisar infraestructura asumiendo proyecto de cero → [01b](./01b-infraestructura.md)
- [x] **Decisión: Astro + Cloudflare Workers + Supabase**
- [ ] **Revisar todo esto con ojo crítico y marcar lo que no cierre**
- [ ] Cerrar los pendientes del [README](./README.md): precios, duración de la
      reserva, dominio

> **Nada se aplica hasta que esto esté revisado.** `supabase/migrations/` sigue
> vacío a propósito.

---

## Fase 1.5 — Arranque del proyecto nuevo

Leer **[08 · Arranque desde cero](./08-arranque-desde-cero.md)** antes de borrar nada.

- [ ] `pnpm create astro@latest` en carpeta nueva
- [ ] Portar los archivos marcados 🟢 desde `v1.0.0`
- [ ] Decidir starwind vs shadcn y portar sólo la elegida
- [ ] **Checkpoint: el login con Google funciona en el proyecto nuevo**

> Se **queda en Vercel**. La migración a Cloudflare está documentada en
> [07](./07-guia-cloudflare.md) y se ejecuta cuando actives el cobro (fase 6).

---

## Fase 2 — Toolchain de base de datos

Antes de escribir una tabla, poder versionarlas.

- [ ] Instalar la CLI de Supabase (`brew install supabase/tap/supabase`)
- [ ] `supabase init` → genera `config.toml`
- [ ] `supabase link --project-ref <ref>`
- [ ] Levantar el entorno local (`supabase start`, requiere Docker)
- [ ] Agregar scripts a `package.json`:
      `db:start` · `db:reset` · `db:diff` · `db:push` · `db:types`
- [ ] Bajar el esquema actual de producción como respaldo:
      `supabase db dump --schema public > docs/sql/_v1_snapshot.sql`

> Este último paso importa más de lo que parece: hoy **no existe ningún registro
> de qué policies tiene puesta la base de v1**. Sin ese dump no hay con qué
> comparar ni a qué volver.

---

## Fase 3 — Esquema nuevo, en local

- [ ] Mover `docs/sql/*.sql` → `supabase/migrations/`
- [ ] `supabase db reset` y que corra **entero, sin errores**
- [ ] Correr los chequeos de RLS de [04](./04-rls-y-roles.md#cómo-probar-que-esto-funciona)
      — sobre todo los que tienen que **denegar**
- [ ] Probar concurrencia: dos `create_raffle_order()` sobre el mismo número en
      dos sesiones psql a la vez. Uno tiene que fallar.
- [ ] Regenerar tipos: `supabase gen types typescript --local > src/types/database.ts`

> El SQL de `docs/sql/` fue revisado a mano pero **nunca se ejecutó** — no hay
> Postgres ni Docker en esta máquina. Asumí que la primera corrida va a tirar
> algún error de sintaxis o de orden de dependencias. Es esperable.

---

## Fase 4 — Migración de datos

- [ ] Crear un proyecto Supabase de **staging**
- [ ] Aplicar el esquema nuevo ahí
- [ ] Escribir el script de transformación (ver [03](./03-modelo-de-datos.md#migración-de-los-datos-de-v1))
- [ ] Correrlo con una copia de los datos reales
- [ ] **Verificar totales por rifa contra v1**: vendidos y recaudado tienen que
      dar idénticos
- [ ] Recién ahí, producción

Además:

- [ ] Redirect 301 de `/raffle/[id]` → `/r/[slug]`

> Hay links `/raffle/<uuid>` circulando en chats de WhatsApp de rifas que están
> en curso. Si esos links mueren, se rompe una rifa de alguien que está en el
> medio de venderla.

---

## Fase 5 — Adaptar la aplicación

En este orden, porque cada paso depende del anterior:

- [ ] `src/lib/supabase/errors.ts` — mapa de códigos → castellano ([05](./05-flujos.md#errores-de-postgres-a-castellano))
- [ ] Reescribir `src/lib/repositories/raffle.ts` contra vistas + RPC
- [ ] `src/lib/repositories/order.ts` y `voucher.ts`
- [ ] Actions: `create`, `publish`, `sell`, `release`, `draw`
- [ ] Actions de pedidos: `create`, `confirm`, `cancel`
- [ ] Página pública `/r/[slug]` + cache header
- [ ] Selección de números con pedido real (hoy sólo arma el mensaje)
- [ ] `/r/[slug]/pedido?t=` — estado del pedido para el visitante
- [ ] Dashboard: bandeja de pedidos pendientes
- [ ] Dashboard: sorteo y anuncio del ganador
- [ ] `/admin/vouchers`
- [ ] OG: **URL versionada** `/og/raffle/{id}/{vendidos}.png` (arregla el cache
      de WhatsApp) + plantilla satori con la grilla en colores → [07 · etapa C](./07-guia-cloudflare.md)
- [ ] Imagen descargable de la grilla

---

## Fase 6 — Deuda y opcionales

Ninguna bloquea el refactor.

- [ ] **Unificar shadcn vs starwind** ([02](./02-arquitectura.md#la-deuda-de-ui-que-hay-que-saldar)) —
      hay 7 componentes duplicados
- [ ] Tests de `src/lib/domain/` (son funciones puras: es la fruta más baja)
- [ ] Realtime en la página pública, en lugar del cache de 30 s
- [ ] Mercado Pago
- [ ] **Migrar a Cloudflare Workers** cuando actives el cobro → [07](./07-guia-cloudflare.md)
- [ ] Evaluar Durable Objects por rifa para estado en vivo por WebSocket
      ([01b](./01b-infraestructura.md#durable-objects-por-qué-siguen-sobre-la-mesa))

---

## Commits sugeridos

Convención del repo: Conventional Commits + gitmoji, en inglés (según el
historial de `git log`).

| Fase | Commit |
|---|---|
| 1 | `docs: :memo: add refactor planning docs and proposed v2 schema` |
| 1.5 | `feat: :tada: bootstrap v2 project and port salvaged v1 modules` |
| 2 | `chore: :wrench: set up supabase CLI and database scripts` |
| 3 | `feat: :database: add v2 schema with RLS policies and RPC functions` |
| 3 | `feat: :label: regenerate database types from v2 schema` |
| 4 | `feat: :truck: migrate v1 data to v2 schema` |
| 4 | `feat: :children_crossing: redirect legacy raffle URLs to slug routes` |
| 5 | `refactor: :recycle: rewrite raffle repository against views and RPC` |
| 5 | `feat: :sparkles: add raffle orders with number reservation (PRO)` |
| 5 | `feat: :sparkles: add winner draw and announcement` |
| 5 | `feat: :sparkles: add voucher redemption and admin panel` |
| 6 | `refactor: :lipstick: unify UI components under starwind` |

---

## Comandos de git

**Ahora — cerrar la fase 0 y commitear la fase 1:**

```bash
# Push del punto de retorno
git push origin v1-stable
git push origin v1.0.0

# Documentación de planificación
git add docs/
git commit -m "docs: :memo: add refactor planning docs and proposed v2 schema

Documenta las decisiones del refactor v2: stack (se sigue en Astro, se
descarta D1 por falta de RLS), modelo de datos rediseñado, matriz de RLS
por actor, flujos y roadmap por fases.

Incluye la propuesta de esquema en docs/sql/, sin aplicar: supabase/migrations
sigue vacío hasta que la planificación esté revisada."

git push origin main
```

**Fase 2:**

```bash
git add supabase/config.toml package.json
git commit -m "chore: :wrench: set up supabase CLI and database scripts"
```

**Fase 3** (recién cuando `supabase db reset` corra limpio):

```bash
git mv docs/sql/*.sql supabase/migrations/
git add supabase/migrations/
git commit -m "feat: :database: add v2 schema with RLS policies and RPC functions"

git add src/types/database.ts
git commit -m "feat: :label: regenerate database types from v2 schema"
```

> Trabajá el refactor en una rama: `git switch -c v2-refactor`. `main` se queda
> reflejando lo que está en producción hasta que v2 esté probado.
