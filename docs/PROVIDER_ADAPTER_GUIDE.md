# WanderWrap provider adapter guide

WanderWrap agents call stable capabilities, never provider SDKs directly. A provider can be added or replaced without changing an agent, MCP tool, workflow, UI or domain state machine.

## Stable capabilities

| Capability | Boundary | Automatic fallback |
| --- | --- | --- |
| `preference.extract` | Authorized text to proposal-only preference candidates | Before any side effect |
| `recommendation.rank` | Confirmed evidence and candidates to ranked gifts | Yes |
| `catalogue.search` / `catalogue.enrich` | Query to provider-grounded catalogue information | Yes |
| `explanation.generate` | Evidence ledger to grounded wording | Yes |
| `fulfillment.route` | Facts to proposed route | Yes |
| `fulfillment.create` | Create an external fulfilment operation | Never after dispatch or ambiguity |
| `payment.order.prepare` | Construct a reviewable payment proposal | Before dispatch only |
| `payment.capture` / `payment.refund` | Move money | Never after dispatch or ambiguity |
| `gift.claim.create` / `gift.group.create` | Create WanderWrap state | Requires authorization and idempotency |

## Adding a provider

1. Implement a narrow adapter executor for one or more capabilities.
2. Declare a `wanderwrap.provider.manifest.v1` manifest with provider ID, kind, contract and implementation versions, capabilities, markets, currencies, tenant scope, data classes and priority.
3. Add strict normalized-output validators. Provider-native payloads must not escape the adapter.
4. Register the adapter in the trusted composition root. Environment or tenant configuration may select registered IDs, but cannot dynamically load code.
5. Run the shared registry, fallback, policy and adapter conformance tests.
6. Roll out with a tenant allowlist, health state, shadow/canary policy and kill switch.

Manifests must never contain API keys, access tokens, credentials or private keys. They are safe discovery metadata; secrets are resolved server-side by the adapter.

## Minimal adapter example

```js
registry.register({
  manifest: {
    schemaVersion: 'wanderwrap.provider.manifest.v1',
    id: 'example-gifts',
    kind: 'catalogue',
    contractVersion: '1.0',
    implementationVersion: '1.0.0',
    capabilities: [{ name: 'catalogue.search', version: '1.0' }],
    markets: ['GB'], currencies: ['GBP'], tenants: ['*'],
    modes: ['sandbox'], dataClasses: ['search-query'], priority: 50
  },
  execute: async (_capability, input, context) => normalizedSearch(input, context),
  validateOutput: { 'catalogue.search': output => Array.isArray(output.items) }
});
```

Provider selection is deterministic: tenant allowlist and kill switches, requested capability, market/currency compatibility, health, priority, then provider ID. A caller cannot select a provider by inserting a field into domain input.

## Agent and approval rules

Agents remain bounded, proposal-only roles. Provider IDs are not agent IDs. The orchestration layer authorizes the logical action before the provider runtime executes it.

Signed approvals bind request, tenant, actor, agent, action, payload, idempotency key and selected provider. Changing the provider invalidates the approval. External payment or fulfilment timeouts become `outcome_unknown` and require reconciliation; the runtime must not try a second provider and risk duplicate charges or orders.

Every successful execution returns provider ID, implementation version, capability version, selection reason and attempt history. Audit records use this metadata and never retain credentials, raw social text or private delivery details.
