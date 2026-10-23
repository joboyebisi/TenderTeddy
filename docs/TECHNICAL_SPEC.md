# WanderWrap technical specification

**Version:** 0.4  
**Implements:** `PRD.md`, `PRD_AMAZON_ALEXA_PLUS.md`, `PRD_PAYPAL_AI.md`

## 1. Architecture

### Client layer

- Responsive web/PWA at `wanderwrap.co.uk`: account, profiles, recommendations, claims, PayPal approval and dashboards.
- Alexa+ add-on: conversational client for the remote MCP service.
- Later native mobile shell: push, contacts and just-in-time location permission.
- Later Slack/Teams/Telegram adapters: scoped group-gift commands and approved conversation access.

### Edge and identity

- CloudFront/WAF → API Gateway/ALB.
- Cognito for consumers; SAML/OIDC federation for business customers.
- OAuth 2.1 authorization code + PKCE for Alexa+ account linking.
- Protected Resource Metadata at `/.well-known/oauth-protected-resource`.
- Secrets in Secrets Manager; KMS envelope encryption for sensitive profile fields.

### Services

- **Profile service:** household/user/recipient/consent records.
- **Evidence service:** source-scoped preference facts with confidence and confirmation.
- **Preference extraction service:** isolated self-hosted XLM-R inference for consented text; returns proposal-only structured candidates and has no database, catalogue, ranking or outbound-network authority.
- **Recommendation service:** retrieval, policy filtering, deterministic ranking and explanation.
- **Catalogue service:** normalized Amazon/supplier items with timestamps and territory.
- **Routing service:** Amazon vs PayPal/Xoom/supplier decision.
- **Gift service:** claim/group/order state machines.
- **Payment service:** PayPal Orders create/capture/refund and webhook processing.
- **MCP gateway:** Alexa+-compatible Streamable HTTP tools.
- **Notification service:** transactional email/push/Alexa-compatible confirmation payloads.
- **Audit service:** append-only decision/approval/provider events.
- **Provider platform:** immutable manifests, capability registry, tenant-aware resolution, health/kill switches, guarded execution and provider provenance.

Start as a modular TypeScript service and split only when load/compliance ownership requires it. The current dependency-free JavaScript modules are executable domain contracts.

Agents depend on stable capabilities rather than vendors. The initial capability set covers preference extraction, recommendation ranking, catalogue search/enrichment, explanation, fulfilment routing/creation, payment preparation/capture/refund and gift creation. Code-reviewed adapters are registered at boot; environment and durable tenant policy may enable or select registered IDs but cannot load arbitrary code. See `PROVIDER_ADAPTER_GUIDE.md`.

Read-only and proposal operations may fall back deterministically before side effects. Payment or fulfilment operations never fail over after dispatch or an ambiguous timeout; they become `outcome_unknown` and enter reconciliation/manual review. Providers become sticky to an order once created. Signed approvals bind the selected provider as well as the exact payload and idempotency key.

## 2. Data model

### User

`id`, `email`, `locale`, `homeCountry`, `currency`, `status`, `createdAt`, `deletedAt`.

### RecipientProfile

`id`, `ownerId`, `displayName`, `relationship`, `country`, `consentBasis`, `status`.

### PreferenceEvidence

`id`, `recipientId`, `topic`, `sourceType`, `sourceReference`, `contentHash`, `confidence`, `confirmedState`, `observedAt`, `expiresAt`, `extractorModelId`, `extractorRevision`, `taxonomyVersion`, `consentReceiptId`, `allowedPurpose`, `sensitivityDecision`, `userDecision`.

Never store protected/sensitive inference categories. Derived data is deleted when the underlying connection is revoked unless another lawful basis exists.

### Gift

`id`, `senderId`, `recipientId`, `occasionId`, `recommendationId`, `kind`, `status`, `currency`, `providerRoute`, `providerReference`, `idempotencyKey`, timestamps.

Gift state:

`draft → awaiting-sender-approval → claimable → address-pending → ready-for-checkout → paid → fulfilled → completed`

Exceptional terminal/branch states: `declined`, `expired`, `cancelled`, `refunding`, `refunded`, `failed`, `manual-review`.

### GroupGift

`id`, `organizerId`, `recipientId`, `targetMinorUnits`, `pledgedMinorUnits`, `currency`, `deadline`, `visibility`, `status`.

All money uses integer minor units plus ISO currency. Never floating-point values.

### ProviderEvent

`id`, `provider`, `externalId`, `eventType`, `signatureVerified`, `receivedAt`, `processedAt`, `payloadHash`, `outcome`. Unique on provider + external ID/event type to make replay safe.

## 3. Fulfilment decision table

| Intent | Amazon verified deliverable offer | Approved alternate supplier | PayPal available | Xoom eligible | Result |
|---|---:|---:|---:|---:|---|
| Physical product | Yes | Any | Any | N/A | Amazon retail/checkout handoff |
| Physical/experience | No | Yes | Yes | N/A | PayPal merchant checkout |
| Physical/experience | No | No | Yes | N/A | PayPal value-gift option |
| Money, domestic | N/A | N/A | Yes | Any | PayPal send handoff |
| Money, cross-border | N/A | N/A | Yes | Yes | Xoom handoff |
| Any | No | No | No | No | Manual review/no fabricated route |

Every result includes `reason`, `requiresUserApproval`, `autoPurchase:false`, provider and last-checked metadata.

Amazon Creators API is a catalogue/recommendation integration. It does not by itself authorize WanderWrap to place retail orders. The user completes checkout through a valid Amazon/Alexa+ commerce surface. Xoom is also modelled as a handoff until an approved partner integration exists.

## 4. API contracts

### Recommendations

`POST /v1/recommendations`

Request: recipient ID, occasion, budget/currency, destination and exclusions.  
Response: up to four items with score, evidence, explanation, provider candidates and feasibility timestamp.

### Routing

`POST /v1/routes/evaluate`

Request: gift kind, sender/destination countries, selected item, current provider capabilities.  
Response: provider route, reason, disclosures, required confirmation and fallback.

### Claims

- `POST /v1/gifts/:id/claim-links`
- `GET /claim/:opaqueToken`
- `POST /claim/:opaqueToken/accept`
- `POST /claim/:opaqueToken/decline`
- `POST /claim/:opaqueToken/delivery`

Tokens are random, stored hashed, scoped, rate-limited and revocable. High-risk changes require recipient verification.

### PayPal

- `POST /v1/paypal/orders` — resolve trusted SKU; create Orders v2 request.
- `POST /v1/paypal/orders/:id/capture` — validate gift state/provider order/amount/currency; idempotent capture.
- `POST /v1/webhooks/paypal` — verify signature, persist event, enqueue exactly-once state processing.

### Amazon

- `POST /v1/catalog/amazon/search` — server obtains/caches OAuth token, calls Creators API with marketplace and partner tag.
- `POST /v1/handoffs/amazon` — records disclosure/selection and returns provider detail URL or eligible checkout session.

## 5. MCP server

Endpoint: `POST /mcp` using Streamable HTTP and JSON-RPC 2.0. Target protocol: `2025-11-25`, as required by the Amazon event snapshot and current Alexa+ documentation.

Implemented tools:

- `recommend_gifts`
- `route_gift`
- `create_gift_link`
- `create_group_gift`
- `prepare_paypal_order`
- `search_amazon_catalog`

`initialize`, `tools/list`, `tools/call` and initialized notification are implemented. Write-preparation tools require `userApproved:true`; real deployment additionally derives identity/scopes from the OAuth access token rather than trusting an argument.

Production Alexa+ gap checklist:

- deploy to a public HTTPS endpoint;
- finish OAuth 2.1 authorization server metadata and PKCE flow;
- enforce audience/resource/scopes and token expiry;
- validate Host/Origin against configured values;
- add request deadlines, rate limits, tracing and structured redaction;
- measure p95 end-to-end latency against Alexa+'s documented target;
- create and certify the Alexa+ add-on manifest/assets/privacy/terms.

## 6. AI system

### Pipeline

1. Retrieve only consented, confirmed recipient evidence.
2. Generate searchable categories/constraints.
3. Retrieve candidates from normalized catalogues.
4. Apply hard filters: market, delivery, budget, exclusions, safety.
5. Deterministically score by evidence strength and fit.
6. Use a language model only to phrase explanations/questions from cited facts.
7. Run unsupported-claim and sensitive-inference checks.

The model never invents availability, price, delivery, fees, exchange rates or provider eligibility. Those are provider facts with freshness metadata.

### XLM-R extraction boundary

The application evaluates consent and source capability before sending a bounded transient batch to `POST /internal/v1/preference-extractions`. The inference request contains opaque content references, text, creation time and optional language hints; it excludes names, handles, email addresses, access tokens, consent receipts and stable user IDs. The response is schema-versioned and binds model ID, adapter version, artifact checksum and taxonomy version to typed labels, intent, polarity, calibrated confidence and abstention reasons.

The inference container has no public ingress or outbound network access. Request and response bodies are excluded from ordinary logs and traces. Payload size, concurrency and time are bounded, and malformed, mismatched or unavailable inference fails closed to zero ML candidates. The deterministic extractor remains the fallback and control cohort.

### Evaluation

- recommendation relevance judged on a labelled scenario set;
- explanation faithfulness: every reason maps to confirmed evidence;
- sensitive inference violations: zero release threshold;
- routing accuracy across market/capability matrix;
- hallucinated provider facts: zero release threshold;
- latency and recovery under provider timeouts.

## 7. PayPal implementation

Use Orders v2 and the current JavaScript SDK. Server credentials are runtime secrets. The server calculates totals, supplies gift ID as provider reference, uses `PayPal-Request-Id`, and validates the retrieved order before capture. Webhooks are signature-verified before mutation. Sandbox fixtures cover completed, denied, cancelled, duplicate and delayed events.

Personal PayPal/Xoom routes are external consumer flows unless PayPal grants an appropriate API/product contract. WanderWrap must not relay credentials, automate the consumer UI or claim a transfer succeeded without a provider status source.

## 8. Amazon implementation

Use Creators API for `SearchItems`/`GetItems` after Associates approval, required qualifying activity and marketplace partner tags. Cache tokens safely and respect response/display requirements. The normalized offer records source, marketplace, availability/price timestamp and detail URL.

For Alexa+, discovery occurs through MCP. Checkout must follow the supported Alexa+ commerce/UCP flow or send the customer to Amazon; it is not a `tools/call` that silently purchases.

## 9. Infrastructure and operations

### AWS production target

- Route 53, CloudFront, WAF;
- API Gateway/ALB, ECS Fargate or Lambda;
- Cognito and an OAuth authorization service;
- Aurora PostgreSQL for transactional data;
- DynamoDB for idempotency/session/short-lived state where appropriate;
- SQS/EventBridge/Step Functions for provider workflows;
- KMS, Secrets Manager, CloudTrail, CloudWatch/X-Ray;
- S3 for consented static assets and audit exports.

Separate sandbox/staging/production accounts. Infrastructure as code, least-privilege roles, encrypted backups, tested restore, budget alarms and region-specific data policy are launch gates.

### Reliability targets

- 99.9% public API monthly availability at launch;
- no duplicate captures/transfers;
- provider timeout degrades to a saved/manual-review state;
- RPO ≤15 minutes and RTO ≤4 hours for initial commercial launch;
- alert on payment webhook lag, routing failures, claim abuse and elevated recommendation errors.

## 10. File structure

```text
src/
  recommendation.mjs       evidence-weighted ranking
  gift-taxonomy.mjs        canonical gift-preference labels
  preference-model.mjs     pinned XLM-R proposal-only provider contract
  provider-platform.mjs    provider manifests, registry, resolution and guarded execution
  provider-adapters.mjs    built-in compatibility adapters and composition root
  open-library.mjs         normalized Open Library catalogue enrichment adapter
  fulfillment-router.mjs   provider precedence policy
  amazon.mjs               marketplace search/handoff contracts
  paypal.mjs               Orders payload/capture guard
  gift-flow.mjs            claim and group state machines
  channel-policy.mjs       social/chat permission policy
  mcp-tools.mjs            controlled domain tool registry
  mcp-server.mjs           JSON-RPC/MCP lifecycle and tool dispatch
server.mjs                 static app + Streamable HTTP endpoint
test/                      domain, policy and protocol tests
docs/                      business, event and technical requirements
```

## 11. Verification plan

- Unit: ranking, routing matrix, money precision, state transitions, schema/error handling.
- Contract: Amazon/PayPal fixtures, webhook signature/replay behavior, OAuth claims.
- MCP: initialize/list/call, approval gates, authentication, malformed requests and timeout.
- End-to-end: Amazon handoff, PayPal sandbox alternate supplier, recipient claim, group gift.
- Security: authorization isolation, token/link enumeration, SSRF, injection, secret scanning.
- Accessibility: keyboard/screen reader/contrast; voice-only Alexa completion.
- Load: launch funnel plus event-driven Christmas spikes.

## 12. Build sequence

1. Production-grade MCP transport/auth and deployed HTTPS endpoint.
2. PayPal sandbox create/capture/webhook vertical slice.
3. Amazon Creators API adapter or deterministic provider fixture pending access.
4. Recipient claim storage and authentication.
5. End-to-end UI wired to real backend states.
6. Alexa+ simulator/add-on onboarding.
7. Observability, abuse controls and security review.
8. Three-minute dual-demo capture and submission-specific packaging.
