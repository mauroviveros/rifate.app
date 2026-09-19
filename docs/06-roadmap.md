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
| 6 | Dashboard | ✅ crear, publicar, vender y liberar desde la pantalla | Bajo |
| 7 | Página pública + compartir | El link se ve bien en WhatsApp | Medio |
| 8 | Plan PRO: pedidos y vivo | Dos navegadores ven la grilla actualizarse | Medio |
| 9 | Sorteo, vouchers, admin | Cierre del ciclo completo | Bajo |
| 10 | Deuda y futuro | — | — |

> Las fases 3 y 5 son las de riesgo alto y por eso van solas: **auth** porque es
> lo de mayor consecuencia si sale mal, y **autorización** porque es lo que
> reemplaza a RLS. Las dos pasaron su checkpoint.
>
> ¹ Queda abierto sólo el cierre de las decisiones de producto — ver fase 1.
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

## Fase 1 — Planificación ✅ *(queda un pendiente, no bloquea)*

- [x] Contexto y alcance → [00](./00-contexto-y-alcance.md)
- [x] Stack e infraestructura → [01](./01-stack.md) · [01b](./01b-infraestructura.md)
- [x] Modelo de datos D1 + DO → [03](./03-modelo-de-datos.md)
- [x] Capa de autorización → [04](./04-rls-y-roles.md)
- [x] Durable Objects: costos y ciclo de vida → [09](./09-durable-objects.md)
- [x] Better Auth → [10](./10-better-auth.md)
- [x] Reescribir [02 · Arquitectura](./02-arquitectura.md) — commit `f1f5321`
- [x] ~~Reemplazar `docs/sql/` por migraciones D1 + esquema del DO~~
      → **`docs/sql/` borrado.** La verdad vive en `migrations/` (D1) y en
      `src/do/schema.ts` (DO). La copia de `docs/` mentía: numeración corrida
      (`0002_profiles` vs `0001_profiles` en el repo), su README mandaba a correr
      `@better-auth/cli generate` —que se sacó del proyecto— y su `do/schema.ts`
      tenía las cuatro cosas que la fase 4 encontró mal. Quedan enlaces colgados
      a `docs/sql/` en `07`, `08`, `01b`, `02` y el `README` de `docs/`: se
      limpian cuando se toque cada uno.
- [x] ~~Dominio~~ → **`rifate.app` está en producción**, servido por Cloudflare.
      Pero quedó **deriva de configuración**, y hay que cerrarla antes de la
      fase 7: `wrangler.jsonc` no tiene bloque `routes` —el dominio se enganchó
      desde el panel de Cloudflare, así que el repo no lo registra— y
      `vars.PUBLIC_APP_URL` sigue diciendo
      `https://rifate.mauroviveros.workers.dev`. Ese valor es el `baseURL` de
      Better Auth y va a ser la base de las URLs del OG: **verificar que un
      login iniciado en `rifate.app` no rebote a `workers.dev`**, y sumar la URI
      de redirección en Google si falta.
- [ ] Cerrar: precio BASIC/PRO · duración de la reserva
      *(el precio bloquea la pantalla de plan, no el resto de la fase 6: el
      `ticket_price` de una rifa lo pone el organizador y ya está en el modelo)*

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

```bash
npx starwind@latest init --astro     # trae tailwind v4 y el contrato de tokens
pnpm add -D prettier-plugin-tailwindcss
```

- [x] Sistema visual «Talonario» en `src/styles/global.css` + fuentes por la
      API de Astro
- [x] Layout de la app + menú de sesión (`src/layouts/Dashboard.astro` +
      `layouts/components/Header.astro` · `User.astro`)
- [x] Pantalla `Login` (`src/pages/ingresar.astro`) contra el artboard — no
      estaba como ítem: la fase 3 sólo la nombraba como destino de redirect
- [x] Pantalla `NotFound` (`src/pages/404.astro`) contra el artboard
- [x] Landing `/` (`src/pages/index.astro`, `prerender = true`) contra los
      artboards `Landing` / `LandingMobile`: `Hero` · `HowItWorks` · `FAQs` ·
      `CTA` en `src/components/landing/`, sobre `src/layouts/Marketing.astro`
      (nav + footer del sitio público)
- [x] Legales `/terminos` · `/privacidad` · `/contacto` contra sus artboards de
      la página «Lo que ve el comprador» del canvas, sobre
      `src/layouts/Article.astro` (título + bajada + fecha + secciones) y
      `src/components/ui/Section.astro` (sección numerada). Las tres
      `prerender = true`
- [x] `src/layouts/Focused.astro` — extraído de `ingresar` y `404`, que tenían
      duplicado el `<main>` centrado sobre la trama
- [x] `src/components/ui/tile/Tile.astro` — el cuadradito con ícono o número, con
      variants `size` (sm–xl) y `tone` (ink/muted/primary). Unifica el badge de
      `Section`, los pasos de `HowItWorks` y los íconos de las tarjetas de contacto
- [x] `release()` en el Durable Object — faltaba la contracara de `sell()`
- [x] `/panel` — listado del catálogo con `listOwnRaffles(actor)`, **sin abrir
      ningún DO**: el avance de cada tarjeta sale de `sold_count` /
      `reserved_count`, que el DO proyecta cuando vende. Tipo `RaffleListItem`
      (= `RaffleCard` + `prize` + ganador) con su propio `toListItem()`, para no
      ensanchar la card base que también van a usar las superficies públicas.
      La pantalla se descompone como la landing: ~~`Header` · `Stats` ·
      `Raffles` · `NewRaffle` · `MobileBar` en `src/components/panel/`, más
      `NewRaffleButton`~~ → hoy en **`src/components/panel/list/`**: `Stats` ·
      `Raffles`/`Raffle` · `Empty` · `NewRaffleCTA` · `MobileBar` ·
      `NewRaffleBtn`, que concentra la ruta y el copy del CTA que estaba
      repetido en cuatro lugares. El frontmatter de la tarjeta —estado, badge,
      acción, puntos, bajada— vive en `src/utils/frontmatter/raffle.ts` con 14
      tests propios: el frontmatter de un `.astro` no se puede testear
- [x] **Astro Actions + Zod** — `src/actions/` con `index.ts` (el barril que
      Astro busca), `raffle.ts` (las cuatro actions), `raffle.schema.ts` (los
      esquemas, aparte para poder testearse: `raffle.ts` importa `astro:actions`,
      que es virtual) y `errors.ts` con `asActionError()`. **Zod no se instaló**:
      viene con Astro y se importa de `astro/zod`
- [x] **Envolturas con binding** — `src/lib/raffles.ts` pasó a
      `src/lib/raffles/`, espejando `src/lib/db/`: `flows.ts` (los flujos, con
      los bindings por parámetro, testeables), `bound.ts` (los resuelve) e
      `index.ts` (el barril). Son **dos** combinadores, `withDbAndRaffles` y
      `withRaffles`: `sellNumbers` / `releaseNumbers` no tocan D1
- [x] **Regla de eslint extendida a `RAFFLE`** — dos entradas en
      `no-restricted-syntax`, no una regex en el selector
- [x] `/panel/rifa/crear` contra el artboard `Create` — alta con Zod →
      `createRaffleWithGrid`
- [x] `/panel/rifa/[id]` contra el artboard `Detail`. ~~`Header` (badge de
      estado + bajada premio/fecha + `Actions`) · `Stats` · `Grid`/`Cell` ·
      `Sale` · `SaleBar` (barra fija hasta `lg`) · `Buyers`/`BuyerRow` en
      `src/components/panel/detail/`, con la lógica pura en
      `src/utils/frontmatter/detail.ts` y sus tests. `Dashboard` ganó `heading`
      / `description` como props, slots `eyebrow` / `actions` y un
      `wideActions` para el modo «título a su propia fila»~~
      → **la pantalla se reescribió entera**; ver «Reescritura del detalle»
      más abajo. Lo que sí quedó de este ítem: `panel/Header.astro` se plegó
      adentro del layout y su frase-resumen fue a `frontmatter/panel.ts`
- [x] Vender / liberar → `sell()` / `release()` del DO desde un solo `<form>`
      con dos `formaction`. **La deuda de la fase 5 quedó cerrada**: el código
      del error sobrevive el RPC — `sell()` de un número ya vendido llega como
      «Alguien tomó uno de esos números. Elegí otros.». El botón de vender va
      **verde** (confirmación, docs/11), no vermellón: el único vermellón del
      detalle es «Compartir por WhatsApp». `sell()` además copia la nota de la
      venta en `numbers.note` de cada fila (no lo hacía, así que `Buyers` nunca
      la mostraba)
- [x] Publicar (`DRAFT → PUBLISHED`) → `publishRaffle`. Sin `contact_phone` el
      botón se deshabilita y lo dice
- [x] ~~Decidir **starwind vs shadcn** y portar sólo la elegida~~
      → **la pregunta estaba mal planteada.** No era qué librería: los
      componentes de las dos están escritos contra `bg-primary` /
      `border-border` / `--radius`, así que **el `global.css` es el que decide
      si algún día se puede portar algo**. Se escribió con ese contrato más
      alias de marca encima. Cuándo usar cada una: la regla de las tres puertas
      en [11](./11-sistema-visual.md).
- [x] **✅ Checkpoint: crear, publicar, vender y liberar sin tocar la base a
      mano** — corrido de punta a punta sobre una rifa de 100 números

> ⚠️ **Un día del calendario no se compara con `toISOString()`.** La tarjeta
> marcaba «Últimos días» comparando `draw_date` contra
> `new Date(…).toISOString().slice(0, 10)`, que da el día **UTC**: desde las
> 21:00 de Argentina el umbral se corría un día y el badge se prendía antes de
> tiempo. Es la misma trampa que `format.ts` ya documentaba esquivar en
> `shortDate()`, tres funciones más arriba. Ahora sale de `today()` / `inDays()`,
> que arman el día argentino con `Intl` y `formatToParts`. Y ese umbral **no
> puede ser un `const` de módulo**: un isolate de Workers vive horas y el valor
> se congelaría — se calcula una vez por request en `Raffles.astro` y baja por
> prop.

> **Los ternarios anidados de la tarjeta pasaron a dos `Record` exhaustivos**
> (`BADGE` y `ACCION`, indexados por un `EstadoTarjeta` derivado). No es
> estética: con la cadena de ternarios, un estado nuevo caía en el `else` final
> y la rifa se mostraba «En venta» en silencio. Con el `Record`, TypeScript
> obliga a llenar las dos tablas.

> ⚠️ **Las rutas van en castellano**, no como las nombraba este documento antes.
> Los ítems de arriba decían `/dashboard/raffle/...`; el código quedó así:
>
> | Antes (este doc) | Real |
> |---|---|
> | `/dashboard` | `/panel` |
> | `/login` | `/ingresar` |
> | `/admin` | `/administracion` |
>
> `src/middleware.ts` protege `/^\/(panel|administracion)(\/|$)/` y redirige a
> `/ingresar?next=…`. El paréntesis `(\/|$)` no es adorno: sin él `/panel`
> también matchea `/panelazo`.
>
> El módulo que toca **D1 y el DO en el mismo acto** —crear con grilla, publicar—
> es `src/lib/raffles.ts` (`createRaffleWithGrid`, `publishRaffle`), no un repo
> de `src/lib/db/`: recibe además el namespace del DO, así que no es un
> repositorio. La regla de qué escribe primero está en [03](./03-modelo-de-datos.md).

> **Los layouts**, para no mezclarlos:
>
> | Layout | Qué arma | Lo usan |
> |---|---|---|
> | `Layout.astro` ¹ | shell `<html>` + fuentes | todos |
> | `Marketing.astro` | nav + footer del sitio público | landing · legales |
> | `Article.astro` | página de texto larga, sobre `Marketing` | `/terminos` · `/privacidad` · `/contacto` |
> | `Focused.astro` | una tarjeta centrada sobre la trama | `/ingresar` · `/404` |
> | `Dashboard.astro` | la app | `/panel/*` |
>
> ¹ Se llamaba `Base.astro`. Y la marca se mudó con él: `components/brand/`
> pasó a `src/layouts/components/brand/`, que es el único lugar que la usa.
>
> El middleware corta antes de resolver sesión en las rutas `prerender = true`
> (chequea `isPrerendered` en `src/middleware.ts`): la landing y las legales se
> sirven como HTML estático desde el asset storage, sin invocar el Worker ni
> tocar D1. Corre igual durante el build, y ahí no hay bindings.

> **Tres decisiones de la fase, con el porqué:**
>
> 1. **La grilla va en Astro puro**, no en React. Medido: el markup de una rifa
>    BASIC (tope 1000) pesa **2,5 KB en brotli**, contra ~45 KB gzip que pesa el
>    runtime de React antes de dibujar la primera celda. Pero el argumento
>    grande es la forma del estado: un `Set` de elegidos, un solo listener con
>    delegación, y actualizaciones puntuales por clave (`[data-n="47"]`). La
>    fase 8 lo refuerza en vez de invertirlo — los mensajes del WebSocket van a
>    ser exactamente «cambió el número N».
> 2. **Nada de `server:defer` acá.** Verificado que el island corre el
>    middleware (`/_server-islands/[name]` se inyecta como ruta real del
>    manifest), así que autorización no es el problema. El problema es que
>    `/panel/rifa/[id]` es 100 % personalizada y no hay nada que cachear:
>    el island sólo agrega un round trip, una invocación y una llamada más al
>    DO. Y la grilla **es** el contenido de esa pantalla: diferirla es diferir
>    la página. El caso de manual es la fase 7, `/r/[slug]`, y ahí se decide
>    midiendo — un island deja la grilla siempre fresca pero despierta el DO en
>    cada visita, que es lo peor que puede pasar con un link que se viraliza.
> 3. **10.000 números en el DOM es pesado con cualquier tecnología.** Cuando
>    llegue PRO la respuesta no es virtualizar, es **producto**: el talonario de
>    papel se maneja por centenas y la grilla también debería. Queda para la
>    fase 8; con el tope de 1000 de BASIC no hace falta. Ojo que `ownerGrid()`
>    devuelve todos los números en un solo RPC: si se pagina, se pagina también
>    ahí.

> **Deuda del detalle, anotada para cuando toque:**
>
> | Qué | Dónde se resuelve |
> |---|---|
> | ~~No hay cómo **editar** una rifa~~ | ✅ **hecho** — `/panel/rifa/[id]/editar` |
> | ~~El panel `Sale` sigue interactivo en `CLOSED` / `CANCELLED`~~ | ✅ **imposible por construcción**: `estadoDetalle()` manda a `Closed.astro`, que no monta el panel. La guarda del DO sigue faltando |
> | `estadoDe()` muestra `CANCELLED` como «Ya sorteada» en la tarjeta del listado | fase 9 |
> | Teléfono del comprador en E.164 (`+54…`), no `11 4455-2211` como el canvas | `src/lib/whatsapp/` en la fase 7 |
> | La celda `RESERVED` se rotula «· vendido» en el `sr-only` | fase 8 (ahí aparecen las reservas) |
> | `buyers.note` quedó vestigial (la nota se lee de `numbers.note`); `upsertBuyer` tampoco la actualiza en un comprador que repite | limpiar si estorba |
> | La Nota del formulario de venta siempre visible (el canvas no la tiene) | cosmético: plegarla en `<details>` si el form se siente largo |
> | La bajada del detalle concatena descripción + fecha con `line-clamp-2`: una descripción muy larga puede recortar el «· se sortea el…» | **confirmado en celular** el 2026-09-19: dice «se sortea el 31 de…». Separar la fecha a su renglón |
> | `Closed.astro` y `NoGrid.astro` están escritos pero `cerrada` es inalcanzable: nada pone una rifa en `CLOSED` | fase 9 |
> | Ningún test cubre el render: los dos bugs visuales del 2026-09-19 pasaron con 244 tests en verde | fase 10 — Container API en un segundo proyecto de vitest |

> ~~**Con qué seguir: primero el bloque «Antes de la fase 7» de acá abajo**
> (editar una rifa + los estados del detalle)~~ → **cerrado**, y después
> reescrito entero (ver «Reescritura del detalle»).
>
> **Con qué seguir: la fase 7** — `/r/[slug]` público + imagen para compartir +
> OG fijo. El botón «Compartir por WhatsApp» del detalle apunta a `/r/{slug}`,
> que **sigue dando 404**: confirmado a mano el 2026-09-19. Es la única punta
> suelta visible para el usuario. No pide **Workers Paid**: el OG dejó de
> renderizarse en el Worker (ver la fase 7).

---

## Antes de la fase 7 — Editar la rifa y los estados del detalle

> Diseñado el 2026-09-08 contra la **página 5 del canvas** («Detalle · todos los
> estados»): 17 artboards, escritorio y celular. El detalle sólo existía en
> `PUBLISHED` con ventas; faltaban los otros tres estados y las acciones que
> salen de esa pantalla. Esta media fase cierra lo que traba *publicar y
> arreglar* una rifa; sortear y anular van en la fase 9.

- [x] **`raffle.update`** — action + esquema para título, premio, descripción,
      fecha de sorteo y teléfono. Con la rifa `PUBLISHED` **y con ventas**,
      `total_numbers` y `ticket_price` quedan **bloqueados**: cambiarlos le
      cambia el trato a quien ya pagó y desincroniza D1 con el DO. En `DRAFT`
      los dos se editan. No toca el DO salvo que cambie el rango, que en `DRAFT`
      es un `destroy()` + `init()`.
- [x] **`/panel/rifa/[id]/editar`** contra `DetailEdit` / `DetailEditMobile` —
      reusa `Form` y `Summary` del alta, no un layout nuevo. Cinco campos con
      ayuda arriba de cada uno: es una **página**, no un diálogo (igual que
      «crear»; en el celular un modal con cinco campos es peor). Entra por un
      renglón discreto bajo la bajada del encabezado, no por un tercer botón.
- [x] **Cargar el teléfono desde el detalle** contra `DetailDraftPhone` /
      `DetailDraftPhoneMobile` — el renglón «Un teléfono de contacto» de la
      lista «Antes de publicar» **se vuelve el input**, ahí mismo. Es un campo,
      no una pantalla ni un diálogo. El botón hace las dos cosas: «Guardar y
      publicar la rifa», con «Guardar sin publicar todavía» abajo.
- [x] **Estado `DRAFT` del detalle** contra `DetailDraft` / `DetailDraftMobile`
      — sin panel de venta (no hay nada que vender); en su lugar la lista
      «Antes de publicar» y el CTA de publicar apagado con el motivo (regla 7).
- [x] **Grilla vacía** — resultó ser un bug más serio que el planeado. La fila
      queda en D1, pero si el `init()` del DO no llega a correr, su `owner_id`
      nunca se fija — y `assertOwner()` falla **cerrado** ante eso (a
      propósito: «un objeto a medio crear se niega a todo»), así que el
      `ownerGrid()` del DO tiraba `FORBIDDEN`. La pantalla lo confundía con una
      rifa ajena y devolvía **404**: el dueño no encontraba su propia rifa, sin
      ningún indicio de qué pasó ni cómo arreglarlo. No era «la grilla sale en
      blanco», como decía este ítem — era que la rifa desaparecía.
      Arreglado en `flows.ts`: `ownerGrid()` ahora distingue ese `FORBIDDEN` del
      DO —después de que D1 ya confirmó que sos el dueño, sólo puede significar
      «huérfana»— y le pasa a la pantalla `numbers: []` en vez de propagar el
      error. `[id].astro` renderiza `EmptyGrid` en ese caso (reemplaza `Grid`,
      oculta `Buyers`/`Sale`/`SaleBar`: no hay nada que vender ni mostrar) con
      un botón «Rearmar el talonario» → la action `raffle.rebuildGrid`, que
      vuelve a llamar `init()` con los datos de D1 (no-op si ya prendió).
      Cubierto en `flows.test.ts` simulando la huérfana de verdad: `createRaffle`
      de D1 sin el `init()` del DO.
      **El arreglo de `flows.ts` sigue igual**; los nombres de pantalla de este
      párrafo no: `EmptyGrid` es hoy `NoGrid.astro`, y es una pantalla entera —
      no un reemplazo de la grilla. Ver «Reescritura del detalle».
- [x] ~~Gate en `[id].astro`: con la rifa fuera de `DRAFT`/`PUBLISHED` el panel
      `Sale` no se renderiza (`isPublished && !isEmpty`)~~
      → el gate ya no existe como condición: `estadoDetalle()` despacha a la
      pantalla del estado, y las que no venden simplemente no montan el panel.
- [x] **Checkpoint** — verificado por partes, no de punta a punta a mano: los
      199 tests (`pnpm test`), `pnpm lint` y `pnpm check` pasan limpios, y el
      estado de grilla vacía se revisó visualmente contra una página de prueba
      descartable. ~~Falta correr el flujo completo autenticado (crear → cargar
      teléfono → publicar → editar con ventas) contra Google OAuth real — no
      hay credenciales de Google configuradas en este entorno.~~
      → **corrido el 2026-09-19** contra Google OAuth real, sobre el dev server
      local: crear → publicar → vender → liberar → editar. El PRG cierra (el
      flash sale y el `?ok=` se limpia de la URL) y la mezcla de libres con
      vendidos apaga los dos botones **y lo explica**. Ahí salieron los dos
      bugs visuales del recuadro de abajo.

---

## Reescritura del detalle — 2026-09-19

> No estaba planificado. El detalle funcionaba y pasó su checkpoint, pero la
> pantalla había crecido feature por feature hasta volverse el peor archivo del
> repo: 270 líneas de página, 12 componentes y **cero tests** sobre la lógica de
> pantalla. Se reescribió entera. La API pública no cambió — las cinco actions,
> los flujos y el modelo son los mismos.

**Los cinco problemas que tenía, y cómo se cerraron:**

| Problema | Cómo era | Cómo quedó |
|---|---|---|
| Sopa de booleanos | `isDraft` / `isPublished` / `isEmpty` en 8 condiciones dispersas — 8 combinaciones posibles, 4 reales | `estadoDetalle()`: un discriminante, 4 ramas adyacentes, con tests |
| La bolsa | `detailView()` devolvía 9 campos de 3 orígenes distintos | `subtitleOf` · `publicUrlOf` · `selectedNumbers` · `flashMessage`, cada una con su test |
| PRG repetido | 5 `if` con su propio `Astro.redirect`, más un comment pidiendo disculpas | una expresión y **un** `redirect` |
| Acción a distancia | la barra fija la montaba un componente y su espaciador vivía al fondo de la página | los dos en líneas contiguas, en `Draft` y en `OnSale` |
| Componentes gigantes | `Sale.astro`: 311 líneas, 142 de `<script>`, sin test | `salePanel()` puro con 19 tests + un `paint()` mecánico |

**Cómo quedó repartido:**

```
components/panel/detail/
  Draft · OnSale · Closed · NoGrid   ← una pantalla por estado, sin condiciones adentro
  Actions · Stats · EditLink         ← lo que comparten
  grid/{Grid,Cell,SellCell} · buyers/{Buyers,BuyerRow}
  draft/{Checklist,Summary,WhenPublished} · sale/Panel · closed/Winner

utils/frontmatter/
  detail/   estado · tally · buyers · publish · edit · flash · subtitle · link · selection
  sale.ts   ← aparte: es lo único del detalle que corre en el NAVEGADOR
```

> ⚠️ **`sale.ts` no entra al barril de `detail/` a propósito.** Se importa desde
> un `<script>` del cliente, y ponerlo detrás del barril arrastraría `tally`,
> `buyersOf` y el resto al bundle del navegador.

**Decisiones que cambiaron lo planificado:**

- **Una pantalla por estado**, no un esqueleto con ranuras. Se evaluaron las dos:
  la variante con ranura evita repetir la cáscara de dos columnas, pero obliga a
  un `Record` de componentes que no cierra —los paneles no reciben los mismos
  props— o a `if` adentro. Con un archivo por estado, abrís `Draft.astro` y ves
  la pantalla del borrador de corrido. El precio es la cáscara repetida en tres
  archivos, aceptado.
- **El encabezado se queda en la página**, por una restricción de Astro que
  conviene saber: `slot="actions"` tiene que ser hijo **directo** de
  `<Dashboard>`. Un `slot="actions"` dentro de `Draft.astro` apuntaría a quien
  llamó a `Draft` —la página—, no al layout. Por eso los componentes por estado
  gobiernan el **cuerpo** y nada más.
- **`sin-grilla` gana sobre los cuatro status.** Antes el cartel de rearmar
  convivía con la checklist de publicar; sin números no hay nada que publicar, y
  ofrecerlo era ofrecer algo que no iba a funcionar.
- ~~`wideActions` para el modo «título a su propia fila»~~ → **el encabezado
  decide solo**. El prop se había sacado por no tener consumidor y la regresión
  apareció al medir: a 768px las acciones del detalle son 617px y le dejaban
  **55px** al título, que se desbordaba por encima. Ahora la fila es
  `flex-wrap` con el título en `flex-[1_0_20rem]`.

> ⚠️ **El `0` del medio de `flex-[1_0_20rem]` es lo que hace que funcione.**
> `flex-wrap` por sí solo no baja nada mientras el título PUEDA encogerse:
> flexbox achica antes de partir la línea, que es exactamente cómo llegó a
> 55px. Con `flex-shrink: 0` las dos piezas no entran y recién ahí las acciones
> se van abajo. Lo mismo con el `ml-auto` que las alinea a la derecha: va con
> `sm:` porque en celular el contenedor es `flex-col`, el eje transversal es el
> horizontal, y un margen automático ahí **cancela el `align-items: stretch`** —
> sin el prefijo el div mide por contenido y se sale de la pantalla.

**Lo que la reescritura NO resolvió:** el estado `cerrada` sigue siendo
inalcanzable (fase 9), y nada cubre el render — los dos bugs visuales de ese día
pasaron con 244 tests en verde.

---

## Fase 7 — Página pública y compartir

> ~~A partir de acá hace falta **Workers Paid**: la generación del OG con satori
> mide ~150–400 ms de CPU y Free corta en 10 ms por invocación.~~
> → **El OG deja de renderizarse en el Worker** (recuadro abajo), así que la
> fase 7 **sigue en Free**. Y lo que más se usa no es el OG: es la imagen del
> estado que el organizador baja y manda al grupo — en WhatsApp una imagen se
> mira y un link se ignora.

- [ ] `/r/[slug]` con `Cache-Control: s-maxage=30, stale-while-revalidate=300`
- [ ] Grilla pública (sólo número y estado)
- [ ] El `<svg>` de la grilla (título · barra de progreso · celdas por estado)
      en un módulo compartido — alimenta las dos salidas de abajo
- [ ] **Imagen del estado para compartir** — botón en `/panel/rifa/[id]`: arma
      el SVG → `canvas.drawImage()` → `toBlob()` → descarga el PNG, **todo en el
      navegador del organizador**. Cero CPU de Worker. Es el artefacto que más
      se usa. → artboard pendiente de sumar al canvas
- [ ] **OG fijo** — un PNG de marca versionado en el repo; `SocialMeta.astro` lo
      referencia igual para toda rifa. El `og:title` y la bajada sí son los
      reales de cada una
- [ ] `/og/raffle/[id]/[v].png` — route que lee R2 (`og/{id}/{vendidos}.png`) y
      **cae al PNG fijo si no existe**. Se cablea aunque nadie suba nada
      todavía: es el gancho para el OG en vivo sin pasar a Paid (recuadro)
- [ ] `src/lib/whatsapp/` — teléfono a formato local (`11 4455-2211`) y el `9`
      de celular para el link `wa.me`. Deuda de la fase 6
- [ ] Botón de contacto por WhatsApp
- [ ] **✅ Checkpoint: el link se ve bien en WhatsApp y el organizador baja una
      imagen del estado para mandar al grupo**

> **Por qué el OG no puede ser cliente-side como la imagen para compartir.** Al
> OG lo pide el crawler de WhatsApp: baja el HTML, lee `og:image` y hace un
> `GET` esperando bytes PNG. **No ejecuta JavaScript** — no hay `canvas` ni DOM
> del otro lado. `og:image` tiene que apuntar a una URL que ya devuelva el PNG
> hecho. Sin el render de satori quedan dos caminos:
>
> 1. **Fijo** (el del MVP): un PNG de marca. Cero CPU; se pierde la grilla en
>    vivo en el preview.
> 2. **El organizador sube el OG a R2**: su navegador arma el mismo SVG→PNG y lo
>    `PUT`ea a un endpoint del panel, que lo guarda en R2 con clave
>    `og/{id}/{vendidos}.png`. El route de `og:image` lo lee de R2 (~1–3 ms) y
>    si no está sirve el fijo. R2 tiene free tier propio (10 GB · 1 M escrituras
>    · 10 M lecturas/mes) y el Worker sólo hace passthrough → **sigue en Free**.
>    Cobertura casi total en el flujo BASIC manual (el organizador carga cada
>    venta y re-sube después de cada una); degrada manso en pedidos PRO
>    (fase 8): muestra el estado anterior, nunca 404.
>
> `satori` + `resvg-wasm` quedan **descartados** para el OG, y con ellos la
> deuda de «CSS completo con Browser Run» de la fase 10: el `<svg>` de la grilla
> a mano se controla al pixel y no arrastra un Chromium. Corrección en
> [07 · Etapa C](./07-guia-cloudflare.md).

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
- [ ] **Diálogo de sorteo** contra `DetailDraw` / `DetailDrawMobile` — las dos
      opciones (al azar entre los vendidos, o número a mano) y la confirmación
      de que cierra la rifa. Es un modal → Starwind `Dialog` (pasa la puerta 1
      de [11](./11-sistema-visual.md#la-regla-de-las-tres-puertas)), nunca
      `dialog.showModal()` a mano ni `:target`
- [ ] **Estado `CLOSED` del detalle** contra `DetailClosed` /
      `DetailClosedMobile` — grilla congelada, tarjeta del ganador en la
      columna derecha
- [ ] Anuncio del ganador + OG con el ganador destacado
- [ ] `redeemVoucher()` con `UPDATE ... WHERE used_count < max_uses` + guarda
- [ ] `/admin/vouchers` — emisión, sólo `ADMIN`
- [ ] Cancelar rifa (no borrar, si tiene ventas) — **`raffle.cancel`** con
      guarda de tipeo, contra `DetailCancelConfirm` / `DetailCancelConfirmMobile`
      (modal → Starwind `Dialog`; el botón arranca apagado diciendo por qué)
- [ ] **Estado `CANCELLED` del detalle** contra `DetailCancelled` /
      `DetailCancelledMobile` — badge en tinta llena (arreglar `estadoDe()`,
      que hoy lo muestra como «Ya sorteada»), el texto habla de a quién
      devolverle la plata, no del sorteo
- [ ] Borrado seguro: **`destroy()` del DO primero, D1 después**

---

## Fase 10 — Deuda y futuro

- [ ] Tests de la lógica de dominio pura
- [ ] ~~Imagen descargable de la grilla — con **Browser Run**~~
      → **se adelantó a la fase 7**, cliente-side canvas. Browser Run no se usa
      en ningún lado: sacar el binding de `wrangler.jsonc`
- [ ] Mercado Pago (`unlock_method = 'PAYMENT'`)
- [ ] Dominio propio en Cloudflare
- [ ] Revisar métricas: DO duration, Workers CPU, D1 writes → [09](./09-durable-objects.md)

---

## Transversal · repo, CI y tooling

No es una fase: es lo que sostiene a todas. Hecho el 2026-09-04, durante la
fase 6.

- [x] **`src/utils/`** — `format.ts`, `normalize.ts` y `errors.ts` se mudaron
      ahí con sus tests. ~~Tres archivos~~ → **los tres son carpetas** con
      barril: `format/` (dates · money · initials · progress), `normalize/`
      (phone · slug) y `errors/` (app-error · catalog · codes · resolve). Los
      importadores no cambiaron: `@/utils/format` resuelve al `index.ts`. En `src/lib/` quedan las piezas con dependencias
      propias: `auth/`, `db/`, `raffles.ts` (D1 + DO) y `tv.ts`. El criterio es
      el tamaño de la dependencia, no la palabra «util».
- [x] **`src/lib/db/bound.ts`** — `conDB` y el `import { env }` salieron del
      barril. `index.ts` volvió a ser sólo el índice. `bound.ts` es ahora el
      único módulo del proyecto que lee `env.DB`.
- [x] **API en inglés y sin el prefijo `normalize`**: `phone()`,
      `voucherCode()`, `genSlug()` (y no `slug()`, que al lado de `slugify()`
      sería una moneda al aire en el punto de llamada). En `format.ts`:
      `shortDate()`, `progress()`, `today()`, `inDays()`.
- [x] **pnpm 11.25.0** por corepack, con `packageManager` pineado en
      `package.json`.
- [x] **Hooks locales en `.githooks/`**, enganchados con `core.hooksPath` desde
      un script `prepare` — que es lo que husky hace por dentro, sin la
      dependencia. `pre-push` corre lint + check + tests **sólo cuando el push
      va a `main`** (~35 s); `pre-commit` pasa prettier por los archivos del
      índice (~1 s).
- [x] **`.github/workflows/ci.yml`** — lint, check y tests en cada push a `main`
      y en cada PR, con `pnpm/setup@v2` y `--frozen-lockfile`.

- [x] **Enrutamiento declarado en `wrangler.jsonc`** — `rifate.app` estaba
      enganchado sólo desde el panel de Cloudflare. Ahora va en el repo, con
      `workers_dev` y `preview_urls` **explícitos**: ver el recuadro de abajo,
      porque omitirlos apaga cosas en silencio.
- [ ] **`env.staging` para previews con login** — pendiente, para cuando la
      fase 6 cierre y haya pantallas autenticadas que revisar en un PR.

> ⚠️ **El adapter de Astro inyecta bindings que `wrangler.jsonc` no declara.**
> En `dist/server/wrangler.json` aparecen `images: { binding: "IMAGES" }` y
> `kv_namespaces: [{ binding: "SESSION" }]`, ninguno de los dos escrito por
> nosotros. La diferencia entre ellos importa: el de Images **está completo**
> —ese binding es de cuenta y no lleva id—, mientras que el de KV llega **sin
> `id`**, y el id es lo que identifica al namespace. Resultado: el deploy lo
> tomaba del remoto y wrangler lo listaba como `env.SESSION (inherited)`, o sea
> configuración que vivía sólo en el panel de Cloudflare. Ya quedó pineado en
> `wrangler.jsonc`.
>
> `Astro.session` **no se usa en ninguna parte del código** —las sesiones de
> verdad son las de Better Auth y viven en D1—, así que ese KV es peso muerto
> que el adapter habilita solo. Queda pendiente ver si se puede apagar: el
> adapter expone `sessionKVBindingName` para renombrar el binding, pero no
> encontré la opción para deshabilitar las sesiones del todo.

### Por qué un preview por PR no alcanza

Con `preview_urls: true`, cada versión subida obtiene su
`<version>-rifate.<subdominio>.workers.dev`. Sirve para la superficie pública
—landing, legales y, desde la fase 7, `/r/[slug]`— y no cuesta nada. Para lo
autenticado no alcanza, por dos razones distintas:

1. **Google exige coincidencia exacta del `redirect_uri`** y no acepta
   comodines. Las URLs de preview cambian con cada versión, así que no se pueden
   registrar. Y como `baseURL` es `rifate.app` fijo, un login iniciado en un
   preview arma el callback contra producción y la cookie se setea allá.
   `trustedOrigins` no lo salva: gobierna la validación de origen, no el
   `redirect_uri`.
2. **Un preview URL es una versión del MISMO Worker**, así que usa **los mismos
   bindings**: la misma D1 `rifate-db` y el mismo namespace de Durable Objects.
   Un PR que toque escrituras modifica los datos reales.

### La forma del `env.staging`

```jsonc
"env": {
  "staging": {
    // Sin esto, wrangler le agrega el sufijo del entorno igual: `rifate-staging`.
    // Se declara explícito porque de este nombre depende el aislamiento del DO.
    "name": "rifate-staging",
    "routes": [{ "pattern": "staging.rifate.app", "custom_domain": true }],
    "vars": { "PUBLIC_APP_URL": "https://staging.rifate.app" },
    "d1_databases": [
      { "binding": "DB", "database_name": "rifate-db-staging", "database_id": "…" }
    ],
    "durable_objects": {
      "bindings": [{ "name": "RAFFLE", "class_name": "Raffle" }]
    }
  }
}
```

> ⚠️ **La trampa son las claves no heredables.** `vars`, `d1_databases` y
> `durable_objects` **no se heredan** del nivel superior, y la regla es peor que
> eso: si pisás **una sola** de ellas en un entorno, **tenés que declararlas
> todas** en ese entorno. Si te olvidás de una, valida bien en local y **falla
> recién al desplegar**.

> **El aislamiento del Durable Object sale del nombre del Worker.** Los
> namespaces de DO son por script, así que `rifate-staging` tiene sus propios
> objetos y su propio almacenamiento sin configurar nada más. La D1 sí hay que
> crearla aparte (`wrangler d1 create rifate-db-staging`) y correrle las
> migraciones.

Lo que falta además del bloque:

- `wrangler d1 create rifate-db-staging` + `migrations apply --env staging`
- Los tres secrets, que son **por entorno**:
  `wrangler secret put BETTER_AUTH_SECRET --env staging` (y los dos de Google)
- Una URI de redirección más en Google:
  `https://staging.rifate.app/api/auth/callback/google`
- Deploy: `wrangler deploy --env staging`
- **Verificar** si la clave `migrations` (la del `new_sqlite_classes`) se hereda
  o hay que repetirla en el entorno — no lo confirmé.

> ⚠️ **pnpm 11 trae `minimumReleaseAge` prendido por defecto**: rechaza
> paquetes publicados en las últimas ~24 h. Es la defensa contra los ataques de
> cadena de suministro de npm, y **no se desactiva**. Si `pnpm install` falla
> por eso, casi siempre es porque un `pnpm update` acaba de traer versiones
> recién publicadas: se revierte el update o se espera un día.

> ⚠️ **`pnpm update` actualiza las dependencias, no pnpm.** Para subir el
> gestor es `corepack use pnpm@<version>`.

> ⚠️ **El postinstall de `workerd` hay que aprobarlo** (`pnpm approve-builds`),
> y queda registrado en `allowBuilds` de `pnpm-workspace.yaml`. Sin eso CI
> instala sin construir el binario y `pnpm test` se queda sin runtime: los 113
> tests corren **adentro** de workerd.

> ⚠️ **`astro check` en CI necesita dos cosas que están en `.gitignore`.**
> `worker-configuration.d.ts` lo genera `wrangler types`, y sin él no existen
> `Env`, `D1Database`, `SqlStorage` ni el módulo `cloudflare:workers` — son 60
> errores de una. Pero generarlo no alcanza: `BETTER_AUTH_SECRET`,
> `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` no están en `wrangler.jsonc` sino
> en `.dev.vars`, y `wrangler types` los lee de ahí. Por eso hay un
> **`.dev.vars.example` versionado**: `wrangler` sólo necesita las **claves**,
> no los valores. Si agregás una variable nueva, sumala al ejemplo o CI falla.
>
> Este error **el hook local nunca lo hubiera visto**: en la máquina de
> desarrollo los dos archivos existen. Apareció en la primera corrida de CI, que
> es exactamente para lo que está.

> **Todos los commits del repo están firmados con SSH** (`commit.gpgsign`,
> `gpg.format = ssh`). Cualquier reescritura de historia —`filter-branch` o
> `filter-repo`— **desfirma todo lo que toca**, así que un rewrite cuesta las
> 125 firmas y la insignia «Verified» de GitHub. Tenerlo presente antes de
> proponer cualquier limpieza de historia.

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
| 7 | `feat: :sparkles: add public raffle page with a client-side share image` |
| 8 | `feat: :sparkles: add PRO orders with reservations and live grid` |
| 9 | `feat: :sparkles: add winner draw, vouchers and admin panel` |

~~Trabajá en una rama: `git switch -c v2-refactor`. `main` refleja lo desplegado.~~
→ **El refactor va en `main`** (decidido 2026-08-26). v1 quedó congelado en el
tag `v1.0.0` y la rama `v1-stable`, así que no hace falta una rama de trabajo
aparte: `main` es el refactor y el punto de retorno es el tag.

---

## Los tres errores que más caro salen

Todos están documentados, pero conviene tenerlos a mano:

1. **`accept()` en vez de `acceptWebSocket()`** → la factura pasa de $5 a $140.
   [09](./09-durable-objects.md)
2. **Crear la instancia de Better Auth a nivel de módulo** → rompe en runtime,
   no en build. [10](./10-better-auth.md)
3. **Un `WHERE` que usa un id del input en vez del actor** → filtra datos en
   silencio, sin romper nada. [04](./04-rls-y-roles.md)
