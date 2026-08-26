# 06 · Roadmap

> Stack final: **Astro + Cloudflare Workers + D1 + Durable Objects + Better Auth**.
>
> Cada fase termina en algo **verificable**. Si el checkpoint no pasa, no se
> avanza. Punto de retorno siempre disponible: tag `v1.0.0`, rama `v1-stable`.

## Mapa

| Fase | Qué | Checkpoint | Riesgo |
|---|---|---|---|
| 0 | Congelar v1 | ✅ hecho | — |
| 1 | Planificación | ✅ hecho | — |
| 2 | Esqueleto que deploya | Se ve en `*.workers.dev` | Bajo |
| 3 | **Better Auth + D1** | Login con Google anda | **Alto** |
| 4 | Esquema D1 + DO | Se crea una rifa con su grilla | Medio |
| 5 | Capa de datos y autorización | Los tests de denegación pasan | **Alto** |
| 6 | Dashboard | Administrás una rifa punta a punta | Bajo |
| 7 | Página pública + compartir | El link se ve bien en WhatsApp | Medio |
| 8 | Plan PRO: pedidos y vivo | Dos navegadores ven la grilla actualizarse | Medio |
| 9 | Sorteo, vouchers, admin | Cierre del ciclo completo | Bajo |
| 10 | Deuda y futuro | — | — |

> Las fases 3 y 5 son las de riesgo alto y por eso van solas: **auth** porque es
> lo de mayor consecuencia si sale mal, y **autorización** porque es lo que
> reemplaza a RLS.

---

## Fase 0 — Congelar v1 ✅

- [x] Commitear lo pendiente
- [x] Tag `v1.0.0` y rama `v1-stable`
- [x] Borrar el código de v1, dejando sólo `/docs`
- [ ] Push del tag y las ramas al remoto

## Fase 1 — Planificación ✅

- [x] Contexto y alcance → [00](./00-contexto-y-alcance.md)
- [x] Stack e infraestructura → [01](./01-stack.md) · [01b](./01b-infraestructura.md)
- [x] Modelo de datos D1 + DO → [03](./03-modelo-de-datos.md)
- [x] Capa de autorización → [04](./04-rls-y-roles.md)
- [x] Durable Objects: costos y ciclo de vida → [09](./09-durable-objects.md)
- [x] Better Auth → [10](./10-better-auth.md)
- [ ] Reescribir [02 · Arquitectura](./02-arquitectura.md)
- [ ] Reemplazar `docs/sql/` por migraciones D1 + esquema del DO
- [ ] Cerrar: precio BASIC/PRO · duración de la reserva · dominio

---

## Fase 2 — Esqueleto que deploya

Lo mínimo para tener un ciclo `build → deploy → ver` funcionando.

```bash
pnpm create astro@latest .
pnpm add -D @astrojs/cloudflare wrangler
pnpm add -D @astrojs/react react react-dom
```

- [ ] `astro.config.mjs` con el adapter de Cloudflare y `platformProxy` activado
- [ ] `wrangler.jsonc`: `nodejs_compat`, `compatibility_date`, assets
- [ ] Portar de `v1.0.0` lo marcado 🟢 en [08](./08-arranque-desde-cero.md):
      `formatters`, `utils`, `global.css`, `.prettierrc`, `eslint.config.mjs`,
      `tsconfig.json`, `.editorconfig`
- [ ] `npx wrangler deploy`
- [ ] **✅ Checkpoint: la landing se ve en `rifate-app.<sub>.workers.dev`**

> Detalles de configuración en [07 · etapas A y B](./07-guia-cloudflare.md).
> Ignorá la parte de Supabase de ese documento.

---

## Fase 3 — Better Auth + D1 · 🔴 riesgo alto

Va sola porque es lo de mayor consecuencia. Guía completa en [10](./10-better-auth.md).

```bash
npx wrangler d1 create rifate-db
pnpm add better-auth kysely kysely-d1
pnpm add -D @better-auth/cli
```

- [ ] Binding de D1 en `wrangler.jsonc`
- [ ] `createAuth(env)` — **por request**, nunca a nivel de módulo
- [ ] `npx @better-auth/cli generate` y aplicar la migración
- [ ] Credenciales de Google + las **tres** URIs de redirección
- [ ] Secrets: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] Ruta catch-all `src/pages/api/auth/[...all].ts`
- [ ] Tabla `profiles` + el hook que crea el perfil al registrarse
- [ ] `Actor`, `actorFromSession`, middleware
- [ ] **✅ Checkpoint:**
      - login con Google funciona en local y desplegado
      - `/dashboard` sin sesión redirige a `/login`
      - `/admin` con rol `USER` devuelve **404**
      - registrarse crea la fila en `profiles` con `role = 'USER'`

---

## Fase 4 — Esquema

### D1

- [ ] Migración: `profiles`, `raffles`, `vouchers`, `voucher_redemptions`, `_abort`
- [ ] Índices de [03](./03-modelo-de-datos.md)
- [ ] `npx wrangler d1 migrations apply rifate-db --local` y `--remote`

### Durable Object

- [ ] Clase `Raffle` + binding y `new_sqlite_classes` en `wrangler.jsonc`
- [ ] `migrar()` con `PRAGMA user_version` — **desde el día uno**
- [ ] Tablas `meta`, `numbers`, `buyers`, `orders`
- [ ] `init()` que materializa la grilla en lotes de 500
- [ ] `destroy()` con `deleteAll()`
- [ ] **✅ Checkpoint: crear una rifa de 500 números y ver la grilla completa**

> La plata va en **`INTEGER` de centavos**. Si aparece un `REAL` para dinero,
> es un bug.

---

## Fase 5 — Datos y autorización · 🔴 riesgo alto

Lo que reemplaza a RLS. Guía en [04](./04-rls-y-roles.md).

```bash
pnpm add -D vitest @cloudflare/vitest-pool-workers
```

- [ ] Tipos `PublicNumber` / `OwnerNumber` — el público **sin** campos de comprador
- [ ] Repositorios D1 en `src/lib/db/`, todos con `actor` obligatorio
- [ ] Regla de ESLint que prohíbe `env.DB` fuera de `src/lib/db/`
- [ ] `assertOwner` en el DO + superficies pública y de organizador separadas
- [ ] `normalizePhone()` y `updated_at` en **un solo** lugar
- [ ] Proyección DO → D1 con `waitUntil` + método `resync()`
- [ ] **Tests de denegación:**
      - [ ] usuario ajeno → `FORBIDDEN` en `ownerGrid` y `sell`
      - [ ] `publicGrid()` serializado no contiene teléfonos
      - [ ] un organizador no puede auto-promoverse a `ADMIN`
- [ ] **✅ Checkpoint: los tests de denegación pasan**

---

## Fase 6 — Dashboard

- [ ] Layout de la app + menú de sesión
- [ ] `/dashboard/raffle` — listado (lee el catálogo de D1, no abre DOs)
- [ ] `/dashboard/raffle/create` — alta con Zod
- [ ] `/dashboard/raffle/[id]` — detalle con la grilla del DO
- [ ] Vender números / liberar
- [ ] Publicar (`DRAFT → PUBLISHED`)
- [ ] Decidir **starwind vs shadcn** y portar sólo la elegida
- [ ] **✅ Checkpoint: crear, publicar, vender y liberar sin tocar la base a mano**

---

## Fase 7 — Página pública y compartir

> A partir de acá conviene **Workers Paid ($5)**: la generación del OG necesita
> ~300 ms de CPU y el plan Free da 10 ms.

- [ ] `/r/[slug]` con `Cache-Control: s-maxage=30, stale-while-revalidate=300`
- [ ] Grilla pública (solo número y estado)
- [ ] `src/lib/og/` — plantilla satori + `resvg-wasm` + fuentes en base64
- [ ] `/og/raffle/[id]/[v].png.ts` con **URL versionada** e `immutable`
- [ ] `SocialMeta.astro` apuntando a la URL versionada
- [ ] Botón de contacto por WhatsApp
- [ ] **✅ Checkpoint: pegás el link en un chat y el preview muestra el estado real**

> La URL versionada no es cosmética: hace que la imagen se genere **una sola vez
> en la vida**, y el OG es el 60 % del consumo de CPU de la app.

---

## Fase 8 — Plan PRO: pedidos y estado en vivo

- [ ] `createOrder()` en el DO — valida tier, estado y máximo 50 números
- [ ] Selección de números en la página pública + mensaje de WhatsApp armado
- [ ] `/r/[slug]/pedido?t=` — el visitante consulta con su token
- [ ] Bandeja de pedidos en el dashboard: confirmar / cancelar
- [ ] `alarm()` que vence las reservas
- [ ] WebSocket con **`acceptWebSocket()`** ← nunca `accept()`
- [ ] **✅ Checkpoint: dos navegadores abiertos; vendés en uno y el otro se actualiza solo**

---

## Fase 9 — Sorteo, vouchers y admin

- [ ] `drawWinner()` — sortea entre los **vendidos**, o número manual
- [ ] Anuncio del ganador + OG con el ganador destacado
- [ ] `redeemVoucher()` con `UPDATE ... WHERE used_count < max_uses` + guarda
- [ ] `/admin/vouchers` — emisión, sólo `ADMIN`
- [ ] Cancelar rifa (no borrar, si tiene ventas)
- [ ] Borrado seguro: **`destroy()` del DO primero, D1 después**

---

## Fase 10 — Deuda y futuro

- [ ] Tests de la lógica de dominio pura
- [ ] Imagen descargable de la grilla — acá sí con **Browser Run**
- [ ] Mercado Pago (`unlock_method = 'PAYMENT'`)
- [ ] Dominio propio en Cloudflare
- [ ] Revisar métricas: DO duration, Workers CPU, D1 writes → [09](./09-durable-objects.md)

---

## Commits por fase

Conventional Commits + gitmoji, en inglés.

| Fase | Commit |
|---|---|
| 2 | `feat: :tada: bootstrap v2 on Astro and Cloudflare Workers` |
| 3 | `feat: :lock: add Better Auth with Google OAuth on D1` |
| 4 | `feat: :database: add D1 schema and Raffle durable object` |
| 5 | `feat: :safety_vest: add typed authorization layer with denial tests` |
| 6 | `feat: :sparkles: add raffle dashboard with manual sales` |
| 7 | `feat: :sparkles: add public raffle page with versioned OG images` |
| 8 | `feat: :sparkles: add PRO orders with reservations and live grid` |
| 9 | `feat: :sparkles: add winner draw, vouchers and admin panel` |

Trabajá en una rama: `git switch -c v2-refactor`. `main` refleja lo desplegado.

---

## Los tres errores que más caro salen

Todos están documentados, pero conviene tenerlos a mano:

1. **`accept()` en vez de `acceptWebSocket()`** → la factura pasa de $5 a $140.
   [09](./09-durable-objects.md)
2. **Crear la instancia de Better Auth a nivel de módulo** → rompe en runtime,
   no en build. [10](./10-better-auth.md)
3. **Un `WHERE` que usa un id del input en vez del actor** → filtra datos en
   silencio, sin romper nada. [04](./04-rls-y-roles.md)
