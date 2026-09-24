/**
 * Un teléfono guardado (E.164, de `normalize.phone`) visto como lo escribe la
 * gente: `+541144552211` → `11 4455-2211`.
 *
 * El número nacional argentino tiene siempre 10 dígitos —característica más
 * abonado—, pero la característica puede ser de 2, 3 o 4 dígitos y desde los
 * dígitos solos no se sabe cuál. Por eso la tabla: `11` es la única de dos,
 * las de tres son las de abajo y todo lo demás se toma como de cuatro. Si la
 * tabla se equivoca, el número se agrupa raro pero sigue siendo el mismo
 * número: el error es sólo cosmético.
 */

const AR = '+54';

/** Las características de tres dígitos. El resto (salvo `11`) son de cuatro. */
// prettier-ignore
const AREA_3 = new Set([
  '220', '221', '223', '230', '236', '237', '249', '260', '261', '263', '264',
  '266', '280', '291', '294', '297', '298', '299', '336', '341', '342', '343',
  '345', '348', '351', '353', '358', '362', '364', '370', '376', '379', '380',
  '381', '383', '385', '387', '388',
]);

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

const areaLength = (national: string): number =>
  national.startsWith('11') ? 2 : AREA_3.has(national.slice(0, 3)) ? 3 : 4;

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
