import test from 'node:test';
import assert from 'node:assert/strict';
import { findOpenLibraryGiftIdeas } from '../src/open-library.mjs';

test('Open Library adapter normalizes catalogue records without leaking provider payloads', async () => {
  const ideas = await findOpenLibraryGiftIdeas({
    signals: [{ value: 'books', source: 'recipient_confirmed' }],
    country: 'GB',
    fetchImpl: async url => {
      assert.match(String(url), /openlibrary\.org/);
      return { ok: true, json: async () => ({ docs: [{ key: '/works/OL1W', title: 'The Gift', author_name: ['Author'] }] }) };
    }
  });
  assert.equal(ideas[0].id, 'openlibrary-worksOL1W');
  assert.equal(ideas[0].dataSource, 'Open Library');
  assert.match(ideas[0].handoffUrl, /^https:\/\/www\.amazon\.co\.uk\/s\?k=/);
  assert.equal('author_name' in ideas[0], false);
});

test('Open Library adapter rejects provider HTTP errors for platform fallback', async () => {
  await assert.rejects(
    findOpenLibraryGiftIdeas({ fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /open-library-http-503/
  );
});
