import { createServerClient as createSupabaseServerClient, parseCookieHeader } from "@supabase/ssr";
import type { Database } from "@/types";
import type { AstroCookies } from "astro";

const getSupabaseEnv = () => {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase env vars: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY");
  }

  return { url, anonKey };
};


export function createServerClient({ request, cookies }: { request: Request; cookies: AstroCookies }) {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "")
          .filter((cookie): cookie is { name: string; value: string } => typeof cookie.value === "string");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...options,
            maxAge: 60 * 60 * 24 * 7, // 1 week
          });
        });
      },
    },
  });
}
