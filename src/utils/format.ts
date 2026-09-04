/**
 * Lo que se deriva para que alguien lo LEA: nombres, plata, fechas, avance.
 *
 * Nada de acá toca la base. Si el valor tiene que quedar guardado, el que manda
 * es `normalize.ts` — este archivo es la punta opuesta del mismo eje.
 */

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
export const pesos = (cents: number): string =>
  `$${new Intl.NumberFormat('es-AR').format(Math.round(cents / 100))}`;

/**
 * El mes corto en castellano rioplatense, del catálogo del runtime.
 *
 * `timeZone: 'UTC'` no es decorativo: la fecha que se le pasa se arma con
 * `Date.UTC()`, así que sin fijar la zona el formateo local podría caer en el
 * mes anterior el día 1. Del `Date` sólo sale el NOMBRE del mes — el número del
 * día se toma tal cual del string, que es lo que mantiene a `shortDate()`
 * fuera de cualquier zona horaria.
 *
 * El catálogo lo pone ICU, así que la abreviatura es la que diga el CLDR del
 * runtime (hoy, `sept` para septiembre). El test la fija corriendo adentro de
 * workerd, que es donde esto se ejecuta de verdad.
 */
const MONTH = new Intl.DateTimeFormat('es-AR', {
  month: 'short',
  timeZone: 'UTC',
});

/**
 * La fecha del sorteo como la escribe el canvas: `2026-09-20` → `20 sept`.
 *
 * El string se parte a mano y NO se construye un `Date` con él a propósito.
 * `new Date('2026-09-20')` es medianoche UTC, y cualquier formateo local desde
 * Argentina (UTC−3) lo muestra como el 19: el sorteo se correría un día para
 * atrás en toda la app. La fecha de sorteo es un día del calendario, no un
 * instante, así que nunca tiene que pasar por una zona horaria.
 *
 * Si la fecha no tiene la forma esperada se devuelve tal cual: mostrar el ISO
 * es feo, pero inventar un mes sería peor.
 */
export const shortDate = (iso: string): string => {
  const [, rawMonth = '', rawDay = ''] = iso.split('-');
  const month = Number(rawMonth);
  const day = Number(rawDay);

  const valid =
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= 31;

  if (!valid) return iso;

  return `${day} ${MONTH.format(Date.UTC(2000, month - 1, 1))}`;
};

/**
 * El avance de una rifa, entero, para mostrar: `113 de 200` → `57`.
 *
 * Se multiplica ANTES de dividir: `(113 / 200) * 100` da 56.4999… en punto
 * flotante y la tarjeta mostraría 56% donde el papel dice 57%.
 *
 * Sin números no hay avance, y de paso no hay división por cero.
 */
export const progress = (sold: number, total: number): number =>
  total > 0 ? Math.round((sold * 100) / total) : 0;

/**
 * El calendario argentino, para poder comparar contra `draw_date`.
 *
 * `formatToParts` y no el patrón del locale porque `en-CA` emite hoy
 * `YYYY-MM-DD`, pero eso es una convención de CLDR y no un contrato: armando
 * las partes a mano, el formato lo decide este archivo.
 */
const AR_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * El día del calendario argentino de un instante, como `YYYY-MM-DD`.
 *
 * El ISO ordena lexicográficamente, así que `rifa.drawDate <= inDays(7)` es una
 * comparación de fechas correcta sin construir ningún `Date` intermedio.
 *
 * Lo que NO sirve acá es `toISOString().slice(0, 10)`: eso da el día UTC, y
 * desde las 21:00 de Argentina ya devuelve el día siguiente. Es exactamente la
 * trampa que `shortDate()` esquiva tres funciones más arriba.
 */
export const today = (date = new Date()): string => {
  const parts = new Map(
    AR_DAY.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
};

/**
 * El mismo día del calendario, corrido `dias` días. Argentina no tiene horario
 * de verano, así que sumar milisegundos y volver a formatear es exacto.
 *
 * ⚠️ No lo guardes en un `const` de módulo: un isolate de Workers vive horas y
 * el valor se congelaría. Se llama una vez por request.
 */
export const inDays = (days: number, from = new Date()): string =>
  today(new Date(from.getTime() + days * 86_400_000));
