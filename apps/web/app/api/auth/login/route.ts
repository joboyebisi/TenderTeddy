import { NextResponse } from 'next/server';
import { oauthConfig, pkceChallenge, privateCookie, randomUrlSafe, STATE_COOKIE, VERIFIER_COOKIE } from '../../../../lib/oauth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = oauthConfig();
    const state = randomUrlSafe();
    const verifier = randomUrlSafe(64);
    const authorization = new URL('/oauth2/authorize', config.baseUrl);
    authorization.searchParams.set('response_type', 'code');
    authorization.searchParams.set('client_id', config.clientId);
    authorization.searchParams.set('redirect_uri', config.redirectUri);
    authorization.searchParams.set('scope', config.scopes.join(' '));
    authorization.searchParams.set('state', state);
    authorization.searchParams.set('code_challenge_method', 'S256');
    authorization.searchParams.set('code_challenge', pkceChallenge(verifier));
    authorization.searchParams.set('resource', config.resource);

    const response = NextResponse.redirect(authorization);
    response.cookies.set(STATE_COOKIE, state, privateCookie(600));
    response.cookies.set(VERIFIER_COOKIE, verifier, privateCookie(600));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication is not configured' }, { status: 503 });
  }
}
