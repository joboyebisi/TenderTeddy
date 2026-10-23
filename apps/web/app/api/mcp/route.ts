import type { NextRequest } from 'next/server';
import { accessToken, refreshAccessToken } from '../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const configuredWebOrigin = process.env.NEXT_PUBLIC_WANDERWRAP_URL;
  const requestOrigin = request.headers.get('origin');
  if (!configuredWebOrigin || requestOrigin !== new URL(configuredWebOrigin).origin) {
    return Response.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  const base = process.env.WANDERWRAP_CORE_API_URL;
  if (!base) return Response.json({ error: 'Core API is not configured' }, { status: 503 });
  const body = await request.text();
  let token = await accessToken();
  if (!token) return Response.json({ error: 'Sign in required' }, { status: 401 });

  const forward = (bearer: string) => fetch(new URL('/mcp', base), {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
      'mcp-protocol-version': '2025-11-25'
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000)
  });

  let response = await forward(token);
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await forward(refreshed);
  }
  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' }
  });
}
