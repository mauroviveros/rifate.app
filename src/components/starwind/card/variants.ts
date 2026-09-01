import { tv } from "@/lib/tv";

export const card = tv({
  base: [
    "bg-card text-card-foreground group/card ring-border flex flex-col gap-(--card-spacing) rounded-xl py-(--card-spacing) ring-2",
    "has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0",
    "*:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
  ],
  variants: {
    size: {
      sm: "[--card-spacing:--spacing(5)] text-support",
      // docs/11 · Formas: la tarjeta de Talonario lleva 26px de padding.
      md: "[--card-spacing:26px]",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export const cardAction = tv({
  base: "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
});

export const cardContent = tv({
  base: "px-(--card-spacing)",
});

export const cardDescription = tv({
  base: "text-muted-foreground text-support group-data-[size=sm]/card:text-label",
});

export const cardFooter = tv({
  base: "bg-muted/50 flex items-center rounded-b-xl border-t p-(--card-spacing)",
});

export const cardHeader = tv({
  base: [
    "@container/card-header grid auto-rows-min items-start gap-1 px-(--card-spacing)",
    "has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
  ],
});

export const cardTitle = tv({
  base: "font-heading text-title font-extrabold group-data-[size=sm]/card:text-support",
});
