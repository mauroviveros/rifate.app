import { ActionError, defineAction } from 'astro:actions';

import { createServerClient } from '@/lib/supabase/server';
import { SellRaffleNumbersSchema } from '@/schemas/raffle-buyer';

export default defineAction({
  accept: 'json',
  input: SellRaffleNumbersSchema,
  handler: async (input, { cookies, request }) => {
    const supabase = createServerClient({ cookies, request });

    // Guard: verificar que los números no estén ya vendidos (evitar race conditions)
    const { data: soldNumbers } = await supabase
      .from('raffle_numbers')
      .select('number')
      .eq('raffle_id', input.raffle_id)
      .in('number', input.numbers)
      .neq('status', 'AVAILABLE');

    if (soldNumbers && soldNumbers.length > 0) {
      throw new ActionError({
        code: 'CONFLICT',
        message: `Los números ${soldNumbers.map((n) => n.number).join(', ')} ya no están disponibles`,
      });
    }

    const { data: buyer, error: buyerError } = await supabase
      .from('raffle_buyers')
      .insert({
        raffle_id: input.raffle_id,
        name: input.name,
        phone: input.phone ?? null,
        note: input.note ?? null,
      })
      .select('id')
      .single();

    if (buyerError || !buyer) {
      console.error('Error creating buyer:', buyerError);
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error al crear el comprador',
      });
    }

    const numbersToInsert = input.numbers.map((number) => ({
      raffle_id: input.raffle_id,
      number,
      buyer_id: buyer.id,
      status: 'SOLD' as const,
    }));

    const { error: numbersError } = await supabase
      .from('raffle_numbers')
      .insert(numbersToInsert);

    // Rollback: eliminar buyer huérfano si falla la inserción de números
    if (numbersError) {
      console.error('Error assigning numbers:', numbersError);
      await supabase.from('raffle_buyers').delete().eq('id', buyer.id);
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error al asignar los números',
      });
    }

    return { success: true, buyer_id: buyer.id };
  },
});
