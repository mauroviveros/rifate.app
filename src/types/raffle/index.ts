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
