import { describe, expect, it } from 'vitest';

import { localPhone } from './phone';

describe('localPhone', () => {
  it.each([
    ['+541144552211', '11 4455-2211'], // característica de dos
    ['+5491144552211', '11 4455-2211'], // el 9 de celular no se muestra
    ['+543415551234', '341 555-1234'], // característica de tres
    ['+542966421234', '2966 42-1234'], // característica de cuatro
  ])('%s → %s', (e164, local) => {
    expect(localPhone(e164)).toBe(local);
  });

  it('un número de otro país queda como vino', () => {
    expect(localPhone('+59899123456')).toBe('+59899123456');
  });

  it('un argentino con el 15 adentro no se adivina: queda como vino', () => {
    // Guardado antes de que normalize.phone sacara el 15: 12 dígitos
    // nacionales. Los nuevos ya llegan como +549…
    expect(localPhone('+54341155551234')).toBe('+54341155551234');
  });
});
