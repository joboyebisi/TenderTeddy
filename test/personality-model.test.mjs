import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approvePersonalityForGiftRanking, assessPersonality, createHttpPersonalityProvider, createOpenPersonalityProvider,
  personalityGiftSignals, scoreIpip10, validatePersonalityModelCard
} from '../src/personality-model.mjs';
import { scoreGift } from '../src/recommendation.mjs';

const modelCard = {
  id: 'open-big-five-test', version: '1.0.0', task: 'big-five-regression', license: 'MIT',
  trainingDomain: 'consented English essays', minimumWords: 100,
  metrics: Object.fromEntries(['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'emotionalStability'].map(trait => [trait, { correlation: .3 }]))
};
const provider = createOpenPersonalityProvider({ modelCard, predict: async () => ({ openness: .9, conscientiousness: .55, extraversion: .7, agreeableness: .65, emotionalStability: .6 }) });
const consent = { receiptId: 'c1', subjectId: 'u1', status: 'active', scopes: ['personality.infer'], purposes: ['personality_self_discovery'], expiresAt: '2099-01-01T00:00:00Z' };
const text = Array(120).fill('I enjoy creative projects travel books music and planning experiences with friends.').join(' ');

test('requires an open model card with provenance, metrics and approved license', () => {
  assert.equal(validatePersonalityModelCard(modelCard).valid, true);
  assert.equal(validatePersonalityModelCard({ ...modelCard, license: 'unknown' }).reason, 'license-not-approved');
  assert.throws(() => createOpenPersonalityProvider({ modelCard: { ...modelCard, metrics: {} }, predict: async () => ({}) }), /trait-metrics-incomplete/);
});

test('HTTP model adapter permits local or HTTPS inference and validates returned traits', async () => {
  const httpProvider = createHttpPersonalityProvider({
    modelCard, url: 'http://127.0.0.1:8090/predict',
    fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body);
      assert.equal(body.modelId, modelCard.id);
      return { ok: true, json: async () => ({ openness: .8, conscientiousness: .7, extraversion: .6, agreeableness: .7, emotionalStability: .6 }) };
    }
  });
  assert.equal((await httpProvider.predict('enough text for direct provider test')).openness, .8);
  assert.throws(() => createHttpPersonalityProvider({ modelCard, url: 'http://example.com/predict', fetchImpl: async () => ({}) }), /https-or-loopback/);
});

test('scores a transparent IPIP-style calibration questionnaire', () => {
  const scores = scoreIpip10({ O1: 5, O2R: 1, C1: 4, C2R: 2, E1: 3, E2R: 3, A1: 4, A2R: 2, ES1: 5, ES2R: 1 });
  assert.equal(scores.openness, 1);
  assert.equal(scores.conscientiousness, .75);
});

test('personality inference requires subject consent and enough text', async () => {
  assert.equal((await assessPersonality({ subjectId: 'u1', texts: [text], consent: null, provider })).status, 'denied');
  const short = await assessPersonality({ subjectId: 'u1', texts: ['too short'], consent, provider });
  assert.equal(short.status, 'needs_more_text');
});

test('open-model estimate is calibrated with questionnaire and not rankable by default', async () => {
  const assessment = await assessPersonality({
    subjectId: 'u1', texts: [text], consent, provider,
    questionnaireResponses: { O1: 5, O2R: 1, C1: 4, C2R: 2, E1: 4, E2R: 2, A1: 4, A2R: 2, ES1: 4, ES2R: 2 },
    now: '2026-10-22T12:00:00Z'
  });
  assert.equal(assessment.status, 'calibrated');
  assert.equal(assessment.rankEligible, false);
  assert.equal(assessment.model.license, 'MIT');
});

test('only the subject can opt personality into gift ranking and contribution stays bounded', async () => {
  const assessment = await assessPersonality({ subjectId: 'u1', texts: [text], consent, provider, now: '2026-10-22T12:00:00Z' });
  assert.throws(() => approvePersonalityForGiftRanking(assessment, { subjectId: 'friend', decision: 'approve_for_my_gifts' }), /only the assessed subject/);
  const approved = approvePersonalityForGiftRanking(assessment, { subjectId: 'u1', decision: 'approve_for_my_gifts', at: '2026-10-22T12:05:00Z' });
  const signals = personalityGiftSignals(approved);
  assert.ok(signals.length > 0);
  const ranked = scoreGift({ id: 'g1', name: 'Creative trip', price: 20, categories: ['creative', 'travel', 'experience'] }, { budget: 50, signals });
  const personalityTotal = ranked.contributionLedger.filter(item => item.source === 'personality_hypothesis').reduce((sum, item) => sum + item.contribution, 0);
  assert.ok(personalityTotal <= .1001);
});
