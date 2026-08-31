/// <reference types="@cloudflare/vitest-pool-workers/types" />

/**
 * `Cloudflare.Env` la genera `wrangler types` en worker-configuration.d.ts a
 * partir de wrangler.jsonc. Los bindings que existen sólo en los tests se suman
 * acá por merging de interfaces — este archivo NO tiene imports ni exports de
 * primer nivel a propósito, porque si los tuviera sería un módulo y el
 * `declare namespace` dejaría de ser global.
 */
declare namespace Cloudflare {
  interface Env {
    /** Las migraciones de ./migrations, inyectadas desde vitest.config.ts. */
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }
}

/**
 * Y también en el `Env` global, que es el que usa `DurableObject<Env>`.
 *
 * `wrangler types` genera los dos (`Cloudflare.Env` y `Env`) con el mismo
 * contenido. Si se suma el binding a uno solo, los dos dejan de ser
 * intercambiables y falla cualquier cosa tipada contra la clase del DO — por
 * ejemplo `runInDurableObject<Raffle, R>`, cuya restricción pasa por
 * `Cloudflare.Env` mientras que `Raffle extends DurableObject<Env>`.
 */
interface Env {
  TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
}
