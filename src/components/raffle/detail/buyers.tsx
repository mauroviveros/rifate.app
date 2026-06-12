import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '@shadcn/card';

import { formatRaffleNumber } from '@/lib/formatters';
import type { Tables } from '@/types/database';

export default function RaffleBuyers({
  sold_numbers,
  number_padding = 2,
}: {
  sold_numbers: (Tables<'raffle_numbers'> & {
    buyer: Tables<'raffle_buyers'> | null;
  })[];
  number_padding: number;
}) {
  return (
    <Card size="sm" className="h-fit">
      <CardHeader className="flex items-center">
        <CardTitle className="text-foreground flex flex-1 items-center gap-2 text-lg font-bold">
          <Icon icon="lucide:users" className="text-primary size-4" />
          Compradores
        </CardTitle>

        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
          {sold_numbers.length}
        </span>
      </CardHeader>

      <CardContent className="space-y-3">
        <ul className="max-h-104 space-y-1.5 overflow-y-auto pr-2">
          {/* <li className="flex items-center gap-3 bg-muted/50 rounded-xl p-3">
            <div className="size-10 rounded-2xl bg-muted-foreground/20" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-24 bg-muted-foreground/20 rounded" />
              <div className="h-3 w-16 bg-muted-foreground/20 rounded" />
            </div>
          </li> */}
          {sold_numbers.map(({ number, buyer }) => (
            <li
              key={number}
              className="bg-muted/50 flex items-center gap-3 rounded-xl p-3"
            >
              <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold">
                {formatRaffleNumber(number, number_padding)}
              </span>

              <div className="min-w-0 flex-1">
                {buyer ? (
                  <>
                    <p className="text-foreground truncate text-sm font-semibold">
                      {buyer.name}
                    </p>
                    {buyer.phone && (
                      <p className="text-muted-foreground text-xs">
                        {buyer.phone}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-foreground truncate text-sm font-semibold">
                    Comprador no encontrado
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
