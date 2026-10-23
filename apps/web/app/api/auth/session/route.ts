import { accessToken, refreshAccessToken } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const core = process.env.WANDERWRAP_CORE_API_URL;
  if (!core) return Response.json({ authenticated: false, reason: 'core-not-configured' });
  let token = await accessToken();
  if (!token) return Response.json({ authenticated: false });
  let response = await fetch(new URL('/v1/me', core), { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) response = await fetch(new URL('/v1/me', core), { headers: { authorization: `Bearer ${refreshedToken}` }, cache: 'no-store' });
  }
  if (!response.ok) return Response.json({ authenticated: false });
  const profile = await response.json();
  return Response.json({ authenticated: true, user: { id: profile.id, displayName: profile.displayName } });
}
