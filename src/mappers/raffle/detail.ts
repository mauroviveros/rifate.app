import { formatCurrency, formatDate, formatPercentage } from "@/lib/formatters";
import type { RaffleDetailStats, StatsProps } from "@/types";

export const mapRaffleDetailStats = ({ sold, total, price, date }: RaffleDetailStats): StatsProps[] => {
  return [
    {
      name: "Vendidos",
      value: `${sold}/${total}`,
      icon: "lucide:shopping-cart",
    },
    {
      name: "Progreso",
      value: formatPercentage(sold / total),
      icon: "lucide:percent",
    },
    {
      name: "Recaudado",
      value: formatCurrency(sold * price),
      icon: "lucide:dollar-sign",
      highlight: true,
    },
    {
      name: "Sorteo",
      value: formatDate(date),
      icon: "lucide:calendar-days",
    },
    {
      name: "Disponibles",
      value: `${total - sold}`,
      icon: "lucide:users",
    }
  ]
}
