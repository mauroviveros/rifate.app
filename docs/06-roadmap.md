# 06 · Roadmap

> Stack final: **Astro + Cloudflare Workers + D1 + Durable Objects + Better Auth**.
>
> Cada fase termina en algo **verificable**. Si el checkpoint no pasa, no se
> avanza. Punto de retorno siempre disponible: tag `v1.0.0`, rama `v1-stable`.

## Mapa

| Fase | Qué | Checkpoint | Riesgo |
|---|---|---|---|
| 0 | Congelar v1 | ✅ hecho | — |
| 1 | Planificación | ✅ hecho ¹ | — |
| 2 | Esqueleto que deploya | ✅ se ve en `*.workers.dev` | Bajo |
| 3 | **Better Auth + D1** | ✅ login con Google anda | **Alto** |
| 4 | Esquema D1 + DO | ✅ se crea una rifa con su grilla | Medio |
| 5 | Capa de datos y autorización | ✅ los tests de denegación pasan | **Alto** |
| 6 | Dashboard | Administrás una rifa punta a punta | Bajo |
| 7 | Página pública + compartir | El link se ve bien en WhatsApp | Medio |
| 8 | Plan PRO: pedidos y vivo | Dos navegadores ven la grilla actualizarse | Medio |
| 9 | Sorteo, vouchers, admin | Cierre del ciclo completo | Bajo |
| 10 | Deuda y futuro | — | — |

> Las fases 3 y 5 son las de riesgo alto y por eso van solas: **auth** porque es
> lo de mayor consecuencia si sale mal, y **autorización** porque es lo que
> reemplaza a RLS. Las dos pasaron su checkpoint.
>
> ¹ Queda abierto lo de `docs/sql/` y las decisiones de producto — ver fase 1.
>
> **Convención de este documento:** cuando un ítem planificado resultó estar mal,
> no se borra: se tacha y abajo va lo que se hizo en su lugar. El error es la
> parte que sirve dentro de seis meses.

---

## Fase 0 — Congelar v1 ✅

- [x] Commitear lo pendiente
- [x] Tag `v1.0.0` y rama `v1-stable`
- [x] Borrar el código de v1, dejando sólo `/docs`
- [x] Push del tag y las ramas al remoto — `v1.0.0`, `main` y `v1-stable` están
      en `origin` (`git@github.com:mauroviveros/rifate.app.git`)

## Fase 1 — Planificación ✅ *(quedan dos pendientes, ninguno bloquea)*

- [x] Contexto y alcance → [00](./00-contexto-y-alcance.md)
- [x] Stack e infraestructura → [01](./01-stack.md) · [01b](./01b-infraestructura.md)
- [x] Modelo de datos D1 + DO → [03](./03-modelo-de-datos.md)
- [x] Capa de autorización → [04](./04-rls-y-roles.md)
- [x] Durable Objects: costos y ciclo de vida → [09](./09-durable-objects.md)
- [x] Better Auth → [10](./10-better-auth.md)
- [x] Reescribir [02 · Arquitectura](./02-arquitectura.md) — commit `f1f5321`
- [ ] ~~Reemplazar `docs/sql/` por migraciones D1 + esquema del DO~~
      → **borrar `docs/sql/`.** La verdad ya vive en `migrations/` y en
      `src/do/schema.ts`; la copia de `docs/` quedó vieja y ahora miente:
      - la numeración está corrida (`0002_profiles` acá, `0001_profiles` en el
        repo), así que copiar y pegar rompe el orden de las migraciones
      - su README manda a correr `@better-auth/cli generate`, que se sacó del
        proyecto por generar un esquema incompleto (ver fase 3)
      - `do/schema.ts` tiene las cuatro cosas que la fase 4 encontró mal
- [ ] Cerrar: precio BASIC/PRO · duración de la reserva · dominio
      *(bloquea la fase 6: sin precio no hay pantalla de plan)*

---

## Fase 2 — Esqueleto que deploya ✅

Lo mínimo para tener un ciclo `build → deploy → ver` funcionando.
Commit `fb6e09f`.

```bash
pnpm create astro@latest .
pnpm add -D @astrojs/cloudflare wrangler
pnpm add -D @astrojs/react react react-dom
```

- [x] ~~`astro.config.mjs` con el adapter de Cloudflare y `platformProxy` activado~~
      → **sin `platformProxy`: esa opción no existe** en
      `@astrojs/cloudflare@14.2.5`. El runtime local del adapter ya es
      autónomo, así que el dev server corre con `astro dev` en el **:4321** y
      este proyecto no pasa nunca por `wrangler dev`.
- [x] `wrangler.jsonc`: `nodejs_compat`, `compatibility_date`, assets
- [ ] Portar de `v1.0.0` lo marcado 🟢 en [08](./08-arranque-desde-cero.md)
      — **parcial**:
      - [x] `.prettierrc`, `eslint.config.mjs`, `tsconfig.json`, `.editorconfig`
            *(recuperados con `git checkout v1.0.0 -- <archivo>`, menos
            `prettier-plugin-tailwindcss`)*
      - [ ] `formatters`, `utils`, `global.css` — **posponer a la fase 6**:
            dependen de Tailwind, que todavía no está instalado, y sin una
            pantalla que los use no hay cómo saber si siguen sirviendo
- [x] `npx wrangler deploy`
- [x] **✅ Checkpoint: la landing se ve en `rifate.mauroviveros.workers.dev`**

> ⚠️ El Worker se renombró **tres veces**: `rifate_app` → `rifate-app` →
> `rifate`. El primero porque el guion bajo hace que el subdominio
> `*.workers.dev` no sea una redirect URI válida para Google OAuth. Cada
> renombre **huerfaniza los secrets** (son por nombre de Worker): hay que
> rehacer los tres `wrangler secret put` y sumar la nueva URI de redirección en
> Google. El nombre vive en `wrangler.jsonc` (`name` y `vars.PUBLIC_APP_URL`);
> `.dev.vars` pisa `PUBLIC_APP_URL` con `http://localhost:4321` para local, y
> se confirmó que gana sobre `vars` incluso sin ser un secret.

> ⚠️ **Nunca confíes sólo en `wrangler.jsonc` para saber qué se desplegó.** El
> build de Astro genera `dist/server/wrangler.json` y
> `.wrangler/deploy/config.json` redirige `wrangler deploy` ahí. Un `dist/`
> viejo despliega config vieja en silencio: siempre `pnpm build` antes.

> Detalles de configuración en [07 · etapas A y B](./07-guia-cloudflare.md).
> Ignorá la parte de Supabase de ese documento.

---

## Fase 3 — Better Auth + D1 · 🔴 riesgo alto ✅

Va sola porque es lo de mayor consecuencia. Guía completa en [10](./10-better-auth.md).

```bash
npx wrangler d1 create rifate-db
pnpm add better-auth kysely kysely-d1
```

- [x] Binding de D1 en `wrangler.jsonc`
- [x] `createAuth(env)` — **por request**, nunca a nivel de módulo
- [x] ~~`npx @better-auth/cli generate` y aplicar la migración~~
      → **el CLI se sacó del proyecto.** Las migraciones de Better Auth se
      escriben a mano leyendo los esquemas zod de `@better-auth/core`. Ver el
      recuadro de abajo.
- [x] Credenciales de Google + las **tres** URIs de redirección
- [x] Secrets: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [x] Ruta catch-all `src/pages/api/auth/[...all].ts`
- [x] Tabla `profiles` + el hook que crea el perfil al registrarse
- [x] `Actor`, `actorFromSession`, middleware
- [x] Rate limiting real: `rateLimit.storage = 'database'` + migración
      `0006_rate_limit.sql`. Better Auth lo activa solo en producción pero por
      defecto guarda en **memoria**, que en Workers es por isolate y no sirve de
      nada. `secondaryStorage` sobre KV se descartó: definirlo mueve también las
      *sesiones* a KV, que es eventualmente consistente → logout demorado.
- [x] **✅ Checkpoint:**
      - login con Google funciona en local y desplegado
      - `/dashboard` sin sesión redirige a `/login`
      - `/admin` con rol `USER` devuelve **404**
      - registrarse crea la fila en `profiles` con `role = 'USER'`

> ⚠️ **`@better-auth/cli` está atrasado respecto de la librería y hay que
> desconfiar de lo que genera.** Pinea su propio `better-auth@1.4.21` e ignora
> el `1.7.2` del proyecto. Su `generate` produjo un `0000_better_auth.sql` sin
> la columna `account.issuer` (agregada entre esas dos versiones), y el login
> con Google moría en el callback con un "no such column". Arreglado con
> `0002_account_issuer.sql`, y verificado diffeando los cuatro esquemas zod de
> `@better-auth/core@1.7.2` contra el SQL generado. Además, tenerlo instalado
> rompió el build: pnpm resolvió el peer de `@better-auth/core@1.7.2` contra el
> `better-call@1.1.8` de su árbol, que no tiene `kAPIErrorHeaderSymbol`.

> ⚠️ **El bug que el checkpoint no atrapó.** El middleware salió con
> `if (path.startsWith('/admin') && isAdmin(actor))` — sin el `!`. Invertido:
> admins afuera, usuarios comunes adentro. Pasó el checkpoint igual porque
> todavía no existía ninguna ruta `/admin`, así que el 404 que se vio lo tiraba
> el router de Astro, no el middleware. **Un checkpoint que afirma "devuelve
> 404" no prueba nada si la ruta no existe:** hay que afirmar sobre el *cuerpo*
> de la respuesta (el middleware contesta `No encontrado`) o escribir el test de
> denegación. Es la razón por la que la fase 5 existe.

---

## Fase 4 — Esquema ✅

### D1

- [x] Migración: `profiles`, `raffles`, `vouchers`, `voucher_redemptions`, `_abort`
- [x] Índices de [03](./03-modelo-de-datos.md)
- [x] `npx wrangler d1 migrations apply rifate-db --local` y `--remote`

### Durable Object

- [x] Clase `Raffle` + binding y `new_sqlite_classes` en `wrangler.jsonc`
- [x] ~~`migrar()` con `PRAGMA user_version`~~ — **desde el día uno**, sí, pero
      con una tabla `_migrations` propia: el SQLite de un Durable Object rechaza
      `PRAGMA user_version` con `not authorized: SQLITE_AUTH`, y la doc de
      Cloudflare recomienda justamente llevar el registro en una tabla.
- [x] Tablas `meta`, `numbers`, `buyers`, `orders`
- [x] ~~`init()` que materializa la grilla en lotes de 500~~
      → **CTE recursivo, un solo statement.** El límite es de ~100 parámetros
      por statement (los mismos que D1), así que un lote de 500 filas manda
      1000 y muere con `too many SQL variables`. La serie la genera SQLite:
      tres parámetros, 10.000 números en ~57 ms.
- [x] ~~`destroy()` con `deleteAll()`~~
      → `deleteAll()` + **`migrate()` de nuevo al final.** `deleteAll()` borra
      también el esquema, y `migrate()` sólo corre en el constructor — que para
      esa instancia ya corrió. Sin eso el objeto queda vivo y sin tablas, y todo
      lo que venga después falla con `no such table`, incluido un segundo
      `destroy()`, que es exactamente lo que hay que poder hacer si el DELETE de
      D1 falló y se reintenta.
- [x] **✅ Checkpoint: crear una rifa de 500 números y ver la grilla completa** —
      más idempotencia de `init()`, `number_start = 1`, el tope de 10.000 y un
      `destroy()` reintentable

> La plata va en **`INTEGER` de centavos**. Si aparece un `REAL` para dinero,
> es un bug.

> ⚠️ **Dónde vive la clase del DO.** El entrypoint del adapter
> (`@astrojs/cloudflare/entrypoints/server`) sólo exporta `fetch`, así que la
> clase no tiene dónde ir. `src/worker.ts` reexporta el default del adapter y
> suma la clase, y el `main` de `wrangler.jsonc` apunta ahí. Funciona porque la
> entrada virtual de `@cloudflare/vite-plugin` hace `export * from "<main>"`.

> ⚠️ **El DO guarda su `raffle_id` explícito en `meta`.** No uses `ctx.id.name`:
> está tipado `readonly name?: string` y sólo viene poblado si el objeto se creó
> con `getByName`/`idFromName`. Depender de eso se rompe en silencio.

---

## Fase 5 — Datos y autorización · 🔴 riesgo alto ✅

Lo que reemplaza a RLS. Guía en [04](./04-rls-y-roles.md).

```bash
pnpm add -D vitest@^4.1.0 @cloudflare/vitest-pool-workers@^0.22.0
```

- [x] Tipos `PublicNumber` / `OwnerNumber` — el público **sin** campos de comprador
- [x] Repositorios D1 en `src/lib/db/`, todos con `actor` obligatorio
- [x] Regla de ESLint que prohíbe `env.DB` fuera de `src/lib/db/`
- [x] `assertOwner` en el DO + superficies pública y de organizador separadas
- [x] `normalizePhone()` y `updated_at` en **un solo** lugar
- [x] Proyección DO → D1 con `waitUntil` + método `resync()`
- [x] **Tests de denegación:**
      - [x] usuario ajeno → `FORBIDDEN` en `ownerGrid` y `sell`
      - [x] `publicGrid()` serializado no contiene teléfonos
      - [x] un organizador no puede auto-promoverse a `ADMIN`
- [x] Errores de dominio con código estable en `src/lib/errors.ts` — el
      `message` **es** el código, porque a través del RPC de un Durable Object
      no se puede contar con una propiedad `.code`, e `instanceof` del otro lado
      ya no es la misma clase
- [x] **✅ Checkpoint: los tests de denegación pasan** — 63 tests en verde,
      `pnpm check` y `pnpm lint` limpios

> ⚠️ **Tres cosas del armado de tests que no están en la doc de Cloudflare**,
> encontradas corriéndolo. `@cloudflare/vitest-pool-workers@0.22` es el primero
> para Vitest 4 y cambió bastante:
>
> 1. **No existe más `@cloudflare/vitest-pool-workers/config`** ni
>    `defineWorkersConfig`: ahora es un plugin de Vite, `cloudflareTest()`.
>    Tampoco existe el *isolated storage* automático, así que el reseteo entre
>    tests es explícito.
> 2. **`reset()` es `deleteAllDurableObjects()`, y eso borra también D1** —
>    en local D1 está implementado encima de un Durable Object, así que se lo
>    lleva puesto y las migraciones hay que reaplicarlas en cada test. Llamar
>    `abortAllDurableObjects()` antes lo deja **sin efecto** (verificado: sin
>    eso pasa sólo el primer test de cada archivo).
> 3. **Toda excepción que cruza el RPC de un DO queda además registrada como
>    "unhandled rejection"** aunque el test la capture, y el proceso termina en
>    error con todo en verde. Pasa con cualquier error, incluido un `TypeError`
>    del runtime, y con los cuatro estilos de aserción. Los tests que esperan un
>    rechazo van por `runInDurableObject`, que corre el método sobre la misma
>    instancia sin RPC en el medio.

> **Lo que queda sin cubrir, a propósito:** que el código del error sobreviva la
> serialización del RPC — es consecuencia del punto 3. Se verifica de punta a
> punta en la fase 6, cuando haya una action que lo traduzca con
> `describeError()`.

> **Decisiones que quedaron abiertas en esta fase:**
> - `normalizePhone()` **no inventa el `9`** de los celulares argentinos: un
>   número local de 10 dígitos puede ser celular o fijo y desde el backend no
>   hay cómo distinguirlos. Si el link de WhatsApp lo necesita, se resuelve en
>   el formulario.
> - **El DO no tiene bypass de admin.** La matriz de [04](./04-rls-y-roles.md)
>   dice que el admin ve compradores, pero el mecanismo que nombra es
>   `assertOwner`, que sólo conoce al dueño. Si hace falta, va como método
>   aparte con nombre explícito — no como una excepción adentro de `assertOwner`.
> - Listado global de rifas para el admin: pospuesto a la fase 9.

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
