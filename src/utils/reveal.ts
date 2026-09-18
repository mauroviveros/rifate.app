/**
 * Llevar la vista a algo y enfocarlo. Corre SÓLO en el cliente: es el único
 * módulo de `utils/` que toca el DOM, y por eso se importa desde los `<script>`
 * de los componentes y nunca desde un frontmatter.
 *
 * Existe porque el alta, el panel de venta y «Antes de publicar» hacían los
 * tres el mismo gesto tras un error del server, con el mismo bloque copiado.
 * Lo que comparten es el CÓMO; QUÉ elemento se elige es cosa de cada pantalla
 * —una busca en todo el documento, otra dentro de su `<form>`, la tercera
 * acepta además un `[role="alert"]` y enfoca un campo distinto del que
 * scrollea— así que esa parte se queda en el punto de llamada.
 */

/**
 * Scrollea `target` al centro y enfoca `focus` (por defecto, el mismo
 * `target`). Un `target` nulo no hace nada: así el que llama no necesita
 * envolver la llamada en un `if`.
 *
 * ⚠️ El `document.fonts.ready` no es decorativo. Las fuentes de la app se
 * cargan de Google Fonts, y mientras no llegan el texto se pinta con la de
 * sistema: si el scroll ocurre antes del cambio, el layout se corre DESPUÉS de
 * haber scrolleado y el campo termina fuera de la pantalla. Hay que esperar a
 * que las fuentes estén para que el `scrollIntoView` mida bien.
 *
 * `preventScroll: true` en el foco es por lo mismo: sin eso el `focus()`
 * dispara su propio scroll instantáneo y se come el `behavior: 'smooth'` del
 * `scrollIntoView` de la línea de arriba.
 *
 * Un `focus` explícitamente `null` scrollea sin enfocar nada — el caso del
 * error de dominio, donde lo marcado es un párrafo y no un campo.
 */
export const revealAndFocus = (
  target: HTMLElement | null | undefined,
  focus: HTMLElement | null | undefined = target,
): void => {
  if (!target) return;

  const reveal = () => {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    focus?.focus({ preventScroll: true });
  };

  if (document.fonts) document.fonts.ready.then(reveal);
  else reveal();
};
