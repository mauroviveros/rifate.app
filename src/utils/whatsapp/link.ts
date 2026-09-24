import { arNational } from './phone';

/**
 * El link `wa.me` a un teléfono guardado.
 *
 * WhatsApp reconoce a los celulares argentinos con el `9` después del 54
 * (`549 11 4455-2211`), y `normalize.phone` no lo inventa porque no puede
 * saber si el número es de un celular. Acá sí se pone: este link sólo se arma
 * para el teléfono por el que se compra, que es un WhatsApp, y un WhatsApp
 * argentino es un celular. (Queda afuera una línea fija con WhatsApp Business:
 * es el caso raro.)
 *
 * Un número de otro país va tal cual, sin el `+`: es lo que pide wa.me.
 */
export const waLink = (e164: string, text?: string): string => {
  const national = arNational(e164);
  const target = national === null ? e164.replace(/\D/g, '') : `549${national}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';

  return `https://wa.me/${target}${query}`;
};
