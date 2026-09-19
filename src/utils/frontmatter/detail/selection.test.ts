import { describe, expect, it } from 'vitest';

import { selectedNumbers } from './selection';

const withNumbers = (...values: string[]): FormData => {
  const fd = new FormData();
  for (const value of values) fd.append('numbers', value);
  return fd;
};

describe('selectedNumbers', () => {
  it('sin POST no hay nada tildado', () => {
    expect(selectedNumbers(null)).toEqual([]);
    expect(selectedNumbers(new FormData())).toEqual([]);
  });

  /** El `value` de un checkbox lo escribe cualquiera: lo que no es entero se cae. */
  it('repuebla los tildados y descarta la basura', () => {
    expect(selectedNumbers(withNumbers('7', 'no-es-un-número', '12'))).toEqual([
      7, 12,
    ]);
  });

  it('un decimal tampoco es un número de rifa', () => {
    expect(selectedNumbers(withNumbers('3.5', '4'))).toEqual([4]);
  });

  /** El 0 es un número válido cuando la rifa arranca en 0. */
  it('el cero se respeta', () => {
    expect(selectedNumbers(withNumbers('0'))).toEqual([0]);
  });
});
