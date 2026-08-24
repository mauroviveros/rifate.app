import type { ServerClient } from '@/lib/supabase/server';
import type { RaffleInput } from '@/schemas/raffle';
import type { OwnerRaffle, PublicRaffle, RaffleListItem } from '@/types/raffle';

// Única fuente de queries a Supabase para rifas. Las páginas y actions piden
// datos acá en vez de armar sus propios `select`, para mantener las consultas
// tipadas y en un solo lugar.

const PUBLIC_SELECT = '*, numbers:raffle_numbers(number, status)';
const OWNER_SELECT = `
  *,
  buyers:raffle_buyers(*),
  numbers:raffle_numbers(*, buyer:raffle_buyers(*))
`;
const LIST_SELECT = `
  id, title, description, price, total_numbers, draw_date, status,
  numbers:raffle_numbers(number, status)
`;

/** Rifa publicada visible para cualquiera, o `null` si no existe o no está publicada. */
export const getPublicRaffle = async (
  client: ServerClient,
  id: string,
): Promise<PublicRaffle | null> => {
  const { data } = await client
    .from('raffles')
    .select(PUBLIC_SELECT)
    .eq('id', id)
    .eq('status', 'PUBLISHED')
    .single();

  return (data as PublicRaffle | null) ?? null;
};

/** Rifa que pertenece a `ownerId`, o `null` si no existe o no es de ese dueño. */
export const getOwnerRaffle = async (
  client: ServerClient,
  id: string,
  ownerId: string,
): Promise<OwnerRaffle | null> => {
  const { data } = await client
    .from('raffles')
    .select(OWNER_SELECT)
    .eq('id', id)
    .single();

  const raffle = data as OwnerRaffle | null;
  if (!raffle || raffle.owner_id !== ownerId) return null;
  return raffle;
};

/** Todas las rifas del usuario actual (acotadas por RLS). */
export const listOwnerRaffles = async (
  client: ServerClient,
): Promise<RaffleListItem[]> => {
  const { data } = await client.from('raffles').select(LIST_SELECT);
  return (data as RaffleListItem[] | null) ?? [];
};

/** El id del dueño de una rifa, o `null` si no existe. */
export const getRaffleOwnerId = async (
  client: ServerClient,
  id: string,
): Promise<string | null> => {
  const { data } = await client
    .from('raffles')
    .select('owner_id')
    .eq('id', id)
    .single();

  return data?.owner_id ?? null;
};

/** Inserta una rifa para `ownerId` y devuelve el id de la fila creada. */
export const insertRaffle = (
  client: ServerClient,
  input: RaffleInput,
  ownerId: string,
) =>
  client
    .from('raffles')
    .insert({ ...input, owner_id: ownerId })
    .select('id')
    .single();

export type SellResult =
  | { ok: true; buyerId: string }
  | { ok: false; reason: 'conflict' | 'error' };

/**
 * Registra un comprador y marca sus números como vendidos. Si falla la
 * asignación de números (p. ej. uno fue tomado en simultáneo), se revierte
 * el alta del comprador para no dejar registros huérfanos.
 */
export const sellRaffleNumbers = async (
  client: ServerClient,
  params: {
    raffleId: string;
    buyer: { name: string; phone?: string | null; note?: string | null };
    numbers: number[];
  },
): Promise<SellResult> => {
  const { data: buyer, error: buyerError } = await client
    .from('raffle_buyers')
    .insert({
      raffle_id: params.raffleId,
      name: params.buyer.name,
      phone: params.buyer.phone ?? null,
      note: params.buyer.note ?? null,
    })
    .select('id')
    .single();

  if (buyerError || !buyer) {
    console.error('Error creating buyer:', buyerError);
    return { ok: false, reason: 'error' };
  }

  const { error: numbersError } = await client.from('raffle_numbers').insert(
    params.numbers.map((number) => ({
      raffle_id: params.raffleId,
      number,
      buyer_id: buyer.id,
      status: 'SOLD' as const,
    })),
  );

  if (numbersError) {
    await client.from('raffle_buyers').delete().eq('id', buyer.id);
    return {
      ok: false,
      reason: numbersError.code === '23505' ? 'conflict' : 'error',
    };
  }

  return { ok: true, buyerId: buyer.id };
};
