import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { CATALOG } from './recommendation.mjs';
import { handleMcpRequest, PROTOCOL_VERSION } from './mcp-server.mjs';
import { CAPABILITIES } from './provider-platform.mjs';
import { createDefaultProviderPlatform } from './provider-adapters.mjs';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const cognito = new CognitoIdentityProviderClient({});
const providerPlatform = createDefaultProviderPlatform();
const tableName = process.env.TABLE_NAME;
const clientId = process.env.USER_POOL_CLIENT_ID;
const canonicalUrl = trimSlash(process.env.WANDERWRAP_CANONICAL_URL || 'https://api.wanderwrap.co.uk');
const authorizationIssuer = trimSlash(process.env.WANDERWRAP_AUTH_ISSUER || canonicalUrl);
const readScope = process.env.WANDERWRAP_MCP_READ_SCOPE || 'wanderwrap/gifts.read';
const writeScope = process.env.WANDERWRAP_MCP_WRITE_SCOPE || 'wanderwrap/gifts.write';
const allowedOrigins = new Set((process.env.WANDERWRAP_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
const writeTools = new Set(['create_gift_link', 'create_group_gift', 'prepare_paypal_order']);
let jwtVerifier;
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8'
};

export async function handler(event) {
  const method = event.requestContext?.http?.method || 'GET';
  const path = event.rawPath || '/';
  const origin = canonicalUrl;
  try {
    if (method === 'OPTIONS') {
      if (!isAllowedOrigin(event.headers?.origin)) throw httpError(403, 'Origin not allowed');
      return response(204, '', cors(event));
    }
    if (path === '/health') return json(200, { status: 'ok', service: 'wanderwrap', version: '1.0.0', protocolVersion: PROTOCOL_VERSION });
    if (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/mcp') {
      return json(200, { resource: `${origin}/mcp`, authorization_servers: [authorizationIssuer], scopes_supported: [readScope, writeScope], bearer_methods_supported: ['header'] });
    }
    if (path.startsWith('/v1/auth/')) {
      if (process.env.WANDERWRAP_LEGACY_AUTH_ENABLED !== 'true') throw httpError(404, 'Auth route not found');
      return await authRoute(path, body(event));
    }
    if (path.startsWith('/claim/')) return await claimRoute(method, path, event);

    if (path === '/mcp') {
      if (!isAllowedOrigin(event.headers?.origin)) throw httpError(403, 'Origin not allowed');
      const message = body(event);
      const requiredScope = message.method === 'tools/call' && writeTools.has(message.params?.name) ? writeScope : readScope;
      const user = await authenticate(event, requiredScope);
      const result = await handleMcpRequest(message, {
        userId: user.sub,
        tenantId: user.sub,
        enrichRecommendations: async recommendations => (await providerPlatform.execute(
          CAPABILITIES.EXPLANATION_GENERATE,
          { recommendations },
          { tenantId: user.sub }
        )).output
      });
      return result === null ? response(202, '') : json(200, result, { 'MCP-Protocol-Version': PROTOCOL_VERSION });
    }

    if (path.startsWith('/v1/')) {
      if (!isAllowedOrigin(event.headers?.origin)) throw httpError(403, 'Origin not allowed');
      const user = await authenticate(event, method === 'GET' ? readScope : writeScope);
      return await apiRoute(method, path, body(event), user, origin);
    }
    return await staticRoute(path);
  } catch (error) {
    const status = error.statusCode || (error.name === 'NotAuthorizedException' ? 401 : 400);
    if (status >= 500) console.error(JSON.stringify({ type: error.name, message: error.message, path, method }));
    return json(status, { error: status === 500 ? 'Internal error' : error.message });
  }
}

async function authRoute(path, input) {
  const email = String(input.email || '').trim().toLowerCase();
  if (path === '/v1/auth/signup') {
    requireFields(input, ['email', 'password']);
    const result = await cognito.send(new SignUpCommand({
      ClientId: clientId,
      Username: email,
      Password: input.password,
      UserAttributes: [{ Name: 'email', Value: email }]
    }));
    return json(201, { userSub: result.UserSub, confirmed: result.UserConfirmed, delivery: result.CodeDeliveryDetails?.Destination });
  }
  if (path === '/v1/auth/confirm') {
    requireFields(input, ['email', 'code']);
    await cognito.send(new ConfirmSignUpCommand({ ClientId: clientId, Username: email, ConfirmationCode: String(input.code) }));
    return json(200, { confirmed: true });
  }
  if (path === '/v1/auth/login') {
    requireFields(input, ['email', 'password']);
    const result = await cognito.send(new InitiateAuthCommand({ ClientId: clientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: input.password } }));
    return json(200, tokens(result.AuthenticationResult));
  }
  if (path === '/v1/auth/refresh') {
    requireFields(input, ['refreshToken']);
    const result = await cognito.send(new InitiateAuthCommand({ ClientId: clientId, AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: input.refreshToken } }));
    return json(200, tokens(result.AuthenticationResult));
  }
  if (path === '/v1/auth/forgot') {
    requireFields(input, ['email']);
    const result = await cognito.send(new ForgotPasswordCommand({ ClientId: clientId, Username: email }));
    return json(200, { sent: true, delivery: result.CodeDeliveryDetails?.Destination });
  }
  if (path === '/v1/auth/reset') {
    requireFields(input, ['email', 'code', 'password']);
    await cognito.send(new ConfirmForgotPasswordCommand({ ClientId: clientId, Username: email, ConfirmationCode: String(input.code), Password: input.password }));
    return json(200, { reset: true });
  }
  throw httpError(404, 'Auth route not found');
}

async function authenticate(event, requiredScope) {
  const accessToken = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) throw httpError(401, 'Sign in required');
  try {
    const payload = await verifier().verify(accessToken);
    const scopes = validateAccessTokenClaims(payload, { requiredScope, audience: `${canonicalUrl}/mcp` });
    return { sub: payload.sub, email: payload.email, username: payload.username || payload['cognito:username'], scopes: [...scopes] };
  } catch (error) {
    if (error?.statusCode === 403 || error?.statusCode === 500) throw error;
    throw httpError(401, 'Session is invalid or expired. Please sign in again.');
  }
}

export function validateAccessTokenClaims(payload, { requiredScope, audience }) {
  const scopes = new Set(String(payload?.scope || '').split(' ').filter(Boolean));
  if (payload?.aud !== audience) throw httpError(403, 'Token audience does not match this WanderWrap resource');
  if (requiredScope && !scopes.has(requiredScope)) throw httpError(403, `Missing required scope: ${requiredScope}`);
  return scopes;
}

function verifier() {
  if (jwtVerifier) return jwtVerifier;
  const userPoolId = process.env.USER_POOL_ID;
  const clientIds = (process.env.WANDERWRAP_TOKEN_CLIENT_IDS || clientId || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!userPoolId || !clientIds.length) throw httpError(500, 'Token verifier is not configured');
  jwtVerifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'access', clientId: clientIds.length === 1 ? clientIds[0] : clientIds });
  return jwtVerifier;
}

async function apiRoute(method, path, input, user, origin) {
  const pk = `USER#${user.sub}`;
  if (path === '/v1/providers' && method === 'GET') {
    const capabilities = Object.values(CAPABILITIES).map(name => ({
      capability: name,
      providers: providerPlatform.discover({ tenantId: user.sub, capability: name })
    })).filter(item => item.providers.length);
    return json(200, { capabilities, health: providerPlatform.health() });
  }
  if (path === '/v1/me' && method === 'GET') {
    const profile = await get(pk, 'PROFILE');
    return json(200, { id: user.sub, email: user.email, ...(profile || {}) });
  }
  if (path === '/v1/me' && method === 'PUT') {
    const item = { PK: pk, SK: 'PROFILE', entity: 'profile', displayName: clean(input.displayName, 80), locale: input.locale || 'en-GB', homeCountry: input.homeCountry || 'GB', currency: input.currency || 'GBP', updatedAt: now() };
    await put(item); await audit(pk, 'PROFILE_UPDATED', { fields: Object.keys(input) });
    return json(200, publicItem(item));
  }
  if (path === '/v1/recipients' && method === 'GET') return json(200, await list(pk, 'RECIPIENT#'));
  if (path === '/v1/recipients' && method === 'POST') {
    requireFields(input, ['displayName']);
    const id = randomUUID();
    const item = { PK: pk, SK: `RECIPIENT#${id}`, entity: 'recipient', id, displayName: clean(input.displayName, 80), relationship: clean(input.relationship || '', 80), country: input.country || 'GB', occasion: clean(input.occasion || '', 120), createdAt: now(), updatedAt: now() };
    await put(item); await audit(pk, 'RECIPIENT_CREATED', { recipientId: id });
    return json(201, publicItem(item));
  }
  const recipientMatch = path.match(/^\/v1\/recipients\/([^/]+)$/);
  if (recipientMatch && method === 'PUT') {
    const id = recipientMatch[1]; const existing = await get(pk, `RECIPIENT#${id}`);
    if (!existing) throw httpError(404, 'Recipient not found');
    const item = { ...existing, displayName: clean(input.displayName ?? existing.displayName, 80), relationship: clean(input.relationship ?? existing.relationship, 80), country: input.country || existing.country, occasion: clean(input.occasion ?? existing.occasion, 120), updatedAt: now() };
    await put(item); return json(200, publicItem(item));
  }
  if (recipientMatch && method === 'DELETE') {
    await remove(pk, `RECIPIENT#${recipientMatch[1]}`); await audit(pk, 'RECIPIENT_DELETED', { recipientId: recipientMatch[1] });
    return response(204, '');
  }
  const evidenceMatch = path.match(/^\/v1\/recipients\/([^/]+)\/evidence(?:\/([^/]+))?$/);
  if (evidenceMatch && method === 'GET') return json(200, await list(pk, `EVIDENCE#${evidenceMatch[1]}#`));
  if (evidenceMatch && method === 'POST' && !evidenceMatch[2]) {
    requireFields(input, ['topic']); const id = randomUUID();
    const item = { PK: pk, SK: `EVIDENCE#${evidenceMatch[1]}#${id}`, entity: 'evidence', id, recipientId: evidenceMatch[1], topic: clean(input.topic, 120).toLowerCase(), sourceType: input.sourceType || 'stated', confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 1))), confirmedState: input.confirmedState === 'confirmed' ? 'confirmed' : 'pending', observedAt: now() };
    await put(item); await audit(pk, 'EVIDENCE_ADDED', { recipientId: evidenceMatch[1], evidenceId: id, sourceType: item.sourceType });
    return json(201, publicItem(item));
  }
  if (evidenceMatch && evidenceMatch[2] && method === 'PATCH') {
    if (!['confirmed', 'rejected', 'pending'].includes(input.confirmedState)) throw httpError(400, 'Invalid evidence state');
    const key = { PK: pk, SK: `EVIDENCE#${evidenceMatch[1]}#${evidenceMatch[2]}` };
    await db.send(new UpdateCommand({ TableName: tableName, Key: key, UpdateExpression: 'SET confirmedState = :state, updatedAt = :now', ExpressionAttributeValues: { ':state': input.confirmedState, ':now': now() }, ConditionExpression: 'attribute_exists(PK)' }));
    return json(200, publicItem(await get(key.PK, key.SK)));
  }
  if (evidenceMatch && evidenceMatch[2] && method === 'DELETE') {
    await remove(pk, `EVIDENCE#${evidenceMatch[1]}#${evidenceMatch[2]}`); return response(204, '');
  }
  if (path === '/v1/recommendations' && method === 'POST') {
    requireFields(input, ['recipientId']);
    const recipient = await get(pk, `RECIPIENT#${input.recipientId}`);
    if (!recipient) throw httpError(404, 'Recipient not found');
    const evidence = (await list(pk, `EVIDENCE#${input.recipientId}#`)).filter(item => item.confirmedState === 'confirmed');
    const signals = evidence.map(item => ({ value: item.topic, source: item.sourceType, confidence: item.confidence }));
    let liveBooks = [];
    if (signals.some(item => /book|read|literature/.test(item.value))) {
      try {
        liveBooks = (await providerPlatform.execute(
          CAPABILITIES.CATALOGUE_ENRICH,
          { signals, country: recipient.country },
          { tenantId: user.sub, market: recipient.country }
        )).output;
      } catch { liveBooks = []; }
    }
    const ranked = await providerPlatform.execute(CAPABILITIES.RECOMMENDATION_RANK, {
      recipient: { signals, budget: Number(input.budget || 100), excluded: input.excluded || [] },
      catalog: [...liveBooks, ...CATALOG]
    }, { tenantId: user.sub, market: recipient.country });
    const recommendations = ranked.output.map(item => ({ ...item, priceType: item.price == null ? 'provider-confirmed' : 'guide', handoffUrl: item.handoffUrl || amazonSearch(item.name, recipient.country) }));
    const explanation = (await providerPlatform.execute(
      CAPABILITIES.EXPLANATION_GENERATE,
      { recipient: publicItem(recipient), signals, recommendations },
      { tenantId: user.sub }
    )).output;
    const explainedRecommendations = recommendations.map(item => ({ ...item, aiNarrative: explanation.narratives[item.id] || item.story }));
    await audit(pk, 'RECOMMENDATIONS_GENERATED', { recipientId: input.recipientId, evidenceIds: evidence.map(item => item.id), resultIds: recommendations.map(item => item.id), provider: ranked.provider });
    return json(200, { recipient: publicItem(recipient), recommendations: explainedRecommendations, aiSummary: explanation.summary, aiGenerated: explanation.generated, generatedAt: now(), sourceNote: 'Amazon Bedrock explains deterministic matches when available. Open Library metadata is live when shown. Guide prices are not availability claims; providers confirm final price and delivery.' });
  }
  if (path === '/v1/routes/evaluate' && method === 'POST') {
    const routed = await providerPlatform.execute(CAPABILITIES.FULFILLMENT_ROUTE, input, { tenantId: user.sub, market: input.destinationCountry });
    const decision = routed.output; await audit(pk, 'ROUTE_EVALUATED', { route: decision.route, reason: decision.reason, provider: routed.provider });
    return json(200, decision);
  }
  if (path === '/v1/handoffs/amazon' && method === 'POST') {
    requireFields(input, ['name', 'destinationCountry']);
    const url = amazonSearch(input.name, input.destinationCountry); await audit(pk, 'AMAZON_HANDOFF_PREPARED', { name: clean(input.name, 160), destinationCountry: input.destinationCountry });
    return json(200, { provider: 'amazon', status: 'awaiting-user', url, disclosure: 'Price, availability, delivery and final purchase are confirmed on Amazon.' });
  }
  if (path === '/v1/gifts' && method === 'GET') return json(200, await list(pk, 'GIFT#'));
  if (path === '/v1/gifts' && method === 'POST') {
    requireFields(input, ['recipientId', 'recommendation']); const id = randomUUID();
    const item = { PK: pk, SK: `GIFT#${id}`, entity: 'gift', id, senderId: user.sub, recipientId: input.recipientId, recommendation: input.recommendation, kind: input.kind || 'physical', status: 'awaiting-sender-approval', currency: input.currency || 'GBP', createdAt: now(), updatedAt: now() };
    await put(item); await audit(pk, 'GIFT_CREATED', { giftId: id, recipientId: item.recipientId }); return json(201, publicItem(item));
  }
  const claimLinkMatch = path.match(/^\/v1\/gifts\/([^/]+)\/claim-links$/);
  if (claimLinkMatch && method === 'POST') {
    if (input.userApproved !== true) throw httpError(400, 'Explicit sender approval required');
    const gift = await get(pk, `GIFT#${claimLinkMatch[1]}`); if (!gift) throw httpError(404, 'Gift not found');
    const token = randomBytes(24).toString('base64url'); const tokenHash = hash(token); const expiresAt = Math.floor(Date.now() / 1000) + 14 * 86400;
    const updated = { ...gift, status: 'claimable', claimTokenHash: tokenHash, updatedAt: now() }; await put(updated);
    await put({ PK: `CLAIM#${tokenHash}`, SK: 'CLAIM', entity: 'claim', tokenHash, giftOwnerPk: pk, giftSk: gift.SK, giftId: gift.id, recipientId: gift.recipientId, recommendation: gift.recommendation, senderDisplayName: input.senderDisplayName || user.email, status: 'claimable', expiresAt, createdAt: now() });
    await audit(pk, 'CLAIM_LINK_CREATED', { giftId: gift.id, expiresAt });
    return json(201, { giftId: gift.id, claimUrl: `${origin}/claim/${token}`, expiresAt: new Date(expiresAt * 1000).toISOString() });
  }
  if (path === '/v1/audit' && method === 'GET') return json(200, await list(pk, 'AUDIT#', 100));
  throw httpError(404, 'API route not found');
}

async function claimRoute(method, path, event) {
  const match = path.match(/^\/claim\/([^/]+)(?:\/(accept|delivery|thanks|decline))?$/);
  if (!match) throw httpError(404, 'Claim not found');
  const tokenHash = hash(match[1]); const claim = await get(`CLAIM#${tokenHash}`, 'CLAIM');
  if (!claim || claim.expiresAt < Math.floor(Date.now() / 1000)) throw httpError(404, 'This claim link is invalid or expired');
  if (method === 'GET' && !match[2]) {
    if ((event.headers?.accept || '').includes('application/json')) return json(200, publicClaim(claim));
    return claimPage(claim, match[1]);
  }
  const input = body(event); const action = match[2];
  if (method !== 'POST') throw httpError(405, 'Use POST');
  if (action === 'accept' && claim.status === 'claimable') claim.status = 'address-pending';
  else if (action === 'delivery' && claim.status === 'address-pending') {
    requireFields(input, ['name', 'addressLine1', 'city', 'postalCode', 'country']);
    claim.delivery = { name: clean(input.name, 100), addressLine1: clean(input.addressLine1, 150), addressLine2: clean(input.addressLine2 || '', 150), city: clean(input.city, 100), postalCode: clean(input.postalCode, 30), country: clean(input.country, 2).toUpperCase() };
    claim.status = 'ready-for-checkout';
  } else if (action === 'thanks' && ['fulfilled', 'ready-for-checkout'].includes(claim.status)) { claim.thanks = clean(input.message || 'Thank you!', 500); claim.status = 'completed'; }
  else if (action === 'decline' && ['claimable', 'address-pending'].includes(claim.status)) claim.status = 'declined';
  else throw httpError(409, 'That claim action is not available');
  claim.updatedAt = now(); await put(claim);
  const gift = await get(claim.giftOwnerPk, claim.giftSk); if (gift) await put({ ...gift, status: claim.status, updatedAt: now() });
  await audit(claim.giftOwnerPk, `CLAIM_${action.toUpperCase()}`, { giftId: claim.giftId });
  return json(200, publicClaim(claim));
}

async function staticRoute(path) {
  const wanted = path === '/' ? 'index.html' : path.slice(1);
  const resolved = normalize(join(publicRoot, wanted));
  if (!resolved.startsWith(publicRoot)) throw httpError(404, 'Not found');
  try {
    const data = await readFile(resolved);
    const type = contentTypes[extname(resolved)] || 'application/octet-stream';
    return { statusCode: 200, headers: { 'content-type': type, 'cache-control': extname(resolved) === '.html' ? 'no-cache' : 'public, max-age=3600' }, body: data.toString(type.startsWith('text/') || type.includes('json') ? 'utf8' : 'base64'), isBase64Encoded: !(type.startsWith('text/') || type.includes('json')) };
  } catch { throw httpError(404, 'Not found'); }
}

function claimPage(claim, token) {
  const item = claim.recommendation || {}; const safeName = escapeHtml(item.name || 'A thoughtful surprise');
  return response(200, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your WanderWrap</title><link rel="stylesheet" href="/claim.css"></head><body><main><a href="/" class="logo">wanderwrap ✦</a><section><p class="eyebrow">A PRIVATE GIFT MOMENT</p><h1>${escapeHtml(claim.senderDisplayName)} found something for you.</h1><div class="gift"><span>✦</span><div><small>THOUGHTFULLY CHOSEN</small><h2>${safeName}</h2><p>${escapeHtml(item.story || 'Chosen from preferences you confirmed.')}</p></div></div><div id="flow"><p>Your address stays private. The sender sees only whether this gift can move forward.</p><button id="accept">Accept gift</button><button class="quiet" id="decline">No thank you</button></div></section></main><script>const token=${JSON.stringify(token)};const flow=document.querySelector('#flow');async function send(a,b={}){const r=await fetch('/claim/'+token+'/'+a,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});if(!r.ok)throw Error((await r.json()).error);return r.json()}document.querySelector('#accept').onclick=async()=>{await send('accept');flow.innerHTML='<h3>Where should it go?</h3><form id="address"><input name="name" placeholder="Full name" required><input name="addressLine1" placeholder="Address line 1" required><input name="addressLine2" placeholder="Address line 2"><input name="city" placeholder="Town or city" required><input name="postalCode" placeholder="Postcode" required><input name="country" value="GB" maxlength="2" required><button>Save privately</button></form>';document.querySelector('#address').onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));await send('delivery',data);flow.innerHTML='<h3>All set.</h3><p>Your delivery details are stored privately. The sender can now complete checkout with the provider.</p>'}};document.querySelector('#decline').onclick=async()=>{await send('decline');flow.innerHTML='<h3>Declined, with no awkwardness.</h3><p>The sender will only see that another idea is needed.</p>'};</script></body></html>`, { 'content-type': 'text/html; charset=utf-8' });
}

function amazonSearch(name, country = 'GB') {
  const domains = { GB: 'www.amazon.co.uk', US: 'www.amazon.com', CA: 'www.amazon.ca', DE: 'www.amazon.de', FR: 'www.amazon.fr', IT: 'www.amazon.it', ES: 'www.amazon.es', IE: 'www.amazon.ie' };
  return `https://${domains[country] || domains.GB}/s?k=${encodeURIComponent(name)}`;
}
async function audit(pk, type, details = {}) { await put({ PK: pk, SK: `AUDIT#${now()}#${randomUUID()}`, entity: 'audit', id: randomUUID(), type, details, createdAt: now() }); }
async function get(PK, SK) { return (await db.send(new GetCommand({ TableName: tableName, Key: { PK, SK } }))).Item; }
async function put(Item) { await db.send(new PutCommand({ TableName: tableName, Item })); return Item; }
async function remove(PK, SK) { await db.send(new DeleteCommand({ TableName: tableName, Key: { PK, SK } })); }
async function list(PK, prefix, limit = 200) { const result = await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':pk': PK, ':prefix': prefix }, Limit: limit, ScanIndexForward: false })); return (result.Items || []).map(publicItem); }
function publicItem(item) { if (!item) return item; const { PK, SK, claimTokenHash, ...value } = item; return value; }
function publicClaim(claim) { const { PK, SK, tokenHash, giftOwnerPk, giftSk, delivery, ...value } = claim; return { ...value, deliveryProvided: Boolean(delivery) }; }
function tokens(result = {}) { return { accessToken: result.AccessToken, idToken: result.IdToken, refreshToken: result.RefreshToken, expiresIn: result.ExpiresIn, tokenType: result.TokenType }; }
function body(event) { if (!event.body) return {}; try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); } catch { throw httpError(400, 'Invalid JSON'); } }
function clean(value, max) { return String(value ?? '').trim().slice(0, max); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function now() { return new Date().toISOString(); }
function trimSlash(value) { return value.replace(/\/$/, ''); }
function isAllowedOrigin(origin) { return !origin || allowedOrigins.has(origin); }
function requireFields(input, fields) { for (const field of fields) if (!input[field]) throw httpError(400, `${field} is required`); }
function httpError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }
function json(statusCode, value, headers = {}) { return response(statusCode, JSON.stringify(value), { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }); }
function response(statusCode, bodyValue, headers = {}) { return { statusCode, headers, body: bodyValue }; }
function cors(event) { return { 'access-control-allow-origin': event.headers?.origin || canonicalUrl, 'access-control-allow-headers': 'authorization,content-type,mcp-protocol-version', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', vary: 'Origin' }; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
