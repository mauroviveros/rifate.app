import { RaffleCreateForm, type RafflePreviewState } from "@/components/forms/raffleCreateForm";
import { Card, CardContent } from "@shadcn/card";
import { useState } from "react";
import { RaffleCreatePreview } from "./preview";

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
