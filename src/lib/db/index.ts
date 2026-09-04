/**
 * El único módulo que toca el binding de D1.
 *
 * Las páginas y las actions no ven `env.DB` nunca: importan de acá, y la firma
 * de cada función exige un `actor`, así que no deja olvidarse de filtrar. La
 * regla `no-restricted-syntax` de eslint.config.mjs lo hace fallar en CI si
 * alguien intenta el atajo. NO se exporta el D1Database.
 *
 * El reparto, entonces:
 *
 *   src/lib/db/<repo>.ts   los repositorios. Firma `(db, actor, …)`, con el
 *                          `db` explícito para poder testearlos contra la base
 *                          de `@cloudflare/vitest-pool-workers`. Los importan
 *                          los tests y `src/lib/raffles.ts`, que no es una
 *                          página: orquesta D1 y el Durable Object y recibe
 *                          los dos por parámetro.
 *
 *   src/lib/db/index.ts    esto. Las mismas funciones sin `db`, que se resuelve
 *                          acá. Es la superficie que ve el resto de la app.
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

export type { ProfileInput } from './profiles';
export type { NewVoucher } from './vouchers';
