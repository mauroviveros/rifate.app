import { describe, expect, it } from 'vitest';

import { newRaffleSchema, sellNumbersSchema } from './raffle.schema';

/**
 * Estos tests corren el esquema con objetos planos, NO con un `FormData`: el
 * conversor que hace `FormData` → objeto es interno de Astro
 * (`astro/dist/actions/runtime/server.js`, sin export público) y colgarse de él
 * sería atarse a una ruta que puede moverse en cualquier minor.
 *
 * Lo que se fija acá es el contrato del lado de zod, con los valores que ese
 * conversor produce, que están verificados: un input vacío o ausente llega
 * `null`, y los `z.number()` llegan ya convertidos.
 */

const BASE = {
  title: 'Rifa del Club',
  description: null,
  prize: null,
  ticketPrice: 2500, // en PESOS: el esquema los pasa a centavos
  totalNumbers: 100,
  numberStart: '0' as string | null,
  drawDate: '2099-12-24',
  contactPhone: null,
};

describe('newRaffleSchema', () => {
  /**
   * El caso que se rompía en silencio. `numberStart` no lleva `.default()`:
   * sobre un pipe, zod v4 tipa el default contra la salida y lo valida contra
   * la entrada, así que `.default(0)` compilaba y explotaba en runtime. Si
   * alguien lo vuelve a poner, este test se pone en rojo.
   */
  it('sin numberStart la rifa arranca en 0, como la columna de D1', () => {
    const rifa = newRaffleSchema.parse({ ...BASE, numberStart: null });

    expect(rifa.numberStart).toBe(0);
  });

  it('numberStart llega como texto y sale como número', () => {
    expect(
      newRaffleSchema.parse({ ...BASE, numberStart: '1' }).numberStart,
    ).toBe(1);
    expect(
      newRaffleSchema.safeParse({ ...BASE, numberStart: '2' }).success,
    ).toBe(false);
  });

  it('el precio se escribe en pesos y se guarda en centavos', () => {
    expect(newRaffleSchema.parse(BASE).ticketPrice).toBe(250000);
  });

  /** Un campo con sólo espacios no es una descripción vacía: es que no hay. */
  it('un texto de puros espacios queda en null', () => {
    const rifa = newRaffleSchema.parse({ ...BASE, description: '   ' });

    expect(rifa.description).toBeNull();
  });

  it('no se puede sortear una fecha que ya pasó', () => {
    const r = newRaffleSchema.safeParse({ ...BASE, drawDate: '2020-01-01' });

    expect(r.error?.issues[0]?.message).toBe('Esa fecha ya pasó. Elegí otra.');
  });

  /** El GLOB del CHECK de la tabla deja pasar un 31 de febrero; esto no. */
  it('un día que no existe no es una fecha', () => {
    expect(
      newRaffleSchema.safeParse({ ...BASE, drawDate: '2099-02-31' }).success,
    ).toBe(false);
  });

  it('el teléfono lo valida el mismo normalize que después lo guarda', () => {
    expect(
      newRaffleSchema.safeParse({ ...BASE, contactPhone: '0341 555-1234' })
        .success,
    ).toBe(true);
    expect(
      newRaffleSchema.safeParse({ ...BASE, contactPhone: 'llamame' }).success,
    ).toBe(false);
  });
});

describe('sellNumbersSchema', () => {
  const VENTA = { id: crypto.randomUUID(), numbers: [7, 23], name: 'Carla' };

  it('acepta una venta con lo mínimo', () => {
    const venta = sellNumbersSchema.parse(VENTA);

    expect(venta.numbers).toEqual([7, 23]);
    expect(venta.phone).toBeNull();
  });

  /** El mismo tope que aplica el Durable Object, para no viajar al pedo. */
  it('no deja cargar más de 50 números de una', () => {
    const cincuentaYUno = Array.from({ length: 51 }, (_, i) => i);
    const r = sellNumbersSchema.safeParse({ ...VENTA, numbers: cincuentaYUno });

    expect(r.error?.issues[0]?.message).toBe(
      'Podés cargar hasta 50 números por vez.',
    );
  });

  it('una rifa que no es un uuid no existe', () => {
    const r = sellNumbersSchema.safeParse({ ...VENTA, id: 'la-del-club' });

    expect(r.error?.issues[0]?.message).toBe('Esa rifa no existe.');
  });
});
