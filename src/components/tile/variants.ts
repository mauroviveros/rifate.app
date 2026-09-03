import { tv } from '@/lib/tv';

/**
 * El cuadradito con un ícono (o un número) centrado. Aparece en varios lados
 * del canvas con la misma forma y distinto tamaño/color:
 *
 *   size   caja  radio        dónde
 *   ────   ────  ───────────  ─────────────────────────────────────────────
 *   sm      38   rounded-sm   badge de sección numerada (Article)
 *   md      46   rounded-md   tarjeta "¿compraste un número?" (Contacto)
 *   lg      52   rounded-lg   pasos de «Cómo funciona» (HowItWorks)
 *   xl      56   rounded-xl   tarjeta del mail (Contacto)
 *
 * El `<svg>` de adentro se dimensiona solo salvo que ya traiga una clase
 * `size-*` propia (mismo truco que `button/variants.ts`).
 */
export const tile = tv({
  base: [
    'grid shrink-0 place-items-center font-display font-extrabold',
    "[&>svg]:pointer-events-none [&>svg:not([class*='size-'])]:shrink-0",
  ],
  variants: {
    size: {
      sm: "size-9.5 rounded-sm text-xl [&>svg:not([class*='size-'])]:size-5",
      md: "size-11.5 rounded-md text-[1.375rem] [&>svg:not([class*='size-'])]:size-6",
      lg: "size-13 rounded-lg text-2xl [&>svg:not([class*='size-'])]:size-6.5",
      xl: "size-14 rounded-xl text-3xl [&>svg:not([class*='size-'])]:size-7",
    },
    tone: {
      ink: 'bg-foreground text-background',
      muted: 'bg-muted text-muted-foreground',
      primary: 'bg-primary text-primary-foreground',
    },
  },
  defaultVariants: { size: 'md', tone: 'ink' },
});
