import type { OwnerNumber, OwnerRaffle } from '@/types/raffle';

/**
 * Cuál de las cinco pantallas del detalle hay que dibujar.
 *
 * NO es `raffle.status`: una grilla vacía es una pantalla propia que ningún
 * status describe. `CLOSED` y `CANCELLED` sí van cada uno a la suya —hasta la
 * fase 9 se mostraban igual, y una anulada decía «Ya sorteada»—: en la
 * sorteada lo que importa es quién ganó, y en la anulada, a quién hay que
 * devolverle la plata.
 *
 * Es el mismo recurso que `EstadoTarjeta` en `raffle.ts`: un solo discriminante
 * en vez de tres booleanos sueltos. Con `isDraft` / `isPublished` / `isEmpty`
 * hay ocho combinaciones posibles y sólo cuatro son reales, así que nada impide
 * escribir una rama para un estado que no puede existir — ni avisa cuando falta
 * una que sí.
 */
export type EstadoDetalle =
  'sin-grilla' | 'borrador' | 'en-venta' | 'cerrada' | 'cancelada';

/**
 * ⚠️ `sin-grilla` gana sobre todo lo demás, y eso es un cambio respecto de la
 * pantalla vieja, que mostraba a la vez el cartel de rearmar y la checklist de
 * publicar. Sin números no hay nada que vender ni que publicar: la única acción
 * con sentido es rearmar el talonario, y ofrecer «Publicar» al lado sería
 * ofrecer algo que no va a funcionar.
 *
 * En una rifa sana no pasa —`createRaffleWithGrid` arma la grilla en el alta—:
 * significa que el `init()` del Durable Object no corrió.
 */
export const estadoDetalle = (
  raffle: OwnerRaffle,
  numbers: OwnerNumber[],
): EstadoDetalle => {
  if (numbers.length === 0) return 'sin-grilla';
  if (raffle.status === 'DRAFT') return 'borrador';
  if (raffle.status === 'PUBLISHED') return 'en-venta';
  if (raffle.status === 'CANCELLED') return 'cancelada';

  return 'cerrada';
};
