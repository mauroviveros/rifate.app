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

type ErrorDescription = { mensaje: string; status: number };

export const ERRORES: Record<ErrorCode, ErrorDescription> = {
  FORBIDDEN: {
    mensaje: 'No tenés permiso para hacer esto.',
    status: 403,
  },
  NOT_FOUND: {
    mensaje: 'No encontrado.',
    status: 404,
  },
  NUMBERS_UNAVAILABLE: {
    mensaje: 'Alguien tomó uno de esos números. Elegí otros.',
    status: 409,
  },
  NUMBERS_NOT_RELEASABLE: {
    mensaje: 'Ese número ya está libre.',
    status: 409,
  },
  INVALID_NUMBERS: {
    mensaje: 'Esos números no existen en esta rifa.',
    status: 400,
  },
  TOO_MANY_NUMBERS: {
    mensaje: 'Podés cargar hasta 50 números por vez.',
    status: 400,
  },
  INVALID_PHONE: {
    mensaje: 'Ese teléfono no es válido.',
    status: 400,
  },
  RAFFLE_NOT_INITIALIZED: {
    mensaje: 'Esta rifa todavía no terminó de crearse.',
    status: 409,
  },
  RAFFLE_NOT_PUBLISHED: {
    mensaje: 'Esta rifa todavía no está publicada.',
    status: 400,
  },
  RAFFLE_NOT_PUBLISHABLE: {
    mensaje: 'Cargá un teléfono de contacto antes de publicar.',
    status: 400,
  },
  RAFFLE_NOT_PRO: {
    mensaje: 'Esta rifa no acepta pedidos online.',
    status: 400,
  },
  RAFFLE_NOT_RESIZABLE: {
    mensaje: 'Sólo podés cambiar el rango en borrador.',
    status: 409,
  },
  RAFFLE_HAS_SALES: {
    mensaje: 'Tiene números vendidos: cancelala en lugar de borrarla.',
    status: 409,
  },
  RAFFLE_ALREADY_UNLOCKED: {
    mensaje: 'Esta rifa ya está habilitada.',
    status: 409,
  },
  ORDER_NOT_PENDING: {
    mensaje: 'Este pedido ya fue confirmado o cancelado.',
    status: 409,
  },
  VOUCHER_NOT_FOUND: {
    mensaje: 'Ese código no existe.',
    status: 404,
  },
  VOUCHER_EXPIRED: {
    mensaje: 'Este código venció.',
    status: 400,
  },
  VOUCHER_EXHAUSTED: {
    mensaje: 'Este código ya se usó todas las veces.',
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
  return typeof message === 'string' && message in ERRORES
    ? (message as ErrorCode)
    : null;
};

/** Traduce cualquier error a algo mostrable. Lo desconocido no se filtra. */
export const describeError = (error: unknown): ErrorDescription => {
  const code = codeOf(error);
  return code
    ? ERRORES[code]
    : { mensaje: 'Algo salió mal. Probá de nuevo.', status: 500 };
};
