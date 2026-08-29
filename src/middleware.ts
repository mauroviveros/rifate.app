import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';

import { createAuth } from './lib/auth';
import { actorFromSession, isAdmin } from './lib/auth/actor';

export const onRequest = defineMiddleware(
  async ({ request, locals, url, redirect }, next) => {
    const result = await createAuth(env).api.getSession({
      headers: request.headers,
    });

    locals.actor = await actorFromSession(env.DB, result?.session ?? null);

    const protegida = /^\/dashboard|^\/admin/.test(url.pathname);
    if (protegida && locals.actor.kind === 'visitor') {
      return redirect(`/login?next=${encodeURIComponent(url.pathname)}`);
    }

    if (url.pathname.startsWith('/admin') && !isAdmin(locals.actor)) {
      return new Response('No encontrado', { status: 404 });
    }

    return next();
  },
);
