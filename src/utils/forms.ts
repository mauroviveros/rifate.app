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
 * `Number('') === 0`, que es un valor válido y NO el fallback: por eso no
 * alcanza un `Number(value) || fallback` suelto en cada punto de llamada —da
 * la casualidad de que funciona porque acá el 0 nunca es un valor legítimo
 * (cantidad de números, precio), pero es el tipo de casualidad que se rompe
 * en silencio el día que alguien reuse esto para un campo que sí puede ser 0.
 * `Number.isFinite` de paso descarta un `Infinity` — tipeable en un
 * `<input type="number">` con algo como `1e400` — que si no se filtra
 * arruina cualquier cálculo que se haga después.
 *
 * Sin `FormData` de por medio a propósito: el `<script>` cliente que recalcula
 * el resumen de `Summary.astro` mientras se tipea necesita el mismo criterio,
 * pero ahí no hay ningún `FormData` — hay un `input.value` de toda la vida.
 */
export const numberOr = (raw: string, fallback: number): number => {
  const value = Number(raw);
  return Number.isFinite(value) && value !== 0 ? value : fallback;
};

/** `numberOr`, leyendo el campo de un `FormData` en vez de un string suelto. */
export const formNumber = (
  formData: FormData | null,
  name: string,
  fallback: number,
): number => numberOr(formValue(formData, name), fallback);
