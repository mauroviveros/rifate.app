import { Form, FormProvider, useForm, type FormSubmitHandler } from "react-hook-form";
import { Field } from "../Field";
import { Input } from "@shadcn/input";
import { Textarea } from "@shadcn/textarea";
import { Button } from "@shadcn/button";

export function RaffleBuyerSellForm() {
  const methods = useForm({});
  const handleSubmit: FormSubmitHandler<any> = async () => {};

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
          // error={methods.formState.errors.title?.message}
        >
          <Input
            id="buyer.name"
            placeholder="Ej: Juan Pérez"
            // aria-invalid={!!methods.formState.errors.buyer.name}
            {...methods.register("buyer.name")}
          />
        </Field>

        <Field
          label="Teléfono"
          htmlFor="buyer.phone"
          // error={methods.formState.errors.title?.message}
        >
          <Input
            type="tel"
            id="buyer.phone"
            placeholder="Ej: 11 5142-3888"
            // aria-invalid={!!methods.formState.errors.buyer.phone}
            {...methods.register("buyer.phone")}
          />
        </Field>

        <Field
          label="Nota"
          htmlFor="buyer.note"
          // error={methods.formState.errors.title?.message}
        >
          <Textarea
            id="buyer.note"
            style={{ resize: "none" }}
            // aria-invalid={!!methods.formState.errors.buyer.phone}
            {...methods.register("buyer.note")}
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
