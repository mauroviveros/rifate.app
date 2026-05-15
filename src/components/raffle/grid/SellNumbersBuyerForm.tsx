import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Field } from "@/components/Field";
import { Button } from "@/components/shadcn/button";
import {
  DialogClose,
  DialogFooter,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Textarea } from "@/components/shadcn/textarea";
import {
  SellRaffleBuyerSchema,
  type SellRaffleBuyerInput,
} from "@/schemas/sellRaffleNumbers";
import { formatCurrency } from "@/lib/formatters";

type Props = {
  selectedNumbersLabel: string;
  selectedCount: number;
  totalAmount: number;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (buyer: SellRaffleBuyerInput) => Promise<boolean>;
};

export function SellNumbersBuyerForm({
  selectedNumbersLabel,
  selectedCount,
  totalAmount,
  isSubmitting,
  errorMessage,
  onSubmit,
}: Props) {
  const methods = useForm<SellRaffleBuyerInput>({
    mode: "onSubmit",
    reValidateMode: "onBlur",
    resolver: zodResolver(SellRaffleBuyerSchema),
    defaultValues: {
      name: "",
      phone: "",
      note: "",
    },
    disabled: isSubmitting,
  });

  const handleSubmit = methods.handleSubmit(async (data) => {
    const success = await onSubmit(data);
    if (success) {
      methods.reset();
    }
  });

  const totalLabel = useMemo(() => formatCurrency(totalAmount), [totalAmount]);

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <Field
        label="Nombre del comprador"
        htmlFor="buyer-name"
        required
        error={methods.formState.errors.name?.message}
      >
        <Input
          id="buyer-name"
          placeholder="Ej: Juan Pérez"
          aria-invalid={Boolean(methods.formState.errors.name)}
          {...methods.register("name")}
        />
      </Field>

      <Field
        label="Teléfono"
        htmlFor="buyer-phone"
        error={methods.formState.errors.phone?.message}
      >
        <Input
          id="buyer-phone"
          placeholder="Ej: 11 1234-5678"
          aria-invalid={Boolean(methods.formState.errors.phone)}
          {...methods.register("phone")}
        />
      </Field>

      <Field
        label="Nota"
        htmlFor="buyer-note"
        description="Información adicional opcional sobre esta compra."
        error={methods.formState.errors.note?.message}
      >
        <Textarea
          id="buyer-note"
          placeholder="Detalle adicional (opcional)"
          aria-invalid={Boolean(methods.formState.errors.note)}
          {...methods.register("note")}
        />
      </Field>

      <div className="rounded-xl border bg-muted/40 p-3 text-sm">
        <p className="font-semibold text-foreground">Números seleccionados</p>
        <p className="text-muted-foreground break-words">{selectedNumbersLabel}</p>
        <p className="mt-2 font-semibold text-foreground">
          Total: {totalLabel}
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
  );
}
