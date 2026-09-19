import { describe, expect, it } from 'vitest';

import { initials } from './initials';

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
