import { AppError } from '../errors';
import { areaLength } from './area-code';

/** Argentina. Es el único mercado en el que se opera. */
const COUNTRY_CODE = '54';

/** El prefijo de celular del discado local: `341 15 555-1234`. */
const LOCAL_MOBILE = '15';

/**
 * El número nacional sin el `15` de celular del discado local, o `null` si no
 * lo trae.
 *
 * Se reconoce sólo con la forma exacta: característica + `15` + abonado suman
 * 12 dígitos, dos más que un número nacional. Uno de 10 no se toca aunque
 * tenga un `15` adentro: ahí es parte del abonado.
 */
const withoutLocalMobile = (national: string): string | null => {
  if (national.length !== 12) return null;

  const area = areaLength(national);
  const prefix = national.slice(area, area + LOCAL_MOBILE.length);
  if (prefix !== LOCAL_MOBILE) return null;

  return national.slice(0, area) + national.slice(area + LOCAL_MOBILE.length);
};

/**
 * Devuelve E.164 (`+5493415551234`) o `null` si no hay teléfono.
 *
 * Reglas, deliberadamente mecánicas:
 *   · vacío → null (el campo es opcional)
 *   · empieza con `+` → se respeta tal cual, sólo se limpian separadores
 *   · si no → se le saca el 0 de discado nacional y se le antepone +54
 *   · si además trae el `15` de celular del discado local
 *     (`0341 15 555-1234`), el 15 se va y en su lugar va el `9` después del
 *     54, que es como se escribe un celular en internacional
 *
 * ⚠️ NO inventa el `9` cuando no hay `15`. Un número de 10 dígitos puede ser
 * un celular (que en internacional lleva 9) o una línea fija (que no), y desde
 * acá no hay forma de distinguirlos. Meter el 9 "por las dudas" rompería los
 * fijos en silencio. El `15` es otra cosa: sólo lo tienen los celulares, así
 * que es la prueba, no una suposición. Para el resto, el link de WhatsApp pone
 * el 9 por su cuenta (`waLink`).
 */
export const phone = (raw: string | null | undefined): string | null => {
  if (raw === null || raw === undefined) return null;

  const clean = raw.trim();
  if (clean.length === 0) return null;

  const isInternational = clean.startsWith('+');
  let digits = clean.replace(/\D/g, ''); // quita todo lo que no sea dígito

  if (!isInternational) {
    digits = digits.replace(/^0+/, ''); // quita ceros de discado nacional

    const national = digits.startsWith(COUNTRY_CODE)
      ? digits.slice(COUNTRY_CODE.length)
      : digits;
    const mobile = withoutLocalMobile(national);

    digits =
      mobile === null ? COUNTRY_CODE + national : `${COUNTRY_CODE}9${mobile}`;
  }

  const e164 = `+${digits}`;

  // La misma forma que exige el CHECK de `profiles`: '+', un dígito 1-9, y
  // entre 8 y 15 dígitos en total (largo 9 a 16 con el '+').
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) throw new AppError('INVALID_PHONE');

  return e164;
};
