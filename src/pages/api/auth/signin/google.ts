import type { APIRoute } from "astro";
import { createServerClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/dashboard";
export const POST = (async ({ cookies, request, url, redirect }) => {
  const supabase = createServerClient({ cookies, request});
  const formData = await request.formData();
  const callbackUrl = new URL("/api/auth/callback", url);
  const next = formData.get("next")?.toString() || DEFAULT_NEXT;
  callbackUrl.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error || !data.url) {
    return new Response("Unable to start Google sign-in", { status: 500 });
  }

  return redirect(data.url);
}) satisfies APIRoute;
