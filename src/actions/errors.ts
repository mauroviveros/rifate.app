import { ActionError } from 'astro:actions';

import { codeOf, describeError } from '@/utils/errors';

/**
 * El puente entre los errores de dominio y los de Astro.
 *
 * `AppError` lleva el código en el `message` porque es lo único que sobrevive
 * el límite RPC de un Durable Object (ver `@/utils/errors`). Acá se lo lee y
 * se lo convierte en el `ActionError` que la pantalla puede mostrar.
 *
 * El status sale de `ERRORS`, y de ahí el código de Astro: `statusToCode()` es
 * la tabla del registro de IANA que Astro ya trae. Así la única fuente de qué
 * status le corresponde a cada error de dominio sigue siendo el `ERRORS` de
 * `@/utils/errors`, y no un segundo mapa que se desincroniza.
 */
export const asActionError = (error: unknown): ActionError => {
  if (error instanceof ActionError) return error;
  if (codeOf(error) === null) {
    console.error('error sin código de dominio en una action', error);
  }

  const { message, status } = describeError(error);

  return new ActionError({
    code: ActionError.statusToCode(status),
    message,
  });
};
