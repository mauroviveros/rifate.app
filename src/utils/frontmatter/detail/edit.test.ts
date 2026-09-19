import { describe, expect, it } from 'vitest';

import type { OwnerRaffle } from '@/types/raffle';

import { toEditInitial } from './edit';

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

describe('toEditInitial', () => {
  it('pasa el precio de centavos a pesos, en string', () => {
    expect(toEditInitial(raffle({ ticketPrice: 250000 }))).toMatchObject({
      ticketPrice: '2500',
      totalNumbers: '100',
      numberStart: '1',
    });
  });

  /** El formulario espera strings: un `null` renderizaría la palabra «null». */
  it('los textos que faltan salen como cadena vacía, no null', () => {
    expect(
      toEditInitial(
        raffle({ description: null, prize: null, contactPhone: null }),
      ),
    ).toMatchObject({ description: '', prize: '', contactPhone: '' });
  });
});
