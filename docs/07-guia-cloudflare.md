# 07 · Guía de migración a Cloudflare Workers

> Detalle de configuración de **Astro + Cloudflare Workers** y de la generación
> de imágenes OG. El orden de trabajo general está en
> [06 · Roadmap](./06-roadmap.md); esto es el "cómo" de sus fases 2 y 7.
>
> La autenticación va aparte, en [10 · Better Auth](./10-better-auth.md), y el
> esquema en [`docs/sql/`](./sql/).

## Índice

| Etapa | Qué | Verificás con |
|---|---|---|
| A | Astro 7 + adapter Cloudflare | `pnpm build` sin errores |
| B | wrangler + deploy | La app v1 andando en `*.workers.dev` |
| C | OG con satori + resvg-wasm | La imagen se genera con Nunito, < 400 ms |
| — | Auth y esquema | → [10](./10-better-auth.md) y [`docs/sql/`](./sql/) |
| E | Adaptar la app | → [06 · Roadmap](./06-roadmap.md), fase 5 |

Antes de empezar:

```bash
git switch -c v2-refactor
```

---

## Etapa A · Astro 7 + adapter de Cloudflare

`@astrojs/cloudflare@14` pide `astro ^7.2.0`. Tenés 6.4.6, así que hay que subir.
Ya existe una rama de dependabot con ese bump (`origin/dependabot/npm_and_yarn/astro-7.1.1`),
pero conviene hacerlo a mano para ir a la última.

### A.1 · Subir Astro y sacar Vercel

```bash
pnpm remove @astrojs/vercel
pnpm add -D astro@^7.2.6 @astrojs/cloudflare@^14.2.4 wrangler@^4.125.0
pnpm add -D @astrojs/react@latest
```

### A.2 · `astro.config.mjs`

Reemplazá el archivo completo:

```js
// @ts-check
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://rifate.app',

  // ⚠️ OBLIGATORIO. Astro compila en modo "static" por defecto y NO emite
  // entrypoint de servidor: `wrangler deploy` falla con
  //   The entry-point file at "@astrojs/cloudflare/entrypoints/server" was not found
  // Con 'server' cada página es SSR salvo las que declaren `prerender = true`.
  output: 'server',

  // Ya no hace falta `includeFiles` con las .ttf: la imagen OG pasa a
  // generarse con Browser Run y las fuentes las carga el navegador headless.
  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: { enabled: true },
  }),

  integrations: [icon(), react()],

  vite: {
    plugins: [tailwindcss()],
  },

  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Nunito',
      cssVariable: '--fontsource-nunito',
      weights: [400, 500, 600, 700, 800, 900],
    },
  ],

  redirects: {
    '/dashboard': '/dashboard/raffle',
  },
});
```

> `platformProxy` es lo que hace que `astro dev` te dé acceso a los bindings de
> Cloudflare (el de Browser Run, entre otros) sin desplegar. Sin esto, en
> desarrollo `locals.runtime` viene vacío.

### A.3 · Borrar los archivos que ya no van

```bash
rm -rf .vercel
```

> **No borres las `.ttf`.** Se mueven a `src/lib/og/` en la etapa C: satori
> necesita los buffers de la fuente. Lo único que se saca es `@resvg/resvg-js`
> (binding nativo), y eso también en C — si lo desinstalás ahora, el build falla.

### A.4 · Verificación

```bash
pnpm build
```

Tiene que terminar sin errores y dejar un `dist/_worker.js/`. Anotá la ruta
exacta que imprime: la vas a necesitar en B.2.

> Si algo del ecosistema no está listo para Astro 7, va a saltar acá. Los
> candidatos son `astro-icon` y los componentes de `starwind`.

---

## Etapa B · wrangler y primer deploy

### B.1 · `.gitignore`

```bash
cat >> .gitignore <<'EOF'

# Cloudflare
.wrangler/
.dev.vars
worker-configuration.d.ts
EOF
```

### B.2 · `wrangler.jsonc` (nuevo, en la raíz)

> **Cómo funciona en realidad.** `astro build` lee tu `wrangler.jsonc` y genera
> uno derivado en `dist/server/wrangler.json`, más un puntero en
> `.wrangler/deploy/config.json`. `wrangler deploy` sigue ese puntero:
>
> ```
> Using redirected Wrangler configuration.
>  - Configuration being used: "dist/server/wrangler.json"
>  - Original user's configuration: "wrangler.jsonc"
> ```
>
> El derivado pisa `main` (a `entry.mjs`) y `assets.directory` (a `../client`),
> y hereda todo lo demás del tuyo. Por eso el `main` del archivo raíz casi no
> importa — pero el build **tiene que haber corrido en modo server**, o no hay
> nada a donde apuntar.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "rifate-app",
  "main": "./dist/_worker.js/index.js",

  // quickAction() de Browser Run necesita 2026-03-24 o posterior.
  "compatibility_date": "2026-08-01",

  // Better Auth y kysely usan APIs de Node (crypto, buffer). Sin esto falla en
  // runtime, no en build: el error aparece recién con el primer request.
  "compatibility_flags": ["nodejs_compat"],

  // El adapter lo reescribe a "../client" en el config derivado. Ponelo bien
  // igual: apuntar a "./dist" subiría dist/server —tu código de servidor—
  // como assets públicos si algún día el derivado no se genera.
  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS"
  },

  // Browser Run: genera las imágenes OG. Incluido en el plan free.
  "browser": {
    "binding": "BROWSER"
  },

  "observability": {
    "enabled": true
  }
}
```

> **Verificá `main`** contra lo que imprimió `pnpm build` en A.4. Si el adapter
> emite otra ruta, esta es la línea a corregir.

### B.3 · Variables de entorno

Cloudflare no lee `.env`. Para desarrollo local usa **`.dev.vars`** (ya está en
`.gitignore`), con los mismos nombres que los secrets de producción:

```
BETTER_AUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
PUBLIC_APP_URL=http://localhost:8787
```

Y en producción, como secrets:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

> **Todo se lee de `locals.runtime.env`, no de `import.meta.env`.** Vite inlinea
> las `PUBLIC_*` en tiempo de build, y un valor inlineado sólo se cambia
> rebuildeando. Los secrets de runtime se rotan sin tocar el código — que es lo
> que querés para una clave de sesión o de OAuth.

### B.4 · Tipos de los bindings

```bash
npx wrangler types
```

Genera `worker-configuration.d.ts` con la interfaz `Env` (incluye `BROWSER`).
Ahora enganchalo en `src/env.d.ts`:

```ts
/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    actor: import('@/lib/auth/actor').Actor;
  }
}
```

A partir de acá `Astro.locals.runtime.env.BROWSER` está tipado.

### B.5 · Bindings en `wrangler.jsonc`

Además del browser y los assets, hacen falta D1 y el Durable Object:

```jsonc
{
  "d1_databases": [
    { "binding": "DB", "database_name": "rifate-db", "database_id": "<id>" }
  ],
  "durable_objects": {
    "bindings": [{ "name": "RAFFLE", "class_name": "Raffle" }]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["Raffle"] }
  ]
}
```

> **`new_sqlite_classes`, no `new_classes`.** La variante SQLite es la que trae
> `ctx.storage.sql` y la que tiene free tier. Con `new_classes` (backend
> key-value) nada de lo diseñado en [03](./03-modelo-de-datos.md) funciona.

### B.6 · Scripts en `package.json`

```json
"scripts": {
  "dev": "astro dev",
  "build": "astro build",
  "preview": "wrangler dev",
  "deploy": "astro build && wrangler deploy",
  "cf:types": "wrangler types",
  "astro": "astro"
}
```

### B.7 · Verificación

```bash
pnpm build
npx wrangler dev        # local, con bindings reales
```

Abrí `http://localhost:8787`, entrá al dashboard y verificá que el login con
Google siga funcionando. Después:

```bash
npx wrangler deploy
```

> **Checkpoint.** Antes de seguir, la app v1 tiene que funcionar completa en
> `rifate-app.<tu-subdominio>.workers.dev`: login, listado, detalle, página
> pública. La imagen OG todavía no — la arreglamos ahora.

---

## Etapa C · Imagen OG con satori + resvg-wasm

> **Corrección respecto de la primera versión de esta guía.** Acá decía usar
> Browser Run. Los límites reales lo desaconsejan para el OG:
>
> | | Workers Free | Workers Paid |
> |---|---|---|
> | Browser Run · quick actions | **1 request cada 10 s** | 10 h/mes, luego $0.09/h |
> | Browser Run · duración | 10 min/día | — |
>
> 1 request cada 10 segundos es un bloqueante duro para un endpoint público, y
> levantar un Chromium completo para dibujar una tarjeta estática es
> desproporcionado: 1–3 s contra ~200 ms de un renderer de SVG.
>
> Browser Run queda para la **imagen descargable de la grilla** (etapa E): la
> pide una persona con un click, no está en el camino de compartir, y ahí sí
> conviene tener CSS completo.

### C.0 · El punto que importa más que el motor

**La imagen no cambia por request: cambia cuando se vende un número.** Todo el
diseño sale de ahí.

Y una trampa que hay que resolver desde el principio:

> **WhatsApp cachea el preview por URL, y es agresivo.** Si la imagen vive en
> `/og/raffle/{id}.png`, el organizador comparte, vende 20 números, comparte de
> nuevo — y WhatsApp muestra la imagen vieja. El "estado en vivo al compartir",
> que es el corazón del producto, no funciona.

La solución es un token de versión en la URL que cambie con el estado:

```
/og/raffle/{id}/{vendidos}.png
```

Cada venta cambia la URL, WhatsApp la trata como imagen nueva, y de paso la
versión anterior queda cacheable para siempre (`immutable`).

### C.1 · Dependencias

```bash
pnpm remove @resvg/resvg-js
pnpm add satori @resvg/resvg-wasm
```

`satori` se queda: lo que se va es el binding **nativo** de resvg, que no corre
en Workers, reemplazado por la versión WASM.

> Las dos `.ttf` **no** se borran (contra lo que decía la etapa A.3): satori
> necesita los buffers de la fuente. Si ya las borraste, recuperalas con
> `git checkout v1.0.0 -- src/pages/og/raffle/`.

### C.2 · Las fuentes, como módulo

Importar binarios en el bundle de Workers depende del bundler. Lo más
determinista es inlinearlas en base64 — no hay configuración que se rompa y no
hay request de red en el camino.

```bash
mkdir -p src/lib/og
node -e "
const fs = require('fs');
const b = (p) => fs.readFileSync(p).toString('base64');
fs.writeFileSync('src/lib/og/fonts.ts', \`// Generado. Nunito 700 y 900 en base64 para satori.
const decode = (b64: string): ArrayBuffer => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

export const NUNITO_BOLD = decode('\${b('src/pages/og/raffle/Nunito-Bold.ttf')}');
export const NUNITO_EXTRABOLD = decode('\${b('src/pages/og/raffle/Nunito-ExtraBold.ttf')}');
\`);
console.log('src/lib/og/fonts.ts escrito');
"
mv src/pages/og/raffle/Nunito-*.ttf src/lib/og/
```

### C.3 · La plantilla

> ⚠️ **La plantilla de abajo es de otro diseño.** Se escribió antes de que
> existiera el sistema visual «Talonario» ([11](./11-sistema-visual.md)): usa un
> gradiente verde y Nunito, y la marca es papel `#F5EEE0` + tinta `#17181C` +
> vermellón `#CE3418`, con Bricolage Grotesque y Figtree.
>
> **Sirve como referencia de la mecánica** —cómo se arma el árbol para satori,
> el padding de los números, el corte a partir de 200 celdas— pero los colores,
> las fuentes y el layout hay que rehacerlos sobre el artboard OG que elijas.

`src/lib/og/template.ts`. Ojo con la restricción principal de satori:

> **satori sólo soporta flexbox.** No hay `display: grid`, no hay
> `aspect-ratio`, no hay `gap` en todos los casos. La grilla de la rifa se arma
> con `flexWrap` y celdas de tamaño fijo. En la práctica no se nota.

```ts
import { createElement as h, type ReactElement } from 'react';

import { formatCurrency, formatDate } from '@/lib/formatters';

export interface OgRaffleData {
  title: string;
  description: string | null;
  totalNumbers: number;
  numberStart: number;
  soldNumbers: number[];
  ticketPrice: number;
  drawDate: string;
  winnerNumber: number | null;
}

const PALETTE = {
  bgFrom: '#0d3b2e',
  bgTo: '#17614c',
  free: '#6ee7b7',
  sold: '#b0402f',
  winner: '#fbbf24',
};

const padWidth = (total: number, start: number) =>
  String(start + total - 1).length;

export const buildOgElement = (raffle: OgRaffleData): ReactElement => {
  const sold = new Set(raffle.soldNumbers);
  const width = padWidth(raffle.totalNumbers, raffle.numberStart);
  const soldCount = raffle.soldNumbers.length;
  const available = raffle.totalNumbers - soldCount;

  // Arriba de 200 celdas la grilla no se lee en un preview de WhatsApp:
  // se muestra un resumen grande en su lugar.
  const showGrid = raffle.totalNumbers <= 200;
  const cellSize = raffle.totalNumbers <= 100 ? 44 : 30;

  const stat = (label: string, value: string, color = '#ffffff') =>
    h('div', { style: { display: 'flex', flexDirection: 'column' } }, [
      h('div', {
        key: 'k',
        style: { fontSize: 15, opacity: 0.6, letterSpacing: 2, textTransform: 'uppercase' },
      }, label),
      h('div', {
        key: 'v',
        style: { fontSize: 34, fontWeight: 900, color, marginTop: 4 },
      }, value),
    ]);

  const grid = h('div', {
    style: {
      display: 'flex', flexWrap: 'wrap', width: 480,
      alignContent: 'center', justifyContent: 'center',
    },
  }, Array.from({ length: raffle.totalNumbers }, (_, i) => {
    const n = raffle.numberStart + i;
    const isWinner = raffle.winnerNumber === n;
    const isSold = sold.has(n);

    return h('div', {
      key: n,
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: cellSize, height: cellSize, margin: 3, borderRadius: 8,
        fontSize: cellSize * 0.38, fontWeight: 700,
        background: isWinner ? PALETTE.winner : isSold ? PALETTE.sold : 'rgba(255,255,255,0.12)',
        border: `2px solid ${isWinner ? '#fcd34d' : isSold ? '#d4553f' : 'rgba(255,255,255,0.2)'}`,
        color: isWinner ? '#422006' : isSold ? 'rgba(255,255,255,0.45)' : '#ffffff',
      },
    }, String(n).padStart(width, '0'));
  }));

  const summary = h('div', {
    style: {
      display: 'flex', flexDirection: 'column', width: 480,
      alignItems: 'center', justifyContent: 'center',
    },
  }, [
    h('div', { key: 'n', style: { fontSize: 132, fontWeight: 900, color: PALETTE.free } }, String(available)),
    h('div', { key: 'l', style: { fontSize: 26, opacity: 0.75, marginTop: 8 } },
      `de ${raffle.totalNumbers} números libres`),
  ]);

  return h('div', {
    style: {
      width: 1200, height: 630, display: 'flex', padding: 56,
      background: `linear-gradient(135deg, ${PALETTE.bgFrom} 0%, ${PALETTE.bgTo} 100%)`,
      color: '#ffffff', fontFamily: 'Nunito',
    },
  }, [
    h('div', {
      key: 'info',
      style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', marginRight: 48 },
    }, [
      h('div', { key: 'head', style: { display: 'flex', flexDirection: 'column' } }, [
        h('div', {
          key: 't',
          style: { fontSize: 58, fontWeight: 900, lineHeight: 1.05 },
        }, raffle.title),
        raffle.description
          ? h('div', {
              key: 'd',
              style: { fontSize: 24, opacity: 0.8, marginTop: 16, lineHeight: 1.35 },
            }, raffle.description)
          : null,
      ]),

      h('div', { key: 'stats', style: { display: 'flex', gap: 40 } }, [
        stat('Disponibles', String(available), PALETTE.free),
        stat('Por número', formatCurrency(raffle.ticketPrice)),
        stat('Sorteo', formatDate(new Date(raffle.drawDate), { day: '2-digit', month: 'short' })),
      ]),

      h('div', {
        key: 'brand',
        style: { fontSize: 20, fontWeight: 700, opacity: 0.55 },
      }, 'rifate.app'),
    ]),

    showGrid ? grid : summary,
  ]);
};
```

> satori corta el texto largo solo, pero no trunca por líneas. El título ya está
> limitado a 100 caracteres por el esquema y la descripción a 500 — conviene
> recortar la descripción a ~120 en el endpoint antes de pasarla.

### C.4 · El renderer

`src/lib/og/render.ts`:

```ts
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import satori from 'satori';

import { NUNITO_BOLD, NUNITO_EXTRABOLD } from './fonts';
import { buildOgElement, type OgRaffleData } from './template';

// El módulo WASM se inicializa una sola vez por isolate. Sin este guard,
// initWasm tira error en la segunda invocación del mismo Worker.
let wasmReady: Promise<unknown> | null = null;
const ensureWasm = () => {
  wasmReady ??= initWasm(resvgWasm);
  return wasmReady;
};

export const renderRaffleOg = async (raffle: OgRaffleData): Promise<Uint8Array> => {
  const svg = await satori(buildOgElement(raffle), {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Nunito', data: NUNITO_BOLD, weight: 700, style: 'normal' },
      { name: 'Nunito', data: NUNITO_EXTRABOLD, weight: 900, style: 'normal' },
    ],
  });

  await ensureWasm();

  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
    .render()
    .asPng();
};
```

### C.5 · El endpoint, con versión en la URL

Renombrá el archivo a `src/pages/og/raffle/[id]/[v].png.ts`:

```ts
import type { APIRoute } from 'astro';

import { renderRaffleOg } from '@/lib/og/render';
import { getPublicRaffle } from '@/lib/repositories/raffle';
import { getPublicRaffleById } from '@/lib/db';
import { raffleStub } from '@/lib/raffle/client';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  if (!params.id) return new Response('Not found', { status: 404 });

  const env = locals.runtime.env;

  // Configuración desde D1, estado desde el Durable Object.
  const raffle = await getPublicRaffleById(env.DB, params.id);
  if (!raffle) return new Response('Not found', { status: 404 });

  const grid = await raffleStub(env, raffle.id).publicGrid();

  const png = await renderRaffleOg({
    title: raffle.title,
    description: raffle.description?.slice(0, 120) ?? null,
    totalNumbers: raffle.total_numbers,
    numberStart: raffle.number_start,
    soldNumbers: grid.filter((n) => n.status === 'SOLD').map((n) => n.number),
    ticketPrice: raffle.ticket_price,      // centavos
    drawDate: raffle.draw_date,
    winnerNumber: raffle.winner_number,
  });

  // El `v` de la URL es la cantidad de vendidos: si cambió el estado, cambió la
  // URL. Por eso esta respuesta concreta es inmutable y se puede cachear para
  // siempre, tanto en el CDN como en el cache de WhatsApp.
  const current = grid.filter((n) => n.status === 'SOLD').length;
  const isCurrent = String(current) === params.v;

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': isCurrent
        ? 'public, max-age=300, s-maxage=300'
        : 'public, max-age=31536000, immutable',
    },
  });
};
```

Y en `src/components/seo/SocialMeta.astro`, la meta tag pasa a incluir la versión:

```astro
image={`/og/raffle/${raffle.id}/${soldCount}.png`}
```

### C.6 · `wrangler.jsonc`

El binding de Browser Run **se puede dejar** — lo vas a usar en la etapa E para
la imagen descargable. Lo que hay que sumar es el soporte de WASM:

```jsonc
{
  // ...
  "rules": [
    { "type": "CompiledWasm", "globs": ["**/*.wasm"] }
  ]
}
```

### C.7 · Verificación

```bash
pnpm build && npx wrangler dev
```

Abrí `http://localhost:8787/og/raffle/<id>/0.png`. Tres cosas a mirar:

1. La grilla sale con los vendidos en rojo.
2. **La tipografía es Nunito, no una de fallback.** Si ves otra fuente, satori no
   encontró el peso pedido: revisá que `fontWeight` en la plantilla sea 700 o
   900, que son los dos que cargaste.
3. En la consola de `wrangler dev`, el CPU time del request. Tiene que estar
   holgadamente abajo de 30 s (va a dar ~150–400 ms).

## Auth y esquema

No van acá:

- **Better Auth sobre D1** → [10 · Better Auth](./10-better-auth.md)
- **Migraciones de D1 y esquema del Durable Object** → [`docs/sql/`](./sql/)

## Comandos de git por etapa

```bash
# Etapa A
git add package.json pnpm-lock.yaml astro.config.mjs
git rm --cached src/pages/og/raffle/Nunito-*.ttf
git commit -m "build: :arrow_up: upgrade to Astro 7 and swap Vercel adapter for Cloudflare"

# Etapa B
git add wrangler.jsonc .gitignore src/env.d.ts src/middleware.ts package.json
git commit -m "build: :construction_worker: configure wrangler with browser binding and runtime env"

# Etapa C
git add src/lib/og/ src/pages/og/ package.json pnpm-lock.yaml
git commit -m "refactor: :recycle: render OG images with resvg-wasm and version their URL"

# Auth y esquema → ver 10 y docs/sql/
```

---

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| `Cannot find module 'node:...'` en runtime | Falta `nodejs_compat` en `compatibility_flags` |
| `env.BROWSER is undefined` en `astro dev` | Falta `platformProxy: { enabled: true }` en el adapter |
| `quickAction is not a function` | `compatibility_date` anterior a `2026-03-24` |
| `The entry-point file at "@astrojs/cloudflare/entrypoints/server" was not found` | Falta `output: 'server'` en `astro.config.mjs`: el build salió en modo static y no generó worker |
| `wrangler deploy` no encuentra el entry | El build no corrió, o corrió en modo static |
| La imagen OG sale con otra tipografía | satori no encontró el peso: usá 700 o 900 |
| `initWasm` falla en el segundo request | Falta el guard de módulo en `render.ts` |
| `Unexpected character` al importar el `.wasm` | Falta la regla `CompiledWasm` en `wrangler.jsonc` |
| WhatsApp muestra la imagen vieja | Falta el token de versión en la URL del OG |
| Login rompe después de desplegar | Falta la URI de callback de producción en Google Cloud Console |

> El último es fácil de pasar por alto: en **Google Cloud Console → Credentials**
> hay que tener las **tres** URIs de redirección (local, `workers.dev` y el
> dominio propio). Ver [10 · Better Auth](./10-better-auth.md).
