/**
 * Los centavos que guarda la base, escritos como se leen: `250000` → `$2.500`.
 *
 * A mano y no con `style: 'currency'` por dos razones, las dos del canvas: el
 * `es-AR` de Intl emite `$ 2.500` con un espacio duro en el medio —y en algunos
 * runtimes `ARS 2.500`—, y en los artboards el signo va pegado. El separador de
 * miles sí es el de Intl, que es el punto argentino.
 *
 * Redondea al peso: los precios de una rifa de barrio son redondos, y `$2.500`
 * se lee de un vistazo al sol mucho mejor que `$2.500,00` (regla 6).
 */
export const pesos = (cents: number): string =>
  `$${new Intl.NumberFormat('es-AR').format(Math.round(cents / 100))}`;
