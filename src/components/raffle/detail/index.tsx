import { getNumberLength } from "@/lib/utils";
import RaffleBuyers from "./buyers";
import { RaffleDetailPanel } from "./panel";
import { RaffleSalesGrid } from "./sales";
import type { Tables } from "@/types/database";
type NumbersWithBuyer = Tables<"raffle_numbers"> & {
  buyer: Tables<"raffle_buyers"> | null;
};
type RaffleProps = Tables<"raffles"> & {
  numbers: NumbersWithBuyer[];
};

export function RaffleDetail(
  { raffle }:
  { raffle: RaffleProps }
) {

  const number_padding = getNumberLength(raffle.total_numbers);

  const handleSale = () => {
    window.location.reload();
  }

  return (
    <>
      <RaffleDetailPanel
        sold_numbers={raffle.numbers.filter(n => n.status === 'SOLD').length}
        total_number={raffle.total_numbers}
        unit_price={raffle.price}
        draw_date={new Date(raffle.draw_date)}
      />

      <section className="grid lg:grid-cols-[1fr_23rem] gap-6 pb-6">
        <RaffleSalesGrid
          numbers={raffle.numbers}
          total_numbers={raffle.total_numbers}
          raffle_id={raffle.id}
          price={raffle.price}
          onSale={handleSale}
        />

        <RaffleBuyers
          sold_numbers={
            raffle.numbers
              .filter(({ status }) => status === 'SOLD')
              .sort((a, b) => a.number - b.number)
          }
          number_padding={number_padding}
        />
      </section>
    </>
  )
}
