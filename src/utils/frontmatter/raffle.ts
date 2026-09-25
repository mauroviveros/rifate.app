/**
 * Lo que la tarjeta del panel calcula antes de dibujarse.
 *
 * Está acá y no adentro del `.astro` por dos razones: el frontmatter de un
 * componente no se puede testear, y todo esto son funciones puras sobre una
 * `RaffleListItem`. La tarjeta queda con el markup y nada más.
 */

import type { RaffleListItem } from '@/types/raffle';
import { progress } from '@/utils/format';

/**
 * El estado que ve el organizador, que NO es `rifa.status`.
 *
 * «Últimos días» es una capa encima de `PUBLISHED` que depende de la fecha y
 * no de la columna. Y `CANCELLED` no se dice como `CLOSED`: hasta la fase 9
 * compartían «Ya sorteada», y una rifa anulada no se sorteó. Un solo
 * discriminante para las tres funciones de abajo, así el badge, el botón y la
 * bajada no pueden contradecirse.
 */
export type EstadoTarjeta =
  'cerrada' | 'cancelada' | 'borrador' | 'ultimos-dias' | 'en-venta';

/**
 * `limite` es un día del calendario en ISO (`inDays(7)`), no un `Date`: el ISO
 * ordena lexicográficamente, así que la comparación es correcta sin construir
 * nada ni pasar por una zona horaria.
 */
export const estadoDe = (
  rifa: RaffleListItem,
  limite: string,
): EstadoTarjeta => {
  if (rifa.status === 'CLOSED') return 'cerrada';
  if (rifa.status === 'CANCELLED') return 'cancelada';
  if (rifa.status === 'DRAFT') return 'borrador';

  return rifa.drawDate <= limite ? 'ultimos-dias' : 'en-venta';
};

/**
 * Los tres badges del artboard más el borrador, que el canvas no dibuja pero el
 * modelo tiene: una rifa en `DRAFT` no está en venta y decirlo «En venta» sería
 * mentir. Ninguno depende sólo del color — cada uno lo dice (regla 8).
 *
 * El `Record<EstadoTarjeta, …>` es el punto de todo esto: si mañana aparece un
 * estado nuevo, TypeScript obliga a llenarlo acá y en `ACCION`. Con la cadena
 * de ternarios que había antes, el estado nuevo caía en el `else` y la rifa se
 * mostraba «En venta» sin que nadie se enterara.
 */
// prettier-ignore
export const BADGE: Record<EstadoTarjeta, { texto: string; clase: string }> = {
  'cerrada':      { texto: 'Ya sorteada',  clase: 'bg-muted text-subtle-foreground' },
  // En tinta llena y no en la píldora apagada de la sorteada: son dos cosas
  // distintas, y la cancelada tiene plata que devolver.
  'cancelada':    { texto: 'Cancelada',    clase: 'bg-foreground text-background' },
  'borrador':     { texto: 'Sin publicar', clase: 'bg-warning/35 text-foreground' },
  'ultimos-dias': { texto: 'Últimos días', clase: 'bg-primary/10 text-primary' },
  'en-venta':     { texto: 'En venta',     clase: 'bg-success/12 text-success' },
};

/**
 * El botón dice lo que se puede hacer, y con un borrador NO es vender: la rifa
 * todavía no está publicada, así que «Ver y vender» sería una promesa falsa
 * (regla 4 — se habla como en el barrio, y también se dice la verdad).
 *
 * Las cuatro van al mismo detalle; lo que cambia es la expectativa.
 */
// prettier-ignore
export const ACCION: Record<
  EstadoTarjeta,
  { texto: string; variante: 'default' | 'outline' }
> = {
  'cerrada':      { texto: 'Ver el detalle',      variante: 'outline' },
  'cancelada':    { texto: 'Ver el detalle',      variante: 'outline' },
  'borrador':     { texto: 'Terminar de armarla', variante: 'default' },
  'ultimos-dias': { texto: 'Ver y vender',        variante: 'default' },
  'en-venta':     { texto: 'Ver y vender',        variante: 'default' },
};

/**
 * La miniatura de la grilla: 40 puntos, no los 100 números.
 *
 * Los vendidos se reparten con `i * 13 % 40` —13 y 40 son coprimos, así que la
 * vuelta pasa por los 40 lugares sin repetir ninguno— para que se vea salpicado
 * como en el canvas y no como una segunda barra de progreso. Sin azar: el mismo
 * avance dibuja siempre los mismos puntos.
 */
const PUNTOS = 40;

export const puntosDe = (rifa: RaffleListItem): boolean[] => {
  const vendidos = Math.round(
    (PUNTOS * progress(rifa.soldCount, rifa.totalNumbers)) / 100,
  );

  return Array.from({ length: PUNTOS }, (_, i) => (i * 13) % PUNTOS < vendidos);
};

/**
 * La bajada: el premio, o quién ganó cuando la rifa ya se sorteó. Puede volver
 * `null` — una rifa sin premio cargado no muestra la línea.
 *
 * Recibe el `EstadoTarjeta` ya calculado, no un `boolean` suelto: así usa el
 * mismo discriminante que `BADGE` y `ACCION` en vez de que cada función decida
 * por su cuenta qué es «cerrada». El call site es `bajadaDe(rifa,
 * estadoDe(rifa, limite))`.
 */
export const bajadaDe = (
  rifa: RaffleListItem,
  estado: EstadoTarjeta,
): string | null =>
  estado === 'cerrada' && rifa.winnerNumber !== null
    ? `Ganó el número ${rifa.winnerNumber}${rifa.winnerName ? ` · ${rifa.winnerName}` : ''}`
    : rifa.prize;
