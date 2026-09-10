import { z } from 'astro/zod';

import type { NewRaffle, RaffleUpdate } from '@/types/raffle';
import { pesos, today } from '@/utils/format';
import { phone } from '@/utils/normalize';

/** El tope de números de una rifa BASIC. El mismo que aplica el CHECK. */
const MAX_RAFFLE_NUMBERS = 1_000;

/**
 * Tope por operación del Durable Object (`MAX_NUMEROS_POR_OPERACION`).
 *
 * NO se llama `MAX_PER_ORDER`: `order` es una entidad real de este dominio —la
 * tabla `orders` del plan PRO, con sus estados PENDING/CONFIRMED (fase 8)— y
 * este tope no tiene nada que ver con ella. Vale para vender y para liberar.
 */
const MAX_PER_OPERATION = 50;

/** El máximo por número, en PESOS. El CHECK de la tabla habla en centavos. */
const MAX_PRICE = 10_000_000;

/**
 * Un texto que puede no estar.
 *
 * Un input vacío NO llega como `''`: el `formDataToObject` de Astro hace
 * `if (!value) return null` antes de validar. El `.transform()` es para el otro
 * caso, el de los espacios: «   » sí es un valor, y sin esto quedaría guardado
 * como cadena vacía — que no es lo mismo que «no hay premio cargado».
 */
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((s) => (s === '' ? null : s))
    .nullable()
    .default(null);

/**
 * El teléfono no se valida con una regex propia: se le pregunta a
 * `normalize.phone()`, que es la que después lo va a guardar. Dos reglas
 * distintas para el mismo campo terminan siempre igual — el formulario acepta
 * algo que la base rechaza, y el error aparece tres pantallas más adelante.
 */
const isPhone = (raw: string): boolean => {
  try {
    phone(raw);
    return true;
  } catch {
    return false;
  }
};

const optionalPhone = z
  .string()
  .trim()
  .refine(isPhone, 'Ese teléfono no se entiende. Ejemplo: 341 555 1234.')
  .transform((s) => (s === '' ? null : s))
  .nullable()
  .default(null);

/** Como `optionalPhone` pero obligatorio — lo usa `raffle.setPhone`. */
const requiredPhone = z
  .string({ error: 'Poné un teléfono de contacto.' })
  .trim()
  .min(1, 'Poné un teléfono de contacto.')
  .refine(isPhone, 'Ese teléfono no se entiende. Ejemplo: 341 555 1234.');

const isRealDate = (iso: string): boolean =>
  new Date(`${iso}T00:00:00.000Z`).toISOString().startsWith(iso);

/** El id de una rifa: `crypto.randomUUID()` en `createRaffle()`. */
const raffleId = z.uuid('Esa rifa no existe.');

/**
 * Los números de una operación. El `max` repite el tope del Durable Object, y
 * no es redundancia: es que el organizador se entere en el formulario y no
 * después de un viaje al objeto.
 */
const numbers = z
  .array(z.number().int().nonnegative(), { error: 'Elegí al menos un número.' })
  .min(1, 'Elegí al menos un número.')
  .max(
    MAX_PER_OPERATION,
    `Podés cargar hasta ${MAX_PER_OPERATION} números por vez.`,
  );

export const newRaffleSchema = z.object({
  title: z
    .string({ error: 'Poné cómo se llama la rifa.' })
    .trim()
    .min(3, 'El título tiene que tener al menos 3 letras.')
    .max(100, 'El título no puede superar las 100 letras.'),
  description: optionalText(
    500,
    'La descripción no puede superar las 500 letras.',
  ),
  prize: optionalText(200, 'El premio no puede superar las 200 letras.'),
  ticketPrice: z
    .number({ error: 'Poné cuánto sale cada número.' })
    .positive('El precio tiene que ser mayor a cero.')
    .max(MAX_PRICE, `El precio no puede superar los ${pesos(MAX_PRICE * 100)}.`)
    .transform((inPesos) => Math.round(inPesos * 100)),
  totalNumbers: z
    .number({ error: 'Poné cuántos números tiene la rifa.' })
    .int('Tiene que ser un número entero.')
    .min(1, 'Tiene que haber al menos un número.')
    .max(
      MAX_RAFFLE_NUMBERS,
      `No puede haber más de ${MAX_RAFFLE_NUMBERS} números.`,
    ),
  /**
   * Llega como texto y no como número: el `formDataToObject` de Astro convierte
   * a número sólo cuando el validador ES un `z.number()`, así que con un
   * `z.union([z.literal(0), z.literal(1)])` el `'1'` del radio llegaría string
   * y no matchearía ningún literal.
   *
   * ⚠️ Y el «arranca en 0» NO va con `.default()`, que es lo primero que uno
   * escribe: sobre un pipe, zod v4 TIPA el default contra la salida (`0 | 1`) y
   * lo VALIDA contra la entrada (`'0' | '1'`), así que las dos formas fallan y
   * una de las dos falla callada. Con `.default(0)` compila y explota en
   * runtime con «Invalid option» — justo cuando el radio no viene, que es el
   * único caso en que el default se usaría. El `.nullable()` hace el mismo
   * trabajo sin la trampa: si el campo falta, llega `null` y el transform lo
   * resuelve en 0, que es además el DEFAULT de la columna en D1.
   */
  numberStart: z
    .enum(['0', '1'], { error: 'Poné si los números arrancan en 0 o en 1.' })
    .nullable()
    .transform((v) => (v === '1' ? 1 : 0) as 0 | 1),
  drawDate: z
    .string({ error: 'Poné cuándo se sortea la rifa.' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no tiene el formato correcto.')
    .refine(isRealDate, 'La fecha no es válida.')
    .refine((iso) => iso >= today(), 'Esa fecha ya pasó. Elegí otra.'),
  contactPhone: optionalPhone,
});

/**
 * `contactPhone` opcional: el botón del encabezado manda sólo `{ id }`, pero el
 * renglón «Guardar y publicar» del detalle en DRAFT manda además el teléfono,
 * que el flujo guarda antes de publicar.
 */
export const publishRaffleSchema = z.object({
  id: raffleId,
  contactPhone: optionalPhone,
});

/** Cargar el teléfono desde el detalle sin publicar todavía. */
export const setPhoneSchema = z.object({
  id: raffleId,
  contactPhone: requiredPhone,
});

/**
 * El update valida los mismos campos que el alta, más el id. La pantalla de
 * edición manda todos —los de rango van de sólo lectura cuando la rifa no está
 * en DRAFT, pero viajan igual— y el flujo decide cuáles aplica.
 */
export const raffleUpdateSchema = newRaffleSchema.extend({ id: raffleId });
export const releaseNumbersSchema = z.object({
  id: raffleId,
  numbers,
});

export const sellNumbersSchema = z.object({
  id: raffleId,
  numbers,
  name: z
    .string({ error: 'Poné el nombre del comprador.' })
    .trim()
    .min(1, 'Poné el nombre del comprador.')
    .max(100, 'Ese nombre es demasiado largo.'),
  phone: optionalPhone,
  note: optionalText(200, 'La nota no puede superar las 200 letras.'),
});

type Assert<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * El esquema produce EXACTAMENTE un `NewRaffle`: ni un campo de más ni de
 * menos. Es la misma idea que `_OwnerNumberEsUnPublicNumber` en types/raffle.ts
 * — si mañana la tabla suma una columna obligatoria y el tipo la refleja, esta
 * línea deja de compilar antes de que el formulario se entere.
 */
export type _SchemaMatchesNewRaffle = Assert<
  Equal<z.infer<typeof newRaffleSchema>, NewRaffle>
>;

/** El update es el alta más el id: los mismos campos, misma garantía. */
export type _SchemaMatchesRaffleUpdate = Assert<
  Equal<Omit<z.infer<typeof raffleUpdateSchema>, 'id'>, RaffleUpdate>
>;
