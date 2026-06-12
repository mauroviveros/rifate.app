import { z } from 'astro/zod';

export const SellRaffleNumbersSchema = z.object({
  raffle_id: z.uuid(),
  numbers: z
    .array(z.number().int().min(0))
    .min(1, 'Selecciona al menos un número'),
  name: z.string().min(1, 'El nombre es requerido').max(100),
  phone: z.string().max(20).optional(),
  note: z.string().max(500).optional(),
});

export type SellRaffleNumbersInput = z.infer<typeof SellRaffleNumbersSchema>;
