import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayPalOrder, createPayPalClient } from '../src/paypal.mjs';

test('PayPal client authenticates, creates and captures with idempotency', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/v1/oauth2/token')) return json({ access_token: 'sandbox-token', expires_in: 3600 });
    if (url.endsWith('/v2/checkout/orders')) return json({ id: 'ORDER-1', status: 'CREATED' }, 201);
    if (url.endsWith('/capture')) return json({ id: 'ORDER-1', status: 'COMPLETED' }, 201);
    return json({}, 404);
  };
  const client = createPayPalClient({ clientId: 'client', clientSecret: 'secret', environment: 'sandbox', fetchImpl });
  const order = buildPayPalOrder({ sku: 'trusted-1', description: 'Pottery class', unitMinor: 4500, currency: 'GBP', giftLinkId: 'gift-1' });
  assert.equal((await client.createOrder(order, { requestId: 'create-gift-1' })).status, 'CREATED');
  assert.equal((await client.captureOrder('ORDER-1', { requestId: 'capture-gift-1' })).status, 'COMPLETED');
  assert.equal(calls.filter(call => call.url.endsWith('/v1/oauth2/token')).length, 1);
  assert.equal(calls[1].init.headers['paypal-request-id'], 'create-gift-1');
  assert.equal(calls[2].init.headers['paypal-request-id'], 'capture-gift-1');
});

test('PayPal webhook verification uses provider verification and rejects missing headers', async () => {
  const calls = [];
  const client = createPayPalClient({
    clientId: 'client', clientSecret: 'secret', webhookId: 'WEBHOOK-1',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/v1/oauth2/token')) return json({ access_token: 'sandbox-token', expires_in: 3600 });
      return json({ verification_status: 'SUCCESS' });
    }
  });
  const headers = {
    'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://api.paypal.com/cert.pem',
    'paypal-transmission-id': 'tx-1', 'paypal-transmission-sig': 'signature', 'paypal-transmission-time': '2026-10-23T12:00:00Z'
  };
  assert.equal(await client.verifyWebhook(headers, { id: 'event-1' }), true);
  assert.match(calls[1].url, /verify-webhook-signature$/);
  await assert.rejects(() => client.verifyWebhook({}, { id: 'event-2' }), /Missing PayPal webhook header/);
});

test('PayPal create and capture fail closed without idempotency keys', async () => {
  const client = createPayPalClient({ clientId: 'client', clientSecret: 'secret', fetchImpl: async () => json({}) });
  await assert.rejects(() => client.createOrder({ intent: 'CAPTURE', purchase_units: [{}] }), /idempotency/);
  await assert.rejects(() => client.captureOrder('ORDER-1'), /idempotency/);
});

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}
