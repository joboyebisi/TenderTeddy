import 'server-only';
import { NextResponse } from 'next/server';
import { oauthConfig, pkceChallenge, privateCookie, randomUrlSafe, STATE_COOKIE, VERIFIER_COOKIE } from './oauth';

export function beginOAuth(mode: 'login' | 'signup') {
  const config = oauthConfig();
  const state = randomUrlSafe();
  const verifier = randomUrlSafe(64);
  const authorization = new URL(mode === 'signup' ? '/signup' : '/oauth2/authorize', config.baseUrl);
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
}
