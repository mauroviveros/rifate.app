import { type ErrorDescription, ERRORS } from './catalog';
import type { ErrorCode } from './codes';

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
