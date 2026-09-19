import { describe, expect, it } from 'vitest';

import type { OwnerRaffle } from '@/types/raffle';

import { publicUrlOf } from './link';

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

describe('publicUrlOf', () => {
  it('el link público sale del slug', () => {
    expect(publicUrlOf(raffle(), new URL('https://rifate.app'))).toBe(
      'https://rifate.app/r/rifa-del-club',
    );
  });

  /** En un preview `Astro.site` es otro: el link tiene que seguirlo. */
  it('respeta el origen que le pasen', () => {
    expect(publicUrlOf(raffle(), new URL('https://preview.rifate.app'))).toBe(
      'https://preview.rifate.app/r/rifa-del-club',
    );
  });

  it('sin `Astro.site` cae al dominio de producción', () => {
    expect(publicUrlOf(raffle(), undefined)).toBe(
      'https://rifate.app/r/rifa-del-club',
    );
  });
});
