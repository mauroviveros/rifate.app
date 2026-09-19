import type { OwnerRaffle } from '@/types/raffle';
import { pesos } from '@/utils/format';

/**
 * Por qué NO se puede publicar todavía, o `null` si se puede. El botón usa el
 * texto como etiqueta cuando está apagado (regla 7).
 *
 * Sólo mira el teléfono: es lo único que `publishRaffle` exige además del
 * estado, y el CHECK de la tabla lo pide igual. El botón se muestra sólo en
 * `DRAFT`, así que «ya publicada» no llega acá.
 */
export const publishHint = (raffle: OwnerRaffle): string | null =>
  raffle.contactPhone === null ? 'Cargá un teléfono para publicar' : null;

export type ChecklistItem = { label: string; done: boolean };

/**
 * La lista «Antes de publicar». Los tres primeros ítems siempre están hechos
 * —el alta los exige—; el teléfono es el único que puede faltar, y es lo que
 * `publishRaffle` chequea antes de dejar publicar.
 */
export const beforePublishItems = (raffle: OwnerRaffle): ChecklistItem[] => [
  { label: 'El título y el premio', done: true },
  {
    label: `${raffle.totalNumbers} números a ${pesos(raffle.ticketPrice)}`,
    done: true,
  },
  { label: 'La fecha del sorteo', done: true },
  { label: 'Un teléfono de contacto', done: raffle.contactPhone !== null },
];

/** Cuántos ítems de `beforePublishItems` faltan (0 → se puede publicar). */
export const pendingBeforePublish = (raffle: OwnerRaffle): number =>
  beforePublishItems(raffle).filter((i) => !i.done).length;
