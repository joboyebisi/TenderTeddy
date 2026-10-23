import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

export const POLICY_DECISIONS = Object.freeze({
  ALLOW: 'allow',
  DENY: 'deny',
  REQUIRE_CONFIRMATION: 'require_confirmation',
  MANUAL_REVIEW: 'manual_review'
});

const nowIso = clock => new Date(clock()).toISOString();
const copy = value => value == null ? value : structuredClone(value);
const requiredString = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
};

export function createAgentRequest(input, { id = randomUUID, clock = Date.now } = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('request input is required');
  const requestId = input.requestId || id();
  const envelope = {
    kind: 'wanderwrap.agent.request.v1',
    requestId,
    correlationId: input.correlationId || requestId,
    causationId: input.causationId || null,
    idempotencyKey: input.idempotencyKey || requestId,
    tenantId: requiredString(input.tenantId, 'tenantId'),
    actorId: requiredString(input.actorId, 'actorId'),
    agentId: requiredString(input.agentId, 'agentId'),
    action: requiredString(input.action, 'action'),
    payload: copy(input.payload ?? {}),
    consentReceipt: copy(input.consentReceipt ?? null),
    approvalArtifact: copy(input.approvalArtifact ?? null),
    context: copy(input.context ?? {}),
    createdAt: input.createdAt || nowIso(clock)
  };
  return Object.freeze(envelope);
}

export function createAgentProposal(request, input, { id = randomUUID, clock = Date.now } = {}) {
  if (!request || request.kind !== 'wanderwrap.agent.request.v1') throw new TypeError('valid request envelope required');
  if (!input || typeof input !== 'object') throw new TypeError('proposal input is required');
  return Object.freeze({
    kind: 'wanderwrap.agent.proposal.v1',
    proposalId: input.proposalId || id(),
    requestId: request.requestId,
    correlationId: request.correlationId,
    tenantId: request.tenantId,
    agentId: request.agentId,
    proposedAction: requiredString(input.proposedAction, 'proposedAction'),
    arguments: copy(input.arguments ?? {}),
    evidence: copy(input.evidence ?? []),
    confidence: Number.isFinite(input.confidence) ? input.confidence : null,
    risks: copy(input.risks ?? []),
    provider: copy(input.provider ?? null),
    capability: input.capability ?? null,
    createdAt: input.createdAt || nowIso(clock)
  });
}

export class AgentRegistry {
  #agents = new Map();

  register(definition) {
    if (!definition || typeof definition !== 'object') throw new TypeError('agent definition is required');
    const id = requiredString(definition.id, 'agent.id');
    if (this.#agents.has(id)) throw new Error(`agent already registered: ${id}`);
    if (typeof definition.handler !== 'function') throw new TypeError('agent.handler must be a function');
    const actions = normalizeActions(definition.actions);
    const agent = Object.freeze({
      id,
      tenantId: requiredString(definition.tenantId, 'agent.tenantId'),
      actions,
      handler: definition.handler,
      timeoutMs: positiveInteger(definition.timeoutMs, 5_000),
      maxRetries: nonnegativeInteger(definition.maxRetries, 0),
      enabled: definition.enabled !== false
    });
    this.#agents.set(id, agent);
    return agent;
  }

  get(id) { return this.#agents.get(id) || null; }
  has(id) { return this.#agents.has(id); }
  list() { return [...this.#agents.values()]; }
}

function normalizeActions(actions) {
  if (Array.isArray(actions)) return Object.freeze(Object.fromEntries(actions.map(action => [requiredString(action, 'action'), Object.freeze({})])));
  if (!actions || typeof actions !== 'object') throw new TypeError('agent.actions must be an array or object');
  return Object.freeze(Object.fromEntries(Object.entries(actions).map(([name, policy]) => [requiredString(name, 'action'), Object.freeze({ ...(policy || {}) })])));
}

function positiveInteger(value, fallback) { return Number.isInteger(value) && value > 0 ? value : fallback; }
function nonnegativeInteger(value, fallback) { return Number.isInteger(value) && value >= 0 ? value : fallback; }

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

const approvalBinding = artifact => stableJson({
  approvalId: artifact.approvalId,
  requestId: artifact.requestId,
  tenantId: artifact.tenantId,
  actorId: artifact.actorId,
  agentId: artifact.agentId,
  action: artifact.action,
  providerId: artifact.providerId,
  payloadDigest: artifact.payloadDigest,
  idempotencyKey: artifact.idempotencyKey,
  expiresAt: artifact.expiresAt
});

export function createApprovalArtifact(request, { approvalId = randomUUID(), expiresAt, secret, clock = Date.now } = {}) {
  requiredString(secret, 'approval secret');
  const artifact = {
    approvalId,
    requestId: request.requestId,
    tenantId: request.tenantId,
    actorId: request.actorId,
    agentId: request.agentId,
    action: request.action,
    providerId: request.payload?.providerId ?? request.context?.providerId ?? null,
    payloadDigest: createHash('sha256').update(stableJson(request.payload)).digest('hex'),
    idempotencyKey: request.idempotencyKey,
    expiresAt: expiresAt || new Date(clock() + 5 * 60_000).toISOString()
  };
  return Object.freeze({ ...artifact, signature: createHmac('sha256', secret).update(approvalBinding(artifact)).digest('hex') });
}

export function validateApprovalArtifact(request, artifact, { secret, clock = Date.now } = {}) {
  if (!artifact || typeof artifact !== 'object') return { valid: false, reason: 'approval-required' };
  const bindings = ['requestId', 'tenantId', 'actorId', 'agentId', 'action', 'idempotencyKey'];
  for (const field of bindings) if (artifact[field] !== request[field]) return { valid: false, reason: `approval-${field}-mismatch` };
  const payloadDigest = createHash('sha256').update(stableJson(request.payload)).digest('hex');
  if (artifact.payloadDigest !== payloadDigest) return { valid: false, reason: 'approval-payload-mismatch' };
  const providerId = request.payload?.providerId ?? request.context?.providerId ?? null;
  if (artifact.providerId !== providerId) return { valid: false, reason: 'approval-provider-mismatch' };
  const approvalExpiry = Date.parse(artifact.expiresAt);
  if (!artifact.approvalId || !artifact.expiresAt || !Number.isFinite(approvalExpiry) || approvalExpiry <= clock()) return { valid: false, reason: 'approval-expired-or-malformed' };
  if (!secret || typeof artifact.signature !== 'string') return { valid: false, reason: 'approval-signature-required' };
  const expected = createHmac('sha256', secret).update(approvalBinding(artifact)).digest();
  let actual;
  try { actual = Buffer.from(artifact.signature, 'hex'); } catch { return { valid: false, reason: 'approval-signature-invalid' }; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { valid: false, reason: 'approval-signature-invalid' };
  return { valid: true, approvalId: artifact.approvalId };
}

export function evaluateAgentPolicy(request, agent, { approvalSecret, clock = Date.now } = {}) {
  if (!agent || !agent.enabled) return decision(POLICY_DECISIONS.DENY, 'agent-unavailable');
  if (request.tenantId !== agent.tenantId) return decision(POLICY_DECISIONS.DENY, 'cross-tenant-access-denied');
  const actionPolicy = agent.actions[request.action];
  if (!actionPolicy) return decision(POLICY_DECISIONS.DENY, 'action-not-permitted');
  if (actionPolicy.manualReview === true || request.context?.forceManualReview === true) return decision(POLICY_DECISIONS.MANUAL_REVIEW, 'manual-review-policy');
  if (actionPolicy.consentRequired) {
    const consent = request.consentReceipt;
    if (!consent) return decision(POLICY_DECISIONS.REQUIRE_CONFIRMATION, 'consent-required');
    if (!consent.receiptId) return decision(POLICY_DECISIONS.DENY, 'consent-malformed');
    if (consent.tenantId !== request.tenantId || consent.subjectId !== request.actorId) return decision(POLICY_DECISIONS.DENY, 'consent-binding-mismatch');
    const consentExpiry = consent.expiresAt ? Date.parse(consent.expiresAt) : null;
    if (consent.expiresAt && !Number.isFinite(consentExpiry)) return decision(POLICY_DECISIONS.DENY, 'consent-malformed');
    if (consent.status !== 'active' || (consentExpiry && consentExpiry <= clock())) return decision(POLICY_DECISIONS.REQUIRE_CONFIRMATION, 'consent-inactive');
    const grants = Array.isArray(consent.actions) ? consent.actions : [];
    if (!grants.includes(request.action) && !grants.includes('*')) return decision(POLICY_DECISIONS.REQUIRE_CONFIRMATION, 'action-not-consented');
  }
  if (actionPolicy.approvalRequired) {
    if (!request.approvalArtifact) return decision(POLICY_DECISIONS.REQUIRE_CONFIRMATION, 'approval-required');
    const validation = validateApprovalArtifact(request, request.approvalArtifact, { secret: approvalSecret, clock });
    if (!validation.valid) return decision(POLICY_DECISIONS.DENY, validation.reason);
  }
  return decision(POLICY_DECISIONS.ALLOW, 'policy-satisfied');
}

function decision(value, reason) { return Object.freeze({ decision: value, reason }); }

export class AgentOrchestrator {
  #registry; #approvalSecret; #clock; #auditSink; #results = new Map(); #inflight = new Map(); #audit = [];

  constructor({ registry = new AgentRegistry(), approvalSecret, clock = Date.now, auditSink = () => {} } = {}) {
    this.#registry = registry;
    this.#approvalSecret = approvalSecret;
    this.#clock = clock;
    this.#auditSink = auditSink;
  }

  get registry() { return this.#registry; }
  getAuditLog() { return copy(this.#audit); }

  async execute(input) {
    let request;
    // Re-normalize even branded input: the `kind` field is not a trust boundary.
    try { request = createAgentRequest(input, { clock: this.#clock }); }
    catch (error) { return this.#safeFailure(null, 'invalid-request', error); }

    const cacheKey = `${request.tenantId}:${request.agentId}:${request.action}:${request.idempotencyKey}`;
    if (this.#results.has(cacheKey)) {
      this.#record('idempotency.replayed', request, { cacheKey });
      return copy(this.#results.get(cacheKey));
    }
    if (this.#inflight.has(cacheKey)) return copy(await this.#inflight.get(cacheKey));

    const run = this.#executeOnce(request).then(result => {
      // Cache only a confirmed execution or an ambiguous timeout. Policy refusals
      // must be re-evaluable after the caller obtains consent or approval.
      if (result.status === 'completed' || result.reason === 'execution-outcome-unknown') this.#results.set(cacheKey, copy(result));
      return result;
    }).finally(() => this.#inflight.delete(cacheKey));
    this.#inflight.set(cacheKey, run);
    return copy(await run);
  }

  async #executeOnce(request) {
    this.#record('request.received', request);
    const agent = this.#registry.get(request.agentId);
    const policy = evaluateAgentPolicy(request, agent, { approvalSecret: this.#approvalSecret, clock: this.#clock });
    this.#record('policy.decided', request, policy);
    if (policy.decision !== POLICY_DECISIONS.ALLOW) return this.#result(request, policy.decision, policy.reason);

    for (let attempt = 1; attempt <= agent.maxRetries + 1; attempt++) {
      const controller = new AbortController();
      try {
        const output = await withTimeout(
          Promise.resolve().then(() => agent.handler(copy(request), { signal: controller.signal, attempt })),
          agent.timeoutMs,
          controller
        );
        this.#record('execution.succeeded', request, { attempt });
        return this.#result(request, 'completed', 'executed', output, attempt);
      } catch (error) {
        const timedOut = error?.code === 'AGENT_TIMEOUT';
        this.#record(timedOut ? 'execution.timed_out' : 'execution.failed', request, { attempt, error: safeError(error) });
        if (timedOut) return this.#safeFailure(request, 'execution-outcome-unknown', error, POLICY_DECISIONS.MANUAL_REVIEW, attempt);
        const retryable = error?.retryable === true;
        if (!retryable || attempt > agent.maxRetries) return this.#safeFailure(request, 'agent-execution-failed', error, POLICY_DECISIONS.MANUAL_REVIEW, attempt);
        this.#record('execution.retrying', request, { attempt });
      }
    }
  }

  #result(request, status, reason, output = null, attempts = 0) {
    return Object.freeze({
      kind: 'wanderwrap.agent.result.v1',
      requestId: request.requestId,
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      agentId: request.agentId,
      status,
      reason,
      output: copy(output),
      attempts,
      completedAt: nowIso(this.#clock)
    });
  }

  #safeFailure(request, reason, error, status = POLICY_DECISIONS.DENY, attempts = 0) {
    const fallback = request || { requestId: null, correlationId: null, tenantId: null, agentId: null };
    const result = this.#result(fallback, status, reason, null, attempts);
    this.#record('execution.safe_failure', fallback, { reason, error: safeError(error) });
    return result;
  }

  #record(event, request, details = {}) {
    const entry = Object.freeze({
      event,
      at: nowIso(this.#clock),
      requestId: request?.requestId || null,
      correlationId: request?.correlationId || null,
      tenantId: request?.tenantId || null,
      agentId: request?.agentId || null,
      action: request?.action || null,
      details: copy(details)
    });
    this.#audit.push(entry);
    try {
      const delivery = this.#auditSink(entry);
      if (delivery && typeof delivery.catch === 'function') delivery.catch(() => {});
    } catch { /* audit delivery must not expand execution authority */ }
  }
}

function safeError(error) { return { name: error?.name || 'Error', message: String(error?.message || error || 'unknown error'), code: error?.code || null }; }

function withTimeout(promise, timeoutMs, controller) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`agent execution exceeded ${timeoutMs}ms`);
      error.code = 'AGENT_TIMEOUT';
      reject(error);
      controller.abort();
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
