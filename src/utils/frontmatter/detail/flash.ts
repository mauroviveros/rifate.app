/**
 * El cartel de éxito que deja el PRG.
 *
 * Las cinco acciones del detalle redirigen con un `?ok=…` y acá se traduce a
 * castellano. El parámetro lo puede escribir cualquiera en la barra, así que lo
 * que no esté en el mapa se ignora en vez de mostrarse.
 */
const FLASH: Record<string, (count: number) => string> = {
  published: () => 'Listo: tu rifa quedó publicada.',
  updated: () => 'Listo: guardamos los cambios.',
  phone: () => 'Listo: guardamos el teléfono.',
  sold: (count) => `Vendiste ${count} número${count === 1 ? '' : 's'}.`,
  freed: (count) => `Liberaste ${count} número${count === 1 ? '' : 's'}.`,
  rebuilt: () => 'Listo: rearmamos el talonario.',
};

export const flashMessage = (ok: string | null): string | null => {
  if (!ok) return null;

  const [kind, count] = ok.split('-');
  const build = FLASH[kind ?? ''];

  return build ? build(Number(count) || 0) : null;
};
