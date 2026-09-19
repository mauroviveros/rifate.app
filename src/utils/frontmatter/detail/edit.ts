import type { OwnerRaffle } from '@/types/raffle';

/**
 * La fila de la rifa a los strings que `Form` y `Summary` del alta esperan. En
 * el primer GET de `/panel/rifa/[id]/editar` no hay `FormData` y el formulario
 * saldría vacío: los valores salen de acá. El precio va en PESOS — el mismo
 * formato que tipea el organizador —, que el esquema reconvierte a centavos.
 */
export const toEditInitial = (raffle: OwnerRaffle): Record<string, string> => ({
  title: raffle.title,
  description: raffle.description ?? '',
  prize: raffle.prize ?? '',
  ticketPrice: String(raffle.ticketPrice / 100),
  totalNumbers: String(raffle.totalNumbers),
  numberStart: String(raffle.numberStart),
  drawDate: raffle.drawDate,
  contactPhone: raffle.contactPhone ?? '',
});
