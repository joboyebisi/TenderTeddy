import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE, oauthConfig, REFRESH_COOKIE, STATE_COOKIE, VERIFIER_COOKIE } from '../../../../lib/oauth';

export async function POST(request: NextRequest) {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      const config = oauthConfig();
      await fetch(new URL('/oauth2/revoke', config.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: refreshToken, client_id: config.clientId }),
        cache: 'no-store'
      });
    } catch { /* Local cookie deletion remains the safe fallback. */ }
  }
  const response = NextResponse.redirect(new URL('/', request.url), { status: 303 });
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, STATE_COOKIE, VERIFIER_COOKIE]) response.cookies.delete(name);
  return response;
}
