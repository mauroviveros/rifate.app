import type { OwnerRaffle, PublicNumber } from '@/types/raffle';
import type { GridSvgInput } from '@/utils/grid-svg';

/**
 * Lo que viaja al navegador para armar la imagen del estado: título, arranque
 * y número + estado. Nada más.
 *
 * El panel tiene `OwnerNumber`, con nombre y teléfono de cada comprador.
 * Pasarlo entero al `data-` del botón no filtraría nada —es la pantalla del
 * dueño—, pero metería en el HTML datos que la imagen no usa. El `map` los
 * deja afuera a propósito, y el test lo sostiene.
 */
export const shareImageInput = (
  raffle: Pick<OwnerRaffle, 'title' | 'numberStart'>,
  numbers: PublicNumber[],
): GridSvgInput => ({
  title: raffle.title,
  numberStart: raffle.numberStart,
  numbers: numbers.map(({ number, status }) => ({ number, status })),
});
