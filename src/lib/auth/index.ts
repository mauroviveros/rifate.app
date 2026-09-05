import { betterAuth } from 'better-auth';
import { D1Dialect } from 'kysely-d1';

export const createAuth = (env: Env) =>
  betterAuth({
    database: {
      dialect: new D1Dialect({ database: env.DB }),
      type: 'sqlite',
    },

    // Firma las cookies de sesión. Rotarlo cierra todas las sesiones.
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.PUBLIC_APP_URL,

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    // Sin email/password: una fricción menos para el organizador.
    emailAndPassword: { enabled: false },

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 días
      updateAge: 60 * 60 * 24, // 1 días
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutos
      },
    },

    // Better Auth activa rate limiting solo en producción, pero su storage por
    // defecto es "memory" — inútil en Workers: cada isolate tiene su propia
    // memoria, son efímeros y están repartidos en cientos de datacenters, así
    // que el límite terminaría siendo por isolate y no global. En D1 es real.
    rateLimit: { storage: 'database' },

    advanced: {
      // Cloudflare sirve todo por HTTPS: no hay motivo para aceptar cookies inseguras.
      useSecureCookies: true,
      defaultCookieAttributes: {
        sameSite: 'lax',
        secure: true,
      },
    },

    databaseHooks: {
      user: {
        // El hook `create` se ejecuta después de que el usuario se ha creado en la base de datos de Better Auth.
        create: {
          after: async (user) => {
            const now = Date.now();
            await env.DB.prepare(
              `
            INSERT INTO profiles (id, display_name, avatar_url, role, created_at, updated_at)
            VALUES (?, ?, ?, 'USER', ?, ?)
            ON CONFLICT (id) DO NOTHING
          `,
            )
              .bind(
                user.id,
                user.name || user.email.split('@')[0],
                user.image ?? null,
                now,
                now,
              )
              .run();
          },
        },
      },
    },
  });

export type Auth = ReturnType<typeof createAuth>;
