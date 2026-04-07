import { defineMiddleware } from "astro:middleware";
import { createServerClient } from "@/lib/supabase/server";

const REGEX_PROTECTED_PATHS = [/^\/dashboard.*/];
const REDIRECT_PATH = "/login";

const shouldSkipAuth = (path: string) => {
  const isPathProtected = REGEX_PROTECTED_PATHS.some(regex => regex.test(path));
  return !isPathProtected;
}

export const onRequest = defineMiddleware(async ({cookies, request, url, locals, redirect}, next) => {
  if (shouldSkipAuth(url.pathname)) return next();

  const supabase = createServerClient({ cookies, request });
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const redirect_url = new URL(REDIRECT_PATH, url);
    redirect_url.searchParams.set("next", `${url.pathname}${url.search}`);
    return redirect(redirect_url.toString());
  }

  locals.user = data.user;
  return next();
});
