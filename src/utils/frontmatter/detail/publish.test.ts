import { describe, expect, it } from 'vitest';

import type { OwnerRaffle } from '@/types/raffle';

import {
  beforePublishItems,
  pendingBeforePublish,
  publishHint,
} from './publish';

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

  /** El precio viaja en centavos y el renglón lo dice en pesos. */
  it('el ítem del rango dice la cantidad y el precio', () => {
    const [, rango] = beforePublishItems(
      raffle({ totalNumbers: 200, ticketPrice: 500000 }),
    );
    expect(rango?.label).toBe('200 números a $5.000');
  });
});
