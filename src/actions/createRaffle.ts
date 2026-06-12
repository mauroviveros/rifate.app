import { ActionError, defineAction } from 'astro:actions';

import { createServerClient } from '@/lib/supabase/server';
import { RaffleSchema } from '@/schemas/raffle';

export default defineAction({
  accept: 'json',
  input: RaffleSchema,
  handler: async (input, { cookies, request, locals }) => {
    if (!locals.user) {
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'Debes iniciar sesión para crear una rifa',
      });
    }

    const supabase = createServerClient({ cookies, request });
    const { data, error } = await supabase
      .from('raffles')
      .insert({ ...input, owner_id: locals.user.id })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating raffle:', { error, raffle: input });
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error al crear la rifa',
      });
    }

    return data;
  },
});
