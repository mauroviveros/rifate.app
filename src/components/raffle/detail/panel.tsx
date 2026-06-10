import { mapRaffleDetailStats } from "@/lib/mappers";
import { Progress } from "@shadcn/progress";
import { Stats } from "@ui/stats";

export function RaffleDetailPanel({
  sold_numbers,
  total_number,
  unit_price,
  draw_date,
}: {
  sold_numbers: number;
  total_number: number;
  unit_price: number;
  draw_date: Date;
}) {
  const STATS = mapRaffleDetailStats({
    sold: sold_numbers,
    total: total_number,
    price: unit_price,
    date: draw_date
  });

  return (
    <>
      <article className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {STATS.map((props) => (
          <Stats
            key={props.name}
            className={props.highlight === "accent" ? "col-span-2 lg:col-span-1" : ""}
            {...props}
          />
        ))}
      </article>

      <Progress
        value={(sold_numbers / total_number) * 100}
        className="h-2 my-6"
      />
    </>
  )
}
