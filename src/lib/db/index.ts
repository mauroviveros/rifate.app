/**
 * La superficie de datos que ve el resto de la app. NO se exporta el
 * D1Database: las páginas y las actions no ven `env.DB` nunca, y la firma de
 * cada función exige un `actor`, así que no deja olvidarse de filtrar. La regla
 * `no-restricted-syntax` de eslint.config.mjs lo hace fallar en CI si alguien
 * intenta el atajo.
 *
 * El reparto:
 *
 *   src/lib/db/<repo>.ts   los repositorios. Firma `(db, actor, …)`, con el
 *                          `db` explícito para poder testearlos contra la base
 *                          de `@cloudflare/vitest-pool-workers`. Los importan
 *                          los tests y `src/lib/raffles.ts`, que no es una
 *                          página: orquesta D1 y el Durable Object y recibe
 *                          los dos por parámetro.
 *
 *   src/lib/db/bound.ts    las mismas funciones con el binding ya resuelto.
 *                          Es el único módulo que importa `cloudflare:workers`.
 *
 *   src/lib/db/index.ts    esto: sólo el barril.
 */

export * from './bound';
export type { ProfileInput } from './profiles';
export type { NewVoucher } from './vouchers';
