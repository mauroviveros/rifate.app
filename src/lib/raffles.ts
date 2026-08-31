/**
 * Los dos flujos que necesitan tocar D1 y el Durable Object en el mismo acto.
 *
 * No viven en src/lib/db/ porque no son repositorios: reciben además el
 * namespace del DO. La regla de qué va primero está en docs/03 — D1 escribe
 * primero porque es quien puede responder si el slug es único.
 */

import type { NewRaffle } from '@/types/raffle';

import type { Actor } from './auth/actor';
import { userIdOf } from './auth/actor';
import { createRaffle, getOwnRaffle, markPublished } from './db';
import { AppError } from './errors';

type RaffleNamespace = Env['RAFFLE'];

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
  const userId = userIdOf(actor);
  if (userId === null) throw new AppError('FORBIDDEN');

  const rifa = await getOwnRaffle(db, actor, raffleId);

  // El CHECK de la tabla lo exige igual; acá se convierte en un mensaje.
  if (rifa.contactPhone === null) throw new AppError('RAFFLE_NOT_PUBLISHABLE');

  await markPublished(db, actor, raffleId);

  // El DO tiene su propia copia del estado: sin esto seguiría creyendo que la
  // rifa está en borrador y rechazaría los pedidos de una rifa ya publicada.
  await raffles.getByName(raffleId).syncConfig(userId, {
    tier: rifa.tier,
    status: 'PUBLISHED',
  });
};
