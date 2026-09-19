import type { OwnerNumber, OwnerRaffle } from '@/types/raffle';

/**
 * Cuál de las cuatro pantallas del detalle hay que dibujar.
 *
 * NO es `raffle.status`, por dos motivos. `CLOSED` y `CANCELLED` se muestran
 * igual —la rifa terminó, no hay nada que hacerle—, y una grilla vacía es una
 * pantalla propia que ningún status describe.
 *
 * Es el mismo recurso que `EstadoTarjeta` en `raffle.ts`: un solo discriminante
 * en vez de tres booleanos sueltos. Con `isDraft` / `isPublished` / `isEmpty`
 * hay ocho combinaciones posibles y sólo cuatro son reales, así que nada impide
 * escribir una rama para un estado que no puede existir — ni avisa cuando falta
 * una que sí.
 */
export type EstadoDetalle = 'sin-grilla' | 'borrador' | 'en-venta' | 'cerrada';

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

  return 'cerrada';
};
