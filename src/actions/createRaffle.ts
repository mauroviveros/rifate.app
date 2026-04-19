import { createServerClient } from "@/lib/supabase/server";
import { RaffleSchema } from "@/schemas/raffle";
import { ActionError, defineAction } from "astro:actions";
import z from "zod";

export default defineAction({
  accept: "json",
  input: RaffleSchema,
  handler: async (input, { cookies, request }) => {
    const supabase = createServerClient({ cookies, request });
    try{
      const { data, error } = await supabase.from("raffles").insert(input).select('id').single();
      if(error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating raffle:", {error, raffle: input});
      if(error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Error al crear la rifa' });
    }
  }
})
