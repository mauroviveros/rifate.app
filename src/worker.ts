/**
 * Punto de entrada del Worker.
 *
 * Existe por un solo motivo: una clase de Durable Object tiene que estar
 * EXPORTADA desde el módulo principal del Worker, y el entrypoint del adapter
 * (`@astrojs/cloudflare/entrypoints/server`) sólo exporta el handler `fetch`.
 *
 * El plugin de Cloudflare arma el bundle así:
 *
 *   import * as mod from "<main>";
 *   export * from "<main>";          ← por esto sobreviven los exports nombrados
 *   export default mod.default ?? {};
 *
 * Así que alcanza con reexportar el default del adapter y sumar las clases.
 */

export { default } from '@astrojs/cloudflare/entrypoints/server';
export { Raffle } from './do/raffle';
