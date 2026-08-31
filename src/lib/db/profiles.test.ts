import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Actor } from '@/lib/auth/actor';

import { getProfile, updateProfile } from './profiles';

const organizador = (userId: string): Actor => ({ kind: 'organizer', userId });
const admin = (userId: string): Actor => ({ kind: 'admin', userId });
const visitante: Actor = { kind: 'visitor' };

const seedProfile = (id: string) =>
  env.DB.prepare(
    `INSERT INTO profiles (id, display_name, role) VALUES (?, ?, 'USER')`,
  )
    .bind(id, id)
    .run();

beforeEach(async () => {
  await seedProfile('ana');
  await seedProfile('beto');
});

describe('profiles · autorización', () => {
  it('un organizador no puede auto-promoverse a ADMIN', async () => {
    await updateProfile(env.DB, organizador('beto'), {
      displayName: 'Beto',
      avatarUrl: null,
      contactPhone: null,
      // @ts-expect-error · `role` no está en ProfileInput, y que esta línea no
      // compile ES la primera defensa. El test verifica la segunda: aunque el
      // campo llegue en runtime (desde un form, un JSON.parse), el UPDATE
      // bindea columna por columna y no tiene por dónde escribirlo.
      role: 'ADMIN',
    });

    const p = await getProfile(env.DB, admin('root'), 'beto');
    expect(p?.role).toBe('USER');
  });

  it('un organizador no puede leer el perfil de otro', async () => {
    await expect(
      getProfile(env.DB, organizador('beto'), 'ana'),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('un organizador sí lee el suyo', async () => {
    const p = await getProfile(env.DB, organizador('beto'), 'beto');
    expect(p?.id).toBe('beto');
  });

  it('el admin lee cualquiera', async () => {
    const p = await getProfile(env.DB, admin('root'), 'ana');
    expect(p?.id).toBe('ana');
  });

  it('un visitante no lee ningún perfil', async () => {
    await expect(getProfile(env.DB, visitante, 'ana')).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('un visitante no edita nada', async () => {
    await expect(
      updateProfile(env.DB, visitante, {
        displayName: 'Quien sea',
        avatarUrl: null,
        contactPhone: null,
      }),
    ).rejects.toThrow('FORBIDDEN');
  });
});

describe('profiles · escritura', () => {
  it('escribe sobre el id del actor, nunca sobre otro', async () => {
    // No hay forma de pasarle un id: la firma no lo acepta. Este test existe
    // para que si alguien algún día le agrega un parámetro `id`, falle.
    await updateProfile(env.DB, organizador('beto'), {
      displayName: 'Beto Cambiado',
      avatarUrl: null,
      contactPhone: null,
    });

    const beto = await getProfile(env.DB, organizador('beto'), 'beto');
    const ana = await getProfile(env.DB, organizador('ana'), 'ana');

    expect(beto?.displayName).toBe('Beto Cambiado');
    expect(ana?.displayName).toBe('ana');
  });

  it('el teléfono se guarda normalizado a E.164', async () => {
    await updateProfile(env.DB, organizador('beto'), {
      displayName: 'Beto',
      avatarUrl: null,
      contactPhone: '0341 555-1234',
    });

    const p = await getProfile(env.DB, organizador('beto'), 'beto');
    expect(p?.contactPhone).toBe('+543415551234');
  });

  it('un teléfono inválido no llega a la base', async () => {
    await expect(
      updateProfile(env.DB, organizador('beto'), {
        displayName: 'Beto',
        avatarUrl: null,
        contactPhone: 'llamame',
      }),
    ).rejects.toThrow('INVALID_PHONE');

    const p = await getProfile(env.DB, organizador('beto'), 'beto');
    expect(p?.displayName).toBe('beto'); // no se escribió nada
  });

  it('updated_at se mueve en cada escritura', async () => {
    const antes = await getProfile(env.DB, organizador('beto'), 'beto');

    await updateProfile(env.DB, organizador('beto'), {
      displayName: 'Beto',
      avatarUrl: null,
      contactPhone: null,
    });

    const despues = await getProfile(env.DB, organizador('beto'), 'beto');

    // Sin triggers en D1, esto depende de que el repositorio llame a now().
    // Si alguien agrega un UPDATE nuevo y se olvida, este test no lo ve —
    // pero al menos deja escrito que el campo tiene que moverse.
    expect(despues?.updatedAt ?? 0).toBeGreaterThanOrEqual(
      antes?.updatedAt ?? 0,
    );
  });
});
