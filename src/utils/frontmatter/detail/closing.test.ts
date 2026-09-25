import { describe, expect, it } from 'vitest';

import type { OwnerRaffle } from '@/types/raffle';

import type { BuyerGroup } from './buyers';
import {
  phonesSentence,
  refundNotice,
  refundSentence,
  refundsOf,
  winnerNotice,
  winnerShareText,
} from './closing';

const raffle = (over: Partial<OwnerRaffle> = {}): OwnerRaffle => ({
  id: 'r1',
  slug: 'rifa-del-club',
  title: 'Rifa del Club',
  tier: 'BASIC',
  status: 'DRAFT',
  ticketPrice: 250000,
  currency: 'ARS',
  totalNumbers: 100,
  numberStart: 1,
  drawDate: '2026-12-24',
  soldCount: 0,
  reservedCount: 0,
  createdAt: 0,
  description: null,
  prize: null,
  unlockMethod: 'FREE',
  contactPhone: '+541199990000',
  winnerNumber: null,
  winnerName: null,
  syncedAt: null,
  publishedAt: null,
  closedAt: null,
  updatedAt: 0,
  ...over,
});

const buyer = (over: Partial<BuyerGroup> = {}): BuyerGroup => ({
  buyerId: 'b1',
  name: 'Roberto Paz',
  phone: '+5491144552211',
  numbers: [2, 5],
  notes: [],
  ...over,
});

const URL = 'https://rifate.app/r/rifa-del-club';

describe('refundsOf', () => {
  it('cuánto a cada uno y el total', () => {
    const { refunds, people, sold, cents, withPhone } = refundsOf(
      [
        buyer(),
        buyer({ buyerId: 'b2', name: 'Elsa', phone: null, numbers: [6] }),
      ],
      250000,
    );

    expect(refunds.map((r) => r.cents)).toEqual([500000, 250000]);
    expect({ people, sold, cents, withPhone }).toEqual({
      people: 2,
      sold: 3,
      cents: 750000,
      withPhone: 1,
    });
  });
});

describe('refundSentence', () => {
  it('en plural', () => {
    expect(refundSentence({ people: 9, sold: 27, cents: 6750000 })).toBe(
      '9 personas ya te compraron 27 números por $67.500.',
    );
  });

  it('en singular', () => {
    expect(refundSentence({ people: 1, sold: 1, cents: 250000 })).toBe(
      '1 persona ya te compró 1 número por $2.500.',
    );
  });
});

describe('avisos por WhatsApp', () => {
  it('al comprador de una cancelada: cuánto y por qué números, acolchados', () => {
    const r = raffle({ numberStart: 1, totalNumbers: 100 });
    const [refund] = refundsOf([buyer()], 250000).refunds;

    expect(refundNotice(r, refund!)).toBe(
      '¡Hola, Roberto Paz! Te escribo por la rifa «Rifa del Club»: la tuve que cancelar. Te devuelvo $5.000 por tus números 02 · 05. Avisame cómo te lo paso.',
    );
  });

  it('al ganador', () => {
    expect(winnerNotice(raffle({ numberStart: 0 }), 7, 'Ana')).toBe(
      '¡Hola, Ana! Salió el 07 en la rifa «Rifa del Club»: ¡ganaste! 🎉 Escribime y arreglamos la entrega.',
    );
  });
});

describe('winnerShareText', () => {
  it('con ganador, lo nombra', () => {
    expect(
      winnerShareText(
        raffle({ winnerNumber: 34, winnerName: 'Ana Ríos' }),
        URL,
      ),
    ).toBe(`Salió el 34 en «Rifa del Club»: ¡ganó Ana Ríos! 🎉 👉 ${URL}`);
  });

  it('si salió uno sin vender, lo dice', () => {
    expect(winnerShareText(raffle({ winnerNumber: 34 }), URL)).toBe(
      `Salió el 34 en «Rifa del Club», que no se había vendido. 👉 ${URL}`,
    );
  });
});

describe('phonesSentence', () => {
  it.each([
    [3, 0, 'Son 3 personas y ninguna dejó teléfono: avisales a mano.'],
    [1, 0, 'Es 1 persona y no dejó teléfono: avisale a mano.'],
    [
      9,
      8,
      'Son 9 personas y 8 dejaron teléfono. Cada «Avisar» abre un chat con el mensaje ya escrito.',
    ],
    [
      9,
      1,
      'Son 9 personas y 1 dejó teléfono. Cada «Avisar» abre un chat con el mensaje ya escrito.',
    ],
    [
      2,
      2,
      'Son 2 personas y todas dejaron teléfono. Cada «Avisar» abre un chat con el mensaje ya escrito.',
    ],
    [
      1,
      1,
      'Es 1 persona y dejó teléfono. Cada «Avisar» abre un chat con el mensaje ya escrito.',
    ],
  ])('%i personas, %i con teléfono', (people, withPhone, expected) => {
    expect(phonesSentence(people, withPhone)).toBe(expected);
  });
});
