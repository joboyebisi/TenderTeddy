# WanderWrap project state

Last updated: 2026-10-23

Latest verification: `npm run check` passed on 2026-10-23 — Alexa MCP App build, Next.js production build, AWS handler syntax, and 92/92 automated tests. `npm run test:e2e` independently passed 3/3 HTTP golden-path tests.

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
- Next.js PKCE login/callback/session routes, HttpOnly token storage, refresh/revocation handling, same-origin mutation checks, and an interactive person → confirmed clue → recommendation → saved-for-approval workspace.
- Cognito/DynamoDB/Lambda/HTTP API CloudFormation deployment and a frozen AWS development preview.
- Isolated `wanderwrap-development` AWS stack with Cognito managed login, OAuth code flow + PKCE, resource scopes, JWT signature/client/scope/audience validation, restrictive origins, retained encrypted DynamoDB data, log retention, and duration/error alarms.
- PayPal sandbox client boundary for OAuth, idempotent create/capture, and provider-verified webhooks; it remains disabled until sandbox credentials and trusted supplier pricing are configured.
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
| Alexa+ conversation | Local simulated experience plus a live development MCP endpoint; remote add-on onboarding, Alexa client redirect URI, linked-user test and Web Simulator evidence pending |
| Amazon catalogue | Request/handoff adapter; live Creators API response pending credentials and conformance work |
| PayPal | Server-priced proposal plus tested sandbox HTTP client boundary; credentialed create/approve/capture/webhook loop pending |
| Xoom | Customer handoff only; no public transfer API claim |
| Bedrock | Adapter exists; production uses an IAM role; live model call depends on AWS model access/configuration |
| Social and calendar channels | Architecture/contracts only unless explicitly marked live in the integration checklist |

## Current blockers and external dependencies

1. AWS access was restored with `aws login`, but it identifies as the account root. Replace this with IAM Identity Center/SSO or a narrowly scoped deployment role before production operations.
2. The Next.js web app has no public SSR host yet. The domain uses GoDaddy nameservers; `api.wanderwrap.co.uk` is not configured. Choose Vercel or another Next.js 16-compatible host, then set DNS and production OAuth callbacks.
3. The development Cognito flow is ready but needs a human-created/verified test account to prove the complete browser PKCE callback and authenticated web journey.
4. Alexa+ remote onboarding, the exact Alexa redirect URI, development add-on deployment, and Web Simulator evidence are incomplete.
5. Amazon Creators and PayPal sandbox credentials have not been supplied through a secure secret store.
6. The provider webhook/reconciliation loop and fulfilment/thank-you UI are not yet complete.
7. `.devpost-hackathon-state.json` is absent, so no specific event, deadline, rules, or submission record is attached to the repo yet.

## Next actions, in order

1. Replace root AWS access with IAM Identity Center/SSO or a narrowly scoped deployment identity; do not paste a long-lived AWS secret into chat or `.env`.
2. Choose and connect a public Next.js 16-compatible web host, configure production environment variables, and point the intended GoDaddy DNS hostname at it.
3. Complete one human browser sign-up/login against the development Cognito client and prove the authenticated person → evidence → recommendation → gift-save path.
4. Complete Alexa+ developer onboarding, add the exact redirect URI to the development stack, and verify resource-bound OAuth 2.1/PKCE account linking.
5. Integrate Amazon Creators API and verify live search responses without presenting unverified price, delivery, or stock.
6. Complete the PayPal sandbox create/approve/capture/signed-webhook loop and replay/idempotency tests.
7. Record Alexa+ Web Simulator, provider sandbox, latency, accessibility, and failure-recovery evidence.
8. Initialize the specific Devpost hackathon workflow when the event is known, then map the evidence to its rules and submission fields.

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
