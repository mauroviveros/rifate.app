import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

type Props = ComponentProps<'ul'>;

export function RaffleGridLegend({ className, ...props }: Props) {
  return (
    <ul
      className={cn(
        'text-muted-foreground flex items-center gap-2 text-xs',
        className,
      )}
      {...props}
    >
      <li className="flex items-center gap-1">
        <span className="bg-raffle-available inline-block size-2.5 rounded" />
        <p>Disponible</p>
      </li>
      <li className="flex items-center gap-1">
        <span className="bg-raffle-sold inline-block size-2.5 rounded" />
        <p>Vendido</p>
      </li>
      <li className="flex items-center gap-1">
        <span className="bg-raffle-selected inline-block size-2.5 rounded" />
        <p>Seleccionado</p>
      </li>
    </ul>
  );
}
