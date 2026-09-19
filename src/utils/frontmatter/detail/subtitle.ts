import type { OwnerRaffle } from '@/types/raffle';
import { longDate } from '@/utils/format';

/**
 * La bajada del encabezado: la descripción y la fecha, en una línea.
 *
 * Sin descripción la línea arranca sola, así que se le pone la mayúscula a
 * mano: «Se sortea el 24 de diciembre». Con descripción va detrás del « · » y
 * queda en minúscula, que es como se lee de corrido.
 *
 * Sólo `CLOSED` cambia el verbo a pasado: una `CANCELLED` nunca llegó a
 * sortearse, así que decir «se sorteó» sería mentir.
 */
export const subtitleOf = (raffle: OwnerRaffle): string => {
  const verb = raffle.status === 'CLOSED' ? 'sorteó' : 'sortea';
  const line = `se ${verb} el ${longDate(raffle.drawDate)}`;

  return raffle.description
    ? `${raffle.description} · ${line}`
    : line.charAt(0).toUpperCase() + line.slice(1);
};
