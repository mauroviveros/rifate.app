import { tv } from "@/lib/tv";

/**
 * Botones de Talonario · artboard `Sistema`, tarjeta "BOTONES · ALTURA MÍNIMA 56px".
 *
 *   Acción principal    bg vermellón   + SELLO (sombra dura #8F2410)
 *   Acción secundaria   bg tinta         plana
 *   Acción terciaria    borde de tinta   plana
 *   Deshabilitado       bg #E4DAC6, texto #8A857A, "dice por qué"
 *
 * El sello —`box-shadow: 0 5px 0 0`, sin blur— lo lleva SÓLO la principal.
 * Es lo que hace que la única acción principal de la pantalla (regla 2) se
 * distinga sin depender del color (regla 8).
 */
export const button = tv({
  base: [
    // r16 sale de `rounded-lg` porque --radius es 1rem. 800 de peso, como el canvas.
    "inline-flex items-center justify-center gap-2.5 rounded-lg font-extrabold tracking-tight whitespace-nowrap",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "transition-all outline-none focus-visible:ring-3",
    "disabled:pointer-events-none data-disabled:pointer-events-none",
    // El deshabilitado es una superficie diseñada, no una opacidad: tiene que
    // leerse, porque la regla 7 le pide que explique el motivo en su etiqueta.
    "disabled:bg-disabled disabled:text-disabled-foreground disabled:border-transparent disabled:shadow-none",
    "data-disabled:bg-disabled data-disabled:text-disabled-foreground data-disabled:border-transparent data-disabled:shadow-none",
    "aria-invalid:border-error aria-invalid:focus-visible:ring-error/40",
  ],
  variants: {
    variant: {
      // ACCIÓN PRINCIPAL. La sombra es el vermellón oscuro del canvas.
      primary:
        "bg-primary text-primary-foreground sello-primary-shadow sello-press hover:bg-primary/90 focus-visible:ring-primary/50",
      // ACCIÓN SECUNDARIA: tinta llena, plana.
      default: "bg-foreground text-background hover:bg-foreground/90 focus-visible:ring-outline/50",
      secondary: "bg-foreground text-background hover:bg-foreground/90 focus-visible:ring-outline/50",
      // ACCIÓN TERCIARIA: borde de 2px de tinta, plana, peso 700.
      outline:
        "border-2 border-foreground bg-transparent font-bold text-foreground hover:bg-accent focus-visible:ring-outline/50",
      ghost: "hover:bg-accent hover:text-foreground focus-visible:ring-outline/50",
      success: "bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/50",
      warning: "bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning/50",
      error: "bg-error text-error-foreground hover:bg-error/90 focus-visible:ring-error/50",
      info: "bg-info text-info-foreground hover:bg-info/90 focus-visible:ring-outline/50",
    },
    size: {
      sm: "h-button-min px-5 text-support has-[>svg]:px-4 [&_svg:not([class*='size-'])]:size-4.5",
      md: "h-button px-7 text-body has-[>svg]:px-6 [&_svg:not([class*='size-'])]:size-5",
      // El CTA único de una pantalla: 68px, como Login y Create.
      lg: "h-button-lg px-8 text-body has-[>svg]:px-7 [&_svg:not([class*='size-'])]:size-6",
      "icon-sm": "size-button-min [&_svg:not([class*='size-'])]:size-4.5",
      icon: "size-button [&_svg:not([class*='size-'])]:size-5",
      "icon-lg": "size-button-lg [&_svg:not([class*='size-'])]:size-6",
    },
  },
  defaultVariants: { variant: "default", size: "md" },
});
