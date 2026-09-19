/**
 * El avance de una rifa, entero, para mostrar: `113 de 200` → `57`.
 *
 * Se multiplica ANTES de dividir: `(113 / 200) * 100` da 56.4999… en punto
 * flotante y la tarjeta mostraría 56% donde el papel dice 57%.
 *
 * Sin números no hay avance, y de paso no hay división por cero.
 */
export const progress = (sold: number, total: number): number =>
  total > 0 ? Math.round((sold * 100) / total) : 0;
