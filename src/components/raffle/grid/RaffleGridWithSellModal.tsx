import { useRaffle } from "@/hooks/useRaffle";
import { RaffleGrid } from "./react";
import type { Tables } from "@/types";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Textarea } from "@/components/shadcn/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { actions } from "astro:actions";
import { useMemo, useState, type FormEvent } from "react";
import { Field } from "@/components/Field";
import { formatCurrency, formatRaffleNumber } from "@/lib/formatters";
import { getNumberLength } from "@/lib/utils";

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
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerNote, setBuyerNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { raffle, toggleNumber } = useRaffle({
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedCount === 0) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { error } = await actions.sellRaffleNumbers({
        raffle_id: raffleId,
        buyer: {
          name: buyerName,
          phone: buyerPhone,
          note: buyerNote,
        },
        numbers: selectedNumbers,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setOpen(false);
      window.location.reload();
    } catch (error) {
      console.error("Error selling raffle numbers from dialog:", error);
      setErrorMessage("Ocurrió un error inesperado. Inténtalo nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <article className="flex flex-col gap-4">
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

          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <Field
              label="Nombre del comprador"
              htmlFor="buyer-name"
              required
            >
              <Input
                id="buyer-name"
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value)}
                placeholder="Ej: Juan Pérez"
                required
                disabled={isSubmitting}
              />
            </Field>

            <Field
              label="Teléfono"
              htmlFor="buyer-phone"
            >
              <Input
                id="buyer-phone"
                value={buyerPhone}
                onChange={(event) => setBuyerPhone(event.target.value)}
                placeholder="Ej: 11 1234-5678"
                disabled={isSubmitting}
              />
            </Field>

            <Field
              label="Nota"
              htmlFor="buyer-note"
              description="Información adicional opcional sobre esta compra."
            >
              <Textarea
                id="buyer-note"
                value={buyerNote}
                onChange={(event) => setBuyerNote(event.target.value)}
                placeholder="Detalle adicional (opcional)"
                disabled={isSubmitting}
              />
            </Field>

            <div className="rounded-xl border bg-muted/40 p-3 text-sm">
              <p className="font-semibold text-foreground">Números seleccionados</p>
              <p className="text-muted-foreground break-words">{selectedNumbersLabel}</p>
              <p className="mt-2 font-semibold text-foreground">
                Total: {formatCurrency(totalAmount)}
              </p>
            </div>

            {errorMessage && (
              <p className="text-sm font-medium text-destructive">
                {errorMessage}
              </p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Cancelar
                </Button>
              </DialogClose>

              <Button type="submit" disabled={isSubmitting || selectedCount === 0}>
                {isSubmitting ? "Registrando..." : "Confirmar compra"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </article>
  )
}
