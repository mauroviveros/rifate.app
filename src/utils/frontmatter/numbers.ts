/**
 * Las etiquetas de la grilla de números de una rifa.
 *
 * Vive acá y no dentro de `detail.ts` porque `summary.ts` también lo necesita
 * para la vista previa del alta, y `summary.ts` no tiene por qué depender de
 * un detalle interno de `detail.ts` para calcular algo que es, en sí mismo,
 * una pieza aparte: cómo se acolchan los números de una rifa para que se vean
 * como un talonario de papel.
 */

/**
 * El ancho de padding de las etiquetas. Se calcula sobre el ANTEÚLTIMO número
 * (`start + total - 2`), no el último: en una rifa `1..100` así el `100` es el
 * único de tres dígitos y el resto queda `01..99`, como un talonario de papel.
 * Piso de 1 para la rifa de un solo número.
 */
export const numberWidth = (
  numberStart: number,
  totalNumbers: number,
): number => String(Math.max(1, numberStart + totalNumbers - 2)).length;

export const numberLabel = (value: number, width: number): string =>
  String(value).padStart(width, '0');
