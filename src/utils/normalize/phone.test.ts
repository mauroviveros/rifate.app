import { describe, expect, it } from 'vitest';

import { phone } from './phone';

/**
 * Esta tabla existe porque la primera versión de phone tenía la
 * condición del código de país invertida, y el resultado — `+3415551234` —
 * pasaba el regex y pasaba el CHECK de la base. Un teléfono mal guardado no
 * explota en ningún lado: se descubre el día que hay que avisarle al ganador.
 */
describe('normalize.phone', () => {
  it.each([
    ['0341 555-1234', '+543415551234'], // saca el 0 de discado nacional
    ['3415551234', '+543415551234'], // le antepone el país
    ['11 5555-1234', '+541155551234'],
    ['5411 5555-1234', '+541155551234'], // ya lo trae: no lo duplica
    ['+54 9 341 555-1234', '+5493415551234'], // internacional: se respeta
    ['+5493415551234', '+5493415551234'],
  ])('%s → %s', (entrada, esperado) => {
    expect(phone(entrada)).toBe(esperado);
  });

  it.each([null, undefined, '', '   '])('%s → null', (entrada) => {
    // El teléfono es opcional: vacío no es un error, es ausencia.
    expect(phone(entrada)).toBeNull();
  });

  it.each(['hola', '123', '+0111555'])('rechaza %s', (entrada) => {
    expect(() => phone(entrada)).toThrow('INVALID_PHONE');
  });
});
