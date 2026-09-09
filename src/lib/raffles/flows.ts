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

import type {
  BuyerInput,
  NewRaffle,
  OwnerNumber,
  OwnerRaffle,
  RaffleUpdate,
  SellResult,
} from '@/types/raffle';
import { AppError } from '@/utils/errors';

import type { Actor } from '../auth/actor';
import { userIdOf } from '../auth/actor';
import type { RaffleDetailsInput, RaffleRangeInput } from '../db/raffles';
// Del repositorio y no del barril de `../db`: este módulo recibe el `db` por
// parámetro (y también el namespace del DO), así que está del lado de adentro
// del límite que arma `src/lib/db/index.ts`, no del lado de las páginas.
import {
  createRaffle,
  getOwnRaffle,
  markPublished,
  updateRaffle,
} from '../db/raffles';

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

  // Si esto falla queda una fila huérfana en D1 y se reintenta: init() es
  // idempotente justamente para eso.
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
): Promise<void> => {
  const userId = requireUser(actor);
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
  const numbers = await raffles.getByName(raffleId).ownerGrid(userId);

  return { raffle, numbers };
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
