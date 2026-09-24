import { describe, expect, it } from 'vitest';

import type { NumberStatus, PublicNumber } from '@/types/raffle';

import { gridSvg } from './grid-svg';

/** `1..n` con el estado que se le diga a cada uno; el resto, disponible. */
const numbersOf = (
  total: number,
  statuses: Record<number, NumberStatus> = {},
): PublicNumber[] =>
  Array.from({ length: total }, (_, i) => ({
    number: i + 1,
    status: statuses[i + 1] ?? 'AVAILABLE',
  }));

describe('gridSvg', () => {
  it('el título del usuario se escapa: un < no puede abrir una etiqueta', () => {
    const { svg } = gridSvg({
      title: '<b>Rifa & "co"</b>',
      numberStart: 1,
      numbers: numbersOf(5),
    });

    expect(svg).toContain('&lt;b&gt;Rifa &amp; &quot;co&quot;&lt;/b&gt;');
    expect(svg).not.toContain('<b>');
  });

  it('un título largo se recorta con puntos suspensivos', () => {
    const { svg } = gridSvg({
      title: 'x'.repeat(60),
      numberStart: 1,
      numbers: numbersOf(5),
    });

    expect(svg).toContain(`${'x'.repeat(29)}…`);
    expect(svg).not.toContain('x'.repeat(30));
  });

  it('el alto sale de las filas de diez: 100 números son diez filas', () => {
    const { width, height } = gridSvg({
      title: 'Club',
      numberStart: 1,
      numbers: numbersOf(100),
    });

    expect(width).toBe(1080);
    // 260 de encabezado + 10 × 88 + 9 × 8 + 64 de margen
    expect(height).toBe(1276);
  });

  it('una sola fila no suma separación de más', () => {
    const { height } = gridSvg({
      title: 'Club',
      numberStart: 1,
      numbers: numbersOf(5),
    });

    expect(height).toBe(260 + 88 + 64);
  });

  it('vendido y reservado llevan tachado; disponible y bloqueado no', () => {
    const { svg } = gridSvg({
      title: 'Club',
      numberStart: 1,
      numbers: numbersOf(5, { 1: 'SOLD', 2: 'RESERVED', 3: 'BLOCKED' }),
    });

    expect(svg.match(/<line /g)).toHaveLength(2);
  });

  it('el avance cuenta sólo los vendidos, no los reservados', () => {
    const { svg } = gridSvg({
      title: 'Club',
      numberStart: 1,
      numbers: numbersOf(4, { 1: 'SOLD', 2: 'RESERVED' }),
    });

    expect(svg).toContain('1 de 4 vendidos');
  });

  it('una rifa 1..100 acolcha los números como el talonario: 01 … 99, 100', () => {
    const { svg } = gridSvg({
      title: 'Club',
      numberStart: 1,
      numbers: numbersOf(100),
    });

    expect(svg).toContain('>01<');
    expect(svg).toContain('>99<');
    expect(svg).toContain('>100<');
  });

  it('sin ventas no se dibuja la barra de avance', () => {
    const { svg } = gridSvg({
      title: 'Club',
      numberStart: 1,
      numbers: numbersOf(5),
    });

    expect(svg).not.toContain('fill="#1B6E45"');
  });
});
