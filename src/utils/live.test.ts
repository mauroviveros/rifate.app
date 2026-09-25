import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PublicNumber } from '@/types/raffle';

import { isTaken, LIVE_GONE, liveGrid, soldSummary } from './live';

/**
 * Un WebSocket de mentira: lo que `liveGrid` escucha y llama, y nada más. Los
 * eventos se disparan a mano, así el test decide cuándo abre, qué llega y
 * cómo se corta.
 */
class FakeSocket extends EventTarget {
  sent: string[] = [];
  closedWith: number | null = null;

  send(data: string) {
    this.sent.push(data);
  }

  close(code: number) {
    this.closedWith = code;
  }

  abrir() {
    this.dispatchEvent(new Event('open'));
  }

  recibir(data: string) {
    this.dispatchEvent(new MessageEvent('message', { data }));
  }

  cortar(code = 1006) {
    this.dispatchEvent(new CloseEvent('close', { code }));
  }
}

const GRILLA: PublicNumber[] = [
  { number: 1, status: 'SOLD' },
  { number: 2, status: 'AVAILABLE' },
];

const mensaje = (numbers = GRILLA) => JSON.stringify({ type: 'grid', numbers });

/** Un `liveGrid` con sockets de mentira, y la lista de los que abrió. */
const armar = () => {
  const sockets: FakeSocket[] = [];
  const onGrid = vi.fn();
  const live = liveGrid({
    url: 'ws://rifate.test/r/rifa/live',
    onGrid,
    open: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s as unknown as WebSocket;
    },
  });
  const ultimo = () => sockets[sockets.length - 1];
  return { live, onGrid, sockets, ultimo };
};

describe('isTaken', () => {
  it.each([
    ['AVAILABLE', false],
    ['RESERVED', true],
    ['SOLD', true],
    ['BLOCKED', false],
  ] as const)('%s → %s', (status, taken) => {
    expect(isTaken(status)).toBe(taken);
  });
});

describe('soldSummary', () => {
  it('cuenta los vendidos y no los reservados', () => {
    expect(
      soldSummary([
        { number: 1, status: 'SOLD' },
        { number: 2, status: 'RESERVED' },
        { number: 3, status: 'AVAILABLE' },
        { number: 4, status: 'AVAILABLE' },
      ]),
    ).toEqual({ label: '1 de 4 vendidos', value: 25 });
  });

  it('sin números no divide por cero', () => {
    expect(soldSummary([])).toEqual({ label: '0 de 0 vendidos', value: 0 });
  });
});

describe('liveGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cada grilla que llega va a onGrid, y el pong no', () => {
    const { live, onGrid, ultimo } = armar();
    live.start();

    ultimo().recibir(mensaje());
    ultimo().recibir('pong');

    expect(onGrid).toHaveBeenCalledTimes(1);
    expect(onGrid).toHaveBeenCalledWith(GRILLA);
  });

  it('manda el ping cada 30 s mientras está abierto', () => {
    const { live, ultimo } = armar();
    live.start();
    ultimo().abrir();

    vi.advanceTimersByTime(60_000);

    expect(ultimo().sent).toEqual(['ping', 'ping']);
  });

  it('si se corta, vuelve a conectarse solo', () => {
    const { live, sockets, ultimo } = armar();
    live.start();

    ultimo().cortar();
    vi.advanceTimersByTime(1000);

    expect(sockets).toHaveLength(2);
  });

  it('cada corte seguido espera más que el anterior', () => {
    const { live, sockets, ultimo } = armar();
    live.start();

    ultimo().cortar();
    vi.advanceTimersByTime(1000); // el 1º espera hasta 1 s
    ultimo().cortar();
    vi.advanceTimersByTime(999); // el 2º, entre 1 y 2 s

    expect(sockets).toHaveLength(2);

    vi.advanceTimersByTime(1001);
    expect(sockets).toHaveLength(3);
  });

  it('una grilla recibida vuelve la espera a cero', () => {
    const { live, sockets, ultimo } = armar();
    live.start();
    ultimo().cortar();
    vi.advanceTimersByTime(1000);
    ultimo().cortar();
    vi.advanceTimersByTime(2000);

    ultimo().recibir(mensaje()); // conectó bien
    ultimo().cortar();
    vi.advanceTimersByTime(1000);

    expect(sockets).toHaveLength(4);
  });

  it('con LIVE_GONE se rinde, y start() ya no la revive', () => {
    const { live, sockets, ultimo } = armar();
    live.start();

    ultimo().cortar(LIVE_GONE);
    vi.advanceTimersByTime(60_000);
    live.stop();
    live.start();

    expect(sockets).toHaveLength(1);
  });

  it('stop() corta y no reintenta', () => {
    const { live, sockets, ultimo } = armar();
    live.start();
    const primero = ultimo();

    live.stop();
    primero.cortar(1000);
    vi.advanceTimersByTime(60_000);

    expect(primero.closedWith).toBe(1000);
    expect(sockets).toHaveLength(1);
  });

  it('el cierre tardío de un socket viejo no abre una segunda conexión', () => {
    // La pestaña se oculta y vuelve enseguida: stop() + start() antes de que
    // el socket viejo termine de cerrar.
    const { live, sockets } = armar();
    live.start();
    const viejo = sockets[0];

    live.stop();
    live.start();
    viejo.cortar(1000);
    vi.advanceTimersByTime(60_000);

    expect(sockets).toHaveLength(2);
  });

  it('start() dos veces no abre dos conexiones', () => {
    const { live, sockets } = armar();

    live.start();
    live.start();

    expect(sockets).toHaveLength(1);
  });
});
