import type { APIRoute } from "astro";
import { createServerClient } from "@/lib/supabase/server";
import { buildLoginRedirect, toSafeInternalPath } from "@/lib/url";



export const POST = (async ({ cookies, request, url, redirect }) => {
  const supabase = createServerClient({ cookies, request});
  const formData = await request.formData();
  const callbackUrl = new URL("/api/auth/callback", url);
  const next = toSafeInternalPath(formData.get("next")?.toString() ?? null);
  callbackUrl.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (!error) return redirect(data.url);
  return redirect(buildLoginRedirect(url, { next, error: "google_signin_failed" }));
}) satisfies APIRoute;
