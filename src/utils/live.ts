/**
 * El código con el que el DO cierra el WebSocket cuando la rifa deja de
 * existir. Va en el rango 4000–4999, que el protocolo reserva para las apps.
 *
 * Existe para que el cliente sepa que no tiene que reconectarse: un 1000 o un
 * 1006 se leen como un corte y el navegador volvería a intentar para siempre
 * contra una rifa borrada.
 */
export const LIVE_GONE = 4404;
