/** La primera letra de verdad, no la primera unidad de UTF-16. */
const firstLetter = (text: string): string => [...text][0] ?? '';

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
  const parts = (name.trim() || email.split('@')[0]?.trim() || '')
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';

  const first = parts[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';

  const letters = last
    ? firstLetter(first) + firstLetter(last)
    : [...first].slice(0, 2).join('');

  return letters.toUpperCase();
};
