import { describe, expect, it } from 'vitest';

import type { OwnerNumber, OwnerRaffle } from '@/types/raffle';

import { estadoDetalle } from './estado';

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

/** Una grilla de `count` números. Sólo importa el largo. */
const gridOf = (count: number): OwnerNumber[] =>
  Array.from({ length: count }, (_, i) => ({ number: i }) as OwnerNumber);

describe('estadoDetalle', () => {
  it('DRAFT con grilla es el borrador', () => {
    expect(estadoDetalle(raffle({ status: 'DRAFT' }), gridOf(100))).toBe(
      'borrador',
    );
  });

  it('PUBLISHED con grilla está en venta', () => {
    expect(estadoDetalle(raffle({ status: 'PUBLISHED' }), gridOf(100))).toBe(
      'en-venta',
    );
  });

  /**
   * Los dos estados terminales se dicen igual: la rifa terminó y no hay nada
   * que hacerle. Mismo criterio que `estadoDe` en `raffle.ts`.
   */
  it('CLOSED y CANCELLED son la misma pantalla', () => {
    expect(estadoDetalle(raffle({ status: 'CLOSED' }), gridOf(100))).toBe(
      'cerrada',
    );
    expect(estadoDetalle(raffle({ status: 'CANCELLED' }), gridOf(100))).toBe(
      'cerrada',
    );
  });

  /**
   * El caso que justifica que `sin-grilla` sea un estado y no un booleano
   * aparte: gana sobre los cuatro status, porque sin números no hay nada que
   * publicar ni que vender. En la pantalla vieja esto convivía con la checklist
   * de publicar, y el botón ofrecía algo que no iba a funcionar.
   */
  it('sin grilla gana sobre cualquier status', () => {
    for (const status of [
      'DRAFT',
      'PUBLISHED',
      'CLOSED',
      'CANCELLED',
    ] as const) {
      expect(estadoDetalle(raffle({ status }), [])).toBe('sin-grilla');
    }
  });
});
