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
 * El mes entero, del mismo catálogo del runtime y con el mismo `timeZone: 'UTC'`
 * que `MONTH`: la fecha se arma con `Date.UTC()`, así que sin fijar la zona el
 * formateo local podría caer en el mes anterior el día 1.
 */
const LONG_MONTH = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  timeZone: 'UTC',
});

type ParsedIsoDate = { month: number; day: number };

/**
 * Parseo y validación compartidos por `shortDate()` y `longDate()`.
 *
 * El string se parte a mano y NO se construye un `Date` con él a propósito.
 * `new Date('2026-09-20')` es medianoche UTC, y cualquier formateo local desde
 * Argentina (UTC−3) lo muestra como el 19: el sorteo se correría un día para
 * atrás en toda la app. La fecha de sorteo es un día del calendario, no un
 * instante, así que nunca tiene que pasar por una zona horaria.
 *
 * Si la fecha no tiene la forma esperada devuelve `null`: mostrar el ISO tal
 * cual es feo, pero inventar un mes sería peor — eso lo decide cada función
 * de salida, no este parser.
 */
const parseIsoDate = (iso: string): ParsedIsoDate | null => {
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

  return valid ? { month, day } : null;
};

/**
 * La fecha del sorteo como la escribe el canvas: `2026-09-20` → `20 sept`.
 */
export const shortDate = (iso: string): string => {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;

  return `${parsed.day} ${MONTH.format(Date.UTC(2000, parsed.month - 1, 1))}`;
};

/**
 * La fecha del sorteo con el mes entero, para la bajada del detalle:
 * `2026-09-20` → `20 de septiembre`.
 */
export const longDate = (iso: string): string => {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;

  return `${parsed.day} de ${LONG_MONTH.format(Date.UTC(2000, parsed.month - 1, 1))}`;
};

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
 * trampa que `shortDate()` esquiva más arriba.
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
