/**
 * Un teléfono guardado (E.164, de `normalize.phone`) visto como lo escribe la
 * gente: `+541144552211` → `11 4455-2211`.
 *
 * Para partir característica y abonado usa la tabla de `normalize/area-code`.
 * Si la tabla se equivoca, el número se agrupa raro pero sigue siendo el mismo
 * número: el error es sólo cosmético.
 */

import { areaLength } from '@/utils/normalize/area-code';

const AR = '+54';

/**
 * Los 10 dígitos nacionales de un número argentino, sin el `9` de celular, o
 * `null` si no es argentino o no tiene esa forma.
 */
export const arNational = (e164: string): string | null => {
  if (!e164.startsWith(AR)) return null;

  const rest = e164.slice(AR.length);
  const national =
    rest.length === 11 && rest.startsWith('9') ? rest.slice(1) : rest;

  return /^\d{10}$/.test(national) ? national : null;
};

/**
 * El abonado se parte en los últimos cuatro y lo que quede adelante:
 * `4455-2211`, `555-1234`, `42-1234`. Lo que no es argentino, o no tiene la
 * forma esperada, se muestra tal cual: mejor el E.164 que un número inventado.
 */
export const localPhone = (e164: string): string => {
  const national = arNational(e164);
  if (national === null) return e164;

  const area = national.slice(0, areaLength(national));
  const subscriber = national.slice(area.length);
  const cut = subscriber.length - 4;

  return `${area} ${subscriber.slice(0, cut)}-${subscriber.slice(cut)}`;
};
