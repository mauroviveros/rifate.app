/**
 * La defensa nº1: tipos que no pueden cargar el secreto.
 *
 * ⚠️ Todo lo que se le pasa como genérico a `SqlStorage.exec<T>()` tiene que ser
 * un `type` (alias de tipo), NUNCA una `interface`. La firma real es
 * `exec<T extends Record<string, SqlStorageValue>>`, y TypeScript le da index
 * signature implícita a los alias de objeto pero no a las interfaces: con
 * `interface` esto no compila, con `type` sí.
 */

export type NumberStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'BLOCKED';
export type RaffleTier = 'BASIC' | 'PRO';
export type RaffleStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
export type UnlockMethod = 'FREE' | 'VOUCHER' | 'PAYMENT';

/** Lo que ve el visitante. No tiene campo para el comprador: no existe. */
export type PublicNumber = {
  number: number;
  status: NumberStatus;
};

/** Lo que ve el organizador de SU rifa. */
export type OwnerNumber = {
  number: number;
  status: NumberStatus;
  buyerId: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  orderId: string | null;
  reservedUntil: number | null;
  note: string | null;
};

type Assert<T extends true> = T;

/**
 * La regla de la casa, sostenida por el compilador y no por la memoria:
 * `OwnerNumber` es un `PublicNumber` con más campos. Al revés sería el agujero.
 * Si alguien mueve `buyerPhone` a `PublicNumber`, esta línea deja de compilar.
 */
export type _OwnerNumberEsUnPublicNumber = Assert<
  OwnerNumber extends PublicNumber ? true : false
>;

/**
 * Lo que el DO le manda por el WebSocket a quien está mirando la página
 * pública. Lleva `PublicNumber[]` y nada más: por ese cable pasa lo mismo que
 * ya se ve en `/r/{slug}`, así que no hay nada nuevo que se pueda filtrar.
 *
 * Es la grilla entera y no el cambio. Así el que se conecta tarde, o se
 * reconecta después de un corte, no tiene que reconstruir nada.
 */
export type LiveMessage = {
  type: 'grid';
  numbers: PublicNumber[];
};

export type BuyerInput = {
  name: string;
  phone: string | null;
  note?: string | null;
};

export type SellResult = {
  buyerId: string;
  sold: number[];
};

export type RaffleStats = {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  blocked: number;
};

/** La config que el DO copia de D1 para poder validar por su cuenta. */
export type RaffleInit = {
  raffleId: string;
  ownerId: string;
  tier: RaffleTier;
  status: RaffleStatus;
  numberStart: number;
  totalNumbers: number;
};

/** Lo que D1 le puede cambiar al DO después del init. Nunca el dueño. */
export type RaffleConfigPatch = {
  tier?: RaffleTier;
  status?: RaffleStatus;
};

// ── Del lado de D1 ──────────────────────────────────────────────────────────

export type NewRaffle = {
  title: string;
  description: string | null;
  prize: string | null;
  ticketPrice: number; // centavos
  totalNumbers: number;
  numberStart: 0 | 1;
  drawDate: string; // ISO 'YYYY-MM-DD'
  contactPhone: string | null;
};

/**
 * Lo que edita `raffle.update`. Hoy son los mismos campos que el alta: la
 * pantalla de edición manda todos y el flujo decide cuáles aplica según el
 * estado. Se le da nombre propio para que el día que diverja de `NewRaffle` no
 * haya que desenredarlo.
 */
export type RaffleUpdate = NewRaffle;

export type RaffleCard = {
  id: string;
  slug: string;
  title: string;
  tier: RaffleTier;
  status: RaffleStatus;
  ticketPrice: number;
  currency: string;
  totalNumbers: number;
  numberStart: number;
  drawDate: string;
  soldCount: number;
  reservedCount: number;
  createdAt: number;
};

export type OwnerRaffle = RaffleCard & {
  description: string | null;
  prize: string | null;
  unlockMethod: UnlockMethod;
  contactPhone: string | null;
  winnerNumber: number | null;
  winnerName: string | null;
  syncedAt: number | null;
  publishedAt: number | null;
  updatedAt: number;
};

/**
 * Lo que se sirve en `/r/{slug}`. Sin `ownerId`: el visitante no tiene por qué
 * saber quién es el dueño en el sistema. `contactPhone` SÍ está, y es público a
 * propósito: es el canal por el que se compra.
 */
export type PublicRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  prize: string | null;
  tier: RaffleTier;
  status: RaffleStatus;
  ticketPrice: number;
  currency: string;
  totalNumbers: number;
  numberStart: number;
  drawDate: string;
  contactPhone: string | null;
  soldCount: number;
  reservedCount: number;
  winnerNumber: number | null;
  winnerName: string | null;
};

/**
 * Lo que dibuja la tarjeta del listado del panel (artboard `Dashboard`).
 *
 * Es `RaffleCard` más tres campos que la tarjeta muestra y la card pelada no
 * tiene: el premio de la bajada («Bici rodado 29 + canasta de asado») y el
 * ganador de la rifa ya sorteada («Ganó el número 34 · Ana Ríos»).
 *
 * Se agregan acá y no en `RaffleCard` a propósito: `RaffleCard` es la base que
 * también van a usar las superficies públicas, y `prize` / `winnerName` en la
 * base sería justo el ensanche que docs/04 pide evitar. `listOwnRaffles` los
 * mapea con su propio `toListItem()`; las columnas ya venían en `COLUMNAS`.
 */
export type RaffleListItem = RaffleCard &
  Pick<OwnerRaffle, 'prize' | 'winnerNumber' | 'winnerName'>;
