import { useCallback, useState } from 'react';
import { toast, Toaster } from 'sonner';

import { useRaffle } from '@/hooks/useRaffle';
import { getNumberLength } from '@/lib/utils';
import type { Tables } from '@/types/database';

import RaffleBuyers from './buyers';
import { RaffleDetailPanel } from './panel';
import { RaffleSalesGrid } from './sales';

type NumbersWithBuyer = Tables<'raffle_numbers'> & {
  buyer: Tables<'raffle_buyers'> | null;
};
type RaffleProps = Tables<'raffles'> & {
  numbers: NumbersWithBuyer[];
};
type NewBuyer = {
  number: number;
  name: string;
  phone?: string | null;
};

export function RaffleDetail({ raffle }: { raffle: RaffleProps }) {
  const number_padding = getNumberLength(raffle.total_numbers);

  const initialSolds = raffle.numbers
    .filter((n) => n.status === 'SOLD')
    .map((n) => n.number);

  const {
    raffle: raffleState,
    toggleSelectedNumber,
    clearSelection,
    addSolds,
  } = useRaffle({
    length: raffle.total_numbers,
    initials: { solds: initialSolds },
  });

  const [newBuyers, setNewBuyers] = useState<NewBuyer[]>([]);

  const handleSale = useCallback(
    (numbers: number[], buyerName: string, buyerPhone?: string | null) => {
      addSolds(numbers);
      clearSelection();
      setNewBuyers((prev) => [
        ...prev,
        ...numbers.map((n) => ({
          number: n,
          name: buyerName,
          phone: buyerPhone ?? undefined,
        })),
      ]);
      toast.success(
        `${numbers.length} número${numbers.length !== 1 ? 's' : ''} vendido${numbers.length !== 1 ? 's' : ''} a ${buyerName}`,
      );
    },
    [addSolds, clearSelection],
  );

  const allSoldNumbers: NumbersWithBuyer[] = [
    ...raffle.numbers.filter(({ status }) => status === 'SOLD'),
    ...newBuyers.map(
      (b) =>
        ({
          number: b.number,
          status: 'SOLD',
          buyer: { name: b.name, phone: b.phone ?? null },
          created_at: new Date().toISOString(),
          raffle_id: raffle.id,
          buyer_id: '',
          updated_at: null,
        }) as NumbersWithBuyer,
    ),
  ].sort((a, b) => a.number - b.number);

  return (
    <>
      <Toaster position="bottom-center" richColors />
      <RaffleDetailPanel
        sold_numbers={raffleState.count.solds}
        total_number={raffle.total_numbers}
        unit_price={raffle.price}
        draw_date={new Date(raffle.draw_date)}
      />

      <section className="grid gap-6 pb-6 lg:grid-cols-[1fr_23rem]">
        <RaffleSalesGrid
          raffleState={raffleState}
          toggleSelectedNumber={toggleSelectedNumber}
          raffle_id={raffle.id}
          price={raffle.price}
          onSale={handleSale}
        />

        <RaffleBuyers
          sold_numbers={allSoldNumbers}
          number_padding={number_padding}
        />
      </section>
    </>
  );
}
