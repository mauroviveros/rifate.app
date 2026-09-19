/** `Rifa del Club 2026` → `rifa-del-club-2026`. Sin acentos ni signos. */
export const slugify = (text: string): string =>
  text
    .toLowerCase() // convierte a minúsculas
    .normalize('NFD') // descompone los caracteres acentuados en dos caracteres: la letra y el acento
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-z0-9]+/g, '-') // reemplaza todo por guion (excepto letras y números)
    .replace(/^-+|-+$/g, '') // quita guiones al principio y al final
    .slice(0, 60) || 'rifa';

/**
 * El slug con el que se guarda una rifa: `slugify()` más ocho caracteres al
 * azar, para que dos rifas con el mismo título no choquen.
 */
export const genSlug = (title: string): string =>
  `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
