import { describe, expect, it } from 'vitest';

import { pesos } from './money';

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
