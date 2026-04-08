import type { VariantProps } from "class-variance-authority";
import {
  Field as FieldCN,
  FieldDescription,
  FieldError,
  FieldLabel,
  fieldVariants,
} from "@/components/shadcn/field";

type Props = {
  label: string;
  description?: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
} & React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants>;

export const Field = ({
  error,
  description,
  htmlFor,
  label,
  children,
  required,
  ...props
}: Props) => {
  return (
    <FieldCN {...props} data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={htmlFor} className="gap-0">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </FieldLabel>

      {children}

      {error ? <FieldError>{error}</FieldError> : description && <FieldDescription>{description}</FieldDescription>}
    </FieldCN>
  );
};
