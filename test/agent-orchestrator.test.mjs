import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentOrchestrator, AgentRegistry, POLICY_DECISIONS, createAgentProposal,
  createAgentRequest, createApprovalArtifact, evaluateAgentPolicy
} from '../src/agent-orchestrator.mjs';

const SECRET = 'test-only-approval-secret';
const activeConsent = (overrides = {}) => ({
  receiptId: 'consent-1', tenantId: 'tenant-a', subjectId: 'user-1', status: 'active',
  actions: ['recommend'], expiresAt: '2099-01-01T00:00:00.000Z', ...overrides
});

function registryWith(handler = async () => ({ gifts: ['book'] }), options = {}) {
  const registry = new AgentRegistry();
  registry.register({
    id: 'gift-agent', tenantId: 'tenant-a', handler,
    actions: { recommend: { consentRequired: true }, purchase: { consentRequired: true, approvalRequired: true }, risky: { manualReview: true } },
    timeoutMs: options.timeoutMs || 100, maxRetries: options.maxRetries || 0
  });
  return registry;
}

const request = (overrides = {}) => createAgentRequest({
  requestId: 'request-1', correlationId: 'trace-1', idempotencyKey: 'idem-1', tenantId: 'tenant-a',
  actorId: 'user-1', agentId: 'gift-agent', action: 'recommend', consentReceipt: activeConsent(), ...overrides
});

test('request and proposal envelopes preserve trace and tenant boundaries', () => {
  const req = request();
  const proposal = createAgentProposal(req, { proposedAction: 'show-gifts', confidence: .81, evidence: ['explicit-like'] });
  assert.equal(proposal.correlationId, 'trace-1');
  assert.equal(proposal.tenantId, 'tenant-a');
  assert.equal(proposal.requestId, 'request-1');
  assert.throws(() => { proposal.tenantId = 'tenant-b'; }, TypeError);
});

test('policy denies cross-tenant access before invoking an agent', async () => {
  let calls = 0;
  const orchestrator = new AgentOrchestrator({ registry: registryWith(async () => { calls++; }) });
  const result = await orchestrator.execute(request({ tenantId: 'tenant-b', consentReceipt: activeConsent({ tenantId: 'tenant-b' }) }));
  assert.equal(result.status, POLICY_DECISIONS.DENY);
  assert.equal(result.reason, 'cross-tenant-access-denied');
  assert.equal(calls, 0);
});

test('unconsented action requires confirmation and invalid consent is denied', async () => {
  const orchestrator = new AgentOrchestrator({ registry: registryWith() });
  const absent = await orchestrator.execute(request({ requestId: 'r-absent', idempotencyKey: 'i-absent', consentReceipt: null }));
  assert.equal(absent.status, POLICY_DECISIONS.REQUIRE_CONFIRMATION);
  const wrongTenant = await orchestrator.execute(request({ requestId: 'r-wrong', idempotencyKey: 'i-wrong', consentReceipt: activeConsent({ tenantId: 'tenant-b' }) }));
  assert.equal(wrongTenant.status, POLICY_DECISIONS.DENY);
  assert.equal(wrongTenant.reason, 'consent-binding-mismatch');
});

test('approval is cryptographically bound to request, tenant, actor, action and idempotency key', async () => {
  const unsigned = request({ requestId: 'purchase-1', idempotencyKey: 'buy-1', action: 'purchase', consentReceipt: activeConsent({ actions: ['purchase'] }) });
  const approval = createApprovalArtifact(unsigned, { secret: SECRET, expiresAt: '2099-01-01T00:00:00.000Z' });
  const approved = request({ ...unsigned, approvalArtifact: approval });
  const orchestrator = new AgentOrchestrator({ registry: registryWith(), approvalSecret: SECRET });
  assert.equal((await orchestrator.execute(approved)).status, 'completed');

  const tampered = request({ ...unsigned, requestId: 'purchase-2', idempotencyKey: 'buy-2', approvalArtifact: approval });
  const denied = await orchestrator.execute(tampered);
  assert.equal(denied.status, POLICY_DECISIONS.DENY);
  assert.equal(denied.reason, 'approval-requestId-mismatch');

  const changedPayload = request({ ...unsigned, payload: { amountMinor: 9999 }, approvalArtifact: approval });
  const payloadOrchestrator = new AgentOrchestrator({ registry: registryWith(), approvalSecret: SECRET });
  const payloadDenied = await payloadOrchestrator.execute(changedPayload);
  assert.equal(payloadDenied.status, POLICY_DECISIONS.DENY);
  assert.equal(payloadDenied.reason, 'approval-payload-mismatch');

  const providerBound = request({ ...unsigned, requestId: 'purchase-provider', idempotencyKey: 'buy-provider', context: { providerId: 'paypal-v1' } });
  const providerApproval = createApprovalArtifact(providerBound, { secret: SECRET, expiresAt: '2099-01-01T00:00:00.000Z' });
  const providerSwapped = request({ ...providerBound, context: { providerId: 'stripe-v1' }, approvalArtifact: providerApproval });
  const providerOrchestrator = new AgentOrchestrator({ registry: registryWith(), approvalSecret: SECRET });
  const providerDenied = await providerOrchestrator.execute(providerSwapped);
  assert.equal(providerDenied.reason, 'approval-provider-mismatch');
});

test('idempotency coalesces concurrent calls and replays completed result', async () => {
  let calls = 0;
  const orchestrator = new AgentOrchestrator({ registry: registryWith(async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return { call: calls }; }) });
  const req = request();
  const [a, b] = await Promise.all([orchestrator.execute(req), orchestrator.execute(req)]);
  const c = await orchestrator.execute(req);
  assert.equal(calls, 1);
  assert.deepEqual(a.output, b.output);
  assert.deepEqual(a.output, c.output);
  assert.ok(orchestrator.getAuditLog().some(entry => entry.event === 'idempotency.replayed'));
});

test('idempotency keys are isolated by agent and action within a tenant', async () => {
  const registry = new AgentRegistry();
  registry.register({ id: 'agent-a', tenantId: 't1', actions: ['first'], handler: request => createAgentProposal(request, { proposedAction: 'first-result', arguments: { value: 1 } }) });
  registry.register({ id: 'agent-b', tenantId: 't1', actions: ['second'], handler: request => createAgentProposal(request, { proposedAction: 'second-result', arguments: { value: 2 } }) });
  const orchestrator = new AgentOrchestrator({ registry });
  const common = { tenantId: 't1', actorId: 'u1', idempotencyKey: 'shared-key' };
  const first = await orchestrator.execute({ ...common, agentId: 'agent-a', action: 'first' });
  const second = await orchestrator.execute({ ...common, agentId: 'agent-b', action: 'second' });
  assert.equal(first.output.proposedAction, 'first-result');
  assert.equal(second.output.proposedAction, 'second-result');
});

test('retryable failures retry within the bound and preserve attempt count', async () => {
  let calls = 0;
  const handler = async () => {
    calls++;
    if (calls === 1) { const error = new Error('temporary'); error.retryable = true; throw error; }
    return { ok: true };
  };
  const orchestrator = new AgentOrchestrator({ registry: registryWith(handler, { maxRetries: 1 }) });
  const result = await orchestrator.execute(request());
  assert.equal(result.status, 'completed');
  assert.equal(result.attempts, 2);
});

test('timeout enters safe manual review and is never automatically retried', async () => {
  let calls = 0;
  const handler = (_request, { signal }) => new Promise(resolve => {
    calls++;
    signal.addEventListener('abort', () => resolve({ tooLate: true }));
  });
  const orchestrator = new AgentOrchestrator({ registry: registryWith(handler, { timeoutMs: 10, maxRetries: 3 }) });
  const result = await orchestrator.execute(request());
  assert.equal(result.status, POLICY_DECISIONS.MANUAL_REVIEW);
  assert.equal(result.reason, 'execution-outcome-unknown');
  assert.equal(result.attempts, 1);
  assert.equal(calls, 1);
});

test('manual-review policy and unpermitted action fail closed', () => {
  const registry = registryWith();
  assert.equal(evaluateAgentPolicy(request({ action: 'risky' }), registry.get('gift-agent')).decision, POLICY_DECISIONS.MANUAL_REVIEW);
  assert.equal(evaluateAgentPolicy(request({ action: 'delete-everything' }), registry.get('gift-agent')).decision, POLICY_DECISIONS.DENY);
});
