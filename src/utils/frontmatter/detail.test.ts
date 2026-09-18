import { describe, expect, it } from 'vitest';

import type { OwnerNumber, OwnerRaffle } from '@/types/raffle';

import { flashMessage } from './detail';
import {
  beforePublishItems,
  buyersOf,
  detailView,
  numberLabel,
  numberWidth,
  pendingBeforePublish,
  previewNumbers,
  publishHint,
  selectionKind,
  tally,
  toEditInitial,
} from './detail';

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
  updatedAt: 0,
  ...over,
});

describe('numberWidth', () => {
  it('0..99 son dos dígitos', () => {
    expect(numberWidth(0, 100)).toBe(2);
  });
  it('1..100: el 100 no arrastra a todos a tres dígitos', () => {
    expect(numberWidth(1, 100)).toBe(2);
  });
  it('1..1000: el anteúltimo es 999', () => {
    expect(numberWidth(1, 1000)).toBe(3);
  });
  it('no explota con una rifa de un número', () => {
    expect(numberWidth(0, 1)).toBe(1);
  });
});

describe('numberLabel', () => {
  it('rellena a la izquierda y deja pasar el que se pasa', () => {
    expect(numberLabel(7, 2)).toBe('07');
    expect(numberLabel(100, 2)).toBe('100');
  });
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
  it('grilla vacía: avance 0, sin división por cero', () => {
    expect(tally([], 250000)).toMatchObject({
      total: 0,
      progress: 0,
      raisedCents: 0,
    });
  });
});

describe('selectionKind', () => {
  it('sin selección', () => {
    expect(selectionKind([])).toBe('empty');
  });
  it('todos libres → vender', () => {
    expect(selectionKind([false, false])).toBe('sell');
  });
  it('todos ocupados → liberar', () => {
    expect(selectionKind([true, true])).toBe('release');
  });
  it('mezcla → ni una ni la otra', () => {
    expect(selectionKind([false, true])).toBe('mixed');
  });
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
  it('ordena los grupos por su número más bajo, no por id', () => {
    expect(buyersOf(grid).map((g) => g.buyerId)).toEqual(['b2', 'b1']);
  });
  it('junta cada nota distinta una sola vez', () => {
    expect(buyersOf(grid)[1].notes).toEqual(['pagó alias']);
  });
  it('ignora libres y reservados', () => {
    expect(buyersOf(grid)).toHaveLength(2);
  });
});

describe('previewNumbers', () => {
  it('muestra hasta max y cuenta el resto', () => {
    expect(previewNumbers([1, 2, 3, 4, 5], 3)).toEqual({
      shown: [1, 2, 3],
      hidden: 2,
    });
  });
  it('sin resto cuando entran todos', () => {
    expect(previewNumbers([1, 2], 3)).toEqual({ shown: [1, 2], hidden: 0 });
  });
});

describe('publishHint', () => {
  it('sin teléfono, dice por qué', () => {
    expect(publishHint(raffle({ contactPhone: null }))).toBe(
      'Cargá un teléfono para publicar',
    );
  });
  it('con teléfono, no molesta', () => {
    expect(publishHint(raffle({ contactPhone: '+541199990000' }))).toBeNull();
  });
});

describe('toEditInitial', () => {
  it('pasa el precio de centavos a pesos, en string', () => {
    expect(toEditInitial(raffle({ ticketPrice: 250000 }))).toMatchObject({
      ticketPrice: '2500',
      totalNumbers: '100',
      numberStart: '1',
    });
  });

  it('los textos que faltan salen como cadena vacía, no null', () => {
    expect(
      toEditInitial(
        raffle({ description: null, prize: null, contactPhone: null }),
      ),
    ).toMatchObject({ description: '', prize: '', contactPhone: '' });
  });
});

describe('beforePublishItems · pendingBeforePublish', () => {
  it('sin teléfono, sólo falta el teléfono', () => {
    const items = beforePublishItems(raffle({ contactPhone: null }));
    expect(items.map((i) => i.done)).toEqual([true, true, true, false]);
    expect(items[3]?.label).toBe('Un teléfono de contacto');
    expect(pendingBeforePublish(raffle({ contactPhone: null }))).toBe(1);
  });

  it('con teléfono, no falta nada', () => {
    expect(
      pendingBeforePublish(raffle({ contactPhone: '+5493410000000' })),
    ).toBe(0);
  });

  it('el ítem del rango dice la cantidad y el precio', () => {
    const [, rango] = beforePublishItems(
      raffle({ totalNumbers: 200, ticketPrice: 500000 }),
    );
    expect(rango?.label).toBe('200 números a $5.000');
  });
});

describe('flashMessage', () => {
  it('sin flag no hay cartel', () => {
    expect(flashMessage(null)).toBeNull();
    expect(flashMessage('')).toBeNull();
  });

  it('un flag desconocido se ignora', () => {
    expect(flashMessage('exploded-9')).toBeNull();
  });

  it('publicada no lleva cuenta', () => {
    expect(flashMessage('published')).toBe('Listo: tu rifa quedó publicada.');
  });

  it('editada no lleva cuenta', () => {
    expect(flashMessage('updated')).toBe('Listo: guardamos los cambios.');
  });

  it('vender: singular y plural', () => {
    expect(flashMessage('sold-1')).toBe('Vendiste 1 número.');
    expect(flashMessage('sold-3')).toBe('Vendiste 3 números.');
  });

  it('liberar: singular y plural', () => {
    expect(flashMessage('freed-1')).toBe('Liberaste 1 número.');
    expect(flashMessage('freed-2')).toBe('Liberaste 2 números.');
  });
});

describe('detailView', () => {
  const view = (over: Partial<Parameters<typeof detailView>[0]> = {}) =>
    detailView({
      raffle: raffle(),
      numbers: [cell({ number: 1 })],
      formData: null,
      ok: null,
      site: new URL('https://rifate.app'),
      ...over,
    });

  it('sin descripción, la bajada arranca en mayúscula', () => {
    expect(view().subtitle).toBe('Se sortea el 24 de diciembre');
  });

  it('con descripción, la fecha va detrás del separador', () => {
    const subtitle = view({
      raffle: raffle({ description: 'A beneficio del club' }),
    }).subtitle;

    expect(subtitle).toBe(
      'A beneficio del club · se sortea el 24 de diciembre',
    );
  });

  it('una rifa cerrada ya se sorteó', () => {
    expect(view({ raffle: raffle({ status: 'CLOSED' }) }).subtitle).toBe(
      'Se sorteó el 24 de diciembre',
    );
  });

  it('el link público sale del slug', () => {
    expect(view().publicUrl).toBe('https://rifate.app/r/rifa-del-club');
  });

  it('sin `Astro.site` cae al dominio de producción', () => {
    expect(view({ site: undefined }).publicUrl).toBe(
      'https://rifate.app/r/rifa-del-club',
    );
  });

  it('los estados son excluyentes', () => {
    expect(view()).toMatchObject({ isDraft: true, isPublished: false });
    expect(view({ raffle: raffle({ status: 'PUBLISHED' }) })).toMatchObject({
      isDraft: false,
      isPublished: true,
    });
    expect(view({ raffle: raffle({ status: 'CLOSED' }) })).toMatchObject({
      isDraft: false,
      isPublished: false,
    });
  });

  it('una grilla sin números es la que no se sembró', () => {
    expect(view({ numbers: [] }).isEmpty).toBe(true);
    expect(view().isEmpty).toBe(false);
  });

  it('sin POST no hay nada tildado ni tipeado', () => {
    expect(view()).toMatchObject({ selectedNumbers: [], phoneValue: '' });
  });

  it('repuebla los números tildados y descarta la basura', () => {
    const formData = new FormData();
    formData.append('numbers', '7');
    formData.append('numbers', 'no-es-un-número');
    formData.append('numbers', '12');

    expect(view({ formData }).selectedNumbers).toEqual([7, 12]);
  });

  it('repuebla el teléfono que se tipeó', () => {
    const formData = new FormData();
    formData.append('contactPhone', '11 2345-6789');

    expect(view({ formData }).phoneValue).toBe('11 2345-6789');
  });

  it('el cartel de éxito sale del `?ok=`', () => {
    expect(view({ ok: 'sold-2' }).okMessage).toBe('Vendiste 2 números.');
    expect(view({ ok: null }).okMessage).toBeNull();
  });
});
