import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPABILITIES,
  ProviderError,
  ProviderRegistry,
  PROVIDER_MANIFEST_SCHEMA,
  PROVIDER_RESULT_SCHEMA
} from '../src/provider-platform.mjs';
import { createDefaultProviderPlatform } from '../src/provider-adapters.mjs';
import { createToolSet } from '../src/mcp-tools.mjs';

const provider = ({ id, kind = 'recommender', capability = CAPABILITIES.RECOMMENDATION_RANK, priority = 0, markets = ['*'], currencies = ['*'], tenants = ['*'], execute = () => [], validateOutput } = {}) => ({
  manifest: {
    schemaVersion: PROVIDER_MANIFEST_SCHEMA,
    id,
    kind,
    contractVersion: '1.0',
    implementationVersion: '1.0.0',
    capabilities: [{ name: capability, version: '1.0' }],
    markets,
    currencies,
    tenants,
    modes: ['sandbox'],
    dataClasses: [],
    priority
  },
  execute,
  validateOutput: validateOutput ? { [capability]: validateOutput } : {}
});

test('validates manifests, rejects secrets and exposes immutable capability discovery', () => {
  const registry = new ProviderRegistry();
  registry.register(provider({ id: 'ranker-a' }));
  assert.throws(() => registry.register(provider({ id: 'ranker-a' })), /already registered/);
  const withSecret = provider({ id: 'ranker-secret' });
  withSecret.manifest.apiKey = 'must-not-be-here';
  assert.throws(() => registry.register(withSecret), /must not contain secrets/);
  const discovered = registry.discover({ tenantId: 't1', capability: CAPABILITIES.RECOMMENDATION_RANK });
  assert.equal(discovered[0].id, 'ranker-a');
  assert.equal(JSON.stringify(discovered).includes('execute'), false);
  assert.throws(() => { discovered[0].id = 'changed'; }, TypeError);
});

test('selection is deterministic by priority then provider id and respects market health', () => {
  const registry = new ProviderRegistry();
  registry.register(provider({ id: 'ranker-z', priority: 10, markets: ['GB'] }));
  registry.register(provider({ id: 'ranker-a', priority: 10, markets: ['GB'] }));
  registry.register(provider({ id: 'ranker-high', priority: 20, markets: ['US'] }));
  assert.equal(registry.resolve(CAPABILITIES.RECOMMENDATION_RANK, { tenantId: 't1', market: 'GB' }).providerId, 'ranker-a');
  registry.setHealth('ranker-a', 'unavailable', 'maintenance');
  assert.equal(registry.resolve(CAPABILITIES.RECOMMENDATION_RANK, { tenantId: 't1', market: 'GB' }).providerId, 'ranker-z');
  assert.throws(() => registry.resolve(CAPABILITIES.RECOMMENDATION_RANK, { tenantId: 't1', market: 'FR' }), /No eligible provider/);
});

test('tenant policy selects only registered allowlisted providers', async () => {
  const registry = new ProviderRegistry();
  registry.register(provider({ id: 'ranker-global', priority: 100, execute: () => ['global'] }));
  registry.register(provider({ id: 'ranker-tenant', priority: 1, tenants: ['tenant-a'], execute: () => ['tenant'] }));
  registry.configureTenant('tenant-a', { allowedProviders: ['ranker-tenant'], selections: { [CAPABILITIES.RECOMMENDATION_RANK]: 'ranker-tenant' } });
  assert.deepEqual((await registry.execute(CAPABILITIES.RECOMMENDATION_RANK, {}, { tenantId: 'tenant-a' })).output, ['tenant']);
  assert.deepEqual((await registry.execute(CAPABILITIES.RECOMMENDATION_RANK, {}, { tenantId: 'tenant-b' })).output, ['global']);
});

test('read-only capability fails over with bounded provenance on contract failure', async () => {
  const registry = new ProviderRegistry();
  registry.register(provider({ id: 'broken-ranker', priority: 100, execute: () => 'bad', validateOutput: Array.isArray }));
  registry.register(provider({ id: 'safe-ranker', priority: 10, execute: () => [{ id: 'g1' }], validateOutput: Array.isArray }));
  const result = await registry.execute(CAPABILITIES.RECOMMENDATION_RANK, {}, { tenantId: 't1' });
  assert.equal(result.schemaVersion, PROVIDER_RESULT_SCHEMA);
  assert.equal(result.provider.id, 'safe-ranker');
  assert.deepEqual(result.attempts.map(item => [item.providerId, item.status ?? item.code]), [['broken-ranker', 'contract_violation'], ['safe-ranker', 'completed']]);
});

test('write capability never falls through after an ambiguous provider outcome', async () => {
  let alternateCalls = 0;
  const registry = new ProviderRegistry();
  registry.register(provider({
    id: 'fulfiller-primary', kind: 'fulfillment', capability: CAPABILITIES.FULFILLMENT_CREATE, priority: 100,
    execute: () => { throw new ProviderError('timeout', 'timed out after dispatch', { outcomeUnknown: true }); }
  }));
  registry.register(provider({
    id: 'fulfiller-alternate', kind: 'fulfillment', capability: CAPABILITIES.FULFILLMENT_CREATE, priority: 10,
    execute: () => { alternateCalls += 1; return { id: 'order-2' }; }
  }));
  await assert.rejects(
    registry.execute(CAPABILITIES.FULFILLMENT_CREATE, {}, { tenantId: 't1', authorized: true, idempotencyKey: 'gift-1' }),
    error => error.code === 'outcome_unknown' && error.outcomeUnknown === true
  );
  assert.equal(alternateCalls, 0);
  await assert.rejects(registry.execute(CAPABILITIES.FULFILLMENT_CREATE, {}, { tenantId: 't1' }), error => error.code === 'policy_denied');
});

test('built-in adapters preserve current behavior and allow tool-level swapping', async () => {
  const platform = createDefaultProviderPlatform({ env: {} });
  const ranked = await platform.execute(CAPABILITIES.RECOMMENDATION_RANK, { budget: 60, signals: [{ value: 'travel', source: 'stated' }] }, { tenantId: 't1' });
  assert.equal(ranked.output[0].id, 'journal');
  assert.equal(ranked.provider.id, 'wanderwrap-deterministic-ranker');

  platform.register(provider({ id: 'custom-ranker', priority: 200, execute: () => [{ id: 'custom', name: 'Custom gift', price: 1 }], validateOutput: Array.isArray }));
  const toolSet = createToolSet({ platform });
  const result = await toolSet.recommend_gifts({ recipient: { budget: 10, signals: [] } }, { tenantId: 't1' });
  assert.equal(result[0].id, 'custom');
});
