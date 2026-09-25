import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Raffle } from '@/do/raffle';
import { getMeta, type MetaKey } from '@/do/schema';
import type { Actor } from '@/lib/auth/actor';
import { createRaffle } from '@/lib/db/raffles';
import type { NewRaffle } from '@/types/raffle';

import {
  cancelRaffle,
  createRaffleWithGrid,
  deleteRaffle,
  drawRaffle,
  ownerGrid,
  publicGrid,
  publishRaffle,
  rebuildGrid,
  releaseNumbers,
  sellNumbers,
  updateRaffleDetails,
  watchPublicGrid,
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

  it('rifa huérfana: el dueño ve la grilla vacía en vez de un 404', async () => {
    // D1 sola, sin el init() del DO: reproduce el alta que se cortó a mitad
    // de camino (ver el comentario de createRaffleWithGrid).
    const { id } = await createRaffle(env.DB, organizer('ana'), NEW_RAFFLE);

    const { raffle, numbers } = await ownerGrid(
      env.DB,
      env.RAFFLE,
      organizer('ana'),
      id,
    );

    expect(raffle.title).toBe('Rifa del Club');
    expect(numbers).toEqual([]);
  });
});

describe('publicGrid', () => {
  it('una rifa publicada la ve cualquiera, con número y estado y nada más', async () => {
    const { id, slug } = await createFor('ana');
    await publishRaffle(env.DB, env.RAFFLE, organizer('ana'), id);

    const loaded = await publicGrid(env.DB, env.RAFFLE, visitor, slug);

    expect(loaded?.raffle.title).toBe('Rifa del Club');
    expect(loaded?.numbers).toHaveLength(100);
    expect(Object.keys(loaded?.numbers[0] ?? {}).sort()).toEqual([
      'number',
      'status',
    ]);
  });

  it('un borrador no existe para el visitante', async () => {
    const { slug } = await createFor('ana');

    expect(await publicGrid(env.DB, env.RAFFLE, visitor, slug)).toBeNull();
  });

  it('ni para otro organizador', async () => {
    const { slug } = await createFor('ana');

    expect(
      await publicGrid(env.DB, env.RAFFLE, organizer('beto'), slug),
    ).toBeNull();
  });

  it('el dueño previsualiza su borrador', async () => {
    const { slug } = await createFor('ana');

    const loaded = await publicGrid(env.DB, env.RAFFLE, organizer('ana'), slug);

    expect(loaded?.raffle.status).toBe('DRAFT');
    expect(loaded?.numbers).toHaveLength(100);
  });

  it('un slug que no existe es null', async () => {
    expect(
      await publicGrid(env.DB, env.RAFFLE, visitor, 'no-existe'),
    ).toBeNull();
  });

  it('rifa huérfana: la fila sin grilla devuelve la lista vacía', async () => {
    const { slug } = await createRaffle(env.DB, organizer('ana'), NEW_RAFFLE);

    const loaded = await publicGrid(env.DB, env.RAFFLE, organizer('ana'), slug);

    expect(loaded?.numbers).toEqual([]);
  });
});

/** Lo que manda el navegador para abrir el WebSocket. */
const upgrade = () =>
  new Request('https://rifate.test/r/rifa/live', {
    headers: { Upgrade: 'websocket' },
  });

/**
 * Mira con `watchPublicGrid` y cierra enseguida si se conectó. El socket que
 * se queda abierto al terminar el test es uno más que el DO sigue contando.
 */
const watch = async (actor: Actor, slug: string) => {
  const res = await watchPublicGrid(env.DB, env.RAFFLE, actor, slug, upgrade());
  if (res?.webSocket) {
    res.webSocket.accept();
    res.webSocket.close();
  }
  return res;
};

describe('watchPublicGrid', () => {
  it('una rifa publicada la mira cualquiera', async () => {
    const { id, slug } = await createFor('ana');
    await publishRaffle(env.DB, env.RAFFLE, organizer('ana'), id);

    const res = await watch(visitor, slug);

    expect(res?.status).toBe(101);
  });

  it('un borrador no existe para el visitante, y el objeto ni se entera', async () => {
    const { slug } = await createFor('ana');

    expect(await watch(visitor, slug)).toBeNull();
  });

  it('el dueño mira su borrador', async () => {
    const { slug } = await createFor('ana');

    expect((await watch(organizer('ana'), slug))?.status).toBe(101);
  });

  it('un slug que no existe es null', async () => {
    expect(await watch(visitor, 'no-existe')).toBeNull();
  });

  it('rifa huérfana: D1 la deja pasar y el objeto contesta 404', async () => {
    // A diferencia de `publicGrid`, acá no hay lista vacía que devolver: un
    // objeto sin init() no acepta a nadie (ver `fetch` en el DO).
    const { slug } = await createRaffle(env.DB, organizer('ana'), NEW_RAFFLE);

    expect((await watch(organizer('ana'), slug))?.status).toBe(404);
  });
});
describe('rebuildGrid', () => {
  it('rearma una rifa huérfana sin tocar D1', async () => {
    const { id } = await createRaffle(env.DB, organizer('ana'), NEW_RAFFLE);
    expect(await metaOf(id, 'owner_id')).toBeNull();

    await rebuildGrid(env.DB, env.RAFFLE, organizer('ana'), id);

    const grid = await env.RAFFLE.getByName(id).publicGrid();
    expect(grid).toHaveLength(100);
    expect(await metaOf(id, 'owner_id')).toBe('ana');

    const { numbers } = await ownerGrid(
      env.DB,
      env.RAFFLE,
      organizer('ana'),
      id,
    );
    expect(numbers).toHaveLength(100);
  });

  it('sobre una rifa sana no hace nada: init() es idempotente', async () => {
    const { id } = await createFor('ana');
    const ana = organizer('ana');
    await sellNumbers(env.RAFFLE, ana, id, [5], { name: 'Leo', phone: null });

    await rebuildGrid(env.DB, env.RAFFLE, ana, id);

    const { numbers } = await ownerGrid(env.DB, env.RAFFLE, ana, id);
    expect(numbers).toHaveLength(100);
    expect(numbers.find((n) => n.number === 5)?.status).toBe('SOLD');
  });

  it('una rifa ajena se niega en D1, sin tocar el objeto', async () => {
    const { id } = await createRaffle(env.DB, organizer('ana'), NEW_RAFFLE);

    await expect(
      rebuildGrid(env.DB, env.RAFFLE, organizer('beto'), id),
    ).rejects.toThrow('FORBIDDEN');

    expect(await metaOf(id, 'owner_id')).toBeNull();
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

/** Una rifa de Ana publicada, con el 7 vendido a Carla. */
const onSale = async () => {
  const { id, slug } = await createFor('ana');
  await publishRaffle(env.DB, env.RAFFLE, organizer('ana'), id);
  await sellNumbers(env.RAFFLE, organizer('ana'), id, [7], {
    name: 'Carla',
    phone: '+543411234567',
  });
  return { id, slug };
};

type ClosedRow = {
  status: string;
  winner_number: number | null;
  winner_name: string | null;
  closed_at: number | null;
};

const rowOf = (id: string) =>
  env.DB.prepare(
    `SELECT status, winner_number, winner_name, closed_at
       FROM raffles WHERE id = ?`,
  )
    .bind(id)
    .first<ClosedRow>();

describe('drawRaffle', () => {
  it('sortea en el objeto y copia el ganador a la fila', async () => {
    const { id, slug } = await onSale();

    const winner = await drawRaffle(
      env.DB,
      env.RAFFLE,
      organizer('ana'),
      id,
      null,
    );

    expect(winner).toEqual({
      number: 7,
      buyerName: 'Carla',
      buyerPhone: '+543411234567',
    });
    const row = await rowOf(id);
    expect(row?.status).toBe('CLOSED');
    expect(row?.winner_number).toBe(7);
    expect(row?.winner_name).toBe('Carla');
    expect(row?.closed_at).not.toBeNull();
    expect(await metaOf(id, 'status')).toBe('CLOSED');

    // El link viejo sigue abriendo: tiene que mostrar quién ganó.
    const pub = await publicGrid(env.DB, env.RAFFLE, visitor, slug);
    expect(pub?.raffle.winnerNumber).toBe(7);
  });

  it('el reintento con la fila ya cerrada deja todo igual', async () => {
    const { id } = await onSale();
    const ana = organizer('ana');

    const primero = await drawRaffle(env.DB, env.RAFFLE, ana, id, null);
    const antes = await rowOf(id);
    const segundo = await drawRaffle(env.DB, env.RAFFLE, ana, id, 50);

    expect(segundo).toEqual(primero);
    expect(await rowOf(id)).toEqual(antes);
  });

  it('a mano, un número sin vender cierra la rifa sin ganador', async () => {
    const { id } = await onSale();

    await drawRaffle(env.DB, env.RAFFLE, organizer('ana'), id, 34);

    const row = await rowOf(id);
    expect(row?.status).toBe('CLOSED');
    expect(row?.winner_number).toBe(34);
    expect(row?.winner_name).toBeNull();
  });

  it('un borrador no se sortea, y el objeto ni se entera', async () => {
    const { id } = await createFor('ana');

    await expect(
      drawRaffle(env.DB, env.RAFFLE, organizer('ana'), id, null),
    ).rejects.toThrow('RAFFLE_NOT_PUBLISHED');
    expect(await metaOf(id, 'winner_number')).toBeNull();
  });

  it('una rifa ajena se niega en D1', async () => {
    const { id } = await onSale();

    await expect(
      drawRaffle(env.DB, env.RAFFLE, organizer('beto'), id, null),
    ).rejects.toThrow('FORBIDDEN');
    expect(await metaOf(id, 'winner_number')).toBeNull();
  });
});

describe('cancelRaffle', () => {
  it('anula en el objeto y en la fila, y el link deja de abrir', async () => {
    const { id, slug } = await onSale();

    await cancelRaffle(env.DB, env.RAFFLE, organizer('ana'), id);

    const row = await rowOf(id);
    expect(row?.status).toBe('CANCELLED');
    expect(row?.closed_at).not.toBeNull();
    expect(await metaOf(id, 'status')).toBe('CANCELLED');
    expect(await publicGrid(env.DB, env.RAFFLE, visitor, slug)).toBeNull();
  });

  it('el dueño la sigue viendo, con lo que había vendido', async () => {
    const { id } = await onSale();

    await cancelRaffle(env.DB, env.RAFFLE, organizer('ana'), id);

    const { numbers } = await ownerGrid(
      env.DB,
      env.RAFFLE,
      organizer('ana'),
      id,
    );
    expect(numbers.find((n) => n.number === 7)?.buyerName).toBe('Carla');
  });

  it('anular dos veces es el reintento, no un error', async () => {
    const { id } = await onSale();
    const ana = organizer('ana');

    await cancelRaffle(env.DB, env.RAFFLE, ana, id);
    await cancelRaffle(env.DB, env.RAFFLE, ana, id);

    expect((await rowOf(id))?.status).toBe('CANCELLED');
  });

  it('una sorteada no se anula', async () => {
    const { id } = await onSale();
    const ana = organizer('ana');
    await drawRaffle(env.DB, env.RAFFLE, ana, id, null);

    await expect(cancelRaffle(env.DB, env.RAFFLE, ana, id)).rejects.toThrow(
      'RAFFLE_FINISHED',
    );
    expect((await rowOf(id))?.status).toBe('CLOSED');
  });

  it('una rifa ajena se niega en D1', async () => {
    const { id } = await onSale();

    await expect(
      cancelRaffle(env.DB, env.RAFFLE, organizer('beto'), id),
    ).rejects.toThrow('FORBIDDEN');
    expect(await metaOf(id, 'status')).toBe('PUBLISHED');
  });
});

describe('deleteRaffle', () => {
  it('sin ventas: primero se vacía el objeto, después la fila', async () => {
    const { id } = await createFor('ana');

    await deleteRaffle(env.DB, env.RAFFLE, organizer('ana'), id);

    expect(await rowOf(id)).toBeNull();
    expect(await env.RAFFLE.getByName(id).publicGrid()).toEqual([]);
    expect(await metaOf(id, 'owner_id')).toBeNull();
  });

  it('una publicada que no vendió también se borra', async () => {
    const { id } = await createFor('ana');
    await publishRaffle(env.DB, env.RAFFLE, organizer('ana'), id);

    await deleteRaffle(env.DB, env.RAFFLE, organizer('ana'), id);

    expect(await rowOf(id)).toBeNull();
  });

  it('una huérfana se borra sin tocar el objeto, que no tiene dueño', async () => {
    const { id } = await createRaffle(env.DB, organizer('ana'), NEW_RAFFLE);

    await deleteRaffle(env.DB, env.RAFFLE, organizer('ana'), id);

    expect(await rowOf(id)).toBeNull();
  });

  it('una sorteada no se borra', async () => {
    const { id } = await onSale();
    const ana = organizer('ana');
    await drawRaffle(env.DB, env.RAFFLE, ana, id, null);

    await expect(deleteRaffle(env.DB, env.RAFFLE, ana, id)).rejects.toThrow(
      'RAFFLE_FINISHED',
    );
    expect(await rowOf(id)).not.toBeNull();
  });

  it('una rifa ajena se niega en D1, sin tocar el objeto', async () => {
    const { id } = await createFor('ana');

    await expect(
      deleteRaffle(env.DB, env.RAFFLE, organizer('beto'), id),
    ).rejects.toThrow('FORBIDDEN');
    expect(await metaOf(id, 'owner_id')).toBe('ana');
  });
});
