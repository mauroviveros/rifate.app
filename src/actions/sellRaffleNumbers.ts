import { createServerClient } from "@/lib/supabase/server";
import { SellRaffleNumbersSchema } from "@/schemas/sellRaffleNumbers";
import { ActionError, defineAction } from "astro:actions";

export default defineAction({
  accept: "json",
  input: SellRaffleNumbersSchema,
  handler: async (input, { cookies, request }) => {
    const supabase = createServerClient({ cookies, request });
    const selectedNumbers = [...new Set(input.numbers)].sort((a, b) => a - b);

    try {
      const { data: existingNumbers, error: existingNumbersError } = await supabase
        .from("raffle_numbers")
        .select("number, status")
        .eq("raffle_id", input.raffle_id)
        .in("number", selectedNumbers);

      if (existingNumbersError) {
        throw existingNumbersError;
      }

      const occupiedNumbers = (existingNumbers ?? [])
        .filter((entry) => entry.status !== "AVAILABLE")
        .map((entry) => entry.number)
        .sort((a, b) => a - b);

      if (occupiedNumbers.length > 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `Los siguientes números ya no están disponibles: ${occupiedNumbers.join(", ")}`,
        });
      }

      const { data: buyer, error: buyerError } = await supabase
        .from("raffle_buyers")
        .insert({
          raffle_id: input.raffle_id,
          name: input.buyer.name.trim(),
          phone: input.buyer.phone?.trim() || null,
          note: input.buyer.note?.trim() || null,
        })
        .select("id")
        .single();

      if (buyerError || !buyer) {
        throw buyerError ?? new Error("No se pudo crear el comprador");
      }

      const existingAvailableNumbers = (existingNumbers ?? [])
        .filter((entry) => entry.status === "AVAILABLE")
        .map((entry) => entry.number);

      if (existingAvailableNumbers.length > 0) {
        const { error: updateError } = await supabase
          .from("raffle_numbers")
          .update({
            buyer_id: buyer.id,
            status: "SOLD",
            updated_at: new Date().toISOString(),
          })
          .eq("raffle_id", input.raffle_id)
          .in("number", existingAvailableNumbers);

        if (updateError) {
          throw updateError;
        }
      }

      const missingNumbers = selectedNumbers.filter(
        (number) => !existingAvailableNumbers.includes(number),
      );

      if (missingNumbers.length > 0) {
        const { error: numbersError } = await supabase.from("raffle_numbers").insert(
          missingNumbers.map((number) => ({
            raffle_id: input.raffle_id,
            number,
            buyer_id: buyer.id,
            status: "SOLD",
          })),
        );

        if (numbersError) {
          throw numbersError;
        }
      }

      return {
        buyer_id: buyer.id,
        numbers: selectedNumbers,
      };
    } catch (error) {
      if (error instanceof ActionError) {
        throw error;
      }

      console.error("Error selling raffle numbers:", { error, input });
      throw new ActionError({
        code: "INTERNAL_SERVER_ERROR",
        message: "No se pudo registrar la compra.",
      });
    }
  },
});
