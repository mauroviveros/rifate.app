import { describe, expect, it } from 'vitest';

import type { OwnerNumber } from '@/types/raffle';

import { shareImageInput } from './share-image';

const RAFFLE = {
  title: 'Club',
  numberStart: 1,
  ticketPrice: 250000, // centavos
  drawDate: '2026-12-31',
  contactPhone: '+543415551234',
};

const SOLD: OwnerNumber = {
  number: 7,
  status: 'SOLD',
  buyerId: 'b1',
  buyerName: 'Ana Ríos',
  buyerPhone: '+541144552211',
  orderId: null,
  reservedUntil: null,
  note: 'pagó en efectivo',
};

describe('shareImageInput', () => {
  it('lleva número y estado, nunca el comprador', () => {
    const input = shareImageInput(RAFFLE, [SOLD]);
    const json = JSON.stringify(input);

    expect(input.numbers).toEqual([{ number: 7, status: 'SOLD' }]);
    expect(json).not.toContain('Ana');
    expect(json).not.toContain('4455');
    expect(json).not.toContain('efectivo');
  });

  it('el pie va formateado como se lee', () => {
    expect(shareImageInput(RAFFLE, []).footer).toEqual({
      price: '$2.500',
      drawDate: '31 dic',
      contact: '341 555-1234',
    });
  });

  it('sin teléfono, el pie no inventa uno', () => {
    const input = shareImageInput({ ...RAFFLE, contactPhone: null }, []);

    expect(input.footer?.contact).toBeNull();
  });
});
