import { RaffleBuyerSellSchema } from "@/schemas/raffle-buyer";
import { defineAction } from "astro:actions";

export default defineAction({
  accept: "json",
  input: RaffleBuyerSellSchema,
  handler: async (input, { cookies, request }) => {
    return { success: true, message: "Raffle numbers sold successfully" };
  }
})
