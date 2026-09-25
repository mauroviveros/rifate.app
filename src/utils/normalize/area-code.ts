/**
 * Cuántos dígitos tiene la característica de un número argentino.
 *
 * El número nacional tiene siempre 10 dígitos —característica más abonado—,
 * pero la característica puede ser de 2, 3 o 4, y desde los dígitos solos no
 * se sabe cuál. Por eso la tabla: `11` es la única de dos, las de tres son las
 * de abajo y todo lo demás se toma como de cuatro.
 *
 * Vive acá y no en `whatsapp/` porque la usan las dos puntas del teléfono:
 * `normalize.phone` para encontrar el `15` de un celular al GUARDAR, y
 * `localPhone` para agruparlo al MOSTRAR.
 */

/** Las características de tres dígitos. El resto (salvo `11`) son de cuatro. */
// prettier-ignore
const AREA_3 = new Set([
  '220', '221', '223', '230', '236', '237', '249', '260', '261', '263', '264',
  '266', '280', '291', '294', '297', '298', '299', '336', '341', '342', '343',
  '345', '348', '351', '353', '358', '362', '364', '370', '376', '379', '380',
  '381', '383', '385', '387', '388',
]);

export const areaLength = (national: string): number =>
  national.startsWith('11') ? 2 : AREA_3.has(national.slice(0, 3)) ? 3 : 4;
