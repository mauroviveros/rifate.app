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
  closedAt: null,
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

  it('una sorteada cuenta cuándo se sorteó, no cuándo estaba previsto', () => {
    // 20 de septiembre, 23:30 en Argentina: ya es el 21 en UTC.
    const closedAt = Date.parse('2026-09-21T02:30:00Z');

    expect(subtitleOf(raffle({ status: 'CLOSED', closedAt }))).toBe(
      'Se sorteó el 20 de septiembre',
    );
  });

  it('una cancelada no se sorteó: se canceló', () => {
    const closedAt = Date.parse('2026-09-12T15:00:00Z');

    expect(subtitleOf(raffle({ status: 'CANCELLED', closedAt }))).toBe(
      'Se canceló el 12 de septiembre',
    );
  });

  it('cerrada por fuera de la app, sin fecha de cierre, cae en la prevista', () => {
    expect(subtitleOf(raffle({ status: 'CLOSED' }))).toBe(
      'Se sorteó el 24 de diciembre',
    );
  });
});
