import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '@shadcn/card';

import { formatCurrency } from '@/lib/formatters';

export function RaffleCreatePreview({
  price = 0,
  total_numbers = 0,
}: {
  price?: number;
  total_numbers?: number;
}) {
  const numberCount = isNaN(total_numbers) ? 0 : total_numbers;
  const numberPrice = isNaN(price) ? 0 : price;

  return (
    <div className="space-y-4">
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2 text-sm font-bold">
            <Icon icon="lucide:info" className="text-primary size-4" />
            Resumen
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between">
            <span className="text-muted-foreground">Números</span>
            <span className="text-foreground ml-auto font-bold">
              {numberCount}
            </span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between">
            <span className="text-muted-foreground">Precio c/u</span>
            <span className="text-foreground ml-auto font-bold">
              {formatCurrency(numberPrice)}
            </span>
          </div>

          <div className="border-border flex flex-wrap items-baseline justify-between border-t pt-3">
            <span className="text-muted-foreground font-semibold">
              Total potencial
            </span>
            <span className="text-primary ml-auto text-lg font-extrabold">
              {formatCurrency(numberCount * numberPrice)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="bg-secondary/20 border-0">
        <CardContent>
          <p className="text-muted-foreground text-sm leading-relaxed">
            <strong>Tip:</strong> Elegí una cantidad de números que sea fácil de
            vender. 100 números es un buen punto de partida
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
