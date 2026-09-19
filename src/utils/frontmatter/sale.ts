/**
 * El panel de venta: qué dice y qué deja hacer según lo que haya tildado.
 *
 * Vive aparte de `detail.ts` porque es la única parte del detalle que corre en
 * el NAVEGADOR: el panel se repinta en cada click de la grilla, así que esto se
 * importa desde un `<script>` del cliente y no sólo desde el frontmatter.
 *
 * Y está entero acá, y no adentro del `<script>`, por el mismo motivo de
 * siempre: era una función `paint()` de 45 líneas que tocaba doce nodos del DOM
 * mezclando las dos cosas —decidir qué decir y dónde escribirlo—, y ninguna de
 * las dos se podía testear. Ahora `salePanel()` es pura y devuelve todo
 * resuelto; al `<script>` le queda copiar valores a nodos, sin una sola
 * decisión adentro.
 */

import { pesos } from '@/utils/format';

export type SelectionKind = 'empty' | 'sell' | 'release' | 'mixed';

/**
 * Qué ofrece el panel según los números tildados: `sell` si son todos libres,
 * `release` si son todos ocupados (vendido o reservado), `mixed` si hay de los
 * dos —y ahí el panel apaga los dos botones y lo dice (regla 7)—.
 *
 * Recibe un booleano por número elegido —`true` = ocupado— y no la grilla: así
 * lo llama igual el `<script>` del panel, que lo lee del DOM en vivo.
 */
export const selectionKind = (taken: readonly boolean[]): SelectionKind => {
  if (taken.length === 0) return 'empty';

  const anyFree = taken.some((t) => !t);
  const anyTaken = taken.some((t) => t);

  return anyFree && anyTaken ? 'mixed' : anyFree ? 'sell' : 'release';
};

/** El plural de «número», que aparece seis veces en este archivo. */
const s = (n: number) => (n === 1 ? '' : 's');

export type SalePanel = {
  /** Va al `data-kind` del `<form>`, que es lo que pinta el borde de color. */
  kind: SelectionKind;
  /** La frase de arriba del panel. */
  sentence: string;
  sellLabel: string;
  canSell: boolean;
  releaseLabel: string;
  canRelease: boolean;
  /** La aclaración de abajo. `null` cuando no hay nada que aclarar. */
  hint: string | null;
  /** El «Cobrás», ya formateado. `null` cuando no corresponde mostrarlo. */
  total: string | null;
  /** La barra fija del celular, que repite la acción sin tener que scrollear. */
  bar: {
    visible: boolean;
    text: string;
    label: string;
    enabled: boolean;
  };
};

/**
 * Todo lo que el panel muestra, a partir de lo tildado y el precio.
 *
 * `taken` es un booleano por número elegido (`true` = ocupado), el mismo
 * formato que toma `selectionKind`. El precio va en CENTAVOS, como lo guarda
 * D1 y como lo escribe el `data-price` del formulario.
 *
 * El «Cobrás» sale `null` cuando no se está vendiendo —liberar no cobra nada—
 * y también con precio 0, que no debería pasar pero saldría como «$0» y
 * parecería un error de la app en vez de un dato faltante.
 */
export const salePanel = (
  taken: readonly boolean[],
  priceCents: number,
): SalePanel => {
  const kind = selectionKind(taken);
  const count = taken.length;
  const selling = kind === 'sell';

  return {
    kind,
    sentence: {
      empty: 'Elegí números de la grilla para vender o liberar.',
      sell: `Vas a marcar ${count} número${s(count)} como vendido${s(count)}.`,
      release: `Vas a liberar ${count} número${s(count)}.`,
      mixed: 'Elegiste números libres y vendidos juntos. Va uno o el otro.',
    }[kind],

    canSell: selling,
    sellLabel: selling
      ? `Marcar ${count} número${s(count)} como vendido${s(count)}`
      : 'Marcar como vendidos',

    canRelease: kind === 'release',
    releaseLabel:
      kind === 'release' ? `Liberar ${count} número${s(count)}` : 'Liberar',

    hint: {
      empty: 'Elegí números de la grilla.',
      sell: null,
      release: null,
      mixed: 'No se puede vender y liberar a la vez.',
    }[kind],

    total: selling && priceCents > 0 ? pesos(count * priceCents) : null,

    bar: {
      visible: count > 0,
      text: {
        empty: '',
        sell: `${count} número${s(count)} · ${pesos(count * priceCents)}`,
        release: `${count} número${s(count)} a liberar`,
        mixed: 'Libres o vendidos, no los dos',
      }[kind],
      label: kind === 'release' ? 'Ir a liberar' : 'Cargar la venta',
      enabled: kind !== 'mixed',
    },
  };
};
