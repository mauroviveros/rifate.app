import { ActionError, defineAction } from 'astro:actions';

import { createServerClient } from '@/lib/supabase/server';
import { SellRaffleNumbersSchema } from '@/schemas/raffle-buyer';

export default defineAction({
  accept: 'json',
  input: SellRaffleNumbersSchema,
  handler: async (input, { cookies, request, locals }) => {
    if (!locals.user) {
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'Debes iniciar sesión para vender números',
      });
    }

    const supabase = createServerClient({ cookies, request });

    // Guard: verificar ownership de la rifa
    const { data: raffle } = await supabase
      .from('raffles')
      .select('owner_id')
      .eq('id', input.raffle_id)
      .single();

    if (!raffle || raffle.owner_id !== locals.user.id) {
      throw new ActionError({
        code: 'FORBIDDEN',
        message: 'No tenés permiso para vender números en esta rifa',
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

    if (numbersError) {
      await supabase.from('raffle_buyers').delete().eq('id', buyer.id);

      if (numbersError.code === '23505') {
        throw new ActionError({
          code: 'CONFLICT',
          message: 'Uno o más números ya no están disponibles',
        });
      }

      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error al asignar los números',
      });
    }

    return { success: true, buyer_id: buyer.id };
  },
});
