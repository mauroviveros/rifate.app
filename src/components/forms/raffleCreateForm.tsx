import { Form, FormProvider, useForm, type FormSubmitHandler } from "react-hook-form";

export function raffleCreateForm(){
  const methods = useForm({});
  const handleSubmit: FormSubmitHandler<any> = async () => {};

  return (
    <FormProvider {...methods}>
      <Form
        control={methods.control}
        onSubmit={handleSubmit}
        className="space-y-3"
      ></Form>
    </FormProvider>
  )
}
