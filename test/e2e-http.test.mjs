import test from 'node:test';
import assert from 'node:assert/strict';
import { createWanderWrapServer } from '../server.mjs';
import { PROTOCOL_VERSION } from '../src/mcp-server.mjs';

const token = 'e2e-only-token';
let server;
let baseUrl;

test.before(async () => {
  server = createWanderWrapServer({
    canonicalUrl: 'https://api.wanderwrap.test',
    authorizationIssuer: 'https://auth.wanderwrap.test',
    mcpToken: token,
    requireAuth: true,
    allowedOrigins: ['https://demo.wanderwrap.test']
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('serves health, simulator, and OAuth protected-resource metadata', async () => {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', service: 'wanderwrap', protocolVersion: PROTOCOL_VERSION });

  const simulator = await fetch(`${baseUrl}/alexa-simulator.html`);
  assert.equal(simulator.status, 200);
  assert.match(await simulator.text(), /Alexa\+ simulated experience/);

  const metadata = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
  assert.equal(metadata.status, 200);
  assert.deepEqual(await metadata.json(), {
    resource: 'https://api.wanderwrap.test/mcp',
    authorization_servers: ['https://auth.wanderwrap.test'],
    scopes_supported: ['wanderwrap/gifts.read', 'wanderwrap/gifts.write'],
    bearer_methods_supported: ['header']
  });
});

test('enforces bearer auth and trusted browser origins at the real HTTP boundary', async () => {
  const unauthorized = await mcp({ jsonrpc: '2.0', id: 1, method: 'initialize' }, { authenticated: false });
  assert.equal(unauthorized.response.status, 401);

  const forbidden = await mcp({ jsonrpc: '2.0', id: 2, method: 'initialize' }, { origin: 'https://evil.example' });
  assert.equal(forbidden.response.status, 403);

  const accepted = await mcp({ jsonrpc: '2.0', id: 3, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION } });
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.body.result.protocolVersion, PROTOCOL_VERSION);
});

test('runs discovery, recommendation, route, and approval over authenticated HTTP', async () => {
  const listed = await mcp({ jsonrpc: '2.0', id: 10, method: 'tools/list' });
  assert.equal(listed.body.result.tools.some(tool => tool.name === 'recommend_gifts'), true);
  assert.equal(listed.body.result.tools.some(tool => tool.name === 'route_gift'), true);

  const recommended = await mcp({
    jsonrpc: '2.0', id: 11, method: 'tools/call',
    params: { name: 'recommend_gifts', arguments: { recipient: { budget: 60, signals: [{ value: 'creative', source: 'stated' }, { value: 'home', source: 'stated' }] } } }
  });
  assert.equal(recommended.response.status, 200);
  assert.equal(recommended.body.result.structuredContent.recommendations[0].id, 'ceramic');

  const routed = await mcp({
    jsonrpc: '2.0', id: 12, method: 'tools/call',
    params: { name: 'route_gift', arguments: { giftKind: 'physical', senderCountry: 'GB', destinationCountry: 'CA', amazonOffer: { available: true, shipsToDestination: true, detailPageUrl: 'https://www.amazon.ca/s?k=ceramic+gift' } } }
  });
  assert.equal(routed.body.result.structuredContent.route, 'amazon-retail-handoff');
  assert.equal(routed.body.result.structuredContent.autoPurchase, false);

  const deniedWrite = await mcp({
    jsonrpc: '2.0', id: 13, method: 'tools/call',
    params: { name: 'create_group_gift', arguments: { organizerId: 'demo-user', title: 'Birthday', targetMinorUnits: 5000, currency: 'GBP' } }
  });
  assert.equal(deniedWrite.body.error.code, -32001);
});

async function mcp(message, { authenticated = true, origin = 'https://demo.wanderwrap.test' } = {}) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': PROTOCOL_VERSION,
    origin
  };
  if (authenticated) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}/mcp`, { method: 'POST', headers, body: JSON.stringify(message) });
  return { response, body: await response.json() };
}
