import { tv } from '@/lib/tv';

/**
 * El logotipo · la caja con el ticket y la palabra al lado.
 *
 * Las medidas salen de los artboards, no de una escala inventada:
 *
 *   size   caja  radio  icono  palabra   dónde
 *   ────   ────  ─────  ─────  ───────   ───────────────────────────────────────
 *   sm      32     10     19     20px    Main · LandingMobile · DashboardMobile
 *   md      36     11     21     22px    PublicDesktop · Dashboard · Detail · Create
 *   lg      38     12     22     24px    Landing
 *   xl      42     13     24     26px    Login
 *   bar    32→36  10→11  19→21  20→22px  la barra del panel: sm en el celular, md de 640 para arriba
 */
export const brand = tv({
  slots: {
    base: 'inline-flex w-fit items-center gap-2.5',
    ticket: 'grid shrink-0 place-items-center',
    icon: '',
    word: 'font-display font-extrabold tracking-tight',
    suffix: 'text-primary',
  },
  variants: {
    size: {
      sm: {
        ticket: 'size-8 rounded-xs',
        icon: 'size-4.75',
        word: 'text-[20px]/none',
      },
      md: {
        ticket: 'size-9 rounded-[11px]',
        icon: 'size-5.25',
        word: 'text-[22px]/none',
      },
      lg: {
        ticket: 'size-9.5 rounded-sm',
        icon: 'size-5.5',
        word: 'text-[24px]/none',
      },
      xl: {
        ticket: 'size-10.5 rounded-[13px]',
        icon: 'size-6',
        word: 'text-[26px]/none',
      },
      /**
       * La barra del panel, que en el canvas son dos artboards: `sm` en el
       * celular (`DashboardMobile`) y `md` de los 640 para arriba (`Dashboard`,
       * `Detail`, `Create`). Va como una medida y no como dos `<Brand>` con
       * `hidden`/`sm:block`: el logotipo se achica, no hay dos logotipos
       * turnándose, y el que lee el HTML ve un solo enlace.
       */
      bar: {
        ticket: 'size-8 rounded-xs sm:size-9 sm:rounded-[11px]',
        icon: 'size-4.75 sm:size-5.25',
        word: 'text-[20px]/none sm:text-[22px]/none',
      },
    },
    color: {
      ink: { ticket: 'bg-foreground text-background' },
      primary: { ticket: 'bg-primary text-primary-foreground' },
    },
  },
  defaultVariants: { size: 'md', color: 'ink' },
});
