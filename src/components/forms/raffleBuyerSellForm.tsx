import { Form, FormProvider, useForm, type FormSubmitHandler } from "react-hook-form";
import { Field } from "../ui/Field";
import { Input } from "@shadcn/input";
import { Textarea } from "@shadcn/textarea";
import { Button } from "@shadcn/button";
import { RaffleBuyerSellSchema, type RaffleBuyerSellInput } from "@/schemas/raffle-buyer";
import type { Tables } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { actions } from "astro:actions";

export function RaffleBuyerSellForm(
  {
    raffle_id,
    numbers
  }: {
    raffle_id: Tables<'raffles'>["id"],
    numbers: Tables<'raffle_numbers'>["number"][],
  }
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const methods = useForm<RaffleBuyerSellInput>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(RaffleBuyerSellSchema as never),
    disabled: isSubmitting,
    defaultValues: {
      raffle_id,
      numbers,
      name: "",
      phone: "",
      note: "",
    },
  });

  const handleSubmit: FormSubmitHandler<RaffleBuyerSellInput> = async ({ data }) => {
    setIsSubmitting(true);

    try {
      const { error, data:dataRes } = await actions.sellRaffleNumbers(data)
    } catch (error) {
      console.error("Error selling raffle numbers:", error);
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
        >
          Confirmar venta
        </Button>
      </Form>
    </FormProvider>
  )
}
