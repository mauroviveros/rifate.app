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

    locals.user = result?.user
      ? {
          name: result.user.name,
          email: result.user.email,
          image: result.user.image ?? null,
        }
      : null;

    // El `(\/|$)` no es adorno: sin él `/^\/panel/` también da verdadero para
    // `/panelazo`, y una ruta pública que empiece igual entraría a pedir sesión.
    const protegida = /^\/(panel|administracion)(\/|$)/.test(url.pathname);
    if (protegida && locals.actor.kind === 'visitor') {
      return redirect(`/ingresar?next=${encodeURIComponent(url.pathname)}`);
    }

    if (url.pathname.startsWith('/administracion') && !isAdmin(locals.actor)) {
      return new Response('No encontrado', { status: 404 });
    }

    return next();
  },
);
