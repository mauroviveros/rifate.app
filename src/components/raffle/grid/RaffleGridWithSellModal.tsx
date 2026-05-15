import { useRaffle } from "@/hooks/useRaffle";
import { RaffleGrid } from "./react";
import type { Tables } from "@/types";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { actions } from "astro:actions";
import { useMemo, useState } from "react";
import { formatRaffleNumber } from "@/lib/formatters";
import { getNumberLength } from "@/lib/utils";
import { SellNumbersBuyerForm } from "./SellNumbersBuyerForm";
import type { SellRaffleBuyerInput } from "@/schemas/sellRaffleNumbers";

export function RaffleGridWithSellModal(
  {
    raffleId,
    rafflePrice,
    totalNumbers,
    numbers,
  }: {
    raffleId: string
    rafflePrice: number
    totalNumbers: number
    numbers: Tables<'raffle_numbers'>[]
  }
  ) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { raffle, toggleNumber, markNumbersAsSold } = useRaffle({
    length: totalNumbers,
    initials: {
      solds: numbers
        .filter(n => n.status === 'SOLD')
        .map(n => n.number),
    }
  });

  const selectedNumbers = raffle.numbers.selecteds;
  const selectedCount = selectedNumbers.length;
  const totalAmount = selectedCount * rafflePrice;
  const numberPadding = getNumberLength(totalNumbers);

  const selectedNumbersLabel = useMemo(
    () => selectedNumbers.map((n) => formatRaffleNumber(n, numberPadding)).join(", "),
    [numberPadding, selectedNumbers],
  );

  const handleSubmit = async (buyer: SellRaffleBuyerInput) => {
    if (selectedCount === 0) return false;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await actions.sellRaffleNumbers({
        raffle_id: raffleId,
        buyer,
        numbers: selectedNumbers,
      });

      if (error) {
        setErrorMessage(error.message);
        return false;
      }

      markNumbersAsSold(selectedNumbers);
      setOpen(false);
      return true;
    } catch (error) {
      console.error("Error selling raffle numbers from dialog:", error);
      setErrorMessage("Ocurrió un error inesperado. Inténtalo nuevamente.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="space-y-4">
      <RaffleGrid
        length={raffle.length}
        editable={true}
        onToggleNumber={toggleNumber}
        soldNumbers={raffle.numbers.solds}
        selectedNumbers={raffle.numbers.selecteds}
      ></RaffleGrid>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={selectedCount === 0}
          onClick={() => setOpen(true)}
        >
          Vender {selectedCount} número{selectedCount === 1 ? "" : "s"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar compra</DialogTitle>
            <DialogDescription>
              Completá los datos del comprador para registrar los números seleccionados.
            </DialogDescription>
          </DialogHeader>
          <SellNumbersBuyerForm
            selectedNumbersLabel={selectedNumbersLabel}
            selectedCount={selectedCount}
            totalAmount={totalAmount}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </article>
  )
}
