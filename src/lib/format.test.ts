import { describe, expect, it } from 'vitest';

import { fechaCorta, initials, pesos } from './format';

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
 */
describe('fechaCorta', () => {
  it.each([
    ['2026-09-20', '20 sep'],
    ['2026-01-01', '1 ene'], // sin cero adelante
    ['2026-12-31', '31 dic'],
    ['20/09/2026', '20/09/2026'], // no tiene la forma esperada: se devuelve igual
  ])('%s → %s', (iso, esperado) => {
    expect(fechaCorta(iso)).toBe(esperado);
  });
});
