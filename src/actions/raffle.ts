import { defineAction } from 'astro:actions';

import { setContactPhone } from '@/lib/db';
import {
  cancelRaffle,
  createRaffleWithGrid,
  deleteRaffle,
  drawRaffle,
  publishRaffle,
  rebuildGrid as rebuildRaffleGrid,
  releaseNumbers,
  sellNumbers,
  updateRaffleDetails,
} from '@/lib/raffles';

import { asActionError } from './errors';
import {
  cancelRaffleSchema,
  deleteRaffleSchema,
  drawRaffleSchema,
  newRaffleSchema,
  publishRaffleSchema,
  raffleUpdateSchema,
  rebuildGridSchema,
  releaseNumbersSchema,
  sellNumbersSchema,
  setPhoneSchema,
} from './raffle.schema';

/**
 * El try/catch, una sola vez. Sin esto, cada action repite cinco líneas y
 * alcanza con que una se olvide del catch para que un `FORBIDDEN` llegue a la
 * pantalla como «500 Internal Server Error» con el stack adentro.
 */
const translatingErrors = async <T>(useCase: () => Promise<T>): Promise<T> => {
  try {
    return await useCase();
  } catch (error) {
    throw asActionError(error);
  }
};

export const create = defineAction({
  accept: 'form',
  input: newRaffleSchema,
  handler: (input, { locals }) =>
    translatingErrors(() => createRaffleWithGrid(locals.actor, input)),
});

export const publish = defineAction({
  accept: 'form',
  input: publishRaffleSchema,
  handler: ({ id, contactPhone }, { locals }) =>
    translatingErrors(async () => {
      await publishRaffle(locals.actor, id, contactPhone);
      return { id };
    }),
});

export const setPhone = defineAction({
  accept: 'form',
  input: setPhoneSchema,
  handler: ({ id, contactPhone }, { locals }) =>
    translatingErrors(async () => {
      await setContactPhone(locals.actor, id, contactPhone);
      return { id };
    }),
});

export const update = defineAction({
  accept: 'form',
  input: raffleUpdateSchema,
  handler: ({ id, ...input }, { locals }) =>
    translatingErrors(async () => {
      await updateRaffleDetails(locals.actor, id, input);
      return { id };
    }),
});

export const sell = defineAction({
  accept: 'form',
  input: sellNumbersSchema,
  handler: ({ id, numbers, name, phone, note }, { locals }) =>
    translatingErrors(() =>
      sellNumbers(locals.actor, id, numbers, { name, phone, note }),
    ),
});

export const release = defineAction({
  accept: 'form',
  input: releaseNumbersSchema,
  handler: ({ id, numbers }, { locals }) =>
    translatingErrors(() => releaseNumbers(locals.actor, id, numbers)),
});

export const rebuildGrid = defineAction({
  accept: 'form',
  input: rebuildGridSchema,
  handler: ({ id }, { locals }) =>
    translatingErrors(async () => {
      await rebuildRaffleGrid(locals.actor, id);
      return { id };
    }),
});

export const draw = defineAction({
  accept: 'form',
  input: drawRaffleSchema,
  handler: ({ id, manual }, { locals }) =>
    translatingErrors(async () => {
      const { number } = await drawRaffle(locals.actor, id, manual);
      return { id, number };
    }),
});

export const cancel = defineAction({
  accept: 'form',
  input: cancelRaffleSchema,
  handler: ({ id }, { locals }) =>
    translatingErrors(async () => {
      await cancelRaffle(locals.actor, id);
      return { id };
    }),
});

/** `delete` es palabra reservada: no puede ser el nombre de un export. */
export const remove = defineAction({
  accept: 'form',
  input: deleteRaffleSchema,
  handler: ({ id }, { locals }) =>
    translatingErrors(async () => {
      await deleteRaffle(locals.actor, id);
      return { id };
    }),
});
