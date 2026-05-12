import { useRaffle } from "@/hooks/useRaffle";
import { RaffleGrid } from "./react";
import { useEffect } from "react";

export function RaffleGridWithSellModal() {
  const { raffle, toggleNumber } = useRaffle({
    length: 100,
    initials: {
      solds: [1, 2, 3, 4, 5],
    }
  });

  console.log('Raffle data initialized:', raffle);

  useEffect(() => {
    console.log(raffle)
  }, [raffle]);

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
