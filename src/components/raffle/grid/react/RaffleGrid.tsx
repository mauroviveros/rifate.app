import { Card, CardContent, CardHeader, CardTitle } from "@shadcn/card"
import { formatRaffleNumber } from "@/lib/formatters"
import { getNumberLength } from "@/lib/utils"

import { RaffleGridCell } from "./RaffleGridCell"
import { RaffleGridLegend } from "./RaffleGridLegend"
import { Icon } from "@iconify/react"

interface Props {
  editable?: boolean
  length: number
  soldNumbers?: number[]
  selectedNumbers?: number[]
  title?: string
  numberPadding?: number
  onToggleSelectedNumber?: (number: number) => void
}

export function RaffleGrid({
  editable = false,
  length,
  soldNumbers = [],
  selectedNumbers = [],
  onToggleSelectedNumber,
}: Props) {
  const soldSet = new Set(soldNumbers);
  const selectedSet = new Set(selectedNumbers);
  const padding = getNumberLength(length);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between mb-4 flex-wrap">
        <CardTitle className="font-bold text-lg text-foreground flex items-center gap-2 flex-1">
          <Icon icon="lucide:ticket" className="text-primary" />
          Números
        </CardTitle>
        <RaffleGridLegend className="ml-auto" />
      </CardHeader>
      <CardContent
        className={[
          "grid grid-cols-10 gap-1",
          editable ? "" : "pointer-events-none",
        ].join(" ")}
      >
        {Array.from({ length }, (_, index) => {
          return (
            <RaffleGridCell
              key={index}
              number={formatRaffleNumber(index, padding)}
              isSold={soldSet.has(index)}
              isSelected={selectedSet.has(index)}
              editable={editable}
              onToggleSelected={() => onToggleSelectedNumber?.(index)}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}
