import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentRequest, createApprovalArtifact, POLICY_DECISIONS } from '../src/agent-orchestrator.mjs';
import { createToolAgentOrchestrator } from '../src/mcp-tools.mjs';
import { createOpenGiftPreferenceProvider, GIFT_PREFERENCE_INFERENCE_SCHEMA_VERSION } from '../src/preference-model.mjs';

const SECRET = 'test-only-orchestration-secret';
const consent = action => ({
  receiptId: `consent-${action}`,
  tenantId: 'personal-u1',
  subjectId: 'u1',
  status: 'active',
  actions: [action],
  expiresAt: '2099-01-01T00:00:00.000Z'
});

test('recommendation agent returns a bounded proposal with evidence trace', async () => {
  const orchestrator = createToolAgentOrchestrator({ tenantId: 'personal-u1', approvalSecret: SECRET });
  const result = await orchestrator.execute(createAgentRequest({
    requestId: 'recommend-1', tenantId: 'personal-u1', actorId: 'u1', agentId: 'recommendation-agent',
    action: 'recommend_gifts', payload: { budget: 50, signals: [{ value: 'travel', source: 'stated' }] },
    consentReceipt: consent('recommend_gifts'), context: { evidenceIds: ['e1'] }
  }));
  assert.equal(result.status, 'completed');
  assert.equal(result.output.proposedAction, 'present-recommendations');
  assert.deepEqual(result.output.evidence, ['e1']);
  assert.ok(result.output.arguments.length > 0);
  assert.equal(result.output.provider.id, 'wanderwrap-deterministic-ranker');
  assert.equal(result.output.capability, 'recommendation.rank');
});

test('state-changing tool requires a signed approval bound to its payload', async () => {
  const orchestrator = createToolAgentOrchestrator({ tenantId: 'personal-u1', approvalSecret: SECRET });
  const base = createAgentRequest({
    requestId: 'group-1', idempotencyKey: 'group-1', tenantId: 'personal-u1', actorId: 'u1', agentId: 'group-gift-agent',
    action: 'create_group_gift', payload: { organizerId: 'u1', title: 'Team gift', targetMinorUnits: 5000 },
    consentReceipt: consent('create_group_gift')
  });
  const pending = await orchestrator.execute(base);
  assert.equal(pending.status, POLICY_DECISIONS.REQUIRE_CONFIRMATION);

  const approvalArtifact = createApprovalArtifact(base, { secret: SECRET, expiresAt: '2099-01-01T00:00:00.000Z' });
  const approved = await orchestrator.execute({ ...base, approvalArtifact });
  assert.equal(approved.status, 'completed');
  assert.equal(approved.output.proposedAction, 'create-group-gift');
  assert.equal(approved.output.arguments.targetMinorUnits, 5000);
});

test('preference intelligence agent only proposes confirmation candidates', async () => {
  const hash = 'b'.repeat(64);
  const modelCard = {
    id: 'wanderwrap/xlmr-gift-preference-v1', version: '1.0.0', task: 'gift-preference-extraction',
    baseModel: 'FacebookAI/xlm-roberta-base', license: 'MIT', weightsSha256: hash,
    taxonomyVersion: 'gift-v1', trainingDomain: 'licensed test data', datasetRights: 'reviewed',
    supportedLanguages: ['en'], maxBatchItems: 10, maxCharsPerItem: 1000, defaultThreshold: .8,
    metrics: { macroPrecision: .96, criticalNegationAccuracy: .99, subjectAttributionAccuracy: .99 }
  };
  const preferenceProvider = createOpenGiftPreferenceProvider({
    modelCard,
    predictBatch: async items => ({
      schemaVersion: GIFT_PREFERENCE_INFERENCE_SCHEMA_VERSION,
      model: { id: modelCard.id, version: modelCard.version, weightsSha256: hash, taxonomyVersion: 'gift-v1' },
      predictions: items.map(item => ({
        contentId: item.id, language: 'en', abstained: false,
        labels: [{ label: 'books', intent: 'interest', polarity: 'positive', confidence: .95, calibratedConfidence: .92 }]
      }))
    })
  });
  const orchestrator = createToolAgentOrchestrator({ tenantId: 'personal-u1', approvalSecret: SECRET, preferenceProvider });
  const result = await orchestrator.execute(createAgentRequest({
    requestId: 'preferences-1', tenantId: 'personal-u1', actorId: 'u1', agentId: 'preference-intelligence-agent',
    action: 'infer_preference_candidates',
    payload: {
      now: '2026-10-22T12:00:00Z',
      connection: {
        provider: 'x', accountOwnerId: 'u1', enabled: true,
        consent: { subjectId: 'u1', selfConsented: true, grantedAt: '2026-01-01T00:00:00Z', scopes: ['posts.read'], purposes: ['preference_intelligence'] }
      },
      content: [{ id: 'p1', kind: 'post', authorId: 'u1', text: 'I love reading novels', createdAt: '2026-10-20T00:00:00Z' }]
    },
    consentReceipt: consent('infer_preference_candidates')
  }));
  assert.equal(result.status, 'completed');
  assert.equal(result.output.proposedAction, 'present-preference-confirmations');
  assert.equal(result.output.arguments.candidates[0].rankEligible, false);
  assert.equal(JSON.stringify(result).includes('reading novels'), false);
});
