import { useState } from "react";
import { RafflePreview } from "./Preview";
import { RaffleFormComponent, type RafflePreviewState } from "./Form";

export function RaffleForm({ owner_id }: { owner_id: string }) {
  const [previewData, setPreviewData] = useState<RafflePreviewState>({
    price: 2000,
    total_numbers: 100,
  });

  return (
    <div className="grid lg:grid-cols-[1fr_18rem] gap-6">
      <RaffleFormComponent owner_id={owner_id} onPreviewChange={setPreviewData} price={previewData.price} total_numbers={previewData.total_numbers}  />
      <RafflePreview price={previewData.price} total_numbers={previewData.total_numbers} />
    </div>
  );
}

// export { RaffleFormComponent } from "./Form";
// export { RafflePreview } from "./Preview";
// export type { RaffleFormType } from "./Form";
