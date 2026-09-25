/**
 * Lo que dicen las pantallas del final: la sorteada y la cancelada, y los dos
 * diálogos que llevan a ellas.
 *
 * Los mensajes de WhatsApp viven acá y no en el markup por la misma razón que
 * `salePanel()`: son texto que se arma con datos, y un texto mal armado —el
 * número sin acolchar, un plural roto, el monto de otro comprador— es un error
 * que sólo se ve cuando ya se mandó.
 */

import type { OwnerRaffle } from '@/types/raffle';
import { pesos } from '@/utils/format';
import { numberLabel, numberWidth } from '@/utils/frontmatter/numbers';

import type { BuyerGroup } from './buyers';

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Una persona que compró, con lo que hay que devolverle. */
export type Refund = BuyerGroup & { cents: number };

/**
 * Lo que hay que devolver si la rifa se cancela: a quién, cuánto a cada uno y
 * el total. Es la cuenta que el diálogo de anular muestra ANTES —«9 personas
 * te compraron 27 números por $67.500»— y la pantalla de la cancelada después.
 */
export const refundsOf = (
  buyers: BuyerGroup[],
  ticketPrice: number,
): {
  refunds: Refund[];
  people: number;
  sold: number;
  cents: number;
  withPhone: number;
} => {
  const refunds = buyers.map((b) => ({
    ...b,
    cents: b.numbers.length * ticketPrice,
  }));

  return {
    refunds,
    people: refunds.length,
    sold: refunds.reduce((sum, r) => sum + r.numbers.length, 0),
    cents: refunds.reduce((sum, r) => sum + r.cents, 0),
    withPhone: refunds.filter((r) => r.phone !== null).length,
  };
};

/** «9 personas ya te compraron 27 números por $67.500». */
export const refundSentence = ({
  people,
  sold,
  cents,
}: {
  people: number;
  sold: number;
  cents: number;
}): string =>
  `${plural(people, 'persona', 'personas')} ya te ${people === 1 ? 'compró' : 'compraron'} ${plural(sold, 'número', 'números')} por ${pesos(cents)}.`;

/**
 * Cuántos se pueden avisar por WhatsApp. «0 dejaron teléfono» no se dice: se
 * dice «ninguna», y entonces no hay link que tocar, así que tampoco se promete.
 */
export const phonesSentence = (people: number, withPhone: number): string => {
  const who = people === 1 ? 'Es 1 persona' : `Son ${people} personas`;

  if (withPhone === 0) {
    return people === 1
      ? `${who} y no dejó teléfono: avisale a mano.`
      : `${who} y ninguna dejó teléfono: avisales a mano.`;
  }

  const phones =
    withPhone === people
      ? people === 1
        ? 'dejó teléfono'
        : 'todas dejaron teléfono'
      : `${withPhone} ${withPhone === 1 ? 'dejó' : 'dejaron'} teléfono`;

  return `${who} y ${phones}. Cada «Avisar» abre un chat con el mensaje ya escrito.`;
};

/** Los números de un comprador como se leen en el talonario: «02 · 05». */
const stubOf = (numbers: number[], raffle: OwnerRaffle) => {
  const width = numberWidth(raffle.numberStart, raffle.totalNumbers);
  return numbers.map((n) => numberLabel(n, width)).join(' · ');
};

/** El aviso a un comprador de una rifa cancelada. Lo manda el organizador. */
export const refundNotice = (raffle: OwnerRaffle, refund: Refund): string =>
  `¡Hola, ${refund.name}! Te escribo por la rifa «${raffle.title}»: la tuve que cancelar. Te devuelvo ${pesos(refund.cents)} por ${refund.numbers.length === 1 ? 'tu número' : 'tus números'} ${stubOf(refund.numbers, raffle)}. Avisame cómo te lo paso.`;

/** El aviso al ganador. */
export const winnerNotice = (
  raffle: OwnerRaffle,
  winnerNumber: number,
  name: string,
): string =>
  `¡Hola, ${name}! Salió el ${stubOf([winnerNumber], raffle)} en la rifa «${raffle.title}»: ¡ganaste! 🎉 Escribime y arreglamos la entrega.`;

/**
 * «Compartir quién ganó», para el grupo. Con el nombre, que es lo único del
 * comprador que se hace público. Si salió un número que nadie compró, se dice
 * así: el grupo tiene que enterarse de que no hubo ganador.
 */
export const winnerShareText = (
  raffle: OwnerRaffle,
  publicUrl: string,
): string => {
  if (raffle.winnerNumber === null) return `${raffle.title} 👉 ${publicUrl}`;

  const label = stubOf([raffle.winnerNumber], raffle);

  return raffle.winnerName === null
    ? `Salió el ${label} en «${raffle.title}», que no se había vendido. 👉 ${publicUrl}`
    : `Salió el ${label} en «${raffle.title}»: ¡ganó ${raffle.winnerName}! 🎉 👉 ${publicUrl}`;
};
