import type { APIRoute } from "astro";
import { createServerClient } from "@/lib/supabase/server";

export const POST = (async ({ cookies, request, redirect }) => {
  const supabase = createServerClient({ cookies, request });
  await supabase.auth.signOut();
  return redirect("/");
}) satisfies APIRoute;
