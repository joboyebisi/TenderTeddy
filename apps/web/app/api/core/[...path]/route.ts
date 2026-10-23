import type { NextRequest } from 'next/server';

const ALLOWED_ROOTS = new Set(['me', 'recipients', 'recommendations', 'routes', 'gifts', 'providers', 'audit']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

async function forward(request: NextRequest, context: RouteContext<'/api/core/[...path]'>) {
  if (!METHODS.has(request.method)) return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const { path } = await context.params;
  if (!path.length || !ALLOWED_ROOTS.has(path[0])) return Response.json({ error: 'Core route not allowed' }, { status: 404 });
  const base = process.env.WANDERWRAP_CORE_API_URL;
  if (!base) return Response.json({ error: 'Core API is not configured' }, { status: 503 });
  const target = new URL(`/v1/${path.map(encodeURIComponent).join('/')}`, base);
  target.search = request.nextUrl.search;
  const authorization = request.headers.get('authorization');
  const response = await fetch(target, {
    method: request.method,
    headers: {
      'content-type': request.headers.get('content-type') || 'application/json',
      ...(authorization ? { authorization } : {})
    },
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000)
  });
  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' }
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
