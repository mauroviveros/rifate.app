import { Icon } from "@iconify/react";
import { Card, CardContent, CardHeader, CardTitle } from "@shadcn/card";
import { useState } from "react";
import { RaffleCreateForm, type RafflePreviewState } from "../forms/raffleCreateForm";
import { formatCurrency } from "@/lib/formatters";

function RaffleCreatePreview({
  price = 0,
  total_numbers = 0
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
          <CardTitle className="font-bold text-sm flex items-center gap-2 text-foreground">
            <Icon icon="lucide:info" className="size-4 text-primary" />
            Resumen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between items-baseline flex-wrap">
            <span className="text-muted-foreground">Números</span>
            <span className="font-bold text-foreground ml-auto">{numberCount}</span>
          </div>
          <div className="flex justify-between items-baseline flex-wrap">
            <span className="text-muted-foreground">Precio c/u</span>
            <span className="font-bold text-foreground ml-auto">
              {formatCurrency(numberPrice)}
            </span>
          </div>
          <div className="border-t border-border pt-3 flex justify-between items-baseline flex-wrap">
            <span className="text-muted-foreground font-semibold">
              Total potencial
            </span>
            <span className="font-extrabold text-primary text-lg ml-auto">
              {formatCurrency(numberCount * numberPrice)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="bg-secondary/20 border-0">
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>Tip:</strong> Elegí una cantidad de números que sea fácil de
            vender. 100 números es un buen punto de partida
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function RaffleCreate({ owner_id }: { owner_id: string }) {
  const [previewData, setPreviewData] = useState<RafflePreviewState>({
    price: 2000,
    total_numbers: 100,
  });

  return (
    <div className="grid lg:grid-cols-[1fr_18rem] gap-6">
      <Card>
        <CardContent className="pt-0">
          <RaffleCreateForm
            owner_id={owner_id}
            price={previewData.price}
            total_numbers={previewData.total_numbers}
            onPreviewChange={setPreviewData}
          />
        </CardContent>
      </Card>

      <RaffleCreatePreview
        price={previewData.price}
        total_numbers={previewData.total_numbers}
      />
    </div>
  );
}
