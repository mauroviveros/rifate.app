/**
 * Vitest corriendo DENTRO del runtime de Workers, no en Node.
 *
 * ⚠️ Esto NO es la configuración que muestra hoy la doc de Cloudflare. En
 * `@cloudflare/vitest-pool-workers@0.22` (el primero compatible con Vitest 4)
 * cambiaron dos cosas, verificadas leyendo el paquete:
 *
 *   1. El subpath `@cloudflare/vitest-pool-workers/config` desapareció, y con
 *      él `defineWorkersConfig` / `defineWorkersProject`. Ahora el pool se
 *      configura con un plugin de Vite: `cloudflareTest()`.
 *   2. Se fue el "isolated storage" automático. Antes cada test corría sobre un
 *      storage que se revertía solo; ahora el reseteo es explícito y vive en
 *      `test/setup.ts`.
 */

import { fileURLToPath } from 'node:url';

import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// Lee ./migrations en Node y las deja listas para aplicarlas desde adentro del
// runtime. Las ordena por número de migración, que es por qué los archivos se
// llaman 0000_, 0001_, …
const migraciones = await readD1Migrations('./migrations');

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: './test/worker-entry.ts',
      miniflare: {
        // Los bindings se declaran acá y no con `wrangler: { configPath }` a
        // propósito: wrangler.jsonc trae el binding ASSETS apuntando a
        // ./dist/client, que sólo existe después de un build. Los tests no
        // tienen por qué depender de haber compilado.
        //
        // El precio es que estos dos valores hay que mantenerlos a mano en
        // sintonía con wrangler.jsonc.
        compatibilityDate: '2026-08-01',
        compatibilityFlags: ['global_fetch_strictly_public', 'nodejs_compat'],

        d1Databases: ['DB'],

        // `useSQLite` es explícito porque sin leer wrangler.jsonc el pool no ve
        // el `new_sqlite_classes` de las migraciones. Sin esto el DO arrancaría
        // con el backend viejo de key-value y `ctx.storage.sql` no existiría.
        durableObjects: {
          RAFFLE: { className: 'Raffle', useSQLite: true },
        },

        bindings: { TEST_MIGRATIONS: migraciones },
      },
    }),
  ],

  // El alias `@/` del tsconfig no lo lee nadie acá: `vitest.config.ts` es una
  // config de Vite aparte de la de Astro, que sí tiene un plugin que lo
  // resuelve. Sin esta línea, cualquier import de un VALOR desde `@/…` falla en
  // los tests (los `import type` sobreviven porque se borran antes).
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src/', import.meta.url)) },
  },

  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
  },
});
