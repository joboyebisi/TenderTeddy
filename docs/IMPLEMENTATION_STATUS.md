# WanderWrap implementation status

This file turns the launch PRD and technical specification into a living delivery sequence. A checked item is implemented and covered by an automated contract test; provider credentials, external certification and human UX review remain separate launch gates.

## Foundation

- [x] Explainable, evidence-weighted recommendation domain
- [x] Consent-first social-content preference extraction with sensitive-trait blocking, provenance, freshness and subject confirmation
- [x] Versioned XLM-R gift-preference provider contract, pre-inference authorization and output schema validation
- [x] Proposal-only ML candidates blocked from ranking until subject confirmation
- [x] Open-model Big Five self-discovery contract with IPIP-style calibration and separately approved, capped gift-ranking signals
- [x] Bounded multi-agent orchestration with tenant isolation, signed payload-bound approvals, idempotency, retries, timeouts and audit events
- [x] Existing MCP domain tools wrapped as least-privilege proposal-only specialist agents
- [x] Plug-and-play provider registry for ML, ranking, catalogue, explanation, fulfilment, payment and gift capabilities
- [x] Deterministic tenant/market/currency/provider resolution with health and kill-switch controls
- [x] Safe read fallback and no-failover-on-ambiguous-write enforcement
- [x] MCP and AWS recommendation/routing paths migrated through provider adapters
- [x] Provider identity bound into signed agent approvals and execution provenance
- [x] Channel-neutral verified event envelopes, identity trust, policy dispatch and webhook deduplication
- [x] Next.js App Router web workspace with constrained core-API backend-for-frontend
- [x] Branded responsive landing page, honest channel-connection hub and verified-email customer sign-up entry point
- [x] Authenticated browser Alexa+ journey simulator calling the protected MCP initialize, discovery, recommendation and routing sequence
- [x] Deliverability-aware Amazon / PayPal / Xoom routing policy
- [x] Claim-link and group-gift state machines
- [x] Server-priced PayPal Orders payload and capture guard
- [x] Alexa-compatible MCP tools with explicit approval gates
- [x] Streamable HTTP media-type, origin, protocol and bearer-token boundary
- [x] OAuth protected-resource metadata discovery
- [x] Local device-free Alexa+ simulator and golden MCP demo test
- [x] Authenticated HTTP end-to-end golden path covering simulator delivery, OAuth resource discovery, recommendation, routing and approval rejection
- [x] MCP Apps resource discovery, lifecycle bundle, structured UI data and voice-safe summaries
- [x] Adaptive inline/fullscreen gift board with mobile/Echo layouts and touch-to-conversation actions
- [x] Alexa+ add-on manifest, required icon sizes, carousel artwork, privacy and terms pages
- [ ] OAuth 2.1 authorization-code + PKCE service and audience/scoped token validation (implemented and deployed in the isolated development stack; human browser and Alexa linking evidence pending)
- [x] Persistent user, recipient, evidence, gift, claim and audit repositories on DynamoDB

## First end-to-end launch journey

- [x] Account creation, verification and recovery through Amazon Cognito
- [x] Sender and recipient profile APIs
- [ ] Consent receipts and source revocation
- [x] Recommendation API backed by persistent confirmed evidence
- [x] Recipient claim link with private delivery capture
- [ ] PayPal sandbox create, approve, capture and signed webhook flow (OAuth/create/capture/webhook-verification client and idempotency contracts implemented; credentialed provider loop pending)
- [ ] Fulfilment and thank-you status UI
- [x] Audit events across recommendation, approval and provider routing

## Provider and channel completion

- [x] Live Open Library metadata plus honest Amazon marketplace search handoff (Creators API still requires separate credentials)
- [ ] Alexa+ remote onboarding and Amazon Web Simulator verification
- [ ] Occasion reminders and transactional notifications
- [ ] Group contribution ledger and organizer approval
- [ ] Business budgets, roles and bulk recipient import
- [ ] Approved alternate-supplier adapter

## Launch hardening

- [ ] Authorization isolation and claim-link abuse tests
- [ ] Idempotent PayPal capture and webhook replay tests
- [x] Accessibility baseline: 48px controls, contrast-aware palette, alt text, reduced motion and voice/touch parity
- [ ] Accessibility review on VoiceView, Screen Magnifier, colour correction and representative real devices
- [ ] Observability, alerting, backup/restore and incident ownership
- [ ] Durable provider health/circuit state, operation inbox/outbox and reconciliation workers
- [ ] Stripe, Goody and first non-Amazon regional gift API adapters with conformance fixtures
- [ ] Durable omnichannel event inbox/outbox and cross-channel journey continuation
- [ ] Expo mobile application and Telegram reference adapter
- [ ] Meta Messenger and X adapters after platform review and compliance testing
- [ ] Privacy/terms, data export/deletion and market-specific legal review
- [x] Public HTTPS AWS deployment and demo packaging
- [ ] Provider sandbox evidence (requires WanderWrap-specific Amazon/PayPal credentials)
- [ ] Licensed multilingual preference benchmark and adversarial red-team set
- [ ] XLM-R shadow/canary telemetry, signed artifact verification and rollback drill
- [ ] Privacy logging audit proving raw social text is absent from logs and traces

## Current checkpoint

Alexa+ is now the primary product direction; the original AWS preview remains frozen. An isolated `wanderwrap-development` stack hosts the hardened API/MCP boundary and Cognito PKCE foundation without replacing production resources. The Next.js companion now includes the public landing page, connections hub, explicit sign-up path, authenticated gift workspace and protected MCP browser simulator. The `wanderwrap-deployment-iam` stack provides a main-branch GitHub OIDC deployment role plus a separate CloudFormation execution role. Public Vercel hosting, production domain/DNS, one human verified browser journey, Alexa account linking and provider credentials remain external gates.
