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
