import type { NextRequest } from 'next/server';
import { accessToken, refreshAccessToken } from '../../../../lib/session';

const ALLOWED_ROOTS = new Set(['me', 'recipients', 'recommendations', 'routes', 'gifts', 'providers', 'audit']);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

async function forward(request: NextRequest, context: RouteContext<'/api/core/[...path]'>) {
  if (!METHODS.has(request.method)) return Response.json({ error: 'Method not allowed' }, { status: 405 });
  if (!['GET', 'HEAD'].includes(request.method)) {
    const configuredWebOrigin = process.env.NEXT_PUBLIC_WANDERWRAP_URL;
    const requestOrigin = request.headers.get('origin');
    if (!configuredWebOrigin || requestOrigin !== new URL(configuredWebOrigin).origin) return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  }
  const { path } = await context.params;
  if (!path.length || !ALLOWED_ROOTS.has(path[0])) return Response.json({ error: 'Core route not allowed' }, { status: 404 });
  const base = process.env.WANDERWRAP_CORE_API_URL;
  if (!base) return Response.json({ error: 'Core API is not configured' }, { status: 503 });
  const target = new URL(`/v1/${path.map(encodeURIComponent).join('/')}`, base);
  target.search = request.nextUrl.search;
  let token = await accessToken();
  if (!token) return Response.json({ error: 'Sign in required' }, { status: 401 });
  const requestBody = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  const forwardRequest = (bearer: string) => fetch(target, {
    method: request.method,
    headers: {
      'content-type': request.headers.get('content-type') || 'application/json',
      authorization: `Bearer ${bearer}`
    },
    body: requestBody,
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000)
  });
  let response = await forwardRequest(token);
  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) response = await forwardRequest(refreshedToken);
  }
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
