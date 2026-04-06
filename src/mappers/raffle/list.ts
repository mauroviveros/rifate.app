import { formatCurrency, formatPercentage } from "@/lib/formatters";
import type { RaffleListStats, StatsProps } from "@/types";

export const mapRaffleListStats = ({ raffles, sold, total, revenue }: RaffleListStats): StatsProps[] => {
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
      highlight: true,
    },
    {
      name: "Progreso global",
      value: formatPercentage(sold / total),
      icon: "lucide:calendar-days",
    }
  ];
};
