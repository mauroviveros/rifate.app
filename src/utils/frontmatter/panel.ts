/**
 * La bajada del panel: «Tenés 2 rifas en venta y 1 sin publicar.»
 *
 * Las partes en cero no se nombran —«0 ya sorteadas» es ruido— y el «y» de la
 * última lo pone `Intl.ListFormat`, con la coma en el medio cuando son tres.
 * Vive acá y no en el `.astro` porque el frontmatter de un componente no se
 * puede testear.
 */

import type { RaffleListItem } from '@/types/raffle';

const list = new Intl.ListFormat('es-AR', { type: 'conjunction' });

export const panelSummary = (raffles: RaffleListItem[]): string => {
  const onSale = raffles.filter((r) => r.status === 'PUBLISHED').length;
  const drafts = raffles.filter((r) => r.status === 'DRAFT').length;
  const drawn = raffles.filter((r) => r.status === 'CLOSED').length;
  const cancelled = raffles.filter((r) => r.status === 'CANCELLED').length;

  const parts = [
    onSale > 0 && `${onSale} ${onSale === 1 ? 'rifa' : 'rifas'} en venta`,
    drafts > 0 && `${drafts} sin publicar`,
    drawn > 0 && `${drawn} ya ${drawn === 1 ? 'sorteada' : 'sorteadas'}`,
    cancelled > 0 &&
      `${cancelled} ${cancelled === 1 ? 'cancelada' : 'canceladas'}`,
  ].filter((part): part is string => typeof part === 'string');

  return parts.length > 0
    ? `Tenés ${list.format(parts)}.`
    : 'Acá van a estar todas tus rifas.';
};
