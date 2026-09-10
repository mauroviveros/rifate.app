import type { OwnerNumber, OwnerRaffle } from '@/types/raffle';
import { pesos, progress } from '@/utils/format';

/* ── Las etiquetas de la grilla ──────────────────────────────────────────── */

/**
 * El ancho de padding de las etiquetas. Se calcula sobre el ANTEÚLTIMO número
 * (`start + total - 2`), no el último: en una rifa `1..100` así el `100` es el
 * único de tres dígitos y el resto queda `01..99`, como un talonario de papel.
 * Mismo cálculo que `Summary` del alta, con un piso de 1 para la rifa de un
 * solo número.
 */
export const numberWidth = (
  numberStart: number,
  totalNumbers: number,
): number => String(Math.max(1, numberStart + totalNumbers - 2)).length;

export const numberLabel = (value: number, width: number): string =>
  String(value).padStart(width, '0');

/* ── Contadores ──────────────────────────────────────────────────────────── */

export type Tally = {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  blocked: number;
  /** Vendidos × precio, en centavos: la unidad que guarda D1. */
  raisedCents: number;
  /** Avance 0-100, entero. */
  progress: number;
};

export const tally = (
  numbers: OwnerNumber[],
  ticketPriceCents: number,
): Tally => {
  const bucket = { available: 0, reserved: 0, sold: 0, blocked: 0 };

  for (const { status } of numbers) {
    if (status === 'AVAILABLE') bucket.available++;
    else if (status === 'RESERVED') bucket.reserved++;
    else if (status === 'SOLD') bucket.sold++;
    else if (status === 'BLOCKED') bucket.blocked++;
  }

  return {
    total: numbers.length,
    ...bucket,
    raisedCents: bucket.sold * ticketPriceCents,
    progress: progress(bucket.sold, numbers.length),
  };
};

/* ── La selección del panel de venta ─────────────────────────────────────── */

export type SelectionKind = 'empty' | 'sell' | 'release' | 'mixed';

/**
 * Qué ofrece el panel según los números tildados: `sell` si son todos libres,
 * `release` si son todos ocupados (vendido o reservado), `mixed` si hay de los
 * dos —y ahí el panel apaga los dos botones y lo dice (regla 7)—.
 *
 * Recibe un booleano por número elegido —`true` = ocupado— y no la grilla: así
 * lo llama igual el `<script>` del panel, que lo lee del DOM en vivo.
 */
export const selectionKind = (taken: readonly boolean[]): SelectionKind => {
  if (taken.length === 0) return 'empty';
  const anyFree = taken.some((t) => !t);
  const anyTaken = taken.some((t) => t);
  return anyFree && anyTaken ? 'mixed' : anyFree ? 'sell' : 'release';
};

/* ── Compradores ─────────────────────────────────────────────────────────── */

export type BuyerGroup = {
  buyerId: string;
  name: string;
  phone: string | null;
  /** Los números de este comprador, ascendente. */
  numbers: number[];
  /** Las notas distintas de esos números, en el orden en que aparecieron. */
  notes: string[];
};

/**
 * Agrupa la grilla por comprador. Sólo entran los `SOLD` (un `RESERVED` no
 * tiene `buyerId`: la reserva va por `orderId`). Los grupos salen ordenados
 * por su número más bajo, así la lista sigue el orden de la grilla y no un
 * hash de ids.
 */
export const buyersOf = (numbers: OwnerNumber[]): BuyerGroup[] => {
  const groups = new Map<string, BuyerGroup>();

  for (const n of numbers) {
    if (n.buyerId === null) continue;

    let group = groups.get(n.buyerId);
    if (group === undefined) {
      group = {
        buyerId: n.buyerId,
        name: n.buyerName ?? 'Sin nombre',
        phone: n.buyerPhone,
        numbers: [],
        notes: [],
      };
      groups.set(n.buyerId, group);
    }

    group.numbers.push(n.number);
    if (n.note !== null && !group.notes.includes(n.note)) {
      group.notes.push(n.note);
    }
  }

  for (const group of groups.values()) {
    group.numbers.sort((a, b) => a - b);
  }

  return [...groups.values()].sort(
    (a, b) => (a.numbers[0] ?? 0) - (b.numbers[0] ?? 0),
  );
};

/**
 * El talón del renglón de comprador: los primeros `max` números y cuántos
 * quedan escondidos. La flecha del `<details>` se dibuja sólo si `hidden > 0`.
 */
export const previewNumbers = (
  values: number[],
  max: number,
): { shown: number[]; hidden: number } => ({
  shown: values.slice(0, max),
  hidden: Math.max(0, values.length - max),
});

/* ── Publicar ────────────────────────────────────────────────────────────── */

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

/* ── Antes de publicar (detalle en DRAFT) ────────────────────────────────── */

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

/* ── Editar ──────────────────────────────────────────────────────────────── */

/**
 * La fila de la rifa a los strings que `Form` y `Summary` del alta esperan. En
 * el primer GET de `/panel/rifa/[id]/editar` no hay `FormData` y el formulario
 * saldría vacío: los valores salen de acá. El precio va en PESOS — el mismo
 * formato que tipea el organizador —, que el esquema reconvierte a centavos.
 */
export const toEditInitial = (raffle: OwnerRaffle): Record<string, string> => ({
  title: raffle.title,
  description: raffle.description ?? '',
  prize: raffle.prize ?? '',
  ticketPrice: String(raffle.ticketPrice / 100),
  totalNumbers: String(raffle.totalNumbers),
  numberStart: String(raffle.numberStart),
  drawDate: raffle.drawDate,
  contactPhone: raffle.contactPhone ?? '',
});

const FLASH: Record<string, (count: number) => string> = {
  published: () => 'Listo: tu rifa quedó publicada.',
  updated: () => 'Listo: guardamos los cambios.',
  phone: () => 'Listo: guardamos el teléfono.',
  sold: (count) => `Vendiste ${count} número${count === 1 ? '' : 's'}.`,
  freed: (count) => `Liberaste ${count} número${count === 1 ? '' : 's'}.`,
};

/* ── Mensajes de flash del panel de venta ───────────────────────────────────── */

export const flashMessage = (ok: string | null): string | null => {
  if (!ok) return null;
  const [kind, count] = ok.split('-');
  const build = FLASH[kind ?? ''];
  return build ? build(Number(count) || 0) : null;
};
