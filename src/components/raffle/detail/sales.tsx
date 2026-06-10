import type { Tables } from "@/types";
import { RaffleGrid } from "../grid/react";
import { useRaffle } from "@/hooks/useRaffle";
import { RaffleBuyerSellDialog } from "@/components/dialogs/raffleBuyerSellDialog";

export function RaffleSalesGrid(
  {
    numbers,
    raffle_id,
    price,
    total_numbers,
    onSale,
  }: {
    numbers: Tables<'raffle_numbers'>[];
    raffle_id: string;
    price: number;
    total_numbers: number;
    onSale?: () => void;
  }
) {

  const { raffle, toggleSelectedNumber } = useRaffle({
    length: total_numbers,
    initials: {
      solds: numbers
        .filter(n => n.status === 'SOLD')
        .map(n => n.number),
    }
  });

  // Mover números seleccionados a vendidos, limpiar selección y notificar
  // al padre para que refetchee stats + compradores
  const handleSaleSuccess = () => {
    onSale?.();
  };

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
          <RaffleBuyerSellDialog
            raffle_id={raffle_id}
            selectedNumbers={raffle.numbers.selecteds}
            price={price}
            onSuccess={handleSaleSuccess}
          />
        </footer>
      )}
    </article>
  )
}
