import type { OwnerRaffle } from '@/types/raffle';

/** Si `Astro.site` no está configurado. Es el dominio de producción. */
const FALLBACK_ORIGIN = 'https://rifate.app';

/**
 * El link público completo: `https://rifate.app/r/rifa-del-club-a1b2c3d4`.
 *
 * El origen entra por parámetro —`Astro.site`— y no está escrito acá, para que
 * en un preview el link apunte al preview y no mande a producción.
 */
export const publicUrlOf = (raffle: OwnerRaffle, site: URL | undefined) =>
  new URL(`/r/${raffle.slug}`, site ?? FALLBACK_ORIGIN).href;
