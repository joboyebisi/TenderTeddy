import test from 'node:test';
import assert from 'node:assert/strict';
import { rankExplainableGifts, scoreGift } from '../src/recommendation.mjs';

test('explainable ranking records evidence contributions and discounts unconfirmed signals', () => {
  const gift = { id: 'g1', name: 'Ceramic class', price: 40, categories: ['creative'] };
  const stated = scoreGift(gift, { budget: 50, signals: [{ id: 'e1', value: 'creative', source: 'stated', confidence: 1 }] });
  const inferred = scoreGift(gift, { budget: 50, signals: [{ id: 'e2', value: 'creative', source: 'inferred', confidence: 1 }] });
  assert.ok(stated.score > inferred.score);
  assert.equal(stated.contributionLedger[0].evidenceId, 'e1');
});

test('sensitive evidence never contributes to gift ranking', () => {
  const result = scoreGift(
    { id: 'g1', name: 'Book', price: 20, categories: ['books'] },
    { signals: [{ id: 'e1', value: 'books', source: 'feed', sensitivityLabels: ['sensitive-trait'] }] }
  );
  assert.equal(result.score, 0);
  assert.deepEqual(result.contributionLedger, []);
});

test('proposal-only model candidates cannot contribute even if passed directly', () => {
  const result = scoreGift(
    { id: 'g1', name: 'Creative class', price: 20, categories: ['creative'] },
    { signals: [{ id: 'pc_1', value: 'creative', source: 'inferred', confidence: 1, rankEligible: false }] }
  );
  assert.equal(result.score, 0);
  assert.deepEqual(result.contributionLedger, []);
});

test('hard constraints filter unavailable, late and wrong-market products', () => {
  const profile = { budget: 50, destinationCountry: 'GB', requiredBy: '2026-12-20', now: '2026-12-01', occasion: 'christmas', signals: [] };
  const catalog = [
    { id: 'ok', name: 'Tea', price: 25, categories: ['food'], countries: ['GB'], deliversBy: '2026-12-18', deliveryConfidence: .9, occasions: ['christmas'], providerObservedAt: '2026-12-01' },
    { id: 'late', name: 'Vase', price: 30, categories: ['home'], countries: ['GB'], deliversBy: '2026-12-23' },
    { id: 'wrong-market', name: 'Coffee', price: 20, categories: ['food'], countries: ['US'] },
    { id: 'sold-out', name: 'Scarf', price: 35, categories: ['fashion'], countries: ['GB'], available: false }
  ];
  const results = rankExplainableGifts(profile, catalog);
  assert.deepEqual(results.map(item => item.id), ['ok']);
  assert.equal(results[0].rankerVersion, 'wanderwrap-context-v1');
  assert.deepEqual(results[0].uncertainty, []);
});
