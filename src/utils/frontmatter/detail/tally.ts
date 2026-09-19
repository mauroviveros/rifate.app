import type { OwnerNumber } from '@/types/raffle';
import { progress } from '@/utils/format';

export type Tally = {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  blocked: number;
  /** Vendidos × precio, en centavos: la unidad que guarda D1. */
  raisedCents: number;
  /** Avance 0-100, entero. */
  progress: number;
};

/**
 * Los contadores de la grilla, de una sola pasada.
 *
 * Se cuenta sobre la grilla y no sobre `raffle.soldCount` a propósito: la fila
 * de D1 es el caché y el Durable Object es la verdad, y esta grilla viene del
 * objeto. Si los dos no coinciden, el que manda es el que estás mirando.
 */
export const tally = (
  numbers: OwnerNumber[],
  ticketPriceCents: number,
): Tally => {
  const bucket = { available: 0, reserved: 0, sold: 0, blocked: 0 };

  for (const { status } of numbers) {
    if (status === 'AVAILABLE') bucket.available++;
    else if (status === 'RESERVED') bucket.reserved++;
    else if (status === 'SOLD') bucket.sold++;
    else if (status === 'BLOCKED') bucket.blocked++;
  }

  return {
    total: numbers.length,
    ...bucket,
    raisedCents: bucket.sold * ticketPriceCents,
    progress: progress(bucket.sold, numbers.length),
  };
};
