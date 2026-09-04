/**
 * El único lugar del proyecto que lee `env.DB`.
 *
 * Cada repositorio de `db/<repo>.ts` recibe el `D1Database` por parámetro para
 * poder testearse contra la base de `@cloudflare/vitest-pool-workers` —y para
 * que `src/lib/raffles.ts`, que orquesta D1 y el Durable Object, pueda pasarle
 * el suyo. Acá se resuelve ese parámetro una sola vez.
 *
 * `conDB` no es magia: es la única forma de que la lista de abajo sea una línea
 * por función y no nueve envoltorios a mano que se desincronizan de la firma
 * real. Los tipos salen inferidos de cada repositorio, así que si a uno le
 * cambia un parámetro, el error aparece en el llamador y no acá.
 */

import { env } from 'cloudflare:workers';

import * as perfiles from './profiles';
import * as rifas from './raffles';
import * as vouchers from './vouchers';

const conDB =
  <A extends unknown[], R>(fn: (db: D1Database, ...args: A) => R) =>
  (...args: A): R =>
    fn(env.DB, ...args);

export const getProfile = conDB(perfiles.getProfile);
export const updateProfile = conDB(perfiles.updateProfile);

export const createRaffle = conDB(rifas.createRaffle);
export const getOwnRaffle = conDB(rifas.getOwnRaffle);
export const getPublicRaffleBySlug = conDB(rifas.getPublicRaffleBySlug);
export const listOwnRaffles = conDB(rifas.listOwnRaffles);
export const markPublished = conDB(rifas.markPublished);

export const issueVoucher = conDB(vouchers.issueVoucher);
export const redeemVoucher = conDB(vouchers.redeemVoucher);
