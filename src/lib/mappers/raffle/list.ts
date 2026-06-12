import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { RaffleListStats, Stats } from "@/types";

export const mapRaffleListStats = ({ raffles, sold, total, revenue }: RaffleListStats): Stats[] => {
  return [
    {
      name: "Rifas",
      value: raffles.toString(),
      icon: "lucide:hash",
    },
    {
      name: "Números vendidos",
      value: `${sold}/${total}`,
      icon: "lucide:trending-up",
    },
    {
      name: "Recaudado",
      value: formatCurrency(revenue),
      icon: "lucide:dollar-sign",
      highlight: "accent",
    },
    {
      name: "Progreso global",
      value: formatPercentage(sold / total),
      icon: "lucide:calendar-days",
    }
  ];
};
