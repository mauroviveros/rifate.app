import { Form, FormProvider, useForm, type FormSubmitHandler } from "react-hook-form";
import { Field } from "../ui/Field";
import { Input } from "@shadcn/input";
import { Textarea } from "@shadcn/textarea";
import { Button } from "@shadcn/button";
import { SellRaffleNumbersSchema, type SellRaffleNumbersInput } from "@/schemas/raffle-buyer";
import type { Tables } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { actions } from "astro:actions";

export function RaffleBuyerSellForm(
  {
    raffle_id,
    numbers,
    onSuccess,
  }: {
    raffle_id: Tables<'raffles'>["id"],
    numbers: Tables<'raffle_numbers'>["number"][],
    onSuccess?: () => void,
  }
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const methods = useForm<SellRaffleNumbersInput>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(SellRaffleNumbersSchema),
    disabled: isSubmitting,
    defaultValues: {
      raffle_id,
      numbers,
      name: "",
      phone: "",
      note: "",
    },
  });

  // Si el action devuelve error (conflicto, server error) se muestra en el formulario.
  // Si hay una excepción inesperada (error de red, etc.) se captura aparte.
  const handleSubmit: FormSubmitHandler<SellRaffleNumbersInput> = async ({ data }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await actions.sellRaffleNumbers(data);
      if (error) setError(error.message);
      else onSuccess?.();
    } catch {
      setError("Ocurrió un error inesperado. Intentalo nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <Form
        control={methods.control}
        onSubmit={handleSubmit}
        className="space-y-3"
      >
        {error && (
          <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <Field
          label="Nombre"
          htmlFor="buyer.name"
          required
          error={methods.formState.errors.name?.message}
        >
          <Input
            id="buyer.name"
            placeholder="Ej: Juan Pérez"
            aria-invalid={!!methods.formState.errors.name}
            {...methods.register("name")}
          />
        </Field>

        <Field
          label="Teléfono"
          htmlFor="buyer.phone"
          error={methods.formState.errors.phone?.message}
        >
          <Input
            type="tel"
            id="buyer.phone"
            placeholder="Ej: 11 5142-3888"
            aria-invalid={!!methods.formState.errors.phone}
            {...methods.register("phone")}
          />
        </Field>

        <Field
          label="Nota"
          htmlFor="buyer.note"
          error={methods.formState.errors.note?.message}
        >
          <Textarea
            id="buyer.note"
            style={{ resize: "none" }}
            aria-invalid={!!methods.formState.errors.note}
            {...methods.register("note")}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-xl h-12 font-bold text-base"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Vendiendo..." : "Confirmar venta"}
        </Button>
      </Form>
    </FormProvider>
  )
}
