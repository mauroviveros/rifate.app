import { describe, expect, it } from 'vitest';

import type { OwnerNumber } from '@/types/raffle';

import { shareImageInput } from './share-image';

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
    const input = shareImageInput({ title: 'Club', numberStart: 1 }, [SOLD]);
    const json = JSON.stringify(input);

    expect(input.numbers).toEqual([{ number: 7, status: 'SOLD' }]);
    expect(json).not.toContain('Ana');
    expect(json).not.toContain('4455');
    expect(json).not.toContain('efectivo');
  });
});
