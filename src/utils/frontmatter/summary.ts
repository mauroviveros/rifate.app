/**
 * El resumen en vivo del alta y la edición: el «SI VENDÉS TODO» y la vista
 * previa del link.
 *
 * Existe porque ese resumen se dibuja DOS VECES y por dos caminos distintos:
 * una en el server, con lo que vino en el `FormData` (o con los valores de la
 * rifa que se está editando), y otra en el cliente, en cada tecla. Las dos
 * cuentas vivían escritas aparte —una en el frontmatter de `Summary.astro` y
 * otra en su `<script>`— con sus propios `2500`, `100`, `30` y su propia
 * fórmula del ancho. Dos implementaciones de la misma cuenta que no tenían
 * cómo enterarse si una cambiaba.
 *
 * Acá vive la cuenta. Lo que cada lado sigue haciendo por su cuenta es LEER:
 * el server desde un `FormData`, el cliente desde los `input.value`. Por eso
 * `summarySnapshot()` recibe strings crudos y no un `FormData`.
 */

import { pesos } from '@/utils/format';
import { numberOr } from '@/utils/forms';

import { numberLabel, numberWidth } from './detail';

/**
 * El ejemplo que se muestra cuando el campo está vacío. Lo usan el resumen
 * —como texto de la vista previa— y el formulario —como `placeholder` de los
 * inputs—, así que tiene que ser el mismo texto en los dos lados.
 */
export const RAFFLE_PLACEHOLDER = {
  title: 'Club Estrella',
  description: 'Una bici rodado 29 y una canasta de asado para diez personas.',
} as const;

/** Lo que se asume mientras el campo está vacío. */
const DEFAULTS = { ticketPrice: 2500, totalNumbers: 100 } as const;

/** Cuántos números entran en la vista previa de la grilla. */
const PREVIEW_COUNT = 30;

/**
 * La clase de cada celda de la vista previa.
 *
 * Es una constante y no está escrita en el template porque el `<script>` del
 * cliente rehace esas celdas con `createElement` y necesita exactamente la
 * misma clase. El frontmatter y el `<script>` de un `.astro` no comparten
 * scope, así que la única forma de que no se separen es que la importen los
 * dos de acá.
 */
export const PREVIEW_CELL_CLASS =
  'flex aspect-square items-center justify-center rounded-xs border-2 border-input bg-card text-[0.75rem] font-extrabold';

/** Lo que se tipeó, crudo. Lo lee cada lado como puede. */
export type SummaryInput = {
  title: string;
  description: string;
  /** En pesos, como se tipea. */
  ticketPrice: string;
  totalNumbers: string;
  /** `'0'` o `'1'`; cualquier otra cosa se toma como 0, igual que el esquema. */
  numberStart: string;
};

export type SummarySnapshot = {
  /** El título, o el ejemplo si no se escribió ninguno. */
  title: string;
  description: string;
  /** Cantidad × precio, formateado. */
  total: string;
  totalNumbers: number;
  /** El precio de un número, formateado. */
  ticketPrice: string;
  /** Las etiquetas de la vista previa, ya con los ceros adelante. */
  numbers: string[];
};

export const summarySnapshot = (raw: SummaryInput): SummarySnapshot => {
  const totalNumbers = numberOr(raw.totalNumbers, DEFAULTS.totalNumbers);
  const ticketPrice = numberOr(raw.ticketPrice, DEFAULTS.ticketPrice);

  // La misma regla que `newRaffleSchema`: sólo un '1' arranca en 1.
  const numberStart = raw.numberStart === '1' ? 1 : 0;
  const width = numberWidth(numberStart, totalNumbers);

  return {
    title: raw.title.trim() || RAFFLE_PLACEHOLDER.title,
    description: raw.description.trim() || RAFFLE_PLACEHOLDER.description,
    total: pesos(totalNumbers * ticketPrice * 100),
    totalNumbers,
    ticketPrice: pesos(ticketPrice * 100),
    numbers: Array.from(
      { length: Math.min(PREVIEW_COUNT, totalNumbers) },
      (_, i) => numberLabel(numberStart + i, width),
    ),
  };
};
