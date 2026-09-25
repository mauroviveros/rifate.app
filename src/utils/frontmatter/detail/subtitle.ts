import type { OwnerRaffle } from '@/types/raffle';
import { longDate, today } from '@/utils/format';

/**
 * Qué pasó y cuándo, en minúscula: «se sortea el 24 de diciembre».
 *
 * La sorteada y la cancelada cuentan la fecha en que pasó —`closedAt`, un
 * instante— y no la que estaba prevista: el sorteo pudo adelantarse, y una
 * cancelada nunca llegó a sortearse, así que decir «se sorteó» sería mentir.
 * Sin `closedAt` (una cerrada por fuera de la app) cae en la prevista.
 */
const whenOf = (raffle: OwnerRaffle): string => {
  const closed =
    raffle.closedAt === null
      ? longDate(raffle.drawDate)
      : longDate(today(new Date(raffle.closedAt)));

  if (raffle.status === 'CLOSED') return `se sorteó el ${closed}`;
  if (raffle.status === 'CANCELLED') return `se canceló el ${closed}`;

  return `se sortea el ${longDate(raffle.drawDate)}`;
};

/**
 * La bajada del encabezado: la descripción y la fecha, en una línea.
 *
 * Sin descripción la línea arranca sola, así que se le pone la mayúscula a
 * mano: «Se sortea el 24 de diciembre». Con descripción va detrás del « · » y
 * queda en minúscula, que es como se lee de corrido.
 */
export const subtitleOf = (raffle: OwnerRaffle): string => {
  const line = whenOf(raffle);

  return raffle.description
    ? `${raffle.description} · ${line}`
    : line.charAt(0).toUpperCase() + line.slice(1);
};
