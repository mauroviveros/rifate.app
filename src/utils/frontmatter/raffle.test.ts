import { describe, expect, it } from 'vitest';

import type { RaffleListItem, RaffleStatus } from '@/types/raffle';

import { ACCION, BADGE, bajadaDe, estadoDe, puntosDe } from './raffle';

const rifa = (parcial: Partial<RaffleListItem> = {}): RaffleListItem => ({
  id: 'r1',
  slug: 'rifa-del-club',
  title: 'Rifa del Club',
  tier: 'BASIC',
  status: 'PUBLISHED' as RaffleStatus,
  ticketPrice: 250000,
  currency: 'ARS',
  totalNumbers: 100,
  numberStart: 0,
  drawDate: '2026-12-24',
  soldCount: 0,
  reservedCount: 0,
  createdAt: 0,
  prize: 'Una bici',
  winnerNumber: null,
  winnerName: null,
  ...parcial,
});

const LIMITE = '2026-09-11'; // el `enDias(7)` de un 4 de septiembre

describe('estadoDe', () => {
  it.each([
    ['CLOSED', '2026-12-24', 'cerrada'],
    ['CANCELLED', '2026-12-24', 'cerrada'], // se dice igual que CLOSED
    ['DRAFT', '2026-09-05', 'borrador'], // aunque sortee mañana: no está publicada
    ['PUBLISHED', '2026-09-10', 'ultimos-dias'],
    ['PUBLISHED', '2026-09-11', 'ultimos-dias'], // el límite entra
    ['PUBLISHED', '2026-09-12', 'en-venta'],
  ])('%s con sorteo el %s → %s', (status, drawDate, esperado) => {
    expect(
      estadoDe(rifa({ status: status as RaffleStatus, drawDate }), LIMITE),
    ).toBe(esperado);
  });
});

describe('BADGE y ACCION', () => {
  it('cubren todos los estados y no se contradicen', () => {
    // Si mañana aparece un estado nuevo, el Record obliga a llenar los dos.
    // Este test comprueba lo otro: que ninguna entrada quedó vacía.
    for (const estado of Object.keys(BADGE) as (keyof typeof BADGE)[]) {
      expect(BADGE[estado].texto).not.toBe('');
      expect(ACCION[estado].texto).not.toBe('');
    }
  });

  it('sólo la rifa cerrada ofrece la acción terciaria', () => {
    expect(ACCION['cerrada'].variante).toBe('outline');
    expect(ACCION['borrador'].variante).toBe('default');
    expect(ACCION['en-venta'].variante).toBe('default');
  });
});

describe('puntosDe', () => {
  it('reparte los vendidos sin amontonarlos al principio', () => {
    const puntos = puntosDe(rifa({ soldCount: 50, totalNumbers: 100 }));

    expect(puntos).toHaveLength(40);
    expect(puntos.filter(Boolean)).toHaveLength(20);
    // Si fuera una barra, los primeros 20 estarían todos prendidos.
    expect(puntos.slice(0, 20).filter(Boolean).length).toBeLessThan(20);
  });

  it('sin ventas no prende ninguno, y completa prende los 40', () => {
    expect(puntosDe(rifa({ soldCount: 0 })).filter(Boolean)).toHaveLength(0);
    expect(puntosDe(rifa({ soldCount: 100 })).filter(Boolean)).toHaveLength(40);
  });
});

describe('bajadaDe', () => {
  it('en venta muestra el premio', () => {
    expect(bajadaDe(rifa(), 'en-venta')).toBe('Una bici');
  });

  it('sorteada muestra el ganador', () => {
    const sorteada = rifa({ winnerNumber: 34, winnerName: 'Ana Ríos' });
    expect(bajadaDe(sorteada, 'cerrada')).toBe('Ganó el número 34 · Ana Ríos');
  });

  it('sorteada sin nombre no deja el separador colgando', () => {
    expect(bajadaDe(rifa({ winnerNumber: 34 }), 'cerrada')).toBe(
      'Ganó el número 34',
    );
  });

  it('cerrada sin ganador cargado cae en el premio', () => {
    expect(bajadaDe(rifa(), 'cerrada')).toBe('Una bici');
  });

  /**
   * `estadoDe` nunca devuelve 'cerrada' para una rifa sin winner por status
   * DRAFT/PUBLISHED, pero `bajadaDe` recibe el estado ya calculado y no
   * revalida la rifa — así que 'borrador' o 'ultimos-dias' también caen acá,
   * sin pasar por la rama del ganador.
   */
  it('borrador o últimos días también muestran el premio', () => {
    expect(bajadaDe(rifa(), 'borrador')).toBe('Una bici');
    expect(bajadaDe(rifa(), 'ultimos-dias')).toBe('Una bici');
  });
});
