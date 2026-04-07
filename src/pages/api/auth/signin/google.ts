import type { APIRoute } from "astro";
import { createServerClient } from "@/lib/supabase/server";

export const POST = (async ({ cookies, request, url, redirect }) => {
  const supabase = createServerClient({ cookies, request});
  const redirectTo = new URL("/api/auth/callback", url).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    return new Response("Unable to start Google sign-in", { status: 500 });
  }

  return redirect(data.url);
}) satisfies APIRoute;
