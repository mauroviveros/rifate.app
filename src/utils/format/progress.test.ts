import { describe, expect, it } from 'vitest';

import { progress } from './progress';

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
