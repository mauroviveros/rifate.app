import type { APIRoute } from 'astro';

import { watchPublicGrid } from '@/lib/raffles';

/**
 * El WebSocket de la página pública: `/r/{slug}/live`.
 *
 * El `Upgrade` se mira acá primero, antes de ir a D1: un GET común a esta
 * dirección (un crawler, alguien que la pegó en el navegador) no tiene por qué
 * costar una consulta. El DO lo vuelve a mirar, porque no confía.
 *
 * La respuesta del DO se devuelve tal cual. Si algo en el medio la
 * reconstruyera, el 101 llegaría sin el socket.
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Se espera un WebSocket', { status: 426 });
  }

  const { slug } = params;
  if (!slug) return new Response('No encontrado', { status: 404 });

  const waching = await watchPublicGrid(locals.actor, slug, request);
  return waching ?? new Response('No encontrado', { status: 404 });
};
