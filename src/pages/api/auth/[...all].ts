import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

import { createAuth } from '@/lib/auth';
export const prerender = false;

const handler: APIRoute = ({ request }) => createAuth(env).handler(request);

export const GET = handler;
export const POST = handler;
