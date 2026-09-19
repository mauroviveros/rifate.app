import { describe, expect, it } from 'vitest';

import { numberLabel, numberWidth } from './numbers';

/**
 * El caso que justifica calcular sobre el ANTEÚLTIMO número y no el último:
 * en `1..100`, el 100 es el único de tres dígitos. Si el ancho se calculara
 * sobre el último, toda la grilla —99 números— quedaría con tres dígitos
 * (`001..100`) por culpa de uno solo.
 */
describe('numberWidth', () => {
  it('una rifa 1..100: el ancho lo da el 99, no el 100', () => {
    expect(numberWidth(1, 100)).toBe(2);
  });

  it('una rifa 0..99: el último y el anteúltimo tienen el mismo ancho', () => {
    expect(numberWidth(0, 100)).toBe(2);
  });

  it('una rifa 1..1000: el ancho lo da el 999, no el 1000', () => {
    expect(numberWidth(1, 1000)).toBe(3);
  });

  it('la rifa de un solo número no se queda sin ancho', () => {
    // anteúltimo = 1 + 1 - 2 = 0 → sin el piso, String(0).length daría 1 igual
    // acá, pero el piso es lo que evita un ancho 0 (o negativo) en general.
    expect(numberWidth(1, 1)).toBe(1);
  });

  it('el piso de 1 cubre también un anteúltimo negativo', () => {
    // 0 + 1 - 2 = -1: sin el Math.max(1, …) esto rompería el padStart.
    expect(numberWidth(0, 1)).toBe(1);
  });
});

describe('numberLabel', () => {
  it('rellena con ceros a la izquierda hasta el ancho', () => {
    expect(numberLabel(7, 2)).toBe('07');
    expect(numberLabel(7, 3)).toBe('007');
  });

  it('un número que ya cubre el ancho no cambia', () => {
    expect(numberLabel(99, 2)).toBe('99');
  });

  it('un número más largo que el ancho no se trunca', () => {
    // El caso del 100 en una rifa 1..100, con ancho calculado en base al 99.
    expect(numberLabel(100, 2)).toBe('100');
  });

  it('el 0 también se rellena', () => {
    expect(numberLabel(0, 2)).toBe('00');
  });
});
