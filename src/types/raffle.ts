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
