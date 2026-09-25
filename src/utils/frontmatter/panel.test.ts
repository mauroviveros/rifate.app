import { describe, expect, it } from 'vitest';

import type { RaffleListItem, RaffleStatus } from '@/types/raffle';

import { panelSummary } from './panel';

const raffle = (status: RaffleStatus): RaffleListItem => ({
  id: 'r',
  slug: 's',
  title: 't',
  tier: 'BASIC',
  status,
  ticketPrice: 1000,
  currency: 'ARS',
  totalNumbers: 100,
  numberStart: 0,
  drawDate: '2026-12-24',
  soldCount: 0,
  reservedCount: 0,
  createdAt: 0,
  prize: null,
  winnerNumber: null,
  winnerName: null,
});

describe('panelSummary', () => {
  it('sin rifas', () => {
    expect(panelSummary([])).toBe('Acá van a estar todas tus rifas.');
  });
  it('una en venta, singular', () => {
    expect(panelSummary([raffle('PUBLISHED')])).toBe('Tenés 1 rifa en venta.');
  });
  it('varias, con «y» en la última', () => {
    expect(
      panelSummary([raffle('PUBLISHED'), raffle('PUBLISHED'), raffle('DRAFT')]),
    ).toBe('Tenés 2 rifas en venta y 1 sin publicar.');
  });
  it('tres partes, con coma', () => {
    expect(
      panelSummary([raffle('PUBLISHED'), raffle('DRAFT'), raffle('CLOSED')]),
    ).toBe('Tenés 1 rifa en venta, 1 sin publicar y 1 ya sorteada.');
  });
  it('CANCELLED no cuenta como sorteada: se dice aparte', () => {
    expect(panelSummary([raffle('CLOSED'), raffle('CANCELLED')])).toBe(
      'Tenés 1 ya sorteada y 1 cancelada.',
    );
  });
});
