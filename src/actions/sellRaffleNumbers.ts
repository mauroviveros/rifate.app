import { ActionError, defineAction } from 'astro:actions';

import { getRaffleOwnerId, sellRaffleNumbers } from '@/lib/repositories/raffle';
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

    // Solo el dueño de la rifa puede vender sus números.
    const ownerId = await getRaffleOwnerId(supabase, input.raffle_id);
    if (!ownerId || ownerId !== locals.user.id) {
      throw new ActionError({
        code: 'FORBIDDEN',
        message: 'No tenés permiso para vender números en esta rifa',
      });
    }

    const result = await sellRaffleNumbers(supabase, {
      raffleId: input.raffle_id,
      buyer: { name: input.name, phone: input.phone, note: input.note },
      numbers: input.numbers,
    });

    if (!result.ok) {
      if (result.reason === 'conflict') {
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

    return { success: true, buyer_id: result.buyerId };
  },
});
