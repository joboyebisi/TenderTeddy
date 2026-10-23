import test from 'node:test';
import assert from 'node:assert/strict';
import { createWanderWrapServer } from '../server.mjs';
import { PROTOCOL_VERSION } from '../src/mcp-server.mjs';

const STREAMABLE_HEADERS = {
  accept: 'application/json, text/event-stream',
  'content-type': 'application/json',
  'mcp-protocol-version': PROTOCOL_VERSION,
  authorization: 'Bearer test-token'
};

async function withServer(run) {
  const server = createWanderWrapServer({
    canonicalUrl: 'http://127.0.0.1',
    authorizationIssuer: 'https://auth.example.test',
    mcpToken: 'test-token',
    requireAuth: true,
    allowedOrigins: ['https://alexa.amazon.com']
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('protected resource metadata declares the canonical MCP audience and scopes', async () => withServer(async base => {
  const response = await fetch(`${base}/.well-known/oauth-protected-resource/mcp`);
  assert.equal(response.status, 200);
  const metadata = await response.json();
  assert.equal(metadata.resource, 'http://127.0.0.1/mcp');
  assert.deepEqual(metadata.authorization_servers, ['https://auth.example.test']);
  assert.deepEqual(metadata.scopes_supported, ['wanderwrap/gifts.read', 'wanderwrap/gifts.write']);
}));

test('MCP transport requires bearer authentication', async () => withServer(async base => {
  const response = await fetch(`${base}/mcp`, {
    method: 'POST', headers: { ...STREAMABLE_HEADERS, authorization: undefined },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION } })
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.has('www-authenticate'), false);
}));

test('MCP transport rejects untrusted browser origins', async () => withServer(async base => {
  const response = await fetch(`${base}/mcp`, {
    method: 'POST', headers: { ...STREAMABLE_HEADERS, origin: 'https://evil.example' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION } })
  });
  assert.equal(response.status, 403);
}));

test('MCP transport enforces media types and protocol versions', async () => withServer(async base => {
  const message = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const badAccept = await fetch(`${base}/mcp`, { method: 'POST', headers: { ...STREAMABLE_HEADERS, accept: 'application/json' }, body: message });
  assert.equal(badAccept.status, 406);
  const badVersion = await fetch(`${base}/mcp`, { method: 'POST', headers: { ...STREAMABLE_HEADERS, 'mcp-protocol-version': '2026-07-28' }, body: message });
  assert.equal(badVersion.status, 400);
}));

test('MCP initialize succeeds over authenticated Streamable HTTP', async () => withServer(async base => {
  const response = await fetch(`${base}/mcp`, {
    method: 'POST', headers: { ...STREAMABLE_HEADERS, origin: 'https://alexa.amazon.com' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'test', version: '1' } } })
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('mcp-protocol-version'), PROTOCOL_VERSION);
  assert.equal((await response.json()).result.serverInfo.name, 'wanderwrap');
}));
