/**
 * La grilla de una rifa dibujada como SVG: título, barra de avance y una celda
 * por número.
 *
 * Existe porque la grilla tiene DOS salidas que tienen que verse igual: la
 * página pública (`/r/[slug]`) y la imagen que el organizador baja para
 * mandar al grupo (SVG → canvas → PNG, todo en su navegador). Si cada una la
 * dibujara por su cuenta se irían separando; acá vive el único dibujo.
 *
 * Los colores van en hex y no como `var(--…)`: la imagen se rasteriza desde un
 * `<img src="data:image/svg+xml…">`, y un SVG cargado así no ve ni las
 * variables CSS ni las fuentes de la página. Los valores salen de
 * docs/11 · «Los tres estados del número».
 *
 * Recibe `PublicNumber[]` a propósito: el panel puede pasar sus `OwnerNumber`
 * (extienden a `PublicNumber`), pero esta función no puede filtrar un
 * comprador porque el tipo no tiene dónde llevarlo.
 */

import type { PublicNumber } from '@/types/raffle';
import { progress } from '@/utils/format';
import { numberLabel, numberWidth } from '@/utils/frontmatter/numbers';

const COLOR = {
  paper: '#F5EEE0',
  ink: '#17181C',
  subtle: '#4A4C55',
  track: '#E4DAC6',
  progress: '#1B6E45',
  free: { fill: '#FFFCF6', stroke: '#D8CDB6', text: '#17181C' },
  taken: {
    fill: '#EAE2D1',
    stroke: '#E0D7C4',
    text: '#A7A192',
    slash: '#BEB5A2',
  },
} as const;

/** 64 + 10 × 88 + 9 × 8 + 64 = 1080: el ancho que WhatsApp no recomprime. */
const PAD = 64;
const COLS = 10;
const CELL = 88;
const GAP = 8;
const WIDTH = PAD * 2 + COLS * CELL + (COLS - 1) * GAP;

const INNER_WIDTH = WIDTH - PAD * 2;
const BAR_Y = 200;
const BAR_HEIGHT = 20;
const GRID_TOP = 260;

/** Lo que entra en una línea a 52px sin salirse de los 952 de ancho útil. */
const TITLE_MAX = 30;

export type GridSvgInput = {
  title: string;
  numberStart: number;
  numbers: PublicNumber[];
};

export type GridSvg = {
  svg: string;
  width: number;
  height: number;
};

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);

const clip = (title: string): string =>
  title.length > TITLE_MAX
    ? `${title.slice(0, TITLE_MAX - 1).trimEnd()}…`
    : title;

/** Vendido o reservado: para el que mira, las dos cosas son «ya no está». */
const isTaken = ({ status }: PublicNumber): boolean =>
  status === 'SOLD' || status === 'RESERVED';

const cell = (item: PublicNumber, index: number, width: number): string => {
  const x = PAD + (index % COLS) * (CELL + GAP);
  const y = GRID_TOP + Math.floor(index / COLS) * (CELL + GAP);
  const colors = isTaken(item) ? COLOR.taken : COLOR.free;

  // El borde de 2px se dibuja hacia adentro: el rect va 1px corrido y 2px más
  // chico, así la celda mide exactamente CELL como en el CSS.
  const box = `<rect x="${x + 1}" y="${y + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="14" fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="2"/>`;

  // El tachado del talonario de papel: de la esquina de abajo a la de arriba.
  const slash = isTaken(item)
    ? `<line x1="${x + 10}" y1="${y + CELL - 10}" x2="${x + CELL - 10}" y2="${y + 10}" stroke="${COLOR.taken.slash}" stroke-width="3" stroke-linecap="round"/>`
    : '';

  const label = `<text x="${x + CELL / 2}" y="${y + CELL / 2}" dy="0.35em" text-anchor="middle" font-size="32" font-weight="800" fill="${colors.text}" style="font-variant-numeric:tabular-nums">${numberLabel(item.number, width)}</text>`;

  return box + slash + label;
};

export const gridSvg = ({
  title,
  numberStart,
  numbers,
}: GridSvgInput): GridSvg => {
  const total = numbers.length;
  const sold = numbers.filter(({ status }) => status === 'SOLD').length;
  const pct = progress(sold, total);
  const width = numberWidth(numberStart, total);

  const rows = Math.ceil(total / COLS);
  const height = GRID_TOP + rows * CELL + Math.max(0, rows - 1) * GAP + PAD;

  const barFill =
    pct > 0
      ? `<rect x="${PAD}" y="${BAR_Y}" width="${Math.round((INNER_WIDTH * pct) / 100)}" height="${BAR_HEIGHT}" rx="10" fill="${COLOR.progress}"/>`
      : '';

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH}" height="${height}" font-family="Figtree, system-ui, sans-serif">`,
    `<rect width="${WIDTH}" height="${height}" fill="${COLOR.paper}"/>`,
    `<text x="${PAD}" y="${PAD + 52}" font-size="52" font-weight="800" fill="${COLOR.ink}">${escapeXml(clip(title))}</text>`,
    `<text x="${PAD}" y="176" font-size="30" font-weight="600" fill="${COLOR.subtle}">${sold} de ${total} vendidos</text>`,
    `<rect x="${PAD}" y="${BAR_Y}" width="${INNER_WIDTH}" height="${BAR_HEIGHT}" rx="10" fill="${COLOR.track}"/>`,
    barFill,
    ...numbers.map((item, index) => cell(item, index, width)),
    '</svg>',
  ].join('');

  return { svg, width: WIDTH, height };
};
