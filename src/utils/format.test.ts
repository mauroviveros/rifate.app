import { describe, expect, it } from 'vitest';

import {
  inDays,
  initials,
  longDate,
  pesos,
  progress,
  shortDate,
  today,
} from './format';

/**
 * El avatar de la barra es lo primero que se ve del panel, y estos casos son
 * los que llegan de verdad desde Google: nombres compuestos, cuentas de empresa
 * sin `name`, y mails con punto en el medio.
 */
describe('initials', () => {
  it.each([
    ['Marta González', '', 'MG'],
    ['Marta de los Santos González', '', 'MG'], // primera y última, no las del medio
    ['marta', '', 'MA'], // una sola palabra: sus dos letras
    ['Marta-González', '', 'MG'], // el guion separa igual que el espacio
    ['M', '', 'M'], // no inventa una segunda letra
    ['Ñandú Ángel', '', 'ÑÁ'], // los acentos son parte del nombre
    ['', 'marta.gonzalez@ejemplo.com', 'MG'], // sin nombre: cae en el mail
    ['   ', 'marta@ejemplo.com', 'MA'], // un nombre en blanco no es un nombre
    ['', '', '?'], // no hay de dónde sacarlas
  ])('(%o, %o) → %s', (nombre, mail, esperado) => {
    expect(initials(nombre, mail)).toBe(esperado);
  });
});

describe('pesos', () => {
  it.each([
    [250000, '$2.500'],
    [150000, '$1.500'],
    [32550000, '$325.500'],
    [0, '$0'],
    [99, '$1'], // redondea al peso, no trunca
  ])('%i → %s', (centavos, esperado) => {
    expect(pesos(centavos)).toBe(esperado);
  });
});

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

describe('progress', () => {
  it.each([
    [113, 200, 57], // el caso del orden: (113/200)*100 da 56.4999… y mostraría 56
    [0, 100, 0],
    [100, 100, 100],
    [5, 0, 0], // sin números no hay avance, y no hay división por cero
  ])('%i de %i → %i%%', (vendidos, total, esperado) => {
    expect(progress(vendidos, total)).toBe(esperado);
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
