import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Actor } from '@/lib/auth/actor';
import type { NewRaffle } from '@/types/raffle';

import { createRaffle, getOwnRaffle } from './raffles';
import { issueVoucher, redeemVoucher } from './vouchers';

const organizador = (userId: string): Actor => ({ kind: 'organizer', userId });
const admin = (userId: string): Actor => ({ kind: 'admin', userId });
const visitante: Actor = { kind: 'visitor' };

const RIFA: NewRaffle = {
  title: 'Rifa del Club',
  description: null,
  prize: null,
  ticketPrice: 250000,
  totalNumbers: 100,
  numberStart: 0,
  drawDate: '2026-12-24',
  contactPhone: '+543415551234',
};

const seedProfile = (id: string) =>
  env.DB.prepare(`INSERT INTO profiles (id, display_name) VALUES (?, ?)`)
    .bind(id, id)
    .run();

const usosDe = async (code: string) => {
  const v = await env.DB.prepare(
    'SELECT used_count FROM vouchers WHERE code = ?',
  )
    .bind(code)
    .first<{ used_count: number }>();
  return v?.used_count ?? null;
};

const emitirPro = () =>
  issueVoucher(env.DB, admin('root'), {
    code: 'rifate-ong24', // en minúscula a propósito: lo normaliza el repo
    tier: 'PRO',
    maxUses: 5,
    expiresAt: null,
    note: 'ONG 2024',
  });

beforeEach(async () => {
  await seedProfile('root');
  await seedProfile('ana');
  await seedProfile('beto');
});

describe('vouchers · emisión', () => {
  it('sólo el admin emite', async () => {
    const input = {
      code: 'RIFATE-X',
      tier: 'PRO' as const,
      maxUses: 1,
      expiresAt: null,
      note: null,
    };

    await expect(
      issueVoucher(env.DB, organizador('ana'), input),
    ).rejects.toThrow('FORBIDDEN');
    await expect(issueVoucher(env.DB, visitante, input)).rejects.toThrow(
      'FORBIDDEN',
    );
  });

  it('el código se guarda en mayúsculas', async () => {
    const { code } = await emitirPro();
    expect(code).toBe('RIFATE-ONG24');
  });
});

describe('vouchers · canje', () => {
  it('no se puede canjear contra la rifa de otro', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);
    await emitirPro();

    await expect(
      redeemVoucher(env.DB, organizador('beto'), 'RIFATE-ONG24', id),
    ).rejects.toThrow('FORBIDDEN');

    // Y no se consumió un uso en el intento.
    expect(await usosDe('RIFATE-ONG24')).toBe(0);
  });

  it('el dueño canja y la rifa queda PRO', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);
    await emitirPro();

    const { tier } = await redeemVoucher(
      env.DB,
      organizador('ana'),
      'rifate-ong24', // el usuario lo escribe como quiere
      id,
    );

    const rifa = await getOwnRaffle(env.DB, organizador('ana'), id);

    expect(tier).toBe('PRO');
    expect(rifa.tier).toBe('PRO');
    expect(rifa.unlockMethod).toBe('VOUCHER');
    expect(await usosDe('RIFATE-ONG24')).toBe(1);
  });

  it('la misma rifa no se habilita dos veces', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);
    await emitirPro();
    await redeemVoucher(env.DB, organizador('ana'), 'RIFATE-ONG24', id);

    await expect(
      redeemVoucher(env.DB, organizador('ana'), 'RIFATE-ONG24', id),
    ).rejects.toThrow('RAFFLE_ALREADY_UNLOCKED');

    expect(await usosDe('RIFATE-ONG24')).toBe(1);
  });

  it('un voucher agotado no habilita nada', async () => {
    await issueVoucher(env.DB, admin('root'), {
      code: 'RIFATE-UNICO',
      tier: 'PRO',
      maxUses: 1,
      expiresAt: null,
      note: null,
    });

    const una = await createRaffle(env.DB, organizador('ana'), RIFA);
    const otra = await createRaffle(env.DB, organizador('ana'), RIFA);

    await redeemVoucher(env.DB, organizador('ana'), 'RIFATE-UNICO', una.id);

    await expect(
      redeemVoucher(env.DB, organizador('ana'), 'RIFATE-UNICO', otra.id),
    ).rejects.toThrow('VOUCHER_EXHAUSTED');

    const segunda = await getOwnRaffle(env.DB, organizador('ana'), otra.id);
    expect(segunda.tier).toBe('BASIC');
  });

  it('un voucher vencido no habilita nada', async () => {
    await issueVoucher(env.DB, admin('root'), {
      code: 'RIFATE-VIEJO',
      tier: 'PRO',
      maxUses: 5,
      expiresAt: Date.now() - 1000,
      note: null,
    });

    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);

    await expect(
      redeemVoucher(env.DB, organizador('ana'), 'RIFATE-VIEJO', id),
    ).rejects.toThrow('VOUCHER_EXPIRED');
  });

  it('un código que no existe no dice nada más que eso', async () => {
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);

    await expect(
      redeemVoucher(env.DB, organizador('ana'), 'NO-EXISTE', id),
    ).rejects.toThrow('VOUCHER_NOT_FOUND');
  });

  it('un canje bueno no deja basura en _abort', async () => {
    // La tabla existe sólo para reventar la transacción desde una condición
    // SQL: sus dos INSERT son `SELECT 1 WHERE NOT EXISTS (…)`, así que cuando
    // la condición se cumple no insertan nada. Esto fija que las guardas no
    // den falso positivo — si lo dieran, TODO canje válido fallaría.
    const { id } = await createRaffle(env.DB, organizador('ana'), RIFA);
    await emitirPro();

    await redeemVoucher(env.DB, organizador('ana'), 'RIFATE-ONG24', id);

    const abort = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM _abort',
    ).first<{ n: number }>();

    expect(abort?.n).toBe(0);
  });
});
