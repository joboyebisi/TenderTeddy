import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleMcpRequest, PROTOCOL_VERSION } from './src/mcp-server.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const DEFAULT_CANONICAL_URL = 'http://127.0.0.1:4202';

export function createWanderWrapServer(options = {}) {
  const canonicalUrl = trimSlash(options.canonicalUrl || process.env.WANDERWRAP_CANONICAL_URL || DEFAULT_CANONICAL_URL);
  const authorizationIssuer = trimSlash(options.authorizationIssuer || process.env.WANDERWRAP_AUTH_ISSUER || canonicalUrl);
  const expectedToken = options.mcpToken ?? process.env.WANDERWRAP_MCP_TOKEN;
  const requireAuth = options.requireAuth ?? (Boolean(expectedToken) || process.env.NODE_ENV === 'production');
  const allowedOrigins = new Set(options.allowedOrigins || configuredOrigins(canonicalUrl));
  const scopes = options.scopes || [process.env.WANDERWRAP_MCP_READ_SCOPE || 'wanderwrap/gifts.read', process.env.WANDERWRAP_MCP_WRITE_SCOPE || 'wanderwrap/gifts.write'];

  return http.createServer(async (req, res) => {
    const pathname = new URL(req.url, canonicalUrl).pathname;
    if (pathname === '/mcp') return serveMcp(req, res, { expectedToken, requireAuth, allowedOrigins });
    if (pathname === '/.well-known/oauth-protected-resource' || pathname === '/.well-known/oauth-protected-resource/mcp') {
      return json(res, 200, {
        resource: `${canonicalUrl}/mcp`,
        authorization_servers: [authorizationIssuer],
        scopes_supported: scopes,
        bearer_methods_supported: ['header']
      }, { 'cache-control': 'public, max-age=300' });
    }
    if (pathname === '/health') return json(res, 200, { status: 'ok', service: 'wanderwrap', protocolVersion: PROTOCOL_VERSION });
    return serveStatic(req, res, pathname);
  });
}

async function serveMcp(req, res, config) {
  if (!validOrigin(req.headers.origin, config.allowedOrigins)) return jsonRpcHttpError(res, 403, -32000, 'Origin not allowed');
  if (req.method === 'GET' || req.method === 'DELETE') {
    res.setHeader('allow', 'POST');
    return json(res, 405, { error: 'This MCP endpoint uses stateless Streamable HTTP over POST' });
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'Use POST for Streamable HTTP requests' }, { allow: 'POST' });

  const supplied = bearerToken(req.headers.authorization);
  if (config.requireAuth && (!config.expectedToken || !timingSafeTokenEqual(supplied, config.expectedToken))) {
    return json(res, 401, { error: 'Unauthorized' }, { 'cache-control': 'no-store' });
  }
  if (!acceptsStreamableHttp(req.headers.accept)) return jsonRpcHttpError(res, 406, -32000, 'Accept must include application/json and text/event-stream');
  if (!isJson(req.headers['content-type'])) return jsonRpcHttpError(res, 415, -32000, 'Content-Type must be application/json');
  const requestedVersion = req.headers['mcp-protocol-version'];
  if (requestedVersion && requestedVersion !== PROTOCOL_VERSION) return jsonRpcHttpError(res, 400, -32000, 'Unsupported MCP protocol version');

  try {
    const body = await readJson(req);
    const response = await handleMcpRequest(body, { userId: supplied ? 'linked-user' : 'local-demo' });
    if (response === null) { res.writeHead(202); return res.end(); }
    res.setHeader('MCP-Protocol-Version', PROTOCOL_VERSION);
    return json(res, 200, response, { 'cache-control': 'no-store' });
  } catch (error) { return jsonRpcHttpError(res, 400, -32700, error.message); }
}

async function serveStatic(req, res, pathname) {
  try {
    const wanted = pathname === '/' ? 'index.html' : pathname.slice(1);
    const path = normalize(join(root, wanted));
    if (!path.startsWith(root)) throw Error('blocked');
    const data = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1_000_000) reject(new Error('Request too large')); });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function configuredOrigins(canonicalUrl) {
  const configured = (process.env.WANDERWRAP_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  return configured.length ? configured : [new URL(canonicalUrl).origin];
}

function validOrigin(origin, allowedOrigins) { return !origin || allowedOrigins.has(origin); }
function acceptsStreamableHttp(accept = '') {
  const values = accept.toLowerCase().split(',').map(value => value.split(';')[0].trim());
  return values.includes('*/*') || (values.includes('application/json') && values.includes('text/event-stream'));
}
function isJson(contentType = '') { return contentType.toLowerCase().split(';')[0].trim() === 'application/json'; }
function bearerToken(value = '') { return value.match(/^Bearer\s+(.+)$/i)?.[1] || ''; }
function timingSafeTokenEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
function trimSlash(value) { return value.replace(/\/$/, ''); }
function jsonRpcHttpError(res, status, code, message) { return json(res, status, { jsonrpc: '2.0', id: null, error: { code, message } }, { 'cache-control': 'no-store' }); }
function json(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json;charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === normalize(process.argv[1]).toLowerCase();
if (isMain) {
  const port = Number(process.env.PORT || 4202);
  const host = process.env.HOST || '127.0.0.1';
  createWanderWrapServer().listen(port, host, () => console.log(`WanderWrap http://${host}:${port}`));
}
