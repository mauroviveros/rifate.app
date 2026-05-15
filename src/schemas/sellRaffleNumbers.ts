import { z } from "zod";

export const SellRaffleNumbersSchema = z.object({
  raffle_id: z.uuid("ID de rifa inválido"),
  buyer: z.object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(120, "El nombre no puede superar los 120 caracteres"),
    phone: z
      .string()
      .trim()
      .max(50, "El teléfono no puede superar los 50 caracteres")
      .optional(),
    note: z
      .string()
      .trim()
      .max(250, "La nota no puede superar los 250 caracteres")
      .optional(),
  }),
  numbers: z
    .array(
      z
        .number()
        .int("Cada número debe ser entero")
        .min(0, "No se permiten números negativos"),
    )
    .min(1, "Debes seleccionar al menos un número")
    .max(1000, "No puedes vender más de 1000 números por operación")
    .refine((numbers) => new Set(numbers).size === numbers.length, {
      message: "No se pueden repetir números en la misma compra",
    }),
});

export type SellRaffleNumbersInput = z.infer<typeof SellRaffleNumbersSchema>;
