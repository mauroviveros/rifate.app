/**
 * El único lugar del proyecto que lee `env.DB`.
 *
 * Cada repositorio de `db/<repo>.ts` recibe el `D1Database` por parámetro para
 * poder testearse contra la base de `@cloudflare/vitest-pool-workers` —y para
 * que `src/lib/raffles/`, que orquesta D1 y el Durable Object, pueda pasarle
 * el suyo. Acá se resuelve ese parámetro una sola vez.
 *
 * `withDb` no es magia: es la única forma de que la lista de abajo sea una línea
 * por función y no nueve envoltorios a mano que se desincronizan de la firma
 * real. Los tipos salen inferidos de cada repositorio, así que si a uno le
 * cambia un parámetro, el error aparece en el llamador y no acá.
 */

import { env } from 'cloudflare:workers';

import * as profiles from './profiles';
import * as raffles from './raffles';
import * as vouchers from './vouchers';

const withDb =
  <A extends unknown[], R>(fn: (db: D1Database, ...args: A) => R) =>
  (...args: A): R =>
    fn(env.DB, ...args);

export const getProfile = withDb(profiles.getProfile);
export const updateProfile = withDb(profiles.updateProfile);

export const createRaffle = withDb(raffles.createRaffle);
export const getOwnRaffle = withDb(raffles.getOwnRaffle);
export const getPublicRaffleBySlug = withDb(raffles.getPublicRaffleBySlug);
export const listOwnRaffles = withDb(raffles.listOwnRaffles);
export const markPublished = withDb(raffles.markPublished);
export const updateRaffle = withDb(raffles.updateRaffle);

export const issueVoucher = withDb(vouchers.issueVoucher);
export const redeemVoucher = withDb(vouchers.redeemVoucher);
