import { Icon } from '@iconify/react';
import { Button } from '@shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shadcn/card';

import { RaffleGrid } from '@/components/raffle/grid/react';
import { useRaffle } from '@/hooks/useRaffle';
import {
  formatCurrency,
  formatDate,
  formatRaffleNumber,
} from '@/lib/formatters';
import { getNumberLength } from '@/lib/utils';
import { buildRaffleInterestMessage, buildWhatsAppUrl } from '@/lib/whatsapp';

// Island interactivo del detalle público: reutiliza la grilla React y el hook
// useRaffle (mismos que el dashboard) para la selección de números, y arma el
// link de WhatsApp de forma reactiva según lo seleccionado. Reemplaza la grilla
// Astro + el <script> imperativo que antes vivían en la página.
interface Props {
  length: number;
  soldNumbers: number[];
  contactPhone: string | null;
  price: number;
  drawDate: string;
}

export function RafflePublicNumbers({
  length,
  soldNumbers,
  contactPhone,
  price,
  drawDate,
}: Props) {
  const padding = getNumberLength(length);
  const { raffle, toggleSelectedNumber } = useRaffle({
    length,
    initials: { solds: soldNumbers },
  });

  const selected = raffle.numbers.selecteds;
  const soldCount = raffle.count.solds;

  // Sin teléfono no hay link (botón deshabilitado); con números seleccionados
  // precargamos el mensaje, y sin selección dejamos el chat vacío.
  const whatsappHref = contactPhone
    ? buildWhatsAppUrl(
        contactPhone,
        selected.length
          ? buildRaffleInterestMessage(
              selected.map((n) => formatRaffleNumber(n, padding)),
            )
          : undefined,
      )
    : undefined;

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_16rem]">
      <div className="space-y-4">
        <RaffleGrid
          editable
          length={length}
          soldNumbers={raffle.numbers.solds}
          selectedNumbers={selected}
          onToggleSelectedNumber={toggleSelectedNumber}
        />
      </div>

      <div className="space-y-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-foreground font-bold">
              Detalles de la rifa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Precio por número</span>
              <span className="text-foreground font-bold">
                {formatCurrency(price)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vendidos</span>
              <span className="text-foreground font-bold">
                {soldCount}/{length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fecha del sorteo</span>
              <span className="text-foreground font-bold">
                {formatDate(new Date(drawDate), { dateStyle: 'medium' })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-foreground font-bold">
              ¿Querés comprar?
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              {selected.length > 0
                ? `Tenés ${selected.length} número${selected.length !== 1 ? 's' : ''} seleccionado${selected.length !== 1 ? 's' : ''}.`
                : 'Seleccioná los números que te interesan y contactá al organizador.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {whatsappHref ? (
              <Button asChild className="w-full">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon icon="lucide:message-circle" />
                  Contactar al organizador
                </a>
              </Button>
            ) : (
              <Button className="w-full" disabled>
                <Icon icon="lucide:message-circle" />
                Contactar al organizador
              </Button>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="bg-secondary/20 border-0">
          <CardContent>
            <p className="text-muted-foreground text-sm leading-relaxed">
              <strong>Tocá</strong> los números disponibles para seleccionarlos.
              Después usá el botón de WhatsApp para enviarle tu selección al
              organizador.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
