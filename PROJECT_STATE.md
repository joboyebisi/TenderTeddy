# WanderWrap project state

Last updated: 2026-10-23

Latest verification: `npm run check` passed on 2026-10-23 — Alexa MCP App build, Next.js production build, AWS handler syntax, and 86/86 automated tests. `npm run test:e2e` independently passed 3/3 HTTP golden-path tests.

This is the durable handoff for humans and coding agents. Read it first; update it after material work. It records what is proven, what is simulated, and the next safe step. It must never contain secrets.

## Product checkpoint

WanderWrap is an explainable, consent-first gifting companion whose first launch surfaces are Alexa+ and a Next.js web companion. Its core is channel-neutral and uses registered provider adapters so recommenders, preference models, catalogues, fulfilment, payments, and gift services can be swapped without changing channel code.

The primary hackathon story is: ask for a gift, receive evidence-backed recommendations, select one, verify a fulfilment route, and move to an explicit approval/handoff. WanderWrap does not silently purchase, capture money, expose a recipient address, or infer consent.

## Working now

- Alexa+-compatible MCP endpoint using Streamable HTTP and protocol `2025-11-25`.
- Device-free browser simulator at `/alexa-simulator.html`, including Amazon, PayPal fallback, and Xoom fixture branches.
- MCP Apps adaptive gift board for inline/fullscreen, screen, mobile, and voice-safe results.
- Explainable deterministic recommendation plus optional XLM-R preference and Bedrock explanation provider boundaries.
- Tenant-aware provider registry with deterministic selection, health controls, safe read fallback, and no ambiguous write failover.
- Bounded specialist-agent orchestration with least privilege, signed payload-bound approvals, idempotency, and audit events.
- Next.js App Router workspace in `apps/web` and a constrained backend-for-frontend proxy.
- Cognito/DynamoDB/Lambda/HTTP API CloudFormation deployment and a frozen AWS development preview.
- Automated domain, provider, orchestration, channel, MCP, AWS, and HTTP end-to-end tests.

## Proof commands

```powershell
npm install
npm run check
npm run test:e2e
npm run demo
```

Then open `http://127.0.0.1:4202/alexa-simulator.html`. `npm run test:e2e` starts an ephemeral authenticated server and proves health, static simulator delivery, OAuth protected-resource discovery, bearer-token enforcement, MCP initialization/tool discovery, recommendation, fulfilment routing, and write approval rejection.

## Live versus simulated

| Capability | Current truth |
|---|---|
| Recommendation and routing policy | Real local application code with deterministic fixtures |
| Alexa+ conversation | Local simulated experience; remote add-on onboarding and Web Simulator evidence pending |
| Amazon catalogue | Request/handoff adapter; live Creators API response pending credentials and conformance work |
| PayPal | Server-priced order proposal only; sandbox create/approve/capture/webhook loop pending |
| Xoom | Customer handoff only; no public transfer API claim |
| Bedrock | Adapter exists; production uses an IAM role; live model call depends on AWS model access/configuration |
| Social and calendar channels | Architecture/contracts only unless explicitly marked live in the integration checklist |

## Current blockers and external dependencies

1. The provided GitHub remote is `https://github.com/joboyebisi/TenderTeddy.git`; it was empty when inspected on 2026-10-23. The initial `main` push is the current repository checkpoint.
2. `.devpost-hackathon-state.json` is absent, so no specific event, deadline, rules, or submission record is attached to the repo yet.
3. Alexa+ remote onboarding, OAuth 2.1 authorization-code + PKCE, and Web Simulator evidence are incomplete.
4. Amazon Creators and PayPal sandbox credentials have not been supplied through a secure secret store.
5. The provider webhook/reconciliation loop and fulfilment/thank-you UI are not yet complete.

## Next actions, in order

1. Establish AWS access through IAM Identity Center/SSO or a narrowly scoped deployment role; do not paste a long-lived AWS secret into chat or `.env`.
2. Complete Alexa+ developer CLI onboarding and OAuth 2.1/PKCE account linking against public HTTPS.
3. Integrate Amazon Creators API and verify live search responses without presenting unverified price, delivery, or stock.
4. Complete the PayPal sandbox create/approve/capture/signed-webhook loop and replay/idempotency tests.
5. Record Alexa+ Web Simulator, provider sandbox, latency, accessibility, and failure-recovery evidence.
6. Initialize the specific Devpost hackathon workflow when the event is known, then map the evidence to its rules and submission fields.

## Source of truth documents

- Product: `docs/PRD.md`
- Technical design: `docs/TECHNICAL_SPEC.md`
- Delivery status: `docs/IMPLEMENTATION_STATUS.md`
- Omnichannel architecture: `docs/OMNICHANNEL_ARCHITECTURE.md`
- Alexa readiness and testing: `docs/ALEXA_PLUS_READINESS.md`, `docs/ALEXA_SIMULATOR_TESTING.md`
- Credential/live gates: `docs/LIVE_INTEGRATION_CHECKLIST.md`
- Provider extension contract: `docs/PROVIDER_ADAPTER_GUIDE.md`

## Decisions that must remain true

- Social data is opt-in, revocable, provenance-tagged, and converted into user-confirmable preference candidates; it is not used for covert personality diagnosis.
- Personality features are self-discovery first, separately consented, and never used to infer sensitive traits.
- Only registered, code-reviewed adapters may be selected by configuration; configuration does not dynamically import code.
- Read providers may fail over only where semantically safe. Payment, fulfilment, and other ambiguous writes never fail over automatically.
- Every external purchase, contribution, money transfer, recipient claim, or private-data action requires explicit human approval.
