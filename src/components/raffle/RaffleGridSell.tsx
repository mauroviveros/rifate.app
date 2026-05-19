import { useRaffle } from "@/hooks/useRaffle";
import { RaffleGrid } from "./grid/react";
import type { Tables } from "@/types";
import { Button } from "@shadcn/button";
import { formatCurrency } from "@/lib/formatters";

export function RaffleGridSell(
  {
    numbers,
    raffle_id,
    price
  }: {
    numbers: Tables<'raffle_numbers'>[];
    raffle_id: string;
    price: number;
  }
) {

  const { raffle, toggleSelectedNumber } = useRaffle({
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
        onToggleSelectedNumber={toggleSelectedNumber}
        soldNumbers={raffle.numbers.solds}
        selectedNumbers={raffle.numbers.selecteds}
      />

      {raffle.numbers.selecteds.length > 0 && (
        <footer className="sticky bottom-6 z-10">
          <Button
            size="lg"
            className="w-full rounded-xl h-12 font-bold text-base shadow-float"
          >
            {[
              `Vender ${raffle.numbers.selecteds.length}`,
              `número${raffle.numbers.selecteds.length !== 1 ? 's' : ''}`,
              `— ${formatCurrency(raffle.numbers.selecteds.length * price)}`
            ].join(' ')}
          </Button>
        </footer>
      )}
    </article>
  )
}
