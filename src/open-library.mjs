import { supportedAmazonMarketplace } from './fulfillment-router.mjs';

function amazonSearch(name, country = 'GB') {
  const marketplace = supportedAmazonMarketplace(country) || supportedAmazonMarketplace('GB');
  return `https://${marketplace}/s?k=${encodeURIComponent(name)}`;
}

export async function findOpenLibraryGiftIdeas({ signals = [], country = 'GB', fetchImpl = globalThis.fetch, timeoutMs = 1_800 } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  const topic = signals.find(item => /book|read|literature/.test(item.value))?.value || 'gift books';
  const response = await fetchImpl(`https://openlibrary.org/search.json?q=${encodeURIComponent(topic)}&fields=key,title,author_name&limit=4`, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'WanderWrap/1.0 (catalog metadata)' }
  });
  if (!response.ok) throw new Error(`open-library-http-${response.status}`);
  const result = await response.json();
  return (result.docs || []).slice(0, 4).filter(book => book?.title).map((book, index) => ({
    id: `openlibrary-${String(book.key || index).replace(/\W/g, '')}`,
    name: book.title,
    price: null,
    categories: ['books', 'creative'],
    local: false,
    story: book.author_name?.[0]
      ? `A real book record by ${book.author_name[0]}, matched to a confirmed reading interest.`
      : 'A real Open Library title matched to a confirmed reading interest.',
    dataSource: 'Open Library',
    providerObservedAt: new Date().toISOString(),
    handoffUrl: amazonSearch(`${book.title} ${book.author_name?.[0] || ''}`, country)
  }));
}
