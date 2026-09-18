import { describe, expect, it } from 'vitest';

import type { SummaryInput } from './summary';
import { RAFFLE_PLACEHOLDER, summarySnapshot } from './summary';

const snapshot = (over: Partial<SummaryInput> = {}) =>
  summarySnapshot({
    title: '',
    description: '',
    ticketPrice: '',
    totalNumbers: '',
    numberStart: '',
    ...over,
  });

describe('summarySnapshot', () => {
  it('con todo vacío asume 100 números a $2500', () => {
    expect(snapshot()).toMatchObject({
      total: '$250.000',
      totalNumbers: 100,
      ticketPrice: '$2.500',
    });
  });

  it('el total es cantidad por precio', () => {
    expect(snapshot({ ticketPrice: '500', totalNumbers: '20' }).total).toBe(
      '$10.000',
    );
  });

  it('sin título ni descripción muestra el ejemplo', () => {
    expect(snapshot()).toMatchObject({
      title: RAFFLE_PLACEHOLDER.title,
      description: RAFFLE_PLACEHOLDER.description,
    });
  });

  it('un título de puros espacios no tapa el ejemplo', () => {
    expect(snapshot({ title: '   ' }).title).toBe(RAFFLE_PLACEHOLDER.title);
  });

  it('el título tipeado gana, ya recortado', () => {
    expect(snapshot({ title: '  Rifa del Club  ' }).title).toBe(
      'Rifa del Club',
    );
  });

  it('la vista previa corta en 30 números', () => {
    expect(snapshot({ totalNumbers: '500' }).numbers).toHaveLength(30);
  });

  it('una rifa más chica que la vista previa se muestra entera', () => {
    expect(snapshot({ totalNumbers: '8' }).numbers).toHaveLength(8);
  });

  it('arranca en 0 salvo que se pida el 1', () => {
    expect(snapshot({ numberStart: '0' }).numbers[0]).toBe('00');
    expect(snapshot({ numberStart: '1' }).numbers[0]).toBe('01');
  });

  it('cualquier otra cosa se toma como 0, igual que el esquema', () => {
    expect(snapshot({ numberStart: '' }).numbers[0]).toBe('00');
    expect(snapshot({ numberStart: 'x' }).numbers[0]).toBe('00');
  });

  /**
   * El ancho sale de `numberWidth`, el mismo que usa la grilla de verdad: se
   * calcula sobre el ANTEÚLTIMO número, así en una rifa 1..100 el 100 es el
   * único de tres dígitos y el resto queda 01..99.
   */
  it('el ancho es el de la grilla real', () => {
    expect(snapshot({ numberStart: '1', totalNumbers: '100' }).numbers[0]).toBe(
      '01',
    );
    expect(
      snapshot({ numberStart: '0', totalNumbers: '1000' }).numbers[0],
    ).toBe('000');
  });

  it('la rifa de un solo número no se pasa de ancho', () => {
    expect(snapshot({ totalNumbers: '1' }).numbers).toEqual(['0']);
  });
});
