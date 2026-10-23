import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createApi, handleApiError } from './src/api.mjs';
import { DynamoDbFamilyStore } from './src/dynamodb-family-store.mjs';
import { createGeminiLessonService } from './src/gemini-service.mjs';

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.apk': 'application/vnd.android.package-archive' };
const binary = new Set(['.apk', '.png', '.jpg', '.jpeg', '.webp', '.ico']);
const securityHeaders = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https://www.youtube.com https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY'
};
const store = new DynamoDbFamilyStore();
const api = createApi(store, { geminiService: createGeminiLessonService() });

function responseCapture() {
  const capture = { statusCode: 200, headers: {} };
  return {
    capture,
    writeHead(statusCode, headers = {}) { capture.statusCode = statusCode; capture.headers = { ...capture.headers, ...headers }; },
    end(body = '') { capture.body = Buffer.isBuffer(body) ? body : Buffer.from(String(body)); }
  };
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const rawPath = event.rawPath || event.path || '/';
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = new URL(`${rawPath}${query}`, 'https://tenderteddy.invalid');
  const input = event.body ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8') : Buffer.alloc(0);
  const req = Readable.from(input.length ? [input] : []); req.method = method; req.headers = event.headers || {}; req.url = rawPath;
  const { capture, ...res } = responseCapture();

  try {
    if (rawPath.startsWith('/api/')) {
      if (!(await api(req, res, url))) { capture.statusCode = 404; capture.headers['content-type'] = 'application/json'; capture.body = Buffer.from(JSON.stringify({ error: 'API route not found' })); }
    } else {
      const wanted = rawPath === '/' ? 'index.html' : rawPath.slice(1);
      const path = normalize(join(publicRoot, wanted));
      if (!path.startsWith(publicRoot)) throw new Error('Invalid path');
      capture.body = await readFile(path); capture.headers['content-type'] = types[extname(path)] || 'application/octet-stream';
    }
  } catch (error) {
    if (rawPath.startsWith('/api/')) handleApiError(res, error);
    else { capture.statusCode = 404; capture.body = Buffer.from('Not found'); capture.headers['content-type'] = 'text/plain; charset=utf-8'; }
  }

  const extension = extname(rawPath);
  const isBase64Encoded = binary.has(extension);
  return { statusCode: capture.statusCode, headers: { ...securityHeaders, 'cache-control': rawPath.startsWith('/api/') ? 'no-store' : 'public, max-age=300', ...capture.headers }, body: isBase64Encoded ? capture.body.toString('base64') : capture.body.toString('utf8'), isBase64Encoded };
}
