const CURRENCIES = new Set(['GBP', 'USD', 'CAD', 'EUR']);

export function buildPayPalOrder({ sku, description, quantity = 1, unitMinor, currency = 'GBP', giftLinkId }) {
  if (!CURRENCIES.has(currency)) throw new Error('Unsupported currency');
  if (!Number.isInteger(unitMinor) || unitMinor < 1) throw new Error('Server-validated unitMinor required');
  const value = ((unitMinor * quantity) / 100).toFixed(2);
  return {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: giftLinkId,
      amount: { currency_code: currency, value, breakdown: { item_total: { currency_code: currency, value } } },
      items: [{ name: description, sku, quantity: String(quantity), unit_amount: { currency_code: currency, value: (unitMinor / 100).toFixed(2) } }]
    }]
  };
}

export function captureAllowed({ gift, order }) {
  return gift.status === 'ready-for-checkout' && order?.status === 'APPROVED' && order.purchase_units?.[0]?.reference_id === gift.id;
}

export function createPayPalClient({
  clientId = process.env.PAYPAL_CLIENT_ID,
  clientSecret = process.env.PAYPAL_CLIENT_SECRET,
  webhookId = process.env.PAYPAL_WEBHOOK_ID,
  environment = process.env.PAYPAL_ENV || 'sandbox',
  fetchImpl = fetch
} = {}) {
  if (!['sandbox', 'live'].includes(environment)) throw new Error('PAYPAL_ENV must be sandbox or live');
  const baseUrl = environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  let cachedToken;
  let tokenExpiresAt = 0;

  async function accessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - 30_000) return cachedToken;
    if (!clientId || !clientSecret) throw new Error('PayPal credentials are not configured');
    const response = await fetchImpl(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const result = await providerJson(response, 'PayPal authentication');
    if (!result.access_token) throw new Error('PayPal authentication returned no access token');
    cachedToken = result.access_token;
    tokenExpiresAt = Date.now() + Number(result.expires_in || 300) * 1000;
    return cachedToken;
  }

  async function request(path, { method = 'GET', body, requestId } = {}) {
    const token = await accessToken();
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(requestId ? { 'paypal-request-id': requestId } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return providerJson(response, `PayPal ${method} ${path}`);
  }

  return {
    environment,
    async createOrder(order, { requestId } = {}) {
      if (!requestId) throw new Error('PayPal create order requires an idempotency request ID');
      if (order?.intent !== 'CAPTURE' || !order.purchase_units?.length) throw new Error('A server-priced PayPal order is required');
      return request('/v2/checkout/orders', { method: 'POST', body: order, requestId });
    },
    async captureOrder(orderId, { requestId } = {}) {
      if (!orderId || !requestId) throw new Error('PayPal capture requires an order ID and idempotency request ID');
      return request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', body: {}, requestId });
    },
    async verifyWebhook(headers, webhookEvent) {
      if (!webhookId) throw new Error('PayPal webhook ID is not configured');
      const normalized = Object.fromEntries(Object.entries(headers || {}).map(([name, value]) => [name.toLowerCase(), value]));
      const required = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'];
      for (const name of required) if (!normalized[name]) throw new Error(`Missing PayPal webhook header: ${name}`);
      const result = await request('/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        body: {
          auth_algo: normalized['paypal-auth-algo'],
          cert_url: normalized['paypal-cert-url'],
          transmission_id: normalized['paypal-transmission-id'],
          transmission_sig: normalized['paypal-transmission-sig'],
          transmission_time: normalized['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: webhookEvent
        }
      });
      return result.verification_status === 'SUCCESS';
    }
  };
}

async function providerJson(response, operation) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${operation} failed with provider status ${response.status}`);
    error.statusCode = response.status >= 500 ? 503 : 502;
    error.providerStatus = response.status;
    throw error;
  }
  return result;
}
