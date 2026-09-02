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
