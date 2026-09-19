import { AppError } from '../errors';

/** Argentina. Es el único mercado en el que se opera. */
const COUNTRY_CODE = '54';

/**
 * Devuelve E.164 (`+5493415551234`) o `null` si no hay teléfono.
 *
 * Reglas, deliberadamente mecánicas:
 *   · vacío → null (el campo es opcional)
 *   · empieza con `+` → se respeta tal cual, sólo se limpian separadores
 *   · si no → se le saca el 0 de discado nacional y se le antepone +54
 *
 * ⚠️ NO inventa el `9` de los celulares argentinos. Un número de 10 dígitos
 * puede ser un celular (que en internacional lleva 9) o una línea fija (que no),
 * y desde acá no hay forma de distinguirlos. Meter el 9 "por las dudas" rompería
 * los fijos en silencio. Si el link de WhatsApp lo necesita, se resuelve en el
 * formulario, pidiéndolo bien.
 */
export const phone = (raw: string | null | undefined): string | null => {
  if (raw === null || raw === undefined) return null;

  const clean = raw.trim();
  if (clean.length === 0) return null;

  const isInternational = clean.startsWith('+');
  let digits = clean.replace(/\D/g, ''); // quita todo lo que no sea dígito

  if (!isInternational) {
    digits = digits.replace(/^0+/, ''); // quita ceros de discado nacional
    if (!digits.startsWith(COUNTRY_CODE)) digits = COUNTRY_CODE + digits;
  }

  const e164 = `+${digits}`;

  // La misma forma que exige el CHECK de `profiles`: '+', un dígito 1-9, y
  // entre 8 y 15 dígitos en total (largo 9 a 16 con el '+').
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) throw new AppError('INVALID_PHONE');

  return e164;
};
