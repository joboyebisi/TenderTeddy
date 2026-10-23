const AMAZON_MARKETPLACES = new Map([
  ['GB', 'www.amazon.co.uk'], ['US', 'www.amazon.com'], ['CA', 'www.amazon.ca'],
  ['DE', 'www.amazon.de'], ['FR', 'www.amazon.fr'], ['IT', 'www.amazon.it'],
  ['ES', 'www.amazon.es'], ['IE', 'www.amazon.ie'], ['MX', 'www.amazon.com.mx']
]);

export function routeGift(input) {
  const { giftKind, destinationCountry, senderCountry, amazonOffer, paypalAvailable = true, xoomAvailable = false, alternateSupplier } = input;
  if (!giftKind || !destinationCountry || !senderCountry) throw new Error('Gift kind and countries are required');
  if (giftKind === 'money') {
    if (senderCountry !== destinationCountry && xoomAvailable) return decision('xoom-handoff', 'Money gift across borders with an eligible Xoom delivery route', true);
    if (paypalAvailable) return decision('paypal-send-handoff', 'Personal money gift; PayPal takes precedence', true);
    return decision('manual-review', 'No permitted money-transfer route is available', true);
  }
  const marketplace = AMAZON_MARKETPLACES.get(destinationCountry);
  const amazonCanFulfil = marketplace && amazonOffer?.available && amazonOffer?.shipsToDestination && amazonOffer?.detailPageUrl;
  if (amazonCanFulfil) return { ...decision('amazon-retail-handoff', 'Amazon offer is available in the recipient marketplace', true), marketplace, url: amazonOffer.detailPageUrl };
  if (alternateSupplier?.available && paypalAvailable) return { ...decision('paypal-merchant-checkout', 'Amazon cannot fulfil; use PayPal with an approved supplier', false), supplierId: alternateSupplier.id };
  if (paypalAvailable) return decision('paypal-value-gift', 'Amazon cannot fulfil; offer a user-approved PayPal value gift', true);
  return decision('manual-review', 'No verified fulfilment route is available', true);
}

function decision(route, reason, externalHandoff) {
  return { route, reason, externalHandoff, requiresUserApproval: true, autoPurchase: false };
}

export function supportedAmazonMarketplace(countryCode) { return AMAZON_MARKETPLACES.get(countryCode) || null; }
