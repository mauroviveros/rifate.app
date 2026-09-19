import { describe, expect, it } from 'vitest';

import type { OwnerNumber } from '@/types/raffle';

import { tally } from './tally';

const cell = (over: Partial<OwnerNumber> = {}): OwnerNumber => ({
  number: 0,
  status: 'AVAILABLE',
  buyerId: null,
  buyerName: null,
  buyerPhone: null,
  orderId: null,
  reservedUntil: null,
  note: null,
  ...over,
});

describe('tally', () => {
  const grid = [
    cell({ number: 1, status: 'SOLD', buyerId: 'b1' }),
    cell({ number: 2, status: 'SOLD', buyerId: 'b1' }),
    cell({ number: 3, status: 'RESERVED' }),
    cell({ number: 4, status: 'AVAILABLE' }),
    cell({ number: 5, status: 'AVAILABLE' }),
  ];

  it('cuenta por estado', () => {
    expect(tally(grid, 250000)).toMatchObject({
      total: 5,
      available: 2,
      reserved: 1,
      sold: 2,
      blocked: 0,
    });
  });

  it('recauda sobre los vendidos, en centavos', () => {
    expect(tally(grid, 250000).raisedCents).toBe(500000);
  });

  it('el avance es entero y sobre el total', () => {
    expect(tally(grid, 250000).progress).toBe(40);
  });

  /** El estado `sin-grilla`: no tiene que dividir por cero para llegar ahí. */
  it('grilla vacía: avance 0, sin división por cero', () => {
    expect(tally([], 250000)).toMatchObject({
      total: 0,
      progress: 0,
      raisedCents: 0,
    });
  });
});
