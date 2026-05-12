import { useRaffle } from "@/hooks/useRaffle";
import { RaffleGrid } from "./react";
import type { Tables } from "@/types";

export function RaffleGridWithSellModal(
  { numbers }: { numbers: Tables<'raffle_numbers'>[] }
) {
  const { raffle, toggleNumber } = useRaffle({
    length: 100,
    initials: {
      solds: numbers
        .filter(n => n.status === 'SOLD')
        .map(n => n.number),
    }
  });

  return (
    <article className="space-y-4">
      <RaffleGrid
        length={raffle.length}
        editable={true}
        onToggleNumber={toggleNumber}
        soldNumbers={raffle.numbers.solds}
        selectedNumbers={raffle.numbers.selecteds}
      ></RaffleGrid>
    </article>
  )
}
