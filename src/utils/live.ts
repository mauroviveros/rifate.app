/**
 * La grilla en vivo del lado del que mira: qué cuenta como «ya no está», cómo
 * se resume el avance y la conexión con el Durable Object.
 *
 * No toca el DOM. Lo importan el frontmatter de `Cell` y de la página pública
 * y el `<script>` de la página, y los tres tienen que dibujar lo mismo: si la
 * regla viviera repetida en el servidor y en el cliente, el primer mensaje del
 * WebSocket podría repintar distinto de lo que mandó el HTML.
 */

import type { LiveMessage, NumberStatus, PublicNumber } from '@/types/raffle';
import { progress } from '@/utils/format/progress';

/**
 * El código con el que el DO cierra el WebSocket cuando la rifa deja de
 * existir. Va en el rango 4000–4999, que el protocolo reserva para las apps.
 *
 * Existe para que el cliente sepa que no tiene que reconectarse: un 1000 o un
 * 1006 se leen como un corte y el navegador volvería a intentar para siempre
 * contra una rifa borrada.
 */
export const LIVE_GONE = 4404;

/** Vendido o reservado: para el que mira, las dos cosas son «ya no está». */
export const isTaken = (status: NumberStatus): boolean =>
  status === 'SOLD' || status === 'RESERVED';

/**
 * El avance de la tarjeta: «37 de 100 vendidos» y el 37 %. Cuenta sólo los
 * `SOLD`: un reservado todavía se puede caer.
 */
export const soldSummary = (
  numbers: PublicNumber[],
): { label: string; value: number } => {
  const sold = numbers.filter(({ status }) => status === 'SOLD').length;
  return {
    label: `${sold} de ${numbers.length} vendidos`,
    value: progress(sold, numbers.length),
  };
};

/**
 * Cada cuánto se manda el `ping`. El DO lo contesta sin despertarse
 * (`setWebSocketAutoResponse`), así que es gratis, y evita que un proxy o la
 * red del celular corten la conexión por estar callada.
 */
const PING_MS = 30_000;

/** El techo de la espera entre reintentos. */
const MAX_RETRY_MS = 30_000;

/**
 * Cuánto esperar antes del reintento `attempt` (desde 0): 1 s, 2 s, 4 s… hasta
 * 30 s. Al azar entre la mitad y el total, para que cuando un deploy corte a
 * todos los que miran la misma rifa no vuelvan todos en el mismo milisegundo.
 */
const retryDelay = (attempt: number): number => {
  const ceiling = Math.min(MAX_RETRY_MS, 1000 * 2 ** attempt);
  return ceiling / 2 + (Math.random() * ceiling) / 2;
};

export type LiveGrid = {
  /** Se conecta. Si ya estaba conectado o la rifa ya no existe, no hace nada. */
  start(): void;
  /** Corta y no vuelve a intentar hasta el próximo `start()`. */
  stop(): void;
};

/**
 * Mantiene una conexión con `/r/{slug}/live` y le pasa cada grilla a `onGrid`.
 *
 * Si se corta, reintenta solo, cada vez esperando más; una grilla recibida
 * vuelve la espera a cero. Si el DO cierra con `LIVE_GONE`, se rinde para
 * siempre: la rifa no va a volver.
 *
 * Cada handler mira si su socket sigue siendo EL socket. Sin eso, un
 * `stop()` + `start()` rápido (la pestaña que se oculta y vuelve) deja al
 * socket viejo avisando un cierre tardío, y ese aviso agenda un reintento que
 * abre una segunda conexión al lado de la nueva.
 *
 * `open` existe para los tests; en el navegador es `new WebSocket(url)`.
 */
export const liveGrid = ({
  url,
  onGrid,
  open = (href) => new WebSocket(href),
}: {
  url: string;
  onGrid: (numbers: PublicNumber[]) => void;
  open?: (url: string) => WebSocket;
}): LiveGrid => {
  let socket: WebSocket | null = null;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let wanted = false;
  let gone = false;

  const connect = () => {
    const ws = open(url);
    socket = ws;

    ws.addEventListener('open', () => {
      if (ws !== socket) return;
      ping = setInterval(() => ws.send('ping'), PING_MS);
    });

    ws.addEventListener('message', ({ data }) => {
      if (ws !== socket || data === 'pong') return;

      const message = JSON.parse(String(data)) as LiveMessage;
      if (message.type !== 'grid') return;

      attempt = 0;
      onGrid(message.numbers);
    });

    ws.addEventListener('close', ({ code }) => {
      if (ws !== socket) return;
      socket = null;
      clearInterval(ping);

      if (code === LIVE_GONE) gone = true;
      if (!wanted || gone) return;

      retry = setTimeout(connect, retryDelay(attempt));
      attempt += 1;
    });
  };

  return {
    start() {
      if (wanted || gone) return;
      wanted = true;
      connect();
    },

    stop() {
      wanted = false;
      clearTimeout(retry);
      clearInterval(ping);
      socket?.close(1000);
      socket = null;
    },
  };
};
