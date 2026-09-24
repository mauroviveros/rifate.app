import type { OwnerRaffle, PublicNumber } from '@/types/raffle';
import { pesos, shortDate } from '@/utils/format';
import type { GridSvgInput } from '@/utils/grid-svg';
import { localPhone } from '@/utils/whatsapp';

/**
 * Lo que viaja al navegador para armar la imagen del estado: título, arranque,
 * número + estado y los textos del pie. Nada más.
 *
 * El panel tiene `OwnerNumber`, con nombre y teléfono de cada comprador.
 * Pasarlo entero al `data-` del botón no filtraría nada —es la pantalla del
 * dueño—, pero metería en el HTML datos que la imagen no usa. El `map` los
 * deja afuera a propósito, y el test lo sostiene.
 *
 * El pie se formatea ACÁ, en el servidor, y no en el `<script>`: así el bundle
 * del navegador no arrastra `format/` ni `whatsapp/` para tres textos. El
 * teléfono que va es el del organizador, que es público a propósito: es el
 * canal por el que se compra (ver `PublicRaffle`).
 */
export const shareImageInput = (
  raffle: Pick<
    OwnerRaffle,
    'title' | 'numberStart' | 'ticketPrice' | 'drawDate' | 'contactPhone'
  >,
  numbers: PublicNumber[],
): GridSvgInput => ({
  title: raffle.title,
  numberStart: raffle.numberStart,
  numbers: numbers.map(({ number, status }) => ({ number, status })),
  footer: {
    price: pesos(raffle.ticketPrice),
    drawDate: shortDate(raffle.drawDate),
    contact:
      raffle.contactPhone === null ? null : localPhone(raffle.contactPhone),
  },
});
