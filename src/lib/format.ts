/**
 * Lo que se escribe para que alguien lo LEA. Nada de acá toca la base: si el
 * valor tiene que quedar guardado, el que manda es `normalize.ts`.
 */

/** La primera letra de verdad, no la primera unidad de UTF-16. */
const primeraLetra = (texto: string): string => [...texto][0] ?? '';

/**
 * Las dos letras del avatar: `Marta González` → `MG`.
 *
 * Se parte por espacios y por los separadores que traen los mails y los nombres
 * compuestos (`.`, `_`, `-`), así que `marta.gonzalez@…` también da `MG` y no
 * un `MA` que no dice nada. Con una sola palabra van sus dos primeras letras.
 *
 * El mail es el segundo intento y no el primero: una cuenta de Google puede
 * venir sin `name` —pasa con las cuentas de empresa— y el avatar tiene que
 * decir algo igual. Si tampoco hay mail, `?`: es feo, pero es honesto, y una
 * caja vermellón vacía en la barra parecería un error de carga.
 */
export const initials = (name: string, email = ''): string => {
  const partes = (name.trim() || email.split('@')[0]?.trim() || '')
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (partes.length === 0) return '?';

  const primera = partes[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1] ?? '') : '';

  const letras = ultima
    ? primeraLetra(primera) + primeraLetra(ultima)
    : [...primera].slice(0, 2).join('');

  return letras.toUpperCase();
};

/**
 * Los centavos que guarda la base, escritos como se leen: `250000` → `$2.500`.
 *
 * A mano y no con `style: 'currency'` por dos razones, las dos del canvas: el
 * `es-AR` de Intl emite `$ 2.500` con un espacio duro en el medio —y en algunos
 * runtimes `ARS 2.500`—, y en los artboards el signo va pegado. El separador de
 * miles sí es el de Intl, que es el punto argentino.
 *
 * Redondea al peso: los precios de una rifa de barrio son redondos, y `$2.500`
 * se lee de un vistazo al sol mucho mejor que `$2.500,00` (regla 6).
 */
export const pesos = (centavos: number): string =>
  `$${new Intl.NumberFormat('es-AR').format(Math.round(centavos / 100))}`;

const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/**
 * La fecha del sorteo como la escribe el canvas: `2026-09-20` → `20 sep`.
 *
 * Se parte el string a mano y no se construye un `Date` a propósito.
 * `new Date('2026-09-20')` es medianoche UTC, y cualquier formateo local desde
 * Argentina (UTC−3) lo muestra como el 19: el sorteo se correría un día para
 * atrás en toda la app. La fecha de sorteo es un día del calendario, no un
 * instante, así que nunca tiene que pasar por una zona horaria.
 *
 * Si la fecha no tiene la forma esperada se devuelve tal cual: mostrar el ISO
 * es feo, pero inventar un mes sería peor.
 */
export const fechaCorta = (iso: string): string => {
  const [, mes = '', dia = ''] = iso.split('-');
  const nombre = MESES[Number(mes) - 1];

  if (nombre === undefined || dia === '') return iso;

  return `${Number(dia)} ${nombre}`;
};
