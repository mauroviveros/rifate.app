/**
 * Todo lo que la pantalla de detalle deriva antes de dibujarse.
 *
 * Un archivo por pregunta, y las preguntas son de distinto origen: `estado` y
 * `tally` salen de la rifa y su grilla, `flash` y `selection` de la URL y del
 * POST que trajo la pantalla. Estaban las ocho en un solo `detail.ts`, y eso
 * fue lo que dejó pasar una `detailView()` que devolvía nueve campos de tres
 * orígenes distintos en una sola bolsa.
 *
 * ⚠️ Lo del panel de venta NO está acá: vive en `../sale.ts`, y es a propósito.
 * Es la única parte del detalle que corre en el NAVEGADOR —se importa desde un
 * `<script>` del cliente—, así que ponerla detrás de este barril arrastraría
 * `tally`, `buyersOf` y el resto al bundle del navegador.
 */

export type { BuyerGroup } from './buyers';
export { buyersOf, previewNumbers } from './buyers';
export { toEditInitial } from './edit';
export type { EstadoDetalle } from './estado';
export { estadoDetalle } from './estado';
export { flashMessage } from './flash';
export { publicUrlOf } from './link';
export type { ChecklistItem } from './publish';
export {
  beforePublishItems,
  pendingBeforePublish,
  publishHint,
} from './publish';
export { selectedNumbers } from './selection';
export { shareImageInput } from './share-image';
export { subtitleOf } from './subtitle';
export type { Tally } from './tally';
export { tally } from './tally';
