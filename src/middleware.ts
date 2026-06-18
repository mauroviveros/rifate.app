import { defineMiddleware } from 'astro:middleware';

import { createServerClient } from '@/lib/supabase/server';

const REGEX_PROTECTED_PATHS = [/^\/dashboard.*/];
const REDIRECT_PATH = '/login';

const isProtectedPath = (path: string) =>
  REGEX_PROTECTED_PATHS.some((regex) => regex.test(path));

export const onRequest = defineMiddleware(
  async ({ cookies, request, url, locals, redirect }, next) => {
    const supabase = createServerClient({ cookies, request });
    const { data } = await supabase.auth.getUser();

    locals.user = data.user ?? null;

    if (isProtectedPath(url.pathname) && !data.user) {
      const redirect_url = new URL(REDIRECT_PATH, url);
      redirect_url.searchParams.set('next', `${url.pathname}${url.search}`);
      return redirect(redirect_url.toString());
    }

    return next();
  },
);
