import { describe, expect, it } from 'vitest';

import { genSlug, slugify } from './slug';

describe('normalize.slugify', () => {
  it.each([
    ['Rifa del Club 2026', 'rifa-del-club-2026'],
    ['Rifa Benéfica — Añó Nuevo', 'rifa-benefica-ano-nuevo'],
    ['  ¡¡¡  !!!  ', 'rifa'], // sin nada aprovechable, cae al fallback
  ])('%s → %s', (entrada, esperado) => {
    expect(slugify(entrada)).toBe(esperado);
  });
});

describe('normalize.genSlug', () => {
  it('no repite dos veces el mismo slug para el mismo título', () => {
    expect(genSlug('Rifa del Club')).not.toBe(genSlug('Rifa del Club'));
  });

  it('conserva el título adelante, que es lo que se lee en el link', () => {
    expect(genSlug('Rifa del Club')).toMatch(/^rifa-del-club-[0-9a-f]{8}$/);
  });
});
