import { ProviderRegistry, PROVIDER_MANIFEST_SCHEMA, CAPABILITIES } from './provider-platform.mjs';
import { rankGifts, CATALOG } from './recommendation.mjs';
import { buildAmazonSearch } from './amazon.mjs';
import { routeGift } from './fulfillment-router.mjs';
import { buildPayPalOrder } from './paypal.mjs';
import { createGiftLink, createGroupGift } from './gift-flow.mjs';
import { inferGiftPreferenceCandidates } from './preference-model.mjs';
import { findOpenLibraryGiftIdeas } from './open-library.mjs';
import { explainRecommendations } from './bedrock.mjs';

const capability = name => ({ name, version: '1.0', effect: undefined });
const manifest = input => ({
  schemaVersion: PROVIDER_MANIFEST_SCHEMA,
  contractVersion: '1.0',
  implementationVersion: '1.0.0',
  markets: ['*'],
  currencies: ['*'],
  tenants: ['*'],
  modes: ['sandbox', 'live'],
  dataClasses: [],
  priority: 100,
  enabled: true,
  ...input
});

function recommendationInput(input = {}) {
  const recipient = input.recipient ?? input.profile ?? input;
  return { recipient, catalog: input.catalog ?? input.candidates ?? CATALOG };
}

function nonemptyArray(value) { return Array.isArray(value); }
function objectWith(field) { return value => Boolean(value && typeof value === 'object' && value[field]); }

export function registerBuiltInProviders(registry, { preferenceProvider } = {}) {
  registry.register({
    manifest: manifest({
      id: 'wanderwrap-deterministic-ranker', kind: 'recommender',
      capabilities: [capability(CAPABILITIES.RECOMMENDATION_RANK)],
      dataClasses: ['confirmed-preference', 'catalogue-item']
    }),
    execute: (_capability, input) => {
      const normalized = recommendationInput(input);
      return rankGifts(normalized.recipient, normalized.catalog);
    },
    validateOutput: { [CAPABILITIES.RECOMMENDATION_RANK]: nonemptyArray }
  });

  registry.register({
    manifest: manifest({
      id: 'open-library-books', kind: 'catalogue',
      capabilities: [capability(CAPABILITIES.CATALOGUE_ENRICH)],
      dataClasses: ['confirmed-preference'], priority: 60
    }),
    execute: (_capability, input) => findOpenLibraryGiftIdeas(input),
    validateOutput: { [CAPABILITIES.CATALOGUE_ENRICH]: nonemptyArray }
  });

  registry.register({
    manifest: manifest({
      id: 'amazon-nova-explainer', kind: 'recommender',
      capabilities: [capability(CAPABILITIES.EXPLANATION_GENERATE)],
      dataClasses: ['recommendation-ledger'], priority: 50
    }),
    execute: (_capability, input) => explainRecommendations(input),
    validateOutput: { [CAPABILITIES.EXPLANATION_GENERATE]: value => Boolean(value?.summary && typeof value?.narratives === 'object') }
  });

  registry.register({
    manifest: manifest({
      id: 'amazon-creators-request', kind: 'catalogue',
      capabilities: [capability(CAPABILITIES.CATALOGUE_SEARCH)],
      markets: ['GB', 'US', 'CA', 'DE', 'FR', 'IT', 'ES', 'IE', 'MX'],
      dataClasses: ['search-query'], priority: 80
    }),
    execute: (_capability, input) => buildAmazonSearch(input),
    validateOutput: { [CAPABILITIES.CATALOGUE_SEARCH]: objectWith('endpoint') }
  });

  registry.register({
    manifest: manifest({
      id: 'wanderwrap-routing-policy', kind: 'fulfillment',
      capabilities: [capability(CAPABILITIES.FULFILLMENT_ROUTE)],
      dataClasses: ['destination-country', 'offer-summary']
    }),
    execute: (_capability, input) => routeGift(input),
    validateOutput: { [CAPABILITIES.FULFILLMENT_ROUTE]: objectWith('route') }
  });

  registry.register({
    manifest: manifest({
      id: 'paypal-orders-v2-payload', kind: 'payment',
      capabilities: [capability(CAPABILITIES.PAYMENT_ORDER_PREPARE)],
      currencies: ['GBP', 'USD', 'CAD', 'EUR'],
      dataClasses: ['order-amount', 'gift-reference']
    }),
    execute: (_capability, input) => buildPayPalOrder(input),
    validateOutput: { [CAPABILITIES.PAYMENT_ORDER_PREPARE]: objectWith('purchase_units') }
  });

  registry.register({
    manifest: manifest({
      id: 'wanderwrap-gift-core', kind: 'gift',
      capabilities: [capability(CAPABILITIES.GIFT_CLAIM_CREATE), capability(CAPABILITIES.GIFT_GROUP_CREATE)],
      dataClasses: ['user-id', 'recipient-id', 'gift-state']
    }),
    execute: (selectedCapability, input) => selectedCapability === CAPABILITIES.GIFT_CLAIM_CREATE ? createGiftLink(input) : createGroupGift(input),
    validateOutput: {
      [CAPABILITIES.GIFT_CLAIM_CREATE]: objectWith('id'),
      [CAPABILITIES.GIFT_GROUP_CREATE]: objectWith('id')
    }
  });

  if (preferenceProvider) {
    registry.register({
      manifest: manifest({
        id: 'wanderwrap-xlmr-preference', kind: 'preference',
        implementationVersion: preferenceProvider.modelCard.version,
        capabilities: [capability(CAPABILITIES.PREFERENCE_EXTRACT)],
        dataClasses: ['authorized-social-text'], priority: 100
      }),
      execute: (_capability, input) => inferGiftPreferenceCandidates({ ...input, provider: preferenceProvider }),
      validateOutput: { [CAPABILITIES.PREFERENCE_EXTRACT]: value => Boolean(value && ['completed', 'unavailable', 'no_eligible_content'].includes(value.status) && Array.isArray(value.candidates)) }
    });
  }
  return registry;
}

const ENV_SELECTIONS = Object.freeze({
  [CAPABILITIES.PREFERENCE_EXTRACT]: 'PROVIDER_PREFERENCE_ID',
  [CAPABILITIES.RECOMMENDATION_RANK]: 'PROVIDER_RECOMMENDATION_ID',
  [CAPABILITIES.CATALOGUE_SEARCH]: 'PROVIDER_CATALOGUE_ID',
  [CAPABILITIES.CATALOGUE_ENRICH]: 'PROVIDER_CATALOGUE_ENRICHMENT_ID',
  [CAPABILITIES.EXPLANATION_GENERATE]: 'PROVIDER_EXPLANATION_ID',
  [CAPABILITIES.FULFILLMENT_ROUTE]: 'PROVIDER_FULFILLMENT_ID',
  [CAPABILITIES.PAYMENT_ORDER_PREPARE]: 'PROVIDER_PAYMENT_ID',
  [CAPABILITIES.GIFT_CLAIM_CREATE]: 'PROVIDER_GIFT_ID',
  [CAPABILITIES.GIFT_GROUP_CREATE]: 'PROVIDER_GIFT_ID'
});

export function createDefaultProviderPlatform({ preferenceProvider, env = process.env, tenantPolicies = {} } = {}) {
  const registry = registerBuiltInProviders(new ProviderRegistry(), { preferenceProvider });
  const selections = Object.fromEntries(Object.entries(ENV_SELECTIONS).flatMap(([name, key]) => env[key] ? [[name, env[key]]] : []));
  registry.configureTenant('*', { selections });
  for (const [tenantId, policy] of Object.entries(tenantPolicies)) registry.configureTenant(tenantId, policy);
  return registry;
}

export { recommendationInput };
