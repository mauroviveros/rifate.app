import type { Tables } from '@/types/database';

// Formas de datos que devuelve el repositorio de rifas, derivadas de los tipos
// generados de la base (`Tables`) para no duplicar definiciones a mano.

/** Número de rifa tal como lo devuelve el select liviano `(number, status)`. */
export type RaffleNumberSummary = Pick<
  Tables<'raffle_numbers'>,
  'number' | 'status'
>;

/** Detalle público de la rifa: la rifa más el estado de sus números. */
export type PublicRaffle = Tables<'raffles'> & {
  numbers: RaffleNumberSummary[];
};

/** Número vendido/asignado junto con su comprador (vista del dashboard). */
export type OwnerRaffleNumber = Tables<'raffle_numbers'> & {
  buyer: Tables<'raffle_buyers'> | null;
};

/** Rifa completa para el dashboard del dueño: compradores + números con su comprador. */
export type OwnerRaffle = Tables<'raffles'> & {
  buyers: Tables<'raffle_buyers'>[];
  numbers: OwnerRaffleNumber[];
};

/** Rifa como tarjeta en el listado del dueño. */
export type RaffleListItem = Pick<
  Tables<'raffles'>,
  | 'id'
  | 'title'
  | 'description'
  | 'price'
  | 'total_numbers'
  | 'draw_date'
  | 'status'
> & {
  numbers: RaffleNumberSummary[];
};

interface RaffleStats {
  sold: number;
  total: number;
}
export interface RaffleListStats extends RaffleStats {
  raffles: number;
  revenue: number;
}

export interface RaffleDetailStats extends RaffleStats {
  date: Date;
  price: number;
}
