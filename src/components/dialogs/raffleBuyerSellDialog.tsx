import { Button } from '@shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@shadcn/dialog';
import { useState } from 'react';

import { formatCurrency } from '@/lib/formatters';

import { RaffleBuyerSellForm } from '../forms/raffleBuyerSellForm';

export function RaffleBuyerSellDialog({
  raffle_id,
  selectedNumbers,
  price,
  onSuccess,
}: {
  raffle_id: string;
  selectedNumbers: number[];
  price: number;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sellTitle = `Vender ${selectedNumbers.length} número${selectedNumbers.length !== 1 ? 's' : ''}`;
  const ordenedSelectedNumbers = [...new Set(selectedNumbers)].sort(
    (a, b) => a - b,
  );

  const handleSuccess = () => {
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="shadow-float h-12 w-full rounded-xl text-base font-bold"
        >
          {sellTitle} - {formatCurrency(selectedNumbers.length * price)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold tracking-tight">
            {sellTitle}
          </DialogTitle>
          <div className="flex max-h-39 flex-wrap gap-1.5 overflow-y-auto py-2">
            {ordenedSelectedNumbers.map((number) => (
              <span
                key={number}
                className="bg-primary/10 text-primary rounded-lg px-2.5 py-1 text-xs font-bold"
              >
                {String(number).padStart(2, '0')}
              </span>
            ))}
          </div>

          <RaffleBuyerSellForm
            raffle_id={raffle_id}
            numbers={selectedNumbers}
            onSuccess={handleSuccess}
          />
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
