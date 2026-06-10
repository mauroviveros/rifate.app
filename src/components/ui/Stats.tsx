import { cn } from "@/lib/utils/react";
import type { Stats } from "@/types";
import { Icon } from "@iconify/react";
import { Card, CardContent, CardHeader, CardTitle } from "@shadcn/card";
import { cva, type VariantProps } from "class-variance-authority";

const statsVariants = cva(
  "gap-2 py-4 rounded-2xl shadow-card",
  {
    variants: {
      highlight: {
        default: "[&_svg]:text-primary",
        accent: "[&_svg]:text-accent [&_p]:text-accent",
        primary: "[&_svg]:text-primary [&_p]:text-primary",
      },
    },
    defaultVariants: {
      highlight: "default",
    },
  }
)

export function Stats(
  { name, value, icon, highlight, className }:
  VariantProps<typeof statsVariants> & React.ComponentProps<"div"> & Stats
) {
  return (
    <Card className={cn(statsVariants({ highlight, className }))}>
      <CardHeader className="flex items-center gap-2 px-4">
        <span className="p-1.5 rounded-2xl bg-muted">
          <Icon icon={icon} className="size-4" />
        </span>

        <CardTitle className="text-xs text-muted-foreground font-semibold">{name}</CardTitle>
      </CardHeader>

      <CardContent className="px-4">
        <p className="text-lg lg:text-xl font-extrabold text-right">
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
