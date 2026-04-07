import type { APIRoute } from "astro";
import { createServerClient } from "@/lib/supabase/server";

export const GET = (async ({ cookies, request, url, redirect }) => {
  const code = url.searchParams.get("code");
  if (!code) return redirect("/?error=missing_auth_code");

  const supabase = createServerClient({ cookies, request });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirect("/?error=auth_callback_failed");

  return redirect("/dashboard");
}) satisfies APIRoute;
