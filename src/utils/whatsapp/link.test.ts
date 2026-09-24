import { describe, expect, it } from 'vitest';

import { waLink } from './link';

describe('waLink', () => {
  it('a un argentino le pone el 9 de celular', () => {
    expect(waLink('+541144552211')).toBe('https://wa.me/5491144552211');
  });

  it('si ya lo trae, no lo duplica', () => {
    expect(waLink('+5491144552211')).toBe('https://wa.me/5491144552211');
  });

  it('un número de otro país va tal cual, sin el +', () => {
    expect(waLink('+59899123456')).toBe('https://wa.me/59899123456');
  });

  it('el texto va codificado', () => {
    expect(waLink('+541144552211', 'Hola & chau')).toBe(
      'https://wa.me/5491144552211?text=Hola%20%26%20chau',
    );
  });
});
