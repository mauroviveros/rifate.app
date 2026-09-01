import { createTV } from 'tailwind-variants';

/**
 * `tv` con la escala de Talonario declarada.
 *
 * tailwind-variants mergea con tailwind-merge, y tailwind-merge sólo conoce la
 * escala de fábrica. Sin esto, las claves propias de `global.css` no se
 * resuelven y rompen de dos formas distintas:
 *
 *   - `text-support` no se reconoce como tamaño, así que cae en el grupo de
 *     COLOR y se come al `text-muted-foreground` que va antes.
 *   - `h-button` no pisa al `h-11` de un variant heredado: quedan los dos en
 *     el class y gana el que la hoja haya emitido último — que cambia según
 *     qué otras clases existan en el proyecto.
 *
 * Las claves son las de los `@theme` de `src/styles/global.css`: si agregás un
 * `--text-*` o un `--spacing-*` propio, va también acá.
 */
export const tv = createTV({
  twMergeConfig: {
    extend: {
      theme: {
        text: ['display', 'title', 'body', 'support', 'label'],
        spacing: ['button', 'field', 'cell', 'cell-mobile'],
      },
    },
  },
});
