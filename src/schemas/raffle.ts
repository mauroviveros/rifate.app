import { formatCurrency } from "@/lib/formatters";
import { z } from "zod";

export const RaffleSchema = z.object({
  title: z
    .string()
    .min(3, "El título debe tener al menos 3 caracteres.")
    .max(100, "El título no puede tener más de 100 caracteres."),
  description: z
    .string()
    .max(500, "La descripción no puede tener más de 500 caracteres.")
    .optional(),
  price: z
    .number({ error: "El precio es requerido" })
    .min(0.01, `El precio debe ser mayor a ${formatCurrency(0)}`)
    .max(1000000, `El precio no puede superar ${formatCurrency(1000000)}`),
  total_numbers: z
    .number({ error: "La cantidad de números es requerida" })
    .min(1, "El número total de boletos debe ser mayor a 0")
    .max(10000, "El número total de boletos no puede superar 10,000"),
  draw_date: z.iso.date(),
  owner_id: z
    .uuid(),
});

export type RaffleInput = z.infer<typeof RaffleSchema>;
