import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { LiveMessage, RaffleInit } from '@/types/raffle';
import { LIVE_GONE } from '@/utils/live';

import type { Raffle } from './raffle';

/**
 * ⚠️ POR QUÉ LAS LLAMADAS QUE ESPERAN UN RECHAZO VAN POR `runInDurableObject`
 *
 * En `@cloudflare/vitest-pool-workers@0.22`, TODA excepción que cruza el límite
 * RPC de un Durable Object queda además registrada como "unhandled rejection",
 * aunque el test la capture con `rejects`. El resultado es una corrida con los
 * 63 tests en verde y el proceso terminando en error. Verificado que pasa
 * también con un `TypeError` del runtime: no es algo de `AppError`, ni de cómo
 * se escribe la aserción (probados `expect(promesa)`, `expect(función)`,
 * `Promise.resolve(...)` y un `try/catch` a mano — los cuatro lo producen).
 *
 * `runInDurableObject` ejecuta el método sobre la MISMA instancia, sin RPC en
 * el medio: `assertOwner` se prueba igual de bien. Lo único que deja de
 * cubrirse es que el código del error sobreviva la serialización del RPC, y eso
 * se va a ver de punta a punta en la fase 6, cuando haya una action que lo
 * traduzca con `describeError`.
 *
 * Las llamadas que se espera que ANDEN siguen yendo por RPC, que es el camino
 * real.
 */

/**
 * Llama a un método del DO adentro del objeto. El tipo del stub no alcanza para
 * que `runInDurableObject` infiera la clase, así que se fija acá una sola vez.
 */
const enElObjeto = <R>(
  stub: DurableObjectStub<Raffle>,
  fn: (rifa: Raffle) => R | Promise<R>,
): Promise<R> => runInDurableObject<Raffle, R>(stub, fn);

const RIFA_DE_ANA: RaffleInit = {
  raffleId: 'rifa-de-ana',
  ownerId: 'ana',
  tier: 'BASIC',
  status: 'PUBLISHED',
  numberStart: 1,
  totalNumbers: 100,
};

/**
 * Cada test arranca de cero (ver test/setup.ts), así que la rifa se inicializa
 * adentro de cada uno. Un test que dependa del estado que dejó el anterior pasa
 * o falla según el orden en que corran, y eso no es una prueba de nada.
 */
const rifaDeAna = async () => {
  const rifa = env.RAFFLE.getByName('rifa-de-ana');
  await rifa.init(RIFA_DE_ANA);
  return rifa;
};

const CARLA = { name: 'Carla', phone: '+543411234567' };

describe('Raffle · autorización', () => {
  it('un usuario ajeno no puede leer la grilla del organizador', async () => {
    const rifa = await rifaDeAna();

    await expect(enElObjeto(rifa, (r) => r.ownerGrid('beto'))).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('un usuario ajeno no puede vender', async () => {
    const rifa = await rifaDeAna();

    await expect(
      enElObjeto(rifa, (r) => r.sell('beto', [1], CARLA)),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('un usuario ajeno no puede tocar la config ni borrar', async () => {
    const rifa = await rifaDeAna();

    await expect(
      enElObjeto(rifa, (r) =>
        r.syncConfig('beto', { tier: 'PRO', status: 'CLOSED' }),
      ),
    ).rejects.toThrow('FORBIDDEN');

    await expect(enElObjeto(rifa, (r) => r.resync('beto'))).rejects.toThrow(
      'FORBIDDEN',
    );

    await expect(enElObjeto(rifa, (r) => r.destroy('beto'))).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('una rifa sin init no le contesta a nadie', async () => {
    // Sin init() no hay owner_id, y sin owner_id no hay nadie autorizado.
    // Falla cerrado: un objeto a medio crear se niega, no deja pasar.
    const rifa = env.RAFFLE.getByName('rifa-sin-init');

    await expect(enElObjeto(rifa, (r) => r.ownerGrid('ana'))).rejects.toThrow(
      'FORBIDDEN',
    );

    await expect(
      enElObjeto(rifa, (r) => r.sell('ana', [1], CARLA)),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('la grilla pública nunca incluye datos del comprador', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [7], CARLA);

    // Serializar y buscar el dato en el string es feo a propósito: es lo único
    // que atrapa una fuga que se coló por un campo nuevo que alguien agregó
    // sin pensar. Un `expect(grid[0].buyerPhone).toBeUndefined()` sólo revisa
    // los campos que ya conocés.
    const serializado = JSON.stringify(await rifa.publicGrid());

    expect(serializado).not.toContain('Carla');
    expect(serializado).not.toContain('3411234567');
  });

  it('el dueño SÍ ve el teléfono en su grilla', async () => {
    // Control positivo, y no es de relleno: sin él, el test de arriba pasaría
    // igual aunque sell() no hubiera guardado nada. No encontrar el teléfono
    // no prueba que esté filtrado — sólo que no está.
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [7], CARLA);

    const fila = (await rifa.ownerGrid('ana')).find((n) => n.number === 7);

    expect(fila?.status).toBe('SOLD');
    expect(fila?.buyerName).toBe('Carla');
    expect(fila?.buyerPhone).toBe('+543411234567');
  });
});

describe('Raffle · venta', () => {
  it('vender un número ya vendido no deja nada a medias', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [7], CARLA);

    await expect(
      enElObjeto(rifa, (r) =>
        r.sell('ana', [8, 7], { name: 'Dante', phone: '+5493419999999' }),
      ),
    ).rejects.toThrow('NUMBERS_UNAVAILABLE');

    const grilla = await rifa.ownerGrid('ana');

    // El 8 volvió atrás con el rollback del transactionSync...
    expect(grilla.find((n) => n.number === 8)?.status).toBe('AVAILABLE');
    // ...y Dante nunca llegó a existir como comprador. Es el bug de v1: dos
    // INSERT sueltos dejaban al comprador cargado cuando fallaba el segundo.
    expect(JSON.stringify(grilla)).not.toContain('Dante');
  });

  it('el mismo teléfono es la misma persona dentro de la rifa', async () => {
    const rifa = await rifaDeAna();

    const uno = await rifa.sell('ana', [1], CARLA);
    const dos = await rifa.sell('ana', [2], {
      name: 'Carla Rodríguez',
      phone: '0341 123-4567', // el mismo número, escrito distinto
    });

    expect(dos.buyerId).toBe(uno.buyerId);
  });

  it('un número fuera del rango no existe', async () => {
    const rifa = await rifaDeAna();

    await expect(
      enElObjeto(rifa, (r) => r.sell('ana', [999], CARLA)),
    ).rejects.toThrow('INVALID_NUMBERS');
  });

  it('no se pueden cargar más de 50 números de una', async () => {
    const rifa = await rifaDeAna();
    const muchos = Array.from({ length: 51 }, (_, i) => i + 1);

    await expect(
      enElObjeto(rifa, (r) => r.sell('ana', muchos, CARLA)),
    ).rejects.toThrow('TOO_MANY_NUMBERS');
  });

  it('los contadores quedan bien después de vender', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [1, 2, 3], CARLA);

    const stats = await rifa.stats();

    expect(stats.total).toBe(100);
    expect(stats.sold).toBe(3);
    expect(stats.available).toBe(97);
  });

  it('la nota de la venta vuelve en la grilla del organizador', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [1, 2], {
      ...CARLA,
      note: 'pagó por transferencia',
    });

    const grilla = await rifa.ownerGrid('ana');

    expect(grilla.find((n) => n.number === 1)?.note).toBe(
      'pagó por transferencia',
    );
    expect(grilla.find((n) => n.number === 2)?.note).toBe(
      'pagó por transferencia',
    );
  });
});

describe('Raffle · liberar', () => {
  it('un usuario ajeno no puede liberar', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [7], CARLA);

    await expect(
      enElObjeto(rifa, (r) => r.release('beto', [7])),
    ).rejects.toThrow('FORBIDDEN');

    // Y el número sigue vendido: la negación no dejó nada a medias.
    const fila = (await rifa.ownerGrid('ana')).find((n) => n.number === 7);
    expect(fila?.status).toBe('SOLD');
  });

  it('liberar deja el número como nuevo, sin rastro del comprador', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [7], { ...CARLA, note: 'seña, debe el resto' });

    await rifa.release('ana', [7]);

    const fila = (await rifa.ownerGrid('ana')).find((n) => n.number === 7);

    expect(fila?.status).toBe('AVAILABLE');
    expect(fila?.buyerId).toBeNull();
    expect(fila?.buyerName).toBeNull();
    expect(fila?.buyerPhone).toBeNull();
    expect(fila?.note).toBeNull();
  });

  it('liberar un número que ya estaba libre no pasa', async () => {
    const rifa = await rifaDeAna();

    await expect(
      enElObjeto(rifa, (r) => r.release('ana', [7])),
    ).rejects.toThrow('NUMBERS_NOT_RELEASABLE');
  });

  it('si uno del lote no se puede liberar, no se libera ninguno', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [1, 2], CARLA);

    // El 3 nunca se vendió, así que el lote entero tiene que volver atrás.
    await expect(
      enElObjeto(rifa, (r) => r.release('ana', [1, 2, 3])),
    ).rejects.toThrow('NUMBERS_NOT_RELEASABLE');

    const grilla = await rifa.ownerGrid('ana');
    expect(grilla.find((n) => n.number === 1)?.status).toBe('SOLD');
    expect(grilla.find((n) => n.number === 2)?.status).toBe('SOLD');
  });

  it('los contadores bajan al liberar', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [1, 2, 3], CARLA);

    await rifa.release('ana', [2]);
    const stats = await rifa.stats();

    expect(stats.sold).toBe(2);
    expect(stats.available).toBe(98);
  });

  it('el comprador sobrevive a que le liberen todos sus números', async () => {
    // No es un descuido: el teléfono es la identidad con la que deduplica
    // upsertBuyer(), y desde la fase 8 orders.buyer_id lo referencia.
    const rifa = await rifaDeAna();

    const venta = await rifa.sell('ana', [7], CARLA);
    await rifa.release('ana', [7]);
    const revancha = await rifa.sell('ana', [8], CARLA);

    expect(revancha.buyerId).toBe(venta.buyerId);
  });
});

describe('Raffle · proyección a D1', () => {
  it('resync() pisa los contadores de la fila de D1', async () => {
    // El DO es la verdad del estado; D1 es caché reconstruible. resync() es la
    // salida cuando divergieron, y a diferencia de la proyección normal espera
    // la respuesta de D1 porque el que lo llama quiere saber si quedó.
    await env.DB.prepare(
      `INSERT INTO profiles (id, display_name) VALUES ('ana', 'Ana')`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO raffles
         (id, owner_id, slug, title, ticket_price, total_numbers, draw_date,
          sold_count)
       VALUES ('rifa-de-ana', 'ana', 'rifa-de-ana', 'Rifa de Ana',
               100000, 100, '2026-12-24', 42)`,
    ).run();

    const rifa = await rifaDeAna();
    await rifa.sell('ana', [1, 2], CARLA);

    await rifa.resync('ana');

    const fila = await env.DB.prepare(
      'SELECT sold_count, synced_at FROM raffles WHERE id = ?',
    )
      .bind('rifa-de-ana')
      .first<{ sold_count: number; synced_at: number | null }>();

    // El 42 inventado se pisa con lo que dice el DO.
    expect(fila?.sold_count).toBe(2);
    expect(fila?.synced_at).not.toBeNull();
  });
});

/**
 * Se conecta como lo haría el navegador y junta lo que va llegando.
 *
 * Los mensajes se encolan desde el `accept()`: la grilla de entrada sale antes
 * de que el test pida nada, y si recién ahí se escuchara, se perdería.
 */
const mirar = async (stub: DurableObjectStub<Raffle>) => {
  const res = await stub.fetch('https://rifate.test/live', {
    headers: { Upgrade: 'websocket' },
  });
  const ws = res.webSocket;
  if (ws === null) throw new Error(`sin WebSocket: ${res.status}`);

  const llegados: string[] = [];
  const esperando: ((m: string) => void)[] = [];

  ws.addEventListener('message', ({ data }) => {
    const m = String(data);
    const alguien = esperando.shift();
    if (alguien === undefined) llegados.push(m);
    else alguien(m);
  });

  const cerrado = new Promise<number>((resolve) => {
    ws.addEventListener('close', ({ code }) => resolve(code));
  });

  ws.accept();

  /** El próximo mensaje, crudo. */
  const siguienteCrudo = (): Promise<string> => {
    const m = llegados.shift();
    if (m !== undefined) return Promise.resolve(m);
    return new Promise((resolve) => esperando.push(resolve));
  };

  /** El próximo mensaje de grilla, ya parseado. */
  const siguiente = async (): Promise<LiveMessage> =>
    JSON.parse(await siguienteCrudo()) as LiveMessage;

  return { ws, siguiente, siguienteCrudo, cerrado };
};

const estadoDe = (m: LiveMessage, numero: number) =>
  m.numbers.find((n) => n.number === numero)?.status;

describe('Raffle · en vivo', () => {
  it('un pedido que no es WebSocket no entra', async () => {
    const rifa = await rifaDeAna();

    const res = await rifa.fetch('https://rifate.test/live');

    expect(res.status).toBe(426);
  });

  it('una rifa sin init no tiene nada que mirar', async () => {
    const rifa = env.RAFFLE.getByName('rifa-sin-init');

    const res = await rifa.fetch('https://rifate.test/live', {
      headers: { Upgrade: 'websocket' },
    });

    expect(res.status).toBe(404);
  });

  it('el que se conecta recibe la grilla de entrada', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [7], CARLA);

    const { siguiente } = await mirar(rifa);
    const entrada = await siguiente();

    expect(entrada.type).toBe('grid');
    expect(entrada.numbers).toHaveLength(100);
    expect(estadoDe(entrada, 7)).toBe('SOLD');
  });

  it('una venta les llega a todos los que miran', async () => {
    const rifa = await rifaDeAna();
    const uno = await mirar(rifa);
    const otro = await mirar(rifa);
    await uno.siguiente(); // la grilla de entrada
    await otro.siguiente();

    await rifa.sell('ana', [7, 8], CARLA);

    for (const visitante of [uno, otro]) {
      const m = await visitante.siguiente();
      expect(estadoDe(m, 7)).toBe('SOLD');
      expect(estadoDe(m, 8)).toBe('SOLD');
    }
  });

  it('liberar también se avisa', async () => {
    const rifa = await rifaDeAna();
    await rifa.sell('ana', [7], CARLA);
    const { siguiente } = await mirar(rifa);
    await siguiente();

    await rifa.release('ana', [7]);

    expect(estadoDe(await siguiente(), 7)).toBe('AVAILABLE');
  });

  it('por el cable nunca viaja el comprador', async () => {
    // Mismo criterio que el test de la grilla pública: buscar en el string es
    // lo único que atrapa un campo nuevo que se coló sin que nadie lo piense.
    const rifa = await rifaDeAna();
    const { siguienteCrudo } = await mirar(rifa);
    await siguienteCrudo();

    await rifa.sell('ana', [7], CARLA);
    const crudo = await siguienteCrudo();

    expect(crudo).toContain('SOLD'); // control positivo: sí llegó la venta
    expect(crudo).not.toContain('Carla');
    expect(crudo).not.toContain('3411234567');
  });

  it('el ping lo contesta el runtime', async () => {
    const rifa = await rifaDeAna();
    const { ws, siguienteCrudo } = await mirar(rifa);
    await siguienteCrudo();

    ws.send('ping');

    expect(await siguienteCrudo()).toBe('pong');
  });

  it('borrar la rifa corta a los que miran con el código de «no vuelvas»', async () => {
    const rifa = await rifaDeAna();
    const { siguiente, cerrado } = await mirar(rifa);
    await siguiente();

    await rifa.destroy('ana');

    expect(await cerrado).toBe(LIVE_GONE);
  });
});
