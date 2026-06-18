import { RaffleBuyerSellDialog } from '@/components/dialogs/raffleBuyerSellDialog';

import { RaffleGrid } from '../grid/react';

export function RaffleSalesGrid({
  raffleState,
  toggleSelectedNumber,
  raffle_id,
  price,
  onSale,
}: {
  raffleState: ReturnType<
    typeof import('@/hooks/useRaffle').useRaffle
  >['raffle'];
  toggleSelectedNumber: (number: number) => void;
  raffle_id: string;
  price: number;
  onSale?: (
    numbers: number[],
    buyerName: string,
    buyerPhone?: string | null,
  ) => void;
}) {
  return (
    <article className="space-y-4">
      <RaffleGrid
        length={raffleState.length}
        editable={true}
        onToggleSelectedNumber={toggleSelectedNumber}
        soldNumbers={raffleState.numbers.solds}
        selectedNumbers={raffleState.numbers.selecteds}
      />

      {raffleState.numbers.selecteds.length > 0 && (
        <footer className="sticky bottom-6 z-10">
          <RaffleBuyerSellDialog
            raffle_id={raffle_id}
            selectedNumbers={raffleState.numbers.selecteds}
            price={price}
            onSuccess={(name, phone) => {
              onSale?.(raffleState.numbers.selecteds, name, phone);
            }}
          />
        </footer>
      )}
    </article>
  );
}
