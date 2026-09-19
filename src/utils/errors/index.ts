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

export { AppError } from './app-error';
export type { ErrorDescription } from './catalog';
export { ERRORS } from './catalog';
export type { ErrorCode } from './codes';
export { codeOf, describeError } from './resolve';
