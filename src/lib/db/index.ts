/**
 * El único módulo que toca el binding de D1.
 *
 * Las páginas y las actions no ven `env.DB` nunca: pasan por acá, y la firma de
 * cada función exige un `actor`, así que no deja olvidarse de filtrar. La regla
 * `no-restricted-syntax` de eslint.config.mjs lo hace fallar en CI si alguien
 * intenta el atajo.
 *
 * NO se exporta el D1Database.
 */

export { getProfile, type ProfileInput, updateProfile } from './profiles';
export {
  createRaffle,
  getOwnRaffle,
  getPublicRaffleBySlug,
  listOwnRaffles,
  markPublished,
} from './raffles';
export { issueVoucher, type NewVoucher, redeemVoucher } from './vouchers';
