import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, oauthConfig, privateCookie, REFRESH_COOKIE, STATE_COOKIE, VERIFIER_COOKIE } from '../../../../lib/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  const verifier = jar.get(VERIFIER_COOKIE)?.value;
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(new URL('/?auth=invalid', request.url));
  }

  try {
    const config = oauthConfig();
    const tokenResponse = await fetch(new URL('/oauth2/token', config.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: verifier,
        resource: config.resource
      }),
      cache: 'no-store'
    });
    if (!tokenResponse.ok) throw new Error('Token exchange failed');
    const tokens = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    const response = NextResponse.redirect(new URL('/dashboard', config.webUrl));
    response.cookies.set(ACCESS_COOKIE, tokens.access_token, privateCookie(tokens.expires_in || 3600));
    if (tokens.refresh_token) response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, privateCookie(30 * 86400));
    response.cookies.delete(STATE_COOKIE);
    response.cookies.delete(VERIFIER_COOKIE);
    return response;
  } catch {
    return NextResponse.redirect(new URL('/?auth=failed', request.url));
  }
}
