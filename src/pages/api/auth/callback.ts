import type { APIRoute } from "astro";
import { createServerClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/dashboard";

const toSafeInternalPath = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return DEFAULT_NEXT;
  return value;
};

export const GET = (async ({ cookies, request, url, redirect }) => {
  const code = url.searchParams.get("code");
  const next = toSafeInternalPath(url.searchParams.get("next"));

  if (!code) return redirect("/?error=missing_auth_code");

  const supabase = createServerClient({ cookies, request });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirect("/?error=auth_callback_failed");

  return redirect(next);
}) satisfies APIRoute;
