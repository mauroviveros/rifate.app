import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormProvider, useForm, type FormSubmitHandler } from "react-hook-form";
import { Button } from "@shadcn/button";
import { Card, CardContent } from "@shadcn/card";
import { RaffleSchema, type RaffleInput } from "@/schemas/raffle";
import { Input } from "@shadcn/input";
import { Textarea } from "@shadcn/textarea";
import { Field } from "@/components/Field";
import { ActionError, actions } from "astro:actions";

export type RafflePreviewState = Pick<RaffleInput, "price" | "total_numbers">;

interface RaffleFormComponentProps {
  owner_id: string;
  price?: number;
  total_numbers?: number;
  onPreviewChange?: (state: RafflePreviewState) => void;
}

export function RaffleFormComponent({ owner_id, price, total_numbers, onPreviewChange }: RaffleFormComponentProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ActionError | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const defaultDrawDate = (() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 2);
    return date.toISOString().split("T")[0];
  })();

  const methods = useForm<RaffleInput>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(RaffleSchema),
    disabled: isSubmitting,
    defaultValues: {
      owner_id: owner_id,
      title: "",
      description: "",
      price: price ?? 0,
      total_numbers: total_numbers ?? 100,
      draw_date: defaultDrawDate,
    },
  });

  const handleSubmit: FormSubmitHandler<RaffleInput> = async ({ data }) => {
    setIsSubmitting(true);
    setErrors(null);

    try {
      const { error } = await actions.createRaffle(data)
      if(error){
        setErrors(error);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.assign(`/dashboard/raffle`);
      }
    } catch (error) {
      setErrors({ message: 'Ocurrio un error inesperado. Intentalo nuevamente.' } as ActionError);
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    const subscription = methods.watch((values: Partial<RaffleInput>) => {
      onPreviewChange?.({
        price: values.price ?? 0,
        total_numbers: values.total_numbers ?? 0,
      });
    });

    return () => subscription.unsubscribe();
  }, [methods, onPreviewChange]);

  return (
    <Card>
      <CardContent className="pt-0">
        <FormProvider {...methods}>
          <Form
            control={methods.control}
            onSubmit={handleSubmit}
            className="space-y-3"
          >
            <Field
              label="Título"
              htmlFor="raffle-title"
              required
              error={methods.formState.errors.title?.message}
            >
              <Input
                id="raffle-title"
                placeholder="Ej: Rifa del barrio - TV 50 pulgadas"
                aria-invalid={!!methods.formState.errors.title}
                {...methods.register("title")}
              />
            </Field>

            <Field
              label="Descripción"
              htmlFor="raffle-description"
              description="Información sobre el premio y detalles de la rifa"
              error={methods.formState.errors.description?.message}
            >
              <Textarea
                id="raffle-description"
                placeholder="Describe tu rifa (opcional)"
                aria-invalid={!!methods.formState.errors.description}
                {...methods.register("description")}
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field
                label="Precio por número (ARS)"
                htmlFor="raffle-price"
                required
                error={methods.formState.errors.price?.message}
              >
                <Input
                  id="raffle-price"
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  max="1000000"
                  aria-invalid={!!methods.formState.errors.price}
                  {...methods.register("price", {
                    setValueAs: (value) => (value === "" ? undefined : Number(value)),
                  })}
                />
              </Field>

              <Field
                label="Cantidad de números"
                htmlFor="raffle-total_numbers"
                required
                error={methods.formState.errors.total_numbers?.message}
              >
                <Input
                  id="raffle-total_numbers"
                  type="number"
                  placeholder="Ej: 100"
                  min="1"
                  step="1"
                  max="1000"
                  aria-invalid={!!methods.formState.errors.total_numbers}
                  {...methods.register("total_numbers", {
                    setValueAs: (value) => (value === "" ? undefined : Number(value)),
                  })}
                />
              </Field>
            </div>

            <Field
              label="Fecha del sorteo"
              htmlFor="raffle-draw_date"
              error={methods.formState.errors.draw_date?.message}
            >
              <Input
                id="raffle-draw_date"
                type="date"
                min={today}
                aria-invalid={!!methods.formState.errors.draw_date}
                {...methods.register("draw_date")}
              />
            </Field>

            <Button
              type="submit"
              className="w-full rounded-3xl h-12 font-bold text-base"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creando rifa..." : "Crear rifa"}
            </Button>

          </Form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}
