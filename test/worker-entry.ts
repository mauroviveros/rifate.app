/**
 * Entrypoint SÓLO para los tests.
 *
 * No se puede usar `src/worker.ts`: reexporta el entrypoint del adapter, que
 * importa `virtual:astro-cloudflare:config` — un módulo virtual que sólo existe
 * mientras corre `astro build`. Vitest no ejecuta el build de Astro, así que ese
 * import no resuelve y el bundle del pool falla antes de correr un solo test.
 *
 * Lo único que el pool necesita del `main` es que exporte la clase del Durable
 * Object, para poder resolver contra qué apunta el binding RAFFLE.
 */

export { Raffle } from '../src/do/raffle';

// El pool espera un default export en el `main`. Nada de lo que probamos pasa
// por HTTP: los tests llaman a los métodos del DO y a los repositorios directo.
export default {
  fetch: () => new Response('sólo tests', { status: 404 }),
} satisfies ExportedHandler<Env>;
