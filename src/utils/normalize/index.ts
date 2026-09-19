/**
 * La normalización de lo que se GUARDA. Los nombres son cortos a propósito:
 * el verbo lo pone el módulo —`normalize.phone()`, `normalize.voucherCode()`—
 * y repetirlo en cada función sólo alargaba el punto de llamada.
 */

export { phone } from './phone';
export { genSlug, slugify } from './slug';

/** La única fuente de `updated_at` / `created_at`. */
export const now = (): number => Date.now();

/** Normaliza un código de voucher: quita espacios y convierte a mayúsculas. */
export const voucherCode = (raw: string): string => raw.trim().toUpperCase();
