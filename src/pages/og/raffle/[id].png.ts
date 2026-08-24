import { readFileSync } from 'node:fs';

import { Resvg } from '@resvg/resvg-js';
import type { APIRoute } from 'astro';
import { createElement as h } from 'react';
import satori from 'satori';

import { countSold } from '@/lib/domain/raffle';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { getPublicRaffle } from '@/lib/repositories/raffle';
import { createServerClient } from '@/lib/supabase/server';

// Genera la imagen social (Open Graph) de cada rifa on-demand: satori arma un
// SVG con el layout y resvg lo rasteriza a PNG. Se usa en las meta tags de la
// página pública para que el link se vea bien al compartirlo (WhatsApp, etc.).
export const prerender = false;

// Paleta de marca (aproximaciones hex de los tokens oklch de global.css).
const TEAL = '#16A79B';
const TEAL_DARK = '#0E7B72';
const INK = '#2B303B';
const MUTED = '#6B7280';
const ACCENT = '#E8663A';

// Las fuentes se leen del disco junto a este módulo para que el file tracing
// de Vercel las empaquete con la función serverless (ver `includeFiles` en
// astro.config).
const fontBold = readFileSync(new URL('./Nunito-Bold.ttf', import.meta.url));
const fontExtra = readFileSync(
  new URL('./Nunito-ExtraBold.ttf', import.meta.url),
);

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

const stat = (label: string, value: string, highlight = false) =>
  h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      },
    },
    h('span', { style: { fontSize: 26, color: MUTED } }, label),
    h(
      'span',
      {
        style: {
          fontSize: 44,
          fontWeight: 800,
          color: highlight ? ACCENT : INK,
        },
      },
      value,
    ),
  );

export const GET: APIRoute = async ({ params, request, cookies, rewrite }) => {
  const supabase = createServerClient({ request, cookies });
  const raffle = await getPublicRaffle(supabase, params.id ?? '');

  if (!raffle) return rewrite('/404');

  const soldCount = countSold(raffle.numbers);
  const available = raffle.total_numbers - soldCount;
  const progress = raffle.total_numbers
    ? Math.round((soldCount / raffle.total_numbers) * 100)
    : 0;

  const tree = h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 64,
        backgroundImage: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})`,
        fontFamily: 'Nunito',
        color: '#FFFFFF',
      },
    },
    // Marca
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 30,
          fontWeight: 800,
        },
      },
      h('span', {}, 'rifate.app'),
    ),
    // Título y descripción
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
          gap: 20,
        },
      },
      h(
        'span',
        { style: { fontSize: 76, fontWeight: 800, lineHeight: 1.05 } },
        truncate(raffle.title, 60),
      ),
      raffle.description
        ? h(
            'span',
            { style: { fontSize: 34, fontWeight: 700, opacity: 0.85 } },
            truncate(raffle.description, 110),
          )
        : null,
    ),
    // Tarjeta de datos (precio, disponibles, sorteo)
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          backgroundColor: '#FFFFFF',
          borderRadius: 28,
          padding: '32px 40px',
        },
      },
      h(
        'div',
        {
          style: { display: 'flex', justifyContent: 'space-between' },
        },
        stat('Precio por número', formatCurrency(raffle.price), true),
        stat('Disponibles', `${available}/${raffle.total_numbers}`),
        stat(
          'Sorteo',
          formatDate(new Date(raffle.draw_date), { dateStyle: 'medium' }),
        ),
      ),
      // Barra de progreso de ventas
      h(
        'div',
        {
          style: {
            display: 'flex',
            width: '100%',
            height: 14,
            borderRadius: 999,
            backgroundColor: '#E6F4EF',
          },
        },
        h('div', {
          style: {
            display: 'flex',
            width: `${progress}%`,
            height: '100%',
            borderRadius: 999,
            backgroundColor: TEAL,
          },
        }),
      ),
    ),
  );

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Nunito', data: fontBold, weight: 700, style: 'normal' },
      { name: 'Nunito', data: fontExtra, weight: 800, style: 'normal' },
    ],
  });

  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })
    .render()
    .asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control':
        'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
