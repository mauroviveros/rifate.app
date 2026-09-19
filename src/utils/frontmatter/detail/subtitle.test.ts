import { describe, expect, it } from 'vitest';

import type { OwnerRaffle } from '@/types/raffle';

import { subtitleOf } from './subtitle';

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

describe('subtitleOf', () => {
  it('sin descripción, la bajada arranca en mayúscula', () => {
    expect(subtitleOf(raffle())).toBe('Se sortea el 24 de diciembre');
  });

  it('con descripción, la fecha va detrás del separador y en minúscula', () => {
    expect(subtitleOf(raffle({ description: 'A beneficio del club' }))).toBe(
      'A beneficio del club · se sortea el 24 de diciembre',
    );
  });

  /** Sólo CLOSED cambia el verbo: una CANCELLED nunca llegó a sortearse. */
  it('una rifa cerrada ya se sorteó', () => {
    expect(subtitleOf(raffle({ status: 'CLOSED' }))).toBe(
      'Se sorteó el 24 de diciembre',
    );
    expect(subtitleOf(raffle({ status: 'CANCELLED' }))).toBe(
      'Se sortea el 24 de diciembre',
    );
  });
});
