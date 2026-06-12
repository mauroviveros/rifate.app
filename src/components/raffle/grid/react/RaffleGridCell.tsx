import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

interface Props extends Omit<ComponentProps<'label'>, 'onChange'> {
  editable?: boolean;
  isSold?: boolean;
  isSelected?: boolean;
  number: string;
  onToggleSelected?: () => void;
}

export function RaffleGridCell({
  editable = false,
  isSold = false,
  isSelected = false,
  number,
  onToggleSelected,
  className,
  ...props
}: Props) {
  return (
    <label
      className={cn(
        'relative aspect-square has-disabled:cursor-not-allowed',
        editable && !isSold ? 'cursor-pointer' : 'cursor-default',
        className,
      )}
      {...props}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={isSelected}
        disabled={isSold}
        onChange={onToggleSelected}
      />
      <span
        className={cn(
          'font-bold transition-all select-none',
          'flex size-full items-center justify-center',
          'rounded-lg text-xs lg:rounded-2xl lg:text-base',
          'peer-checked:bg-raffle-selected peer-checked:text-raffle-selected-foreground',
          'peer-disabled:bg-raffle-sold peer-disabled:text-raffle-sold-foreground',
          'bg-raffle-available text-raffle-available-foreground',
          editable && !isSold ? '' : 'pointer-events-none',
        )}
      >
        {number}
      </span>
    </label>
  );
}
