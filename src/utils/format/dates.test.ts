import { describe, expect, it } from 'vitest';

import { inDays, longDate, shortDate, today } from './dates';

/**
 * El caso que justifica el parseo a mano: con `new Date(iso)` esta misma fecha,
 * formateada desde Argentina (UTC−3), muestra el día anterior.
 *
 * Las abreviaturas las pone la ICU del runtime, y este test corre adentro de
 * workerd: si una actualización de la plataforma cambia el catálogo de CLDR,
 * esto se rompe acá y no en la tarjeta de una rifa.
 */
describe('shortDate', () => {
  it.each([
    ['2026-09-20', '20 sept'], // CLDR 42+ abrevia septiembre con cuatro letras
    ['2026-01-01', '1 ene'], // sin cero adelante
    ['2026-12-31', '31 dic'],
    ['20/09/2026', '20/09/2026'], // no tiene la forma esperada: se devuelve igual
    ['2026-13-01', '2026-13-01'], // mes fuera de rango: no inventa uno
    ['2026-09-20T00:00', '2026-09-20T00:00'], // con hora tampoco: el día no es un número
  ])('%s → %s', (iso, esperado) => {
    expect(shortDate(iso)).toBe(esperado);
  });
});

describe('longDate', () => {
  it.each([
    ['2026-09-20', '20 de septiembre'],
    ['2026-01-01', '1 de enero'],
    ['2026-12-31', '31 de diciembre'],
    ['20/09/2026', '20/09/2026'], // no tiene la forma esperada: se devuelve igual
    ['2026-13-01', '2026-13-01'], // mes fuera de rango: no inventa uno
  ])('%s → %s', (iso, esperado) => {
    expect(longDate(iso)).toBe(esperado);
  });
});

/**
 * El día del calendario argentino, que es contra lo que se compara `draw_date`.
 * El caso de las 02:30 UTC es el que rompía con `toISOString()`: en Buenos
 * Aires todavía es el día anterior.
 */
describe('today · inDays', () => {
  it.each([
    ['2026-09-05T02:30:00Z', '2026-09-04'], // 23:30 en Argentina: sigue siendo el 4
    ['2026-09-05T03:00:00Z', '2026-09-05'], // medianoche justa en Argentina
    ['2026-09-04T14:00:00Z', '2026-09-04'],
  ])('%s → %s', (instante, esperado) => {
    expect(today(new Date(instante))).toBe(esperado);
  });

  it('corre el día del calendario, no el instante', () => {
    const desde = new Date('2026-09-05T02:30:00Z'); // 23:30 del 4 en Argentina

    expect(inDays(0, desde)).toBe('2026-09-04');
    expect(inDays(7, desde)).toBe('2026-09-11');
    expect(inDays(-1, desde)).toBe('2026-09-03');
  });

  it('cruza el fin de mes', () => {
    expect(inDays(7, new Date('2026-09-28T15:00:00Z'))).toBe('2026-10-05');
  });
});
