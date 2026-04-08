import type { APIRoute } from "astro";
import { createServerClient } from "@/lib/supabase/server";
import { buildLoginRedirect, toSafeInternalPath } from "@/lib/url";


export const GET = (async ({ cookies, request, url, redirect }) => {
  const code = url.searchParams.get("code");
  const next = toSafeInternalPath(url.searchParams.get("next"));

  if (!code) return redirect(buildLoginRedirect(url, { next, error: "missing_auth_code" }));

  const supabase = createServerClient({ cookies, request });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirect(buildLoginRedirect(url, { next, error: "auth_callback_failed" }));

  return redirect(next);
}) satisfies APIRoute;
