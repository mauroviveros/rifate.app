import { describe, expect, it } from 'vitest';

import { salePanel, selectionKind } from './sale';

/** El precio de un número, en centavos: $2.500. */
const PRICE = 250000;

/** `n` números libres tildados. */
const free = (n: number) => Array.from({ length: n }, () => false);

/** `n` números ocupados (vendidos o reservados) tildados. */
const taken = (n: number) => Array.from({ length: n }, () => true);

describe('selectionKind', () => {
  it('sin selección', () => {
    expect(selectionKind([])).toBe('empty');
  });

  it('todos libres → vender', () => {
    expect(selectionKind([false, false])).toBe('sell');
  });

  it('todos ocupados → liberar', () => {
    expect(selectionKind([true, true])).toBe('release');
  });

  /** Mezclados, el panel apaga los dos botones y lo dice. */
  it('mezcla → ni una ni la otra', () => {
    expect(selectionKind([false, true])).toBe('mixed');
  });
});

describe('salePanel · sin selección', () => {
  const view = salePanel([], PRICE);

  it('invita a elegir, arriba y abajo', () => {
    expect(view.sentence).toBe(
      'Elegí números de la grilla para vender o liberar.',
    );
    expect(view.hint).toBe('Elegí números de la grilla.');
  });

  it('no deja apretar nada', () => {
    expect(view.canSell).toBe(false);
    expect(view.canRelease).toBe(false);
  });

  it('los botones vuelven a su texto neutro', () => {
    expect(view.sellLabel).toBe('Marcar como vendidos');
    expect(view.releaseLabel).toBe('Liberar');
  });

  it('sin nada elegido no hay plata que mostrar ni barra', () => {
    expect(view.total).toBeNull();
    expect(view.bar.visible).toBe(false);
  });
});

describe('salePanel · vendiendo', () => {
  it('la frase y el botón dicen cuántos, en singular', () => {
    const view = salePanel(free(1), PRICE);
    expect(view.sentence).toBe('Vas a marcar 1 número como vendido.');
    expect(view.sellLabel).toBe('Marcar 1 número como vendido');
  });

  /** Los dos plurales de la frase —«números» y «vendidos»— van juntos. */
  it('la frase y el botón dicen cuántos, en plural', () => {
    const view = salePanel(free(3), PRICE);
    expect(view.sentence).toBe('Vas a marcar 3 números como vendidos.');
    expect(view.sellLabel).toBe('Marcar 3 números como vendidos');
  });

  it('habilita vender y sólo vender', () => {
    const view = salePanel(free(3), PRICE);
    expect(view.canSell).toBe(true);
    expect(view.canRelease).toBe(false);
  });

  it('el «Cobrás» es la cuenta, formateada', () => {
    expect(salePanel(free(3), PRICE).total).toBe('$7.500');
  });

  /** Nada que aclarar: la frase de arriba ya dijo lo que va a pasar. */
  it('sin aclaración abajo', () => {
    expect(salePanel(free(3), PRICE).hint).toBeNull();
  });

  it('la barra repite la cuenta y lleva al formulario', () => {
    expect(salePanel(free(2), PRICE).bar).toEqual({
      visible: true,
      text: '2 números · $5.000',
      label: 'Cargar la venta',
      enabled: true,
    });
  });

  /**
   * Un precio 0 no debería llegar —el esquema exige positivo—, pero si llega,
   * «Cobrás $0» parece un error de la app en vez de un dato que falta.
   */
  it('con precio 0 no se muestra el «Cobrás»', () => {
    expect(salePanel(free(3), 0).total).toBeNull();
  });
});

describe('salePanel · liberando', () => {
  it('la frase y el botón dicen cuántos', () => {
    expect(salePanel(taken(1), PRICE).releaseLabel).toBe('Liberar 1 número');
    expect(salePanel(taken(4), PRICE).sentence).toBe(
      'Vas a liberar 4 números.',
    );
  });

  it('habilita liberar y sólo liberar', () => {
    const view = salePanel(taken(4), PRICE);
    expect(view.canRelease).toBe(true);
    expect(view.canSell).toBe(false);
  });

  /** Liberar no cobra nada: el «Cobrás» no corresponde aunque haya precio. */
  it('liberar no muestra plata', () => {
    expect(salePanel(taken(4), PRICE).total).toBeNull();
  });

  it('la barra cambia de verbo', () => {
    expect(salePanel(taken(4), PRICE).bar).toEqual({
      visible: true,
      text: '4 números a liberar',
      label: 'Ir a liberar',
      enabled: true,
    });
  });
});

describe('salePanel · mezcla', () => {
  const view = salePanel([false, true, false], PRICE);

  /**
   * El caso de la regla 7: no alcanza con apagar los botones, hay que decir
   * por qué. Un botón gris sin explicación es la app rota.
   */
  it('apaga los dos botones Y lo explica', () => {
    expect(view.canSell).toBe(false);
    expect(view.canRelease).toBe(false);
    expect(view.sentence).toBe(
      'Elegiste números libres y vendidos juntos. Va uno o el otro.',
    );
    expect(view.hint).toBe('No se puede vender y liberar a la vez.');
  });

  it('no muestra un total que no se va a cobrar', () => {
    expect(view.total).toBeNull();
  });

  /** La barra se ve —hay algo elegido— pero no deja avanzar. */
  it('la barra se ve pero no deja avanzar', () => {
    expect(view.bar.visible).toBe(true);
    expect(view.bar.enabled).toBe(false);
    expect(view.bar.text).toBe('Libres o vendidos, no los dos');
  });
});

describe('salePanel · el kind que pinta el borde', () => {
  it('es el mismo discriminante que decide todo lo demás', () => {
    expect(salePanel([], PRICE).kind).toBe('empty');
    expect(salePanel(free(2), PRICE).kind).toBe('sell');
    expect(salePanel(taken(2), PRICE).kind).toBe('release');
    expect(salePanel([true, false], PRICE).kind).toBe('mixed');
  });
});
