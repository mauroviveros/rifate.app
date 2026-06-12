import { formatRaffleNumber } from "@/lib/formatters";
import type { Tables } from "@/types/database";
import { Icon } from "@iconify/react";
import { Card, CardContent, CardHeader, CardTitle } from "@shadcn/card";

export default function RaffleBuyers({
  sold_numbers,
  number_padding = 2,
}: {
  sold_numbers: (Tables<"raffle_numbers"> & { buyer: Tables<"raffle_buyers"> | null })[];
  number_padding: number
}) {
  return (
    <Card size="sm" className="h-fit">
      <CardHeader className="flex items-center">
        <CardTitle className="font-bold text-lg text-foreground flex items-center gap-2 flex-1">
          <Icon icon="lucide:users" className="size-4 text-primary" />
          Compradores
        </CardTitle>

        <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          {sold_numbers.length}
        </span>
      </CardHeader>

      <CardContent className="space-y-3">
        <ul className="space-y-1.5 max-h-104 overflow-y-auto pr-2">
          {/* <li className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
            <div className="size-10 rounded-2xl bg-muted-foreground/20" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 bg-muted-foreground/20 rounded" />
              <div className="h-3 w-16 bg-muted-foreground/20 rounded" />
            </div>
          </li> */}
          {sold_numbers.map(({ number, buyer }) => (
            <li key={number} className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
              <span className="size-10 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm shrink-0">
                {formatRaffleNumber(number, number_padding)}
              </span>

              <div className="flex-1 min-w-0">
                {buyer ? (
                  <>
                    <p className="font-semibold text-foreground text-sm truncate">{buyer.name}</p>
                    {buyer.phone && (
                      <p className="text-xs text-muted-foreground">{buyer.phone}</p>
                    )}
                  </>
                ) : (
                  <p className="font-semibold text-foreground text-sm truncate">Comprador no encontrado</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
