import 'server-only';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE, oauthConfig, privateCookie, REFRESH_COOKIE } from './oauth';

export async function accessToken() {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function refreshAccessToken() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  try {
    const config = oauthConfig();
    const response = await fetch(new URL('/oauth2/token', config.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: config.clientId, refresh_token: refreshToken }),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Refresh failed');
    const tokens = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    jar.set(ACCESS_COOKIE, tokens.access_token, privateCookie(tokens.expires_in || 3600));
    if (tokens.refresh_token) jar.set(REFRESH_COOKIE, tokens.refresh_token, privateCookie(30 * 86400));
    return tokens.access_token;
  } catch {
    jar.delete(ACCESS_COOKIE);
    jar.delete(REFRESH_COOKIE);
    return null;
  }
}
