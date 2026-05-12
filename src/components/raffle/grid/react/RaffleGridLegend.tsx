import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

interface Props extends ComponentProps<"ul"> {}

export function RaffleGridLegend({ className, ...props }: Props) {
  return (
    <ul
      className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}
      {...props}
    >
      <li className="flex items-center gap-1">
        <span className="size-2.5 rounded bg-raffle-available inline-block" />
        <p>Disponible</p>
      </li>
      <li className="flex items-center gap-1">
        <span className="size-2.5 rounded bg-raffle-sold inline-block" />
        <p>Vendido</p>
      </li>
      <li className="flex items-center gap-1">
        <span className="size-2.5 rounded bg-raffle-selected inline-block" />
        <p>Seleccionado</p>
      </li>
    </ul>
  )
}
