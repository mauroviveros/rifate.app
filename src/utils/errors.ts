/**
 * Errores de dominio, con código estable.
 *
 * El `message` del Error ES el código, y no el texto para el usuario. El motivo
 * es concreto: cuando un Durable Object tira una excepción, lo único que cruza
 * el límite RPC es `name`, `message` y `stack` — cualquier propiedad extra (un
 * `.code`) llega `undefined` del otro lado. Si el código viaja en el `message`,
 * el que llama puede ramificar. Es también lo que hace que
 * `rejects.toThrow('FORBIDDEN')` funcione contra el DO.
 *
 * El texto en castellano vive en UN mapa y se resuelve recién en el borde,
 * cuando hay que mostrárselo a alguien. Si el mensaje se armara en cada action,
 * tarde o temprano dos actions dirían cosas distintas para el mismo error.
 */

export type ErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'NUMBERS_UNAVAILABLE'
  | 'NUMBERS_NOT_RELEASABLE'
  | 'INVALID_NUMBERS'
  | 'TOO_MANY_NUMBERS'
  | 'INVALID_PHONE'
  | 'RAFFLE_NOT_INITIALIZED'
  | 'RAFFLE_NOT_PUBLISHED'
  | 'RAFFLE_NOT_PUBLISHABLE'
  | 'RAFFLE_NOT_PRO'
  | 'RAFFLE_NOT_RESIZABLE'
  | 'RAFFLE_HAS_SALES'
  | 'RAFFLE_ALREADY_UNLOCKED'
  | 'ORDER_NOT_PENDING'
  | 'VOUCHER_NOT_FOUND'
  | 'VOUCHER_EXPIRED'
  | 'VOUCHER_EXHAUSTED';

type ErrorDescription = { message: string; status: number };

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

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code); // ← el message ES el código, a propósito.

    this.name = 'AppError';
    this.code = code;
  }
}

/** Saca el código de un error, venga de donde venga. */
export const codeOf = (error: unknown): ErrorCode | null => {
  if (typeof error !== 'object' || error === null) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message in ERRORS
    ? (message as ErrorCode)
    : null;
};

/** Traduce cualquier error a algo mostrable. Lo desconocido no se filtra. */
export const describeError = (error: unknown): ErrorDescription => {
  const code = codeOf(error);
  return code
    ? ERRORS[code]
    : { message: 'Algo salió mal. Probá de nuevo.', status: 500 };
};
