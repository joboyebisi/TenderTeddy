import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHttpGiftPreferenceProvider,
  createOpenGiftPreferenceProvider,
  GIFT_PREFERENCE_INFERENCE_SCHEMA_VERSION,
  inferGiftPreferenceCandidates,
  validateGiftPreferenceModelCard
} from '../src/preference-model.mjs';
import { resolvePreferenceCandidate } from '../src/preference-intelligence.mjs';
import { scoreGift } from '../src/recommendation.mjs';

const NOW = '2026-10-22T12:00:00.000Z';
const HASH = 'a'.repeat(64);
const modelCard = {
  id: 'wanderwrap/xlmr-gift-preference-v1',
  version: '1.0.0',
  task: 'gift-preference-extraction',
  baseModel: 'FacebookAI/xlm-roberta-base',
  license: 'MIT',
  weightsSha256: HASH,
  taxonomyVersion: 'gift-v1',
  trainingDomain: 'licensed and donated multilingual preference text',
  datasetRights: 'reviewed-for-commercial-use',
  supportedLanguages: ['en', 'fr'],
  maxBatchItems: 20,
  maxCharsPerItem: 2_000,
  defaultThreshold: .8,
  thresholds: { creative: .85 },
  metrics: { macroPrecision: .96, criticalNegationAccuracy: .99, subjectAttributionAccuracy: .99 }
};
const connection = (overrides = {}) => ({
  provider: 'x', accountOwnerId: 'maya', enabled: true,
  consent: {
    subjectId: 'maya', selfConsented: true, grantedAt: '2026-01-01T00:00:00.000Z',
    scopes: ['posts.read'], purposes: ['preference_intelligence'], ...overrides
  }
});
const post = (id, text, extra = {}) => ({ id, kind: 'post', authorId: 'maya', text, createdAt: '2026-10-20T00:00:00.000Z', ...extra });
const response = (predictions, overrides = {}) => ({
  schemaVersion: GIFT_PREFERENCE_INFERENCE_SCHEMA_VERSION,
  model: { id: modelCard.id, version: modelCard.version, weightsSha256: HASH, taxonomyVersion: 'gift-v1' },
  predictions,
  ...overrides
});

test('validates a pinned XLM-R extraction model independently from personality', () => {
  assert.equal(validateGiftPreferenceModelCard(modelCard).valid, true);
  assert.equal(validateGiftPreferenceModelCard({ ...modelCard, baseModel: 'some/other-model' }).reason, 'unsupported-base-model');
  assert.equal(validateGiftPreferenceModelCard({ ...modelCard, weightsSha256: '' }).reason, 'weights-checksum-required');
  assert.equal(validateGiftPreferenceModelCard({ ...modelCard, license: 'unknown' }).reason, 'license-not-approved');
});

test('prefilters authorization and sensitive content before invoking the model', async () => {
  let received = null;
  const provider = createOpenGiftPreferenceProvider({
    modelCard,
    predictBatch: async items => {
      received = items;
      return response(items.map(item => ({ contentId: item.id, abstained: true, abstainReason: 'ambiguous' })));
    }
  });
  const result = await inferGiftPreferenceCandidates({
    connection: connection(), subjectId: 'maya', provider, now: NOW,
    content: [
      post('safe', 'I want to try pottery https://example.com/item'),
      post('sensitive', 'Therapy helped and I enjoy books'),
      post('foreign', 'I love music', { authorId: 'friend' }),
      post('future', 'I love travel', { createdAt: '2027-01-01T00:00:00Z' })
    ]
  });
  assert.deepEqual(received.map(item => item.id), ['safe']);
  assert.equal(received[0].text.includes('example.com'), false);
  assert.deepEqual(result.rejected.map(item => item.reason).sort(), ['ambiguous', 'content_not_authored_by_subject', 'future_content', 'sensitive_trait'].sort());
  assert.equal(JSON.stringify(result).includes('Therapy'), false);

  received = null;
  const denied = await inferGiftPreferenceCandidates({ connection: connection({ revokedAt: NOW }), subjectId: 'maya', provider, now: NOW, content: [post('safe', 'I love books')] });
  assert.equal(denied.status, 'no_eligible_content');
  assert.equal(received, null);
});

test('creates deterministic, provenance-rich proposals that require confirmation', async () => {
  const provider = createOpenGiftPreferenceProvider({
    modelCard,
    predictBatch: async items => response([{
      contentId: items[0].id,
      language: 'en',
      abstained: false,
      labels: [{ label: 'creative', intent: 'want', polarity: 'positive', confidence: .94, calibratedConfidence: .9 }]
    }])
  });
  const args = { connection: connection(), subjectId: 'maya', provider, now: NOW, content: [post('p1', 'I want to try pottery')] };
  const first = await inferGiftPreferenceCandidates(args);
  const second = await inferGiftPreferenceCandidates(args);
  assert.equal(first.status, 'completed');
  assert.equal(first.candidates[0].rankEligible, false);
  assert.equal(first.candidates[0].status, 'needs_confirmation');
  assert.equal(first.candidates[0].provenance.baseModel, 'FacebookAI/xlm-roberta-base');
  assert.equal(first.candidates[0].provenance.contentHash.length, 64);
  assert.equal(JSON.stringify(first).includes('pottery'), false);
  assert.equal(first.candidates[0].id, second.candidates[0].id);

  const before = scoreGift({ id: 'g1', name: 'Pottery class', price: 30, categories: ['creative'] }, { signals: first.candidates });
  assert.equal(before.score, 0);
  const confirmed = resolvePreferenceCandidate(first.candidates[0], { decision: 'confirm', actorId: 'maya', at: NOW, connection: connection() });
  const after = scoreGift({ id: 'g1', name: 'Pottery class', price: 30, categories: ['creative'] }, { signals: [confirmed] });
  assert.ok(after.score > 0);
  assert.equal(after.contributionLedger[0].evidenceId, first.candidates[0].id.replace('pc_', 'pe_'));
});

test('abstains from negative and below-threshold model signals', async () => {
  const provider = createOpenGiftPreferenceProvider({
    modelCard,
    predictBatch: async items => response([{
      contentId: items[0].id,
      abstained: false,
      labels: [
        { label: 'food', intent: 'dislike', polarity: 'negative', confidence: .99, calibratedConfidence: .99 },
        { label: 'creative', intent: 'interest', polarity: 'positive', confidence: .8, calibratedConfidence: .8 }
      ]
    }])
  });
  const result = await inferGiftPreferenceCandidates({ connection: connection(), subjectId: 'maya', provider, now: NOW, content: [post('p1', "I don't like cooking; pottery might be nice")] });
  assert.equal(result.candidates.length, 0);
  assert.deepEqual(result.rejected.map(item => item.reason), ['negative_signal_requires_exclusion_flow', 'below_model_threshold']);
});

test('fails closed on malformed or mismatched model output', async () => {
  const provider = createOpenGiftPreferenceProvider({
    modelCard,
    predictBatch: async items => response([{ contentId: items[0].id, labels: [{ label: 'politics', intent: 'interest', polarity: 'positive', confidence: .9, calibratedConfidence: .9 }] }])
  });
  const result = await inferGiftPreferenceCandidates({ connection: connection(), subjectId: 'maya', provider, now: NOW, content: [post('p1', 'A permitted input')] });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'model-inference-failed');
  assert.equal(result.candidates.length, 0);
});

test('HTTP adapter allows HTTPS or loopback and sends no stable subject identifier', async () => {
  const provider = createHttpGiftPreferenceProvider({
    modelCard,
    url: 'http://127.0.0.1:8091/v1/extract',
    fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body);
      assert.equal(body.model.id, modelCard.id);
      assert.equal(body.items[0].contentId, 'p1');
      assert.equal('subjectId' in body, false);
      return { ok: true, json: async () => response([{ contentId: 'p1', abstained: true, abstainReason: 'ambiguous' }]) };
    }
  });
  const result = await inferGiftPreferenceCandidates({ connection: connection(), subjectId: 'maya', provider, now: NOW, content: [post('p1', 'Maybe books')] });
  assert.equal(result.status, 'completed');
  assert.throws(() => createHttpGiftPreferenceProvider({ modelCard, url: 'http://example.com/predict', fetchImpl: async () => ({}) }), /https-or-loopback/);
});
