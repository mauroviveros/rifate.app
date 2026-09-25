/**
 * Los mismos flujos con los dos bindings ya resueltos.
 *
 * Existe por la defensa nº3 de docs/04: `src/actions/**` no puede escribir
 * `env.DB` ni `env.RAFFLE` —eslint lo hace fallar en CI—, y los flujos reciben
 * los dos por parámetro justamente para poder testearse. Sin esta capa, la
 * action no tendría cómo llamarlos sin romper la regla.
 *
 * Son DOS combinadores y no uno porque las firmas no son iguales. Uniformarlas
 * —pasarle un `db` a `sellNumbers`, que no lo usa— haría que la firma mintiera
 * sobre lo que cada flujo toca, y esa firma es lo único que después se lee.
 */

import { env } from 'cloudflare:workers';

import * as flows from './flows';

const withDbAndRaffles =
  <A extends unknown[], R>(
    fn: (db: D1Database, raffles: Env['RAFFLE'], ...args: A) => R,
  ) =>
  (...args: A): R =>
    fn(env.DB, env.RAFFLE, ...args);

const withRaffles =
  <A extends unknown[], R>(fn: (raffles: Env['RAFFLE'], ...args: A) => R) =>
  (...args: A): R =>
    fn(env.RAFFLE, ...args);

export const createRaffleWithGrid = withDbAndRaffles(
  flows.createRaffleWithGrid,
);
export const publishRaffle = withDbAndRaffles(flows.publishRaffle);
export const ownerGrid = withDbAndRaffles(flows.ownerGrid);
export const publicGrid = withDbAndRaffles(flows.publicGrid);
export const watchPublicGrid = withDbAndRaffles(flows.watchPublicGrid);
export const updateRaffleDetails = withDbAndRaffles(flows.updateRaffleDetails);
export const rebuildGrid = withDbAndRaffles(flows.rebuildGrid);

export const sellNumbers = withRaffles(flows.sellNumbers);
export const releaseNumbers = withRaffles(flows.releaseNumbers);
