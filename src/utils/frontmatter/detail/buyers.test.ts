import { describe, expect, it } from 'vitest';

import type { OwnerNumber } from '@/types/raffle';

import { buyersOf, previewNumbers } from './buyers';

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

describe('buyersOf', () => {
  const grid = [
    cell({
      number: 5,
      status: 'SOLD',
      buyerId: 'b1',
      buyerName: 'Ana',
      buyerPhone: '+5411',
      note: 'pagó alias',
    }),
    cell({ number: 1, status: 'SOLD', buyerId: 'b2', buyerName: 'Beto' }),
    cell({
      number: 9,
      status: 'SOLD',
      buyerId: 'b1',
      buyerName: 'Ana',
      buyerPhone: '+5411',
      note: 'pagó alias',
    }),
    cell({ number: 3, status: 'AVAILABLE' }),
    cell({ number: 4, status: 'RESERVED' }),
  ];

  it('agrupa por comprador y ordena sus números', () => {
    const [first, second] = buyersOf(grid);
    expect(first).toMatchObject({ buyerId: 'b2', numbers: [1] });
    expect(second).toMatchObject({
      buyerId: 'b1',
      numbers: [5, 9],
      phone: '+5411',
    });
  });

  /**
   * La lista sigue el orden de la grilla y no un hash de ids: `b1` aparece
   * primero en el array, pero su número más bajo (5) es mayor que el de `b2`.
   */
  it('ordena los grupos por su número más bajo, no por id', () => {
    expect(buyersOf(grid).map((g) => g.buyerId)).toEqual(['b2', 'b1']);
  });

  it('junta cada nota distinta una sola vez', () => {
    expect(buyersOf(grid)[1]?.notes).toEqual(['pagó alias']);
  });

  /** Un RESERVED no tiene `buyerId`: la reserva va por `orderId`. */
  it('ignora libres y reservados', () => {
    expect(buyersOf(grid)).toHaveLength(2);
  });

  it('un vendido sin nombre no deja el renglón en blanco', () => {
    const [group] = buyersOf([
      cell({ number: 2, status: 'SOLD', buyerId: 'b9', buyerName: null }),
    ]);
    expect(group?.name).toBe('Sin nombre');
  });
});

describe('previewNumbers', () => {
  it('muestra hasta max y cuenta el resto', () => {
    expect(previewNumbers([1, 2, 3, 4, 5], 3)).toEqual({
      shown: [1, 2, 3],
      hidden: 2,
    });
  });

  /** `hidden: 0` es lo que le dice al renglón que no dibuje la flecha. */
  it('sin resto cuando entran todos', () => {
    expect(previewNumbers([1, 2], 3)).toEqual({ shown: [1, 2], hidden: 0 });
  });
});
