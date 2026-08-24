import type { RaffleListItem, RaffleNumberSummary } from '@/types/raffle';

// Lógica de dominio pura (sin acceso a datos ni UI): cálculos reutilizables
// sobre los números de una rifa. Se testea y reutiliza desde páginas y actions.

export const SOLD_STATUS = 'SOLD';

type StatusRow = Pick<RaffleNumberSummary, 'status'>;

/** Números vendidos, como lista de índices ordenada de menor a mayor. */
export const soldNumbersOf = (numbers: RaffleNumberSummary[]): number[] =>
  numbers
    .filter((n) => n.status === SOLD_STATUS)
    .map((n) => n.number)
    .sort((a, b) => a - b);

export const countSold = (numbers: StatusRow[]): number =>
  numbers.reduce((acc, n) => (n.status === SOLD_STATUS ? acc + 1 : acc), 0);

export const availableCount = (total: number, sold: number): number =>
  total - sold;

export const progressPercent = (sold: number, total: number): number =>
  total ? Math.round((sold / total) * 100) : 0;

export const revenueOf = (sold: number, price: number): number => sold * price;

/**
 * Resumen visual compacto de los números vendidos como hasta `maxDots`
 * booleanos. En rifas chicas cada punto es un número; en las grandes cada
 * punto agrupa un rango de números.
 */
export const buildSalesDots = (
  numbers: RaffleNumberSummary[],
  total: number,
  maxDots = 100,
): boolean[] => {
  const soldSet = new Set(soldNumbersOf(numbers));
  const dotCount = Math.min(total, maxDots);

  if (total <= maxDots) {
    return Array.from({ length: dotCount }, (_, i) => soldSet.has(i));
  }

  const step = total / dotCount;
  return Array.from({ length: dotCount }, (_, i) => {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    for (let n = start; n < end; n += 1) {
      if (soldSet.has(n)) return true;
    }
    return false;
  });
};

export interface RaffleListAggregate {
  raffles: number;
  sold: number;
  total: number;
  revenue: number;
}

/** Totales agregados de todas las rifas del listado del organizador. */
export const aggregateListStats = (
  raffles: RaffleListItem[],
): RaffleListAggregate =>
  raffles.reduce<RaffleListAggregate>(
    (acc, raffle) => {
      const sold = countSold(raffle.numbers);
      return {
        raffles: acc.raffles + 1,
        sold: acc.sold + sold,
        total: acc.total + raffle.total_numbers,
        revenue: acc.revenue + revenueOf(sold, raffle.price),
      };
    },
    { raffles: 0, sold: 0, total: 0, revenue: 0 },
  );
