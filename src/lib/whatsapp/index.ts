/** Arma un link wa.me para un teléfono, con un mensaje opcional precargado. */
export const buildWhatsAppUrl = (phone: string, message?: string): string => {
  // wa.me solo acepta dígitos: descartamos espacios, guiones, paréntesis, etc.
  const normalized = phone.replace(/\D/g, '');
  const base = `https://wa.me/${normalized}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};

/** Mensaje que el comprador le envía al organizador con los números que quiere. */
export const buildRaffleInterestMessage = (paddedNumbers: string[]): string =>
  `¡Hola! Me interesan los números: ${paddedNumbers.join(', ')}.`;
