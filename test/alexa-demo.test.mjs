import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMcpRequest, MCP_APP_MIME_TYPE, PROTOCOL_VERSION, UI_RESOURCE_URI } from '../src/mcp-server.mjs';

async function call(name, args) {
  const response = await handleMcpRequest({ jsonrpc: '2.0', id: name, method: 'tools/call', params: { name, arguments: args } }, { userId: 'demo-user' });
  assert.equal(response.error, undefined);
  return response.result.structuredContent;
}

test('device-free Alexa+ golden path discovers, recommends and routes through MCP', async () => {
  const initialized = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'simulator', version: '1' } } }, { userId: 'demo-user' });
  assert.equal(initialized.result.protocolVersion, '2025-11-25');

  const listed = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { userId: 'demo-user' });
  assert.equal(listed.result.tools.some(tool => tool.name === 'recommend_gifts'), true);
  assert.equal(listed.result.tools.some(tool => tool.name === 'route_gift'), true);

  const ideas = await call('recommend_gifts', { recipient: { budget: 60, signals: [{ value: 'creative', source: 'stated' }, { value: 'home', source: 'stated' }] } });
  assert.equal(ideas.recommendations[0].id, 'ceramic');
  assert.match(ideas.voiceSummary, /top suggestion/i);

  const route = await call('route_gift', { giftKind: 'physical', senderCountry: 'GB', destinationCountry: 'CA', amazonOffer: { available: true, shipsToDestination: true, detailPageUrl: 'https://www.amazon.ca/s?k=ceramic+gift' } });
  assert.equal(route.route, 'amazon-retail-handoff');
  assert.equal(route.requiresUserApproval, true);
  assert.equal(route.autoPurchase, false);
});

test('MCP Apps discovery links tools to a hashed adaptive UI resource', async () => {
  const initialized = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION } });
  assert.deepEqual(initialized.result.capabilities.extensions['io.modelcontextprotocol/ui'], {});

  const listed = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(listed.result.tools.every(tool => tool._meta.ui.resourceUri === UI_RESOURCE_URI), true);
  assert.equal(listed.result.tools.every(tool => tool.outputSchema?.type === 'object'), true);
  assert.match(UI_RESOURCE_URI, /^ui:\/\/wanderwrap\/gift-board-[a-f0-9]{12}\.html$/);

  const resources = await handleMcpRequest({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
  assert.equal(resources.result.resources[0].mimeType, MCP_APP_MIME_TYPE);
  const resource = await handleMcpRequest({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: UI_RESOURCE_URI } });
  assert.equal(resource.result.contents[0].mimeType, MCP_APP_MIME_TYPE);
  assert.match(resource.result.contents[0].text, /WanderWrap gift board/);
  assert.deepEqual(resource.result.contents[0]._meta.ui.supportedDisplayModes, ['inline', 'fullscreen']);
});

test('write tools require explicit approval and return voice-safe errors', async () => {
  const denied = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_group_gift', arguments: { organizerId: 'u1', title: 'Birthday', targetMinorUnits: 5000 } } }, { userId: 'demo-user' });
  assert.equal(denied.error.code, -32001);

  const invalid = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'route_gift', arguments: {} } }, { userId: 'demo-user' });
  assert.equal(invalid.result.isError, true);
  assert.equal(typeof invalid.result.content[0].text, 'string');
});
