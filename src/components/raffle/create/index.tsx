import { Card, CardContent } from '@shadcn/card';
import { useState } from 'react';

import {
  RaffleCreateForm,
  type RafflePreviewState,
} from '@/components/forms/raffleCreateForm';

import { RaffleCreatePreview } from './preview';

export function RaffleCreate() {
  const [previewData, setPreviewData] = useState<RafflePreviewState>({
    price: 2000,
    total_numbers: 100,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <Card>
        <CardContent className="pt-0">
          <RaffleCreateForm
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
