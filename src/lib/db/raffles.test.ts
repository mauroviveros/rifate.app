import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Actor } from '@/lib/auth/actor';
import type { NewRaffle } from '@/types/raffle';

import {
  createRaffle,
  getOwnRaffle,
  getPublicRaffleBySlug,
  listOwnRaffles,
  markPublished,
  setContactPhone,
} from './raffles';

const organizador = (userId: string): Actor => ({ kind: 'organizer', userId });
const admin = (userId: string): Actor => ({ kind: 'admin', userId });
const visitante: Actor = { kind: 'visitor' };

const RIFA: NewRaffle = {
  title: 'Rifa del Club',
  description: null,
  prize: 'Una bici',
  ticketPrice: 250000, // $2.500,00 en centavos
  totalNumbers: 100,
  numberStart: 0,
  drawDate: '2026-12-24',
  contactPhone: '0341 555-1234',
};

const seedProfile = (id: string) =>
  env.DB.prepare(`INSERT INTO profiles (id, display_name) VALUES (?, ?)`)
    .bind(id, id)
    .run();

beforeEach(async () => {
  await seedProfile('ana');
  await seedProfile('beto');
});

describe('raffles · autorización', () => {
  it('el listado sólo trae las propias', async () => {
    await createRaffle(env.DB, organizador('ana'), RIFA);
    await createRaffle(env.DB, organizador('beto'), {
      ...RIFA,
      title: 'Rifa de Beto',
    });

    const deAna = await listOwnRaffles(env.DB, organizador('ana'));

    expect(deAna).toHaveLength(1);
    expect(deAna[0]?.title).toBe('Rifa del Club');
  });

  it('el listado trae el premio y el ganador que dibuja la tarjeta', async () => {
    // `toCard()` los descarta; el listado del panel usa `toListItem()`. Si
    // alguien vuelve a mapear con `toCard`, la bajada y el «Ganó el número…»
    // de la tarjeta se vacían en silencio: esto es lo que lo evita.
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);
    await env.DB.prepare(
      `UPDATE raffles SET winner_number = ?, winner_name = ? WHERE id = ?`,
    )
      .bind(7, 'Ana Ríos', id)
      .run();

    const [rifa] = await listOwnRaffles(env.DB, organizador('ana'));

    expect(rifa?.prize).toBe('Una bici');
    expect(rifa?.winnerNumber).toBe(7);
    expect(rifa?.winnerName).toBe('Ana Ríos');
  });

  it('un organizador no puede abrir la rifa de otro', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);

    await expect(getOwnRaffle(env.DB, organizador('beto'), id)).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('una rifa que no existe es NOT_FOUND, no FORBIDDEN', async () => {
    // Los dos caminos tienen que ser distinguibles: si "no existe" contestara
    // FORBIDDEN, un bug de propiedad se vería igual que un id mal escrito.
    await expect(
      getOwnRaffle(env.DB, organizador('ana'), 'no-existe'),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('un visitante no lista ni crea', async () => {
    await expect(listOwnRaffles(env.DB, visitante)).rejects.toThrow(
      'FORBIDDEN',
    );
    await expect(createRaffle(env.DB, visitante, RIFA)).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('un organizador no puede publicar la rifa de otro', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);

    await expect(
      markPublished(env.DB, organizador('beto'), id),
    ).rejects.toThrow('FORBIDDEN');

    // Y sobre todo: no la publicó. El UPDATE que no toca ninguna fila es el
    // modo de falla silencioso contra el que existe el chequeo de `changes`.
    const rifa = await getOwnRaffle(env.DB, organizador('ana'), id);
    expect(rifa.status).toBe('DRAFT');
  });
});

describe('raffles · superficie pública', () => {
  it('un borrador no se ve desde afuera', async () => {
    const { slug } = await createRaffle(env.DB, organizador('ana'), RIFA);

    expect(await getPublicRaffleBySlug(env.DB, visitante, slug)).toBeNull();
  });

  it('el dueño y el admin sí ven su borrador', async () => {
    const { slug } = await createRaffle(env.DB, organizador('ana'), RIFA);

    expect(
      await getPublicRaffleBySlug(env.DB, organizador('ana'), slug),
    ).not.toBeNull();
    expect(
      await getPublicRaffleBySlug(env.DB, admin('root'), slug),
    ).not.toBeNull();
  });

  it('una rifa ajena en borrador tampoco se ve', async () => {
    const { slug } = await createRaffle(env.DB, organizador('ana'), RIFA);

    expect(
      await getPublicRaffleBySlug(env.DB, organizador('beto'), slug),
    ).toBeNull();
  });

  it('publicada la ve cualquiera, y no expone al dueño', async () => {
    const { id, slug } = await createRaffle(env.DB, organizador('ana'), RIFA);
    await markPublished(env.DB, organizador('ana'), id);

    const publica = await getPublicRaffleBySlug(env.DB, visitante, slug);

    expect(publica?.title).toBe('Rifa del Club');
    // El tipo no tiene ownerId, así que esto es redundante contra el
    // compilador — y por eso mismo atrapa lo que el compilador no ve: un campo
    // que alguien sume al SELECT y se cuele por el mapeo.
    expect(JSON.stringify(publica)).not.toContain('ana');
  });
});

describe('raffles · escritura', () => {
  it('el dueño es el del actor, no algo que venga del input', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);

    const fila = await env.DB.prepare(
      'SELECT owner_id FROM raffles WHERE id = ?',
    )
      .bind(id)
      .first<{ owner_id: string }>();

    expect(fila?.owner_id).toBe('ana');
  });

  it('el teléfono se normaliza al crear', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);

    const rifa = await getOwnRaffle(env.DB, organizador('ana'), id);
    expect(rifa.contactPhone).toBe('+543415551234');
  });

  it('dos rifas con el mismo título no chocan de slug', async () => {
    const una = await createRaffle(env.DB, organizador('ana'), RIFA);
    const otra = await createRaffle(env.DB, organizador('ana'), RIFA);

    expect(una.slug).not.toBe(otra.slug);
  });

  it('publicar deja la marca de tiempo', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);
    await markPublished(env.DB, organizador('ana'), id);

    const rifa = await getOwnRaffle(env.DB, organizador('ana'), id);

    expect(rifa.status).toBe('PUBLISHED');
    expect(rifa.publishedAt).not.toBeNull();
  });

  it('no se publica dos veces', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);
    await markPublished(env.DB, organizador('ana'), id);

    // El WHERE exige status = 'DRAFT'. La segunda vez no toca ninguna fila.
    await expect(markPublished(env.DB, organizador('ana'), id)).rejects.toThrow(
      'FORBIDDEN',
    );
  });
});

describe('setContactPhone', () => {
  it('carga y normaliza el teléfono de un borrador sin teléfono', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), {
      ...RIFA,
      contactPhone: null,
    });

    await setContactPhone(env.DB, organizador('ana'), id, '0341 555-9999');

    const rifa = await getOwnRaffle(env.DB, organizador('ana'), id);
    expect(rifa.contactPhone).toBe('+543415559999');
  });

  it('una rifa ajena se niega', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);

    await expect(
      setContactPhone(env.DB, organizador('beto'), id, '341 555 9999'),
    ).rejects.toThrow('FORBIDDEN');
  });
});
