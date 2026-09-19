/**
 * Lo que la PÁGINA hace con el resultado de una action.
 *
 * Es la punta opuesta de `src/actions/errors.ts`: allá un error de dominio se
 * convierte en `ActionError`; acá ese `ActionError` se abre en lo que el
 * formulario tiene que mostrar — errores por campo, o un mensaje suelto.
 */

import { type ActionError, isInputError } from 'astro:actions';

/** Lo que devuelve `Astro.getActionResult()`. Sin POST todavía, `undefined`. */
export type ActionResult =
  | { data: unknown; error: undefined }
  | { data: undefined; error: ActionError }
  | undefined;

export type FormErrors = {
  /** Errores por campo, del `ActionInputError` de zod. Vacío si no hubo. */
  fields: Record<string, string[] | undefined>;
  /** El error de dominio, ya en castellano. `null` si no hubo. */
  message: string | null;
};

/**
 * Abre el primer resultado que haya fallado.
 *
 * Recibe VARIOS porque hay un `<form>` con más de un botón y cada botón manda a
 * una action distinta: «Guardar y publicar» y «Guardar sin publicar todavía»
 * son `raffle.publish` y `raffle.setPhone`, y el error de cualquiera de las dos
 * se muestra en el mismo lugar. Lo mismo vender y liberar. El orden de los
 * argumentos es el de prioridad, aunque en la práctica nunca fallan dos juntas:
 * el navegador manda un botón por submit.
 */
export const formErrors = (...results: ActionResult[]): FormErrors => {
  const firstError = results.find((result) => result?.error)?.error;
  if (!firstError) return { fields: {}, message: null };

  return isInputError(firstError)
    ? { fields: firstError.fields, message: null }
    : { fields: {}, message: firstError.message };
};
