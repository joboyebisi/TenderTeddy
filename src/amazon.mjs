import { supportedAmazonMarketplace } from './fulfillment-router.mjs';

export function buildAmazonSearch({ keywords, destinationCountry, partnerTag }) {
  const marketplace = supportedAmazonMarketplace(destinationCountry);
  if (!marketplace) throw new Error('No supported Amazon marketplace');
  if (!keywords || !partnerTag) throw new Error('Keywords and marketplace partner tag required');
  return {
    endpoint: 'https://creatorsapi.amazon/catalog/v1/searchItems',
    headers: { 'content-type': 'application/json', 'x-marketplace': marketplace },
    body: { keywords, marketplace, partnerTag, resources: ['images.primary.medium', 'itemInfo.title', 'offersV2.listings.availability', 'offersV2.listings.price'] }
  };
}

export function amazonRetailHandoff(item) {
  if (!item?.detailPageUrl || !item.available) throw new Error('A live available Amazon offer is required');
  return { provider: 'amazon', url: item.detailPageUrl, status: 'awaiting-user', disclosure: 'Availability, price, delivery address and final purchase are confirmed on Amazon.' };
}
