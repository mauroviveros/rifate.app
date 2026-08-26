# 10 · Better Auth sobre D1

> Reemplaza a Supabase Auth. Es la pieza de mayor consecuencia si sale mal:
> pasás a ser dueño de las sesiones, las cookies, el callback de OAuth y el CSRF.
>
> **Verificá contra la documentación oficial** antes de tipear:
> https://better-auth.com/docs — no pude alcanzar el registry completo al
> escribir esto, así que las versiones están confirmadas pero la forma exacta de
> algunas opciones puede haber cambiado.

## Versiones confirmadas

```
better-auth        1.7.1
@better-auth/cli   1.4.21
kysely             0.29.5
kysely-d1          0.4.0
```

Better Auth habla SQL a través de **Kysely**, y `kysely-d1` es el dialecto que
lo conecta al binding de D1. No hace falta ORM.

> Existe un paquete `better-auth-cloudflare` (0.3.1) que envuelve esto. Es de la
> comunidad y está en versión 0.x: preferí el camino directo con `kysely-d1`,
> que tiene menos capas y menos que romperse.

---

## ⚠️ La trampa principal: la instancia va por request

En Node creás el objeto `auth` una vez, al importar el módulo. **En Workers eso
no se puede**: el binding de D1 no existe a nivel de módulo, sólo dentro de un
request.

```ts
// ⛔ MAL — env no existe todavía. Rompe en runtime, no en build.
export const auth = betterAuth({ database: new D1Dialect({ database: env.DB }) });

// ✅ BIEN — se construye con el env de cada request.
export const createAuth = (env: Env) => betterAuth({ ... });
```

Es el error número uno al portar cualquier librería de Node a Workers, y el
mensaje que tira no ayuda nada.

Construir la instancia es barato (no abre conexiones), así que hacerlo por
request no tiene costo real.

---

## 1 · Instalación

```bash
pnpm add better-auth kysely kysely-d1
pnpm add -D @better-auth/cli
```

## 2 · La configuración

```ts
// src/lib/auth/index.ts
import { betterAuth } from 'better-auth';
import { D1Dialect } from 'kysely-d1';

export const createAuth = (env: Env) =>
  betterAuth({
    database: { dialect: new D1Dialect({ database: env.DB }), type: 'sqlite' },

    // Firma las cookies de sesión. Rotarlo cierra todas las sesiones.
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.PUBLIC_APP_URL,          // https://rifate.app

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    // Sin email/password: el registro es sólo con Google. Una vía menos que
    // asegurar, y una fricción menos para el organizador.
    emailAndPassword: { enabled: false },

    session: {
      expiresIn: 60 * 60 * 24 * 30,       // 30 días
      updateAge: 60 * 60 * 24,            // refresca si pasó un día
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },

    advanced: {
      // Cloudflare sirve todo por HTTPS: no hay motivo para aceptar cookies
      // inseguras ni siquiera en preview.
      useSecureCookies: true,
      defaultCookieAttributes: { sameSite: 'lax', secure: true },
    },

    databaseHooks: {
      user: {
        create: {
          // Reemplaza al trigger on_auth_user_created de Postgres: alguien
          // tiene que crear la fila de `profiles` cuando nace el usuario.
          after: async (user) => {
            const ahora = Date.now();
            await env.DB.prepare(
              `INSERT INTO profiles (id, display_name, avatar_url, role, created_at, updated_at)
               VALUES (?, ?, ?, 'USER', ?, ?)
               ON CONFLICT (id) DO NOTHING`,
            ).bind(
              user.id,
              user.name || user.email.split('@')[0],
              user.image ?? null,
              ahora,
              ahora,
            ).run();
          },
        },
      },
    },
  });

export type Auth = ReturnType<typeof createAuth>;
```

> **`profiles` es nuestro, `user` es de Better Auth.** No se mezclan: la tabla
> `user` la maneja la librería y no se toca a mano; `profiles` guarda lo que la
> app necesita (rol, teléfono de contacto). El hook las mantiene alineadas.

## 3 · Generar el esquema

La CLI produce las tablas `user`, `session`, `account` y `verification`:

```bash
npx @better-auth/cli generate --output migrations/0001_better_auth.sql
```

> **Ese archivo no se edita a mano.** Es esquema de librería. Si Better Auth
> cambia su modelo, se regenera y se aplica como una migración más.

Se aplica junto con las nuestras:

```bash
npx wrangler d1 migrations apply rifate-db --local
npx wrangler d1 migrations apply rifate-db --remote
```

## 4 · La ruta que atiende todo

Better Auth expone un handler único. En Astro va como catch-all:

```ts
// src/pages/api/auth/[...all].ts
import type { APIRoute } from 'astro';

import { createAuth } from '@/lib/auth';

export const prerender = false;

const handler: APIRoute = ({ request, locals }) =>
  createAuth(locals.runtime.env).handler(request);

export const GET = handler;
export const POST = handler;
```

Eso reemplaza las tres rutas que tenías en v1 (`callback.ts`, `logout.ts`,
`signin/google.ts`).

## 5 · El middleware

Es donde se conecta con la capa de autorización de [04](./04-rls-y-roles.md):

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

import { actorFromSession, isAdmin } from '@/lib/auth/actor';
import { createAuth } from '@/lib/auth';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const env = ctx.locals.runtime.env;

  const session = await createAuth(env).api.getSession({
    headers: ctx.request.headers,
  });

  ctx.locals.actor = await actorFromSession(env.DB, session?.user ?? null);

  const protegida = /^\/dashboard|^\/admin/.test(ctx.url.pathname);
  if (protegida && ctx.locals.actor.kind === 'visitor') {
    return ctx.redirect(`/login?next=${encodeURIComponent(ctx.url.pathname)}`);
  }

  if (ctx.url.pathname.startsWith('/admin') && !isAdmin(ctx.locals.actor)) {
    return new Response('No encontrado', { status: 404 });
  }

  return next();
});
```

Y los tipos:

```ts
// src/env.d.ts
/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    actor: import('@/lib/auth/actor').Actor;
  }
}
```

> **Notá que `locals` guarda `actor`, no `user`.** Es deliberado: las páginas no
> deberían poder olvidarse de que hay un actor con permisos. Si lo que tenés a
> mano es un `user`, es fácil escribir una consulta sin filtrar; si es un
> `Actor`, la firma de los repositorios te obliga a pasarlo.

## 6 · El botón de login

```astro
---
// src/pages/login.astro
const next = Astro.url.searchParams.get('next') ?? '/dashboard/raffle';
---
<form method="POST" action="/api/auth/sign-in/social">
  <input type="hidden" name="provider" value="google" />
  <input type="hidden" name="callbackURL" value={next} />
  <button type="submit">Entrar con Google</button>
</form>
```

> **Verificá el nombre exacto de la ruta y de los campos** contra la doc de
> Better Auth para la 1.7 — es lo que más cambia entre versiones. Si preferís, el
> cliente oficial (`better-auth/client`) expone `signIn.social({ provider })` y
> te ahorra adivinar, a costa de mandar JS al cliente.

---

## 7 · Secrets y configuración externa

```bash
# Un valor aleatorio largo. Rotarlo cierra todas las sesiones abiertas.
openssl rand -base64 32

npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Para desarrollo, los mismos nombres en `.dev.vars` (que ya está en `.gitignore`).

En **Google Cloud Console → Credentials → OAuth 2.0 Client ID**, las URIs de
redirección autorizadas:

```
http://localhost:8787/api/auth/callback/google
https://rifate-app.<tu-subdominio>.workers.dev/api/auth/callback/google
https://rifate.app/api/auth/callback/google
```

> Las tres. Olvidarse de la de producción es el error que aparece justo el día
> del lanzamiento.

---

## Gotchas

| Síntoma | Causa |
|---|---|
| `env is not defined` al importar `auth` | Creaste la instancia a nivel de módulo. Va por request |
| `no such table: user` | Falta correr `d1 migrations apply` |
| El login redirige y vuelve sin sesión | `baseURL` no coincide con el dominio real |
| `redirect_uri_mismatch` de Google | Falta esa URI exacta en Google Cloud Console |
| Sesión que no persiste en local | `useSecureCookies: true` sobre `http://`. Usá `wrangler dev` (que sirve por localhost) o condicioná el flag |
| `Cannot find module 'node:crypto'` | Falta `nodejs_compat` en `compatibility_flags` |
| El perfil no existe después de registrarse | El `databaseHooks.user.create.after` falló en silencio |

> El último es el más traicionero: si el hook tira error, el usuario queda creado
> en `user` pero sin fila en `profiles`, y todo lo que dependa del rol rompe.
> Vale la pena que `actorFromSession` trate "perfil ausente" como visitante y lo
> loguee, en vez de asumir que siempre está.

---

## Lo que hay que testear

Igual que en [04](./04-rls-y-roles.md), lo que importa es la denegación:

- [ ] Sin sesión, `/dashboard` redirige a `/login`
- [ ] Sin sesión, `/admin` devuelve **404**
- [ ] Con sesión de `USER`, `/admin` devuelve **404**
- [ ] Al registrarse se crea la fila en `profiles` con `role = 'USER'`
- [ ] Una sesión vencida se trata como visitante
- [ ] `actorFromSession` con perfil ausente devuelve `visitor`, no rompe
