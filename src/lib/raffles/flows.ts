/**
 * Los flujos que tocan el Durable Object, solo o junto con D1.
 *
 * No viven en src/lib/db/ porque no son repositorios: reciben además el
 * namespace del DO. La regla de qué va primero está en docs/03 — D1 escribe
 * primero porque es quien puede responder si el slug es único.
 *
 * recibe los bindings por parámetro para poder testearse contra el runtime
 * de `@cloudflare/vitest-pool-workers`. El que los resuelve es `./bound.ts`.
 */

import type { Actor } from '@/lib/auth/actor';
import { userIdOf } from '@/lib/auth/actor';
import type { RaffleDetailsInput, RaffleRangeInput } from '@/lib/db/raffles';
// Del repositorio y no del barril de `../db`: este módulo recibe el `db` por
// parámetro (y también el namespace del DO), así que está del lado de adentro
// del límite que arma `src/lib/db/index.ts`, no del lado de las páginas.
import {
  createRaffle,
  deleteRaffleRow,
  getOwnRaffle,
  getPublicRaffleBySlug,
  markCancelled,
  markClosed,
  markPublished,
  setContactPhone,
  updateRaffle,
} from '@/lib/db/raffles';
import type {
  BuyerInput,
  DrawResult,
  NewRaffle,
  OwnerNumber,
  OwnerRaffle,
  PublicNumber,
  PublicRaffle,
  RaffleUpdate,
  SellResult,
} from '@/types/raffle';
import { AppError, codeOf } from '@/utils/errors';

type RaffleNamespace = Env['RAFFLE'];

/**
 * Quién llama, o FORBIDDEN. Está acá y no repetido en cada función porque un
 * `userIdOf()` sin el chequeo de null es justo la forma de mandarle `null` como
 * dueño a `assertOwner()` y depender de que el DO se acuerde de fallar cerrado.
 */
const requireUser = (actor: Actor): string => {
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');
  return userId;
};

export const createRaffleWithGrid = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  input: NewRaffle,
): Promise<{ id: string; slug: string }> => {
  const { id, slug, ownerId } = await createRaffle(db, actor, input);

  // Si esto falla queda una fila huérfana en D1: el dueño la ve en su panel,
  // `ownerGrid()` le devuelve la grilla vacía en vez de un 404, y `rebuildGrid`
  // reintenta este mismo init() — idempotente justamente para eso.
  await raffles.getByName(id).init({
    raffleId: id,
    ownerId,
    tier: 'BASIC',
    status: 'DRAFT',
    numberStart: input.numberStart,
    totalNumbers: input.totalNumbers,
  });

  return { id, slug };
};

export const publishRaffle = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  raffleId: string,
  /**
   * El teléfono, si se está cargando en el mismo gesto («Guardar y publicar»
   * del renglón «Antes de publicar»). Se guarda ANTES de leer la fila, así el
   * chequeo de abajo lo ve. Sin esto, el botón del encabezado sigue mandando
   * sólo `{ id }` y este parámetro llega `null`.
   */
  contactPhone: string | null = null,
): Promise<void> => {
  const userId = requireUser(actor);

  if (contactPhone !== null) {
    await setContactPhone(db, actor, raffleId, contactPhone);
  }

  const raffle = await getOwnRaffle(db, actor, raffleId);

  // El CHECK de la tabla lo exige igual; acá se convierte en un mensaje.
  if (raffle.contactPhone === null)
    throw new AppError('RAFFLE_NOT_PUBLISHABLE');

  await markPublished(db, actor, raffleId);

  // El DO tiene su propia copia del estado: sin esto seguiría creyendo que la
  // rifa está en borrador y rechazaría los pedidos de una rifa ya publicada.
  await raffles.getByName(raffleId).syncConfig(userId, {
    tier: raffle.tier,
    status: 'PUBLISHED',
  });
};

/**
 * La pantalla de detalle: la fila de D1 más la grilla del organizador.
 *
 * D1 va primero y no es por gusto: `getOwnRaffle()` ya niega una rifa ajena o
 * inexistente, así que una petición que no corresponde no llega a despertar el
 * Durable Object —que es lo que cuesta plata— ni a cruzar el límite RPC.
 *
 * ⚠️ Un ADMIN pasa el chequeo de D1 (`getOwnRaffle` lo deja) y NO pasa el del
 * DO, que compara contra el dueño y nada más. Es a propósito: el objeto falla
 * cerrado. Si algún día el admin tiene que ver una grilla ajena, se agrega un
 * método del DO que lo diga con todas las letras, no un parámetro que ablande
 * `assertOwner()`.
 */
export const ownerGrid = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  raffleId: string,
): Promise<{ raffle: OwnerRaffle; numbers: OwnerNumber[] }> => {
  const userId = requireUser(actor);

  const raffle = await getOwnRaffle(db, actor, raffleId);

  // D1 ya confirmó que sos el dueño de esta rifa. Un FORBIDDEN del objeto acá
  // sólo puede significar que init() nunca corrió —el objeto falla cerrado
  // sin dueño, ver assertOwner()— y la fila quedó huérfana: no es una rifa
  // ajena, es una grilla sin armar. Antes esto tiraba para arriba y la
  // pantalla lo confundía con una rifa inexistente (404); ahora se lo pasamos
  // vacío, y es la pantalla la que ofrece rearmarlo con `rebuildGrid`.
  const numbers = await raffles
    .getByName(raffleId)
    .ownerGrid(userId)
    .catch((error: unknown) => {
      if (codeOf(error) === 'FORBIDDEN') return [];
      throw error;
    });

  return { raffle, numbers };
};

/**
 * La página pública: la fila de D1 más la grilla de sólo número y estado.
 *
 * D1 va primero por la misma razón que en `ownerGrid`: un slug inexistente, o
 * un borrador que mira alguien que no es el dueño, sale acá con `null` y no
 * despierta el Durable Object. La regla de quién ve qué la pone
 * `getPublicRaffleBySlug`; este flujo no la repite.
 *
 * Una rifa huérfana (fila sin grilla) devuelve la lista vacía: `publicGrid()`
 * no tiene `assertOwner`, así que un objeto sin `init()` no falla, sólo no
 * tiene números. La página decide qué mostrar en ese caso.
 */
export const publicGrid = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  slug: string,
): Promise<{ raffle: PublicRaffle; numbers: PublicNumber[] } | null> => {
  const raffle = await getPublicRaffleBySlug(db, actor, slug);
  if (raffle === null) return null;

  const numbers = await raffles.getByName(raffle.id).publicGrid();

  return { raffle, numbers };
};

/**
 * Conecta al visitante con el Durable Object para mirar la grilla en vivo.
 *
 * Es `publicGrid` para el que se queda mirando: la misma regla de quién ve qué
 * (`getPublicRaffleBySlug`), la misma pregunta a D1 antes de despertar el
 * objeto, y del otro lado la misma superficie pública. Un borrador ajeno o un
 * slug inexistente salen con `null` y el DO ni se entera.
 *
 * El `request` viaja entero porque el DO necesita ver el `Upgrade`, y lo que
 * vuelve es su respuesta tal cual: un 101 que lleva el WebSocket adentro.
 * Reconstruirla (`new Response(body, res)`) perdería el socket.
 */
export const watchPublicGrid = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  slug: string,
  request: Request,
): Promise<Response | null> => {
  const raffle = await getPublicRaffleBySlug(db, actor, slug);
  if (raffle === null) return null;

  return raffles.getByName(raffle.id).fetch(request);
};

/**
 * Reintenta `init()` sobre una rifa huérfana: el alta escribió la fila en D1
 * pero la llamada al DO que arma la grilla no llegó a buen puerto (ver el
 * comentario de `createRaffleWithGrid`). `init()` es un no-op si el objeto ya
 * tiene dueño, así que llamarlo de más nunca pisa una grilla que sí prendió.
 */
export const rebuildGrid = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  raffleId: string,
): Promise<void> => {
  const userId = requireUser(actor);
  const raffle = await getOwnRaffle(db, actor, raffleId);

  await raffles.getByName(raffleId).init({
    raffleId,
    ownerId: userId,
    tier: raffle.tier,
    status: raffle.status,
    numberStart: raffle.numberStart,
    totalNumbers: raffle.totalNumbers,
  });
};

/**
 * Vender y liberar NO pasan por D1, a diferencia de las tres de arriba: el
 * dueño lo verifica el propio objeto con `assertOwner()`, que es la copia que
 * vive pegada a los datos. Leer la fila antes sería un viaje de más para llegar
 * a la misma respuesta, y encima a la peor de las dos: D1 es el caché, el DO es
 * la verdad.
 */
export const sellNumbers = async (
  raffles: RaffleNamespace,
  actor: Actor,
  raffleId: string,
  numbers: number[],
  buyer: BuyerInput,
): Promise<SellResult> =>
  raffles.getByName(raffleId).sell(requireUser(actor), numbers, buyer);

export const releaseNumbers = async (
  raffles: RaffleNamespace,
  actor: Actor,
  raffleId: string,
  numbers: number[],
): Promise<number[]> =>
  raffles.getByName(raffleId).release(requireUser(actor), numbers);

/**
 * Edita una rifa. Los datos —título, premio, descripción, fecha, teléfono— se
 * tocan en cualquier estado; el rango —cantidad, arranque, precio— sólo en
 * DRAFT: fuera de DRAFT se ignora lo que venga, porque cambiarlo le cambiaría
 * el trato a quien ya compró.
 *
 * Si en DRAFT cambió la cantidad o el arranque, la grilla del DO ya no
 * corresponde: se rehace con destroy() + init(). El precio no vive en el DO,
 * así que un cambio de sólo precio no lo despierta.
 */
export const updateRaffleDetails = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  raffleId: string,
  input: RaffleUpdate,
): Promise<void> => {
  const userId = requireUser(actor);
  const current = await getOwnRaffle(db, actor, raffleId);

  const details: RaffleDetailsInput = {
    title: input.title,
    description: input.description,
    prize: input.prize,
    drawDate: input.drawDate,
    contactPhone: input.contactPhone,
  };

  const range: RaffleRangeInput | undefined =
    current.status === 'DRAFT'
      ? {
          totalNumbers: input.totalNumbers,
          numberStart: input.numberStart,
          ticketPrice: input.ticketPrice,
        }
      : undefined;

  await updateRaffle(db, actor, raffleId, details, range);

  const rangeChanged =
    range !== undefined &&
    (range.totalNumbers !== current.totalNumbers ||
      range.numberStart !== current.numberStart);

  if (!rangeChanged) return;

  // La instancia sigue viva entre las dos llamadas. destroy() vacía el meta
  // (incluido owner_id) y vuelve a migrar; init() ve owner_id === null y
  // resiembra. `ownerId: userId` es correcto porque destroy() ya pasó su
  // assertOwner: sólo el dueño real llega hasta acá (un ADMIN se cae en
  // destroy(), y es a propósito — el DO no tiene bypass).
  await raffles.getByName(raffleId).destroy(userId);
  await raffles.getByName(raffleId).init({
    raffleId,
    ownerId: userId,
    tier: current.tier,
    status: 'DRAFT',
    numberStart: range.numberStart,
    totalNumbers: range.totalNumbers,
  });
};

/**
 * Sortea y cierra. El orden es el inverso de `publishRaffle`, y a propósito:
 * acá el que decide es el Durable Object —elige el número y lo registra—, y D1
 * copia el resultado. Si D1 falla, el reintento vuelve a entrar por acá, el
 * objeto devuelve el MISMO ganador (`drawWinner()` es idempotente) y la
 * escritura se repite igual.
 *
 * D1 va primero sólo para leer: una rifa ajena o inexistente se niega antes
 * de despertar el objeto, y el estado de la fila dice si hay algo que sortear.
 * `CLOSED` deja pasar porque es el reintento.
 */
export const drawRaffle = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  raffleId: string,
  manual: number | null,
): Promise<DrawResult> => {
  const userId = requireUser(actor);
  const raffle = await getOwnRaffle(db, actor, raffleId);

  if (raffle.status === 'DRAFT') throw new AppError('RAFFLE_NOT_PUBLISHED');
  if (raffle.status === 'CANCELLED') throw new AppError('RAFFLE_FINISHED');

  const winner = await raffles.getByName(raffleId).drawWinner(userId, manual);

  await markClosed(db, actor, raffleId, winner);

  return winner;
};

/**
 * Anula. Mismo orden que el sorteo: el objeto deja de vender y corta el vivo,
 * y después la fila pasa a `CANCELLED` —con lo cual el link público deja de
 * abrir—. Los dos pasos aguantan el reintento.
 */
export const cancelRaffle = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  raffleId: string,
): Promise<void> => {
  const userId = requireUser(actor);
  const raffle = await getOwnRaffle(db, actor, raffleId);

  if (raffle.status === 'CLOSED') throw new AppError('RAFFLE_FINISHED');

  await raffles.getByName(raffleId).cancel(userId);
  await markCancelled(db, actor, raffleId);
};

/**
 * Borra una rifa que no vendió nada. **El objeto primero, D1 después** (docs/09):
 * si el objeto fallara con la fila ya borrada, quedaría cobrando storage sin
 * que nadie tenga su id para volver a él. Al revés, lo peor que pasa es una
 * rifa vacía en el panel, que se puede volver a borrar.
 *
 * La pregunta de si vendió la hace el objeto adentro de `discard()`, no esto:
 * una venta cargada desde otra pestaña entre la pregunta y el borrado se
 * perdería. Lo que sí se mira acá es si hay grilla: una rifa huérfana (el
 * `init()` nunca corrió) no tiene nada que vaciar, y su objeto sin dueño
 * contestaría FORBIDDEN a cualquiera.
 */
export const deleteRaffle = async (
  db: D1Database,
  raffles: RaffleNamespace,
  actor: Actor,
  raffleId: string,
): Promise<void> => {
  const userId = requireUser(actor);
  const raffle = await getOwnRaffle(db, actor, raffleId);

  if (raffle.status === 'CLOSED') throw new AppError('RAFFLE_FINISHED');

  const stub = raffles.getByName(raffleId);
  if ((await stub.stats()).total > 0) await stub.discard(userId);

  await deleteRaffleRow(db, actor, raffleId);
};
