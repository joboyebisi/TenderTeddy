export const PROVIDER_MANIFEST_SCHEMA = 'wanderwrap.provider.manifest.v1';
export const PROVIDER_RESULT_SCHEMA = 'wanderwrap.provider.result.v1';

export const CAPABILITIES = Object.freeze({
  PREFERENCE_EXTRACT: 'preference.extract',
  RECOMMENDATION_RANK: 'recommendation.rank',
  CATALOGUE_SEARCH: 'catalogue.search',
  CATALOGUE_ENRICH: 'catalogue.enrich',
  EXPLANATION_GENERATE: 'explanation.generate',
  FULFILLMENT_ROUTE: 'fulfillment.route',
  FULFILLMENT_CREATE: 'fulfillment.create',
  PAYMENT_ORDER_PREPARE: 'payment.order.prepare',
  PAYMENT_CAPTURE: 'payment.capture',
  PAYMENT_REFUND: 'payment.refund',
  GIFT_CLAIM_CREATE: 'gift.claim.create',
  GIFT_GROUP_CREATE: 'gift.group.create'
});

export const CAPABILITY_EFFECTS = Object.freeze({
  [CAPABILITIES.PREFERENCE_EXTRACT]: 'read',
  [CAPABILITIES.RECOMMENDATION_RANK]: 'read',
  [CAPABILITIES.CATALOGUE_SEARCH]: 'read',
  [CAPABILITIES.CATALOGUE_ENRICH]: 'read',
  [CAPABILITIES.EXPLANATION_GENERATE]: 'read',
  [CAPABILITIES.FULFILLMENT_ROUTE]: 'proposal',
  [CAPABILITIES.FULFILLMENT_CREATE]: 'write',
  [CAPABILITIES.PAYMENT_ORDER_PREPARE]: 'proposal',
  [CAPABILITIES.PAYMENT_CAPTURE]: 'write',
  [CAPABILITIES.PAYMENT_REFUND]: 'write',
  [CAPABILITIES.GIFT_CLAIM_CREATE]: 'write',
  [CAPABILITIES.GIFT_GROUP_CREATE]: 'write'
});

const PROVIDER_KINDS = new Set(['preference', 'recommender', 'catalogue', 'fulfillment', 'payment', 'gift']);
const HEALTH_STATES = new Set(['healthy', 'degraded', 'unavailable', 'circuit_open']);
const SAFE_FALLBACK_CODES = new Set(['provider_unavailable', 'rate_limited', 'timeout', 'contract_violation']);
const SECRET_KEY = /(secret|token|password|credential|api.?key|private.?key)/i;

const clone = value => value == null ? value : structuredClone(value);
const list = (value, fallback = ['*']) => Array.isArray(value) && value.length ? [...new Set(value)] : fallback;
function immutableClone(value) {
  const copied = clone(value);
  const freeze = item => {
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) return item;
    for (const child of Object.values(item)) freeze(child);
    return Object.freeze(item);
  };
  return freeze(copied);
}

export class ProviderError extends Error {
  constructor(code, message, { retryable = false, outcomeUnknown = false, cause } = {}) {
    super(message, { cause });
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
    this.outcomeUnknown = outcomeUnknown;
  }
}

function containsSecret(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => SECRET_KEY.test(key) || containsSecret(child));
}

function normalizeManifest(input) {
  if (!input || typeof input !== 'object') throw new TypeError('provider manifest is required');
  if (containsSecret(input)) throw new Error('provider manifest must not contain secrets');
  if (input.schemaVersion !== PROVIDER_MANIFEST_SCHEMA) throw new Error('unsupported provider manifest schema');
  if (typeof input.id !== 'string' || !/^[a-z0-9][a-z0-9._-]+$/.test(input.id)) throw new Error('invalid provider id');
  if (!PROVIDER_KINDS.has(input.kind)) throw new Error('invalid provider kind');
  if (!input.contractVersion || !input.implementationVersion) throw new Error('provider versions are required');
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) throw new Error('provider capabilities are required');
  const seen = new Set();
  const capabilities = input.capabilities.map(capability => {
    if (!capability?.name || !CAPABILITY_EFFECTS[capability.name]) throw new Error('unsupported provider capability');
    if (seen.has(capability.name)) throw new Error('duplicate provider capability');
    seen.add(capability.name);
    const effect = capability.effect ?? CAPABILITY_EFFECTS[capability.name];
    if (effect !== CAPABILITY_EFFECTS[capability.name]) throw new Error('capability effect mismatch');
    if (!capability.version) throw new Error('capability version is required');
    return Object.freeze({ name: capability.name, version: capability.version, effect });
  });
  return Object.freeze({
    schemaVersion: PROVIDER_MANIFEST_SCHEMA,
    id: input.id,
    kind: input.kind,
    contractVersion: String(input.contractVersion),
    implementationVersion: String(input.implementationVersion),
    capabilities: Object.freeze(capabilities),
    markets: Object.freeze(list(input.markets)),
    currencies: Object.freeze(list(input.currencies)),
    tenants: Object.freeze(list(input.tenants)),
    modes: Object.freeze(list(input.modes, ['sandbox'])),
    dataClasses: Object.freeze(list(input.dataClasses, [])),
    priority: Number.isInteger(input.priority) ? input.priority : 0,
    enabled: input.enabled !== false
  });
}

function supportsValue(allowed, value) {
  return !value || allowed.includes('*') || allowed.includes(value);
}

function safeFailure(error, providerId) {
  return Object.freeze({
    providerId,
    code: error?.code || 'provider_unavailable',
    retryable: error?.retryable === true,
    outcomeUnknown: error?.outcomeUnknown === true
  });
}

export class ProviderRegistry {
  #providers = new Map();
  #health = new Map();
  #tenantPolicies = new Map();

  register({ manifest, execute, validateOutput = {} }) {
    const normalized = normalizeManifest(manifest);
    if (this.#providers.has(normalized.id)) throw new Error(`provider already registered: ${normalized.id}`);
    if (typeof execute !== 'function') throw new TypeError('provider execute function is required');
    for (const key of Object.keys(validateOutput)) {
      if (!normalized.capabilities.some(item => item.name === key) || typeof validateOutput[key] !== 'function') throw new Error('invalid provider output validator');
    }
    const provider = Object.freeze({ manifest: normalized, execute, validateOutput: Object.freeze({ ...validateOutput }) });
    this.#providers.set(normalized.id, provider);
    this.#health.set(normalized.id, Object.freeze({ status: 'healthy', reason: 'registered', changedAt: new Date().toISOString() }));
    return normalized;
  }

  configureTenant(tenantId, policy = {}) {
    if (!tenantId) throw new TypeError('tenantId is required');
    const normalized = Object.freeze({
      allowedProviders: Object.freeze(list(policy.allowedProviders)),
      disabledProviders: Object.freeze(list(policy.disabledProviders, [])),
      selections: Object.freeze({ ...(policy.selections ?? {}) })
    });
    this.#tenantPolicies.set(tenantId, normalized);
    return clone(normalized);
  }

  setHealth(providerId, status, reason = 'operator update') {
    if (!this.#providers.has(providerId)) throw new Error('unknown provider');
    if (!HEALTH_STATES.has(status)) throw new Error('invalid provider health');
    this.#health.set(providerId, Object.freeze({ status, reason: String(reason), changedAt: new Date().toISOString() }));
  }

  discover({ tenantId, capability, market, currency } = {}) {
    return this.#candidates(capability, { tenantId, market, currency }).map(provider => this.#publicDescriptor(provider));
  }

  health() {
    return Object.freeze([...this.#providers.values()].map(provider => Object.freeze({
      providerId: provider.manifest.id,
      ...clone(this.#health.get(provider.manifest.id))
    })));
  }

  resolve(capability, context = {}) {
    const policy = this.#tenantPolicies.get(context.tenantId) ?? this.#tenantPolicies.get('*') ?? null;
    const requestedProvider = context.providerId ?? policy?.selections?.[capability] ?? null;
    const candidates = this.#candidates(capability, context);
    const provider = requestedProvider ? candidates.find(item => item.manifest.id === requestedProvider) : candidates[0];
    if (!provider) throw new ProviderError('unsupported_capability', `No eligible provider for ${capability}`);
    return this.#selection(provider, capability, requestedProvider ? 'configured-provider' : 'priority');
  }

  async execute(capability, input, context = {}) {
    const effect = CAPABILITY_EFFECTS[capability];
    if (!effect) throw new ProviderError('unsupported_capability', `Unknown capability: ${capability}`);
    if (effect === 'write' && context.authorized !== true) throw new ProviderError('policy_denied', 'Explicit policy authorization is required');
    if (effect === 'write' && !context.idempotencyKey) throw new ProviderError('invalid_request', 'An idempotency key is required for write capabilities');

    const policy = this.#tenantPolicies.get(context.tenantId) ?? this.#tenantPolicies.get('*') ?? null;
    const requestedProvider = context.providerId ?? policy?.selections?.[capability] ?? null;
    let candidates = this.#candidates(capability, context);
    if (requestedProvider) candidates = candidates.filter(item => item.manifest.id === requestedProvider);
    if (!candidates.length) throw new ProviderError('unsupported_capability', `No eligible provider for ${capability}`);

    const mayFallback = effect !== 'write' && context.allowFallback !== false && !requestedProvider;
    const attempts = [];
    for (const provider of candidates) {
      const selection = this.#selection(provider, capability, requestedProvider ? 'configured-provider' : attempts.length ? 'fallback' : 'priority');
      try {
        const output = await provider.execute(capability, clone(input), Object.freeze({ ...clone(context), selection }));
        const validate = provider.validateOutput[capability];
        if (validate && validate(output) !== true) throw new ProviderError('contract_violation', 'Provider returned an invalid response');
        return Object.freeze({
          schemaVersion: PROVIDER_RESULT_SCHEMA,
          status: 'completed',
          capability,
          capabilityVersion: selection.capabilityVersion,
          provider: Object.freeze({ id: provider.manifest.id, kind: provider.manifest.kind, implementationVersion: provider.manifest.implementationVersion }),
          selection: Object.freeze({ reason: selection.reason, market: context.market ?? null, currency: context.currency ?? null }),
          attempts: Object.freeze([...attempts, Object.freeze({ providerId: provider.manifest.id, status: 'completed' })]),
          output: clone(output)
        });
      } catch (cause) {
        const error = cause instanceof ProviderError
          ? cause
          : new ProviderError('provider_unavailable', 'Provider execution failed', { retryable: cause?.retryable === true, outcomeUnknown: cause?.outcomeUnknown === true, cause });
        attempts.push(safeFailure(error, provider.manifest.id));
        if (error.outcomeUnknown || effect === 'write') {
          throw new ProviderError('outcome_unknown', 'Provider outcome is unknown; reconciliation is required', { outcomeUnknown: true, cause: error });
        }
        if (!mayFallback || !SAFE_FALLBACK_CODES.has(error.code)) break;
      }
    }
    const failure = new ProviderError('provider_unavailable', `No provider completed ${capability}`);
    failure.attempts = Object.freeze(attempts);
    throw failure;
  }

  #candidates(capability, context) {
    const policy = this.#tenantPolicies.get(context.tenantId) ?? this.#tenantPolicies.get('*') ?? null;
    return [...this.#providers.values()].filter(provider => {
      const manifest = provider.manifest;
      const health = this.#health.get(manifest.id)?.status;
      if (!manifest.enabled || health === 'unavailable' || health === 'circuit_open') return false;
      if (!manifest.capabilities.some(item => item.name === capability)) return false;
      if (!supportsValue(manifest.tenants, context.tenantId)) return false;
      if (!supportsValue(manifest.markets, context.market)) return false;
      if (!supportsValue(manifest.currencies, context.currency)) return false;
      if (policy && !supportsValue(policy.allowedProviders, manifest.id)) return false;
      if (policy?.disabledProviders.includes(manifest.id)) return false;
      return true;
    }).sort((a, b) => b.manifest.priority - a.manifest.priority || a.manifest.id.localeCompare(b.manifest.id));
  }

  #selection(provider, capability, reason) {
    const contract = provider.manifest.capabilities.find(item => item.name === capability);
    return Object.freeze({
      providerId: provider.manifest.id,
      providerKind: provider.manifest.kind,
      implementationVersion: provider.manifest.implementationVersion,
      contractVersion: provider.manifest.contractVersion,
      capability,
      capabilityVersion: contract.version,
      effect: contract.effect,
      reason
    });
  }

  #publicDescriptor(provider) {
    return immutableClone({ ...clone(provider.manifest), health: clone(this.#health.get(provider.manifest.id)) });
  }
}
