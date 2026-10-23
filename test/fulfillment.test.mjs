import test from 'node:test';
import assert from 'node:assert/strict';
import { routeGift } from '../src/fulfillment-router.mjs';
import { buildAmazonSearch, amazonRetailHandoff } from '../src/amazon.mjs';
import { handleMcpRequest, PROTOCOL_VERSION } from '../src/mcp-server.mjs';

test('Amazon is preferred for a fulfilable physical gift', () => {
  const result = routeGift({ giftKind: 'physical', senderCountry: 'GB', destinationCountry: 'US', amazonOffer: { available: true, shipsToDestination: true, detailPageUrl: 'https://amazon.com/dp/example' } });
  assert.equal(result.route, 'amazon-retail-handoff');
  assert.equal(result.marketplace, 'www.amazon.com');
  assert.equal(result.autoPurchase, false);
});

test('PayPal supplier checkout takes precedence when Amazon cannot fulfil', () => {
  const result = routeGift({ giftKind: 'experience', senderCountry: 'GB', destinationCountry: 'CA', amazonOffer: { available: false }, alternateSupplier: { id: 'local-1', available: true } });
  assert.equal(result.route, 'paypal-merchant-checkout');
  assert.equal(result.supplierId, 'local-1');
});

test('Xoom is selected only as an eligible cross-border money handoff', () => {
  const result = routeGift({ giftKind: 'money', senderCountry: 'GB', destinationCountry: 'NG', xoomAvailable: true });
  assert.equal(result.route, 'xoom-handoff');
  assert.equal(result.externalHandoff, true);
  assert.equal(result.requiresUserApproval, true);
});

test('Amazon request is marketplace aware and final checkout remains external', () => {
  const request = buildAmazonSearch({ keywords: 'ceramic tea set', destinationCountry: 'GB', partnerTag: 'wanderwrap-21' });
  assert.equal(request.headers['x-marketplace'], 'www.amazon.co.uk');
  assert.throws(() => amazonRetailHandoff({ available: false, detailPageUrl: 'x' }));
});

test('MCP exposes 2025-11-25 tools and gates side effects', async () => {
  const init = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION } }, { userId: 'u1' });
  assert.equal(init.result.protocolVersion, PROTOCOL_VERSION);
  const list = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, { userId: 'u1' });
  assert.equal(list.result.tools.some(x => x.name === 'route_gift'), true);
  const blocked = await handleMcpRequest({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'create_group_gift', arguments: { organizerId: 'u1', title: 'Gift', targetMinorUnits: 1000 } } }, { userId: 'u1' });
  assert.equal(blocked.error.code, -32001);
});
