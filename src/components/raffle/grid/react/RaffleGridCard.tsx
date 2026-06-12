import { Card, CardContent, CardHeader, CardTitle } from '@shadcn/card';

import { formatRaffleNumber } from '@/lib/formatters';
import { getNumberLength } from '@/lib/utils';

import { RaffleGridCell } from './RaffleGridCell';
import { RaffleGridLegend } from './RaffleGridLegend';

interface Props {
  editable?: boolean;
  length: number;
  soldNumbers?: number[];
  selectedNumbers?: number[];
  title?: string;
  numberPadding?: number;
  onToggleNumber?: (number: number) => void;
}

export function RaffleGridCard({
  editable = false,
  length,
  soldNumbers = [],
  selectedNumbers = [],
  title = 'Números',
  numberPadding,
  onToggleNumber,
}: Props) {
  const soldSet = new Set(soldNumbers);
  const selectedSet = new Set(selectedNumbers);
  const padding = numberPadding ?? getNumberLength(length);

  return (
    <Card>
      <CardHeader className="mb-4 flex flex-wrap items-center justify-between">
        <CardTitle className="text-foreground flex-1 text-lg font-bold">
          {title}
        </CardTitle>
        <RaffleGridLegend className="ml-auto" />
      </CardHeader>
      <CardContent
        className={[
          'grid grid-cols-10 gap-1',
          editable ? '' : 'pointer-events-none',
        ].join(' ')}
      >
        {Array.from({ length }, (_, index) => {
          return (
            <RaffleGridCell
              key={index}
              number={formatRaffleNumber(index, padding)}
              isSold={soldSet.has(index)}
              isSelected={selectedSet.has(index)}
              editable={editable}
              onToggle={() => onToggleNumber?.(index)}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
