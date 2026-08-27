import { createAuth } from "@/lib/auth";
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
export const prerender = false;

const handler: APIRoute = ({ request }) => createAuth(env).handler(request);

export const GET = handler;
export const POST = handler;
