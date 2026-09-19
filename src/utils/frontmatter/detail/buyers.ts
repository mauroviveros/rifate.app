import type { OwnerNumber } from '@/types/raffle';

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
