import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Raffle } from '@/do/raffle';
import { getMeta, type MetaKey } from '@/do/schema';
import type { Actor } from '@/lib/auth/actor';
import type { NewRaffle } from '@/types/raffle';

import {
  createRaffleWithGrid,
  ownerGrid,
  publishRaffle,
  releaseNumbers,
  sellNumbers,
  updateRaffleDetails,
} from './flows';

/**
 * ⚠️ Acá NO hay tests de negación sobre `sellNumbers` / `releaseNumbers`, y no
 * es un olvido: esos dos niegan adentro del Durable Object, y toda excepción
 * que cruza el límite RPC queda registrada como "unhandled rejection" en
 * `@cloudflare/vitest-pool-workers@0.22` aunque el test la capture — la suite
 * termina en verde y el proceso en error. Está explicado en `do/raffle.test.ts`,
 * donde esas negaciones sí se prueban, sin RPC en el medio.
 *
 * Lo que sí se prueba acá es lo que el DO no puede probar solo: que la negación
 * de las rifas ajenas pasa en D1, ANTES de despertar el objeto.
 */

const organizer = (userId: string): Actor => ({ kind: 'organizer', userId });
const visitor: Actor = { kind: 'visitor' };

const NEW_RAFFLE: NewRaffle = {
  title: 'Rifa del Club',
  description: null,
  prize: 'Una bici',
  ticketPrice: 250000,
  totalNumbers: 100,
  numberStart: 1,
  drawDate: '2026-12-24',
  contactPhone: '0341 555-1234',
};

const WITHOUT_PHONE: NewRaffle = { ...NEW_RAFFLE, contactPhone: null };

const seedProfile = (id: string) =>
  env.DB.prepare(`INSERT INTO profiles (id, display_name) VALUES (?, ?)`)
    .bind(id, id)
    .run();

const createFor = (userId: string, input = NEW_RAFFLE) =>
  createRaffleWithGrid(env.DB, env.RAFFLE, organizer(userId), input);

/** Lee la copia local de la config del DO, sin pasar por RPC. */
const metaOf = (raffleId: string, key: MetaKey) =>
  runInDurableObject<Raffle, string | null>(
    env.RAFFLE.getByName(raffleId),
    (_raffle, state) => getMeta(state.storage.sql, key),
  );

beforeEach(async () => {
  await seedProfile('ana');
  await seedProfile('beto');
});

describe('createRaffleWithGrid', () => {
  it('deja la fila en D1 y la grilla completa en el objeto', async () => {
    const { id, slug } = await createFor('ana');

    const row = await env.DB.prepare(
      `SELECT status, total_numbers FROM raffles WHERE id = ?`,
    )
      .bind(id)
      .first<{ status: string; total_numbers: number }>();

    expect(row?.status).toBe('DRAFT');
    expect(slug.startsWith('rifa-del-club-')).toBe(true);

    const grid = await env.RAFFLE.getByName(id).publicGrid();
    expect(grid).toHaveLength(100);
    expect(grid[0]?.number).toBe(1); // numberStart = 1
    expect(await metaOf(id, 'owner_id')).toBe('ana');
  });

  it('un visitante no crea nada', async () => {
    await expect(
      createRaffleWithGrid(env.DB, env.RAFFLE, visitor, NEW_RAFFLE),
    ).rejects.toThrow('FORBIDDEN');
  });
});

describe('publishRaffle', () => {
  it('publica en D1 y se lo avisa al objeto', async () => {
    const { id } = await createFor('ana');

    await publishRaffle(env.DB, env.RAFFLE, organizer('ana'), id);

    const row = await env.DB.prepare(
      `SELECT status, published_at FROM raffles WHERE id = ?`,
    )
      .bind(id)
      .first<{ status: string; published_at: number | null }>();

    expect(row?.status).toBe('PUBLISHED');
    expect(row?.published_at).not.toBeNull();

    // Sin el syncConfig(), el DO seguiría creyendo que está en borrador.
    expect(await metaOf(id, 'status')).toBe('PUBLISHED');
  });

  it('sin teléfono no se publica, y la rifa queda intacta', async () => {
    const { id } = await createFor('ana', WITHOUT_PHONE);

    await expect(
      publishRaffle(env.DB, env.RAFFLE, organizer('ana'), id),
    ).rejects.toThrow('RAFFLE_NOT_PUBLISHABLE');

    const row = await env.DB.prepare(`SELECT status FROM raffles WHERE id = ?`)
      .bind(id)
      .first<{ status: string }>();

    expect(row?.status).toBe('DRAFT');
    expect(await metaOf(id, 'status')).toBe('DRAFT');
  });

  it('carga el teléfono en el mismo gesto y publica', async () => {
    const { id } = await createFor('ana', WITHOUT_PHONE);

    await publishRaffle(
      env.DB,
      env.RAFFLE,
      organizer('ana'),
      id,
      '0341 555-1234',
    );

    const row = await env.DB.prepare(
      `SELECT status, contact_phone FROM raffles WHERE id = ?`,
    )
      .bind(id)
      .first<{ status: string; contact_phone: string | null }>();

    expect(row?.status).toBe('PUBLISHED');
    expect(row?.contact_phone).toBe('+543415551234');
    expect(await metaOf(id, 'status')).toBe('PUBLISHED');
  });

  it('una rifa ajena se niega en D1, sin tocar el objeto', async () => {
    const { id } = await createFor('ana');

    await expect(
      publishRaffle(env.DB, env.RAFFLE, organizer('beto'), id),
    ).rejects.toThrow('FORBIDDEN');

    expect(await metaOf(id, 'status')).toBe('DRAFT');
  });
});

describe('ownerGrid', () => {
  it('el dueño ve su rifa y su grilla', async () => {
    const { id } = await createFor('ana');

    const { raffle, numbers } = await ownerGrid(
      env.DB,
      env.RAFFLE,
      organizer('ana'),
      id,
    );

    expect(raffle.title).toBe('Rifa del Club');
    expect(numbers).toHaveLength(100);
    expect(numbers[0]?.buyerName).toBeNull();
  });

  it('una rifa ajena se niega antes de despertar el objeto', async () => {
    const { id } = await createFor('ana');

    await expect(
      ownerGrid(env.DB, env.RAFFLE, organizer('beto'), id),
    ).rejects.toThrow('FORBIDDEN');
  });
});

describe('sellNumbers · releaseNumbers', () => {
  it('vender y liberar mueven la grilla del organizador', async () => {
    const { id } = await createFor('ana');
    const ana = organizer('ana');

    await sellNumbers(env.RAFFLE, ana, id, [7, 23], {
      name: 'Carla',
      phone: '+543411234567',
    });

    const afterSale = await ownerGrid(env.DB, env.RAFFLE, ana, id);
    expect(afterSale.numbers.filter((n) => n.status === 'SOLD')).toHaveLength(
      2,
    );
    expect(afterSale.numbers.find((n) => n.number === 7)?.buyerName).toBe(
      'Carla',
    );

    await releaseNumbers(env.RAFFLE, ana, id, [7]);

    const afterRelease = await ownerGrid(env.DB, env.RAFFLE, ana, id);
    const seven = afterRelease.numbers.find((n) => n.number === 7);
    expect(seven?.status).toBe('AVAILABLE');
    expect(seven?.buyerName).toBeNull();
  });
});

describe('updateRaffleDetails', () => {
  it('en una rifa publicada cambia los datos y deja el rango quieto', async () => {
    const { id } = await createFor('ana');
    const ana = organizer('ana');
    await publishRaffle(env.DB, env.RAFFLE, ana, id);
    await sellNumbers(env.RAFFLE, ana, id, [5], { name: 'Leo', phone: null });

    await updateRaffleDetails(env.DB, env.RAFFLE, ana, id, {
      ...NEW_RAFFLE,
      prize: 'Una bici nueva',
      ticketPrice: 999999, // se ignora: la rifa no está en DRAFT
      totalNumbers: 50, // idem
    });

    const row = await env.DB.prepare(
      `SELECT prize, ticket_price, total_numbers FROM raffles WHERE id = ?`,
    )
      .bind(id)
      .first<{ prize: string; ticket_price: number; total_numbers: number }>();

    expect(row?.prize).toBe('Una bici nueva');
    expect(row?.ticket_price).toBe(250000); // el de NEW_RAFFLE, intacto
    expect(row?.total_numbers).toBe(100);

    const grid = await env.RAFFLE.getByName(id).publicGrid();
    expect(grid).toHaveLength(100);
    expect(grid.find((n) => n.number === 5)?.status).toBe('SOLD');
  });

  it('en DRAFT, cambiar la cantidad rehace la grilla', async () => {
    const { id } = await createFor('ana');

    await updateRaffleDetails(env.DB, env.RAFFLE, organizer('ana'), id, {
      ...NEW_RAFFLE,
      totalNumbers: 30,
    });

    const row = await env.DB.prepare(
      `SELECT total_numbers FROM raffles WHERE id = ?`,
    )
      .bind(id)
      .first<{ total_numbers: number }>();
    expect(row?.total_numbers).toBe(30);

    const grid = await env.RAFFLE.getByName(id).publicGrid();
    expect(grid).toHaveLength(30);
    expect(await metaOf(id, 'owner_id')).toBe('ana'); // init() volvió a correr
  });

  it('una rifa ajena se niega en D1', async () => {
    const { id } = await createFor('ana');

    await expect(
      updateRaffleDetails(
        env.DB,
        env.RAFFLE,
        organizer('beto'),
        id,
        NEW_RAFFLE,
      ),
    ).rejects.toThrow('FORBIDDEN');
  });
});
