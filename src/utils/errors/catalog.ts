import type { ErrorCode } from './codes';

export type ErrorDescription = { message: string; status: number };

export const ERRORS: Record<ErrorCode, ErrorDescription> = {
  FORBIDDEN: {
    message: 'No tenés permiso para hacer esto.',
    status: 403,
  },
  NOT_FOUND: {
    message: 'No encontrado.',
    status: 404,
  },
  NUMBERS_UNAVAILABLE: {
    message: 'Alguien tomó uno de esos números. Elegí otros.',
    status: 409,
  },
  NUMBERS_NOT_RELEASABLE: {
    message: 'Ese número ya está libre.',
    status: 409,
  },
  INVALID_NUMBERS: {
    message: 'Esos números no existen en esta rifa.',
    status: 400,
  },
  TOO_MANY_NUMBERS: {
    message: 'Podés cargar hasta 50 números por vez.',
    status: 400,
  },
  INVALID_PHONE: {
    message: 'Ese teléfono no es válido.',
    status: 400,
  },
  RAFFLE_NOT_INITIALIZED: {
    message: 'Esta rifa todavía no terminó de crearse.',
    status: 409,
  },
  RAFFLE_NOT_PUBLISHED: {
    message: 'Esta rifa todavía no está publicada.',
    status: 400,
  },
  RAFFLE_NOT_PUBLISHABLE: {
    message: 'Cargá un teléfono de contacto antes de publicar.',
    status: 400,
  },
  RAFFLE_NOT_PRO: {
    message: 'Esta rifa no acepta pedidos online.',
    status: 400,
  },
  RAFFLE_NOT_RESIZABLE: {
    message: 'Sólo podés cambiar el rango en borrador.',
    status: 409,
  },
  RAFFLE_HAS_SALES: {
    message: 'Tiene números vendidos: cancelala en lugar de borrarla.',
    status: 409,
  },
  RAFFLE_ALREADY_UNLOCKED: {
    message: 'Esta rifa ya está habilitada.',
    status: 409,
  },
  ORDER_NOT_PENDING: {
    message: 'Este pedido ya fue confirmado o cancelado.',
    status: 409,
  },
  VOUCHER_NOT_FOUND: {
    message: 'Ese código no existe.',
    status: 404,
  },
  VOUCHER_EXPIRED: {
    message: 'Este código venció.',
    status: 400,
  },
  VOUCHER_EXHAUSTED: {
    message: 'Este código ya se usó todas las veces.',
    status: 400,
  },
};
