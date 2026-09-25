/**
 * La palabra que hay que escribir para anular una rifa.
 *
 * Vive sola y no en `actions/raffle.schema.ts` porque la usan los dos lados:
 * el esquema, que es el que decide, y el `<script>` del diálogo, que prende el
 * botón mientras se escribe. Importarla del esquema metería zod en el bundle
 * del navegador para leer seis letras.
 */
export const CANCEL_WORD = 'ANULAR';
