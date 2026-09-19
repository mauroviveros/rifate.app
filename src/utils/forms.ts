/**
 * Helpers sobre un `FormData` que ya llegó al servidor.
 *
 * No confundir con `normalize.ts`: ahí se normaliza lo que se GUARDA. Acá sólo
 * se lee lo que alguien tipeó, para poder repoblar un formulario después de un
 * error de validación.
 */

/**
 * Un campo de texto de un `FormData`, o `''` si no vino.
 *
 * Tres pantallas (alta, venta, liberación) necesitan repoblar el formulario
 * después de un `ActionInputError`, y las tres repetían este mismo
 * `typeof v === 'string' ? v : ''`. Un solo lugar para esa lectura.
 */
export const formValue = (formData: FormData | null, name: string): string => {
  const value = formData?.get(name);
  return typeof value === 'string' ? value : '';
};

/**
 * Un string a número, con `fallback` si no da uno usable.
 *
 * Cae al `fallback` todo lo que no sea un número positivo y finito: el vacío,
 * la basura, un `Infinity` —tipeable en un `<input type="number">` con algo
 * como `1e400`—, el 0 y los negativos. Ninguno de los campos que pasan por acá
 * (cantidad de números, precio) admite un 0 ni un negativo, y dejarlos pasar no
 * es inocuo: arrastrados a una cuenta —como el total de `summarySnapshot()`—
 * terminan en un `pesos()` de $0 o negativo mostrado en pantalla antes de que
 * el server llegue a validar nada.
 *
 * El `> 0` es también lo que cubre el vacío, que es el caso menos evidente:
 * `Number('') === 0`, así que un `Number(value) || fallback` suelto en cada
 * punto de llamada parecería alcanzar, pero deja de alcanzar apenas aparezca un
 * campo donde 0 sea legítimo. Ese día esto se abre con una opción y el vacío
 * pasa a necesitar su propio corte; hoy no hace falta ninguno de los dos.
 *
 * Sin `FormData` de por medio a propósito: el `<script>` cliente que recalcula
 * el resumen de `Summary.astro` mientras se tipea necesita el mismo criterio,
 * pero ahí no hay ningún `FormData` — hay un `input.value` de toda la vida.
 */
export const numberOr = (raw: string, fallback: number): number => {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
