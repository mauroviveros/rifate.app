import type { APIRoute } from "astro";
import { createServerClient } from "@/lib/supabase/server";
import { HOME_PATH } from "@/lib/url";

export const POST = (async ({ cookies, request, redirect }) => {
  const supabase = createServerClient({ cookies, request });
  await supabase.auth.signOut();
  return redirect(HOME_PATH);
}) satisfies APIRoute;
