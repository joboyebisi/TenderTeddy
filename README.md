# WanderWrap 1.0

**Frozen AWS development preview:** https://jobcy5qznb.execute-api.eu-west-2.amazonaws.com/studio.html

Alexa+ is the primary WanderWrap product. The companion web app is the authenticated handoff and management surface. Do not promote or redeploy the preview until the Alexa+ add-on, account linking, payments and companion journey pass the readiness gates in `docs/ALEXA_PLUS_READINESS.md`.

An explainable gifting companion for yourself and people you care about. The AWS deployment includes:

- verified-email account creation, login, recovery and refresh through Amazon Cognito;
- durable sender, recipient, evidence, gift, claim and audit records in encrypted DynamoDB;
- confirmed-evidence-only recommendations with live Open Library metadata for relevant book interests;
- marketplace-aware Amazon search handoffs that leave price, availability, delivery and purchase confirmation to Amazon;
- sender-approved, expiring recipient claim links with private delivery capture;
- a responsive authenticated dashboard and public recipient experience;
- CloudWatch logs, an error alarm, API throttling and DynamoDB point-in-time recovery;

- self and recipient gift discovery;
- weighted preference evidence inspired by GiftHub, without personality diagnosis;
- opt-in data-source controls;
- a hyperlocal discovery moment;
- user-approved Amazon search handoff;
- a shareable gift-link/referral flow;
- a legacy Alexa custom-skill interaction model retained for reference (the Alexa+ product uses MCP, not that intent model).
- confirmed social-interest evidence, claim-link and group-gift state machines;
- a pinned, self-hosted XLM-R preference-extraction contract whose proposals require subject confirmation before ranking;
- a tenant-aware provider platform that swaps registered ML, catalogue, fulfilment, payment and gift adapters behind stable agent capabilities;
- approval-gated MCP tools and a server-side PayPal Orders payload builder.
- an Alexa+-compatible MCP JSON-RPC endpoint at `POST /mcp` targeting protocol `2025-11-25`;
- a multimodal MCP App with a content-hashed `ui://` resource, adaptive inline/fullscreen display, touch-to-conversation actions and voice-only fallback;
- an Alexa+ add-on package and store media in `alexa/addon-package`;
- Amazon Bedrock Nova 2 Lite explanations through the Converse API, using the Lambda IAM role rather than a production API key;
- Amazon/PayPal/Xoom fulfilment routing with explicit human approval.

Run `npm install`, then `npm run demo` and open `http://127.0.0.1:4202/alexa-simulator.html`. Run `npm run test:e2e` for the authenticated HTTP golden path and `npm run check` to build the self-contained MCP App and execute the complete syntax and contract suite. The local server covers the static experience and MCP development harness; account and persistent API flows run in the frozen AWS development preview. Start each work session with `PROJECT_STATE.md`; the ordered live credential gates are in `docs/LIVE_INTEGRATION_CHECKLIST.md`.

The primary web application now lives in `apps/web` as a Next.js App Router workspace. Run `npm run web:dev` for the web surface; set `WANDERWRAP_CORE_API_URL` to the channel-neutral core API. The existing Vite app remains the Alexa+ MCP App rather than serving as the general website. See `docs/OMNICHANNEL_ARCHITECTURE.md` for channel, mobile and bot boundaries.

## AWS deployment

The `wanderwrap-production` CloudFormation stack in `eu-west-2` owns the application Lambda, HTTP API, Cognito user pool, DynamoDB table, least-privilege Lambda role and error alarm. Source infrastructure is in `infrastructure/template.yaml`; the Lambda entry point is `src/aws-handler.mjs`.

The data table and user pool use retain policies. Deployment artifacts are stored separately in `wanderwrap-artifacts-695912022574-eu-west-2`. All created resources use a `wanderwrap-` name or a `Project=WanderWrap` tag.

Provider boundaries are intentional: AWS does not supply Amazon Creators/Associates or PayPal merchant credentials. Until those are provided and approved, Amazon is a transparent search handoff, PayPal/Xoom remain routing decisions, and no UI claims a live product price, availability, transfer or purchase.

No Echo is required for the Alexa+ development loop. Open `http://127.0.0.1:4202/alexa-simulator.html` for the local MCP-backed simulated experience, then follow `docs/ALEXA_SIMULATOR_TESTING.md` for MCP Inspector, Amazon's Local Inspector, `alexa-ai test` and the Alexa+ Web Simulator.

The X campaign adapter is intentionally not live: current X rules require explicit user intent for replies and prior written approval for AI reply bots. No feed, computer, location, purchase, or booking access is taken without granular opt-in and a confirmation step.

The routing rule is intentionally simple: use a verified Amazon offer for a deliverable physical gift; use a PayPal-backed approved supplier when Amazon cannot fulfil; use PayPal/Xoom first for money gifts. Xoom is currently a handoff, not a claimed public transfer API.

Start with `docs/PRD.md`. The two event-specific slices are `docs/PRD_AMAZON_ALEXA_PLUS.md` and `docs/PRD_PAYPAL_AI.md`; the implementation contract is `docs/TECHNICAL_SPEC.md`.

For a local MCP smoke test, start the server and send JSON-RPC `initialize`, `tools/list`, or `tools/call` messages to `http://127.0.0.1:4202/mcp`. Requests use Streamable HTTP and must send `Content-Type: application/json` plus `Accept: application/json, text/event-stream`. Set `WANDERWRAP_MCP_TOKEN` to require a development bearer token.

MCP deployment settings:

- `WANDERWRAP_CANONICAL_URL`: public origin used to advertise the `/mcp` resource;
- `WANDERWRAP_AUTH_ISSUER`: OAuth authorization-server issuer advertised in protected-resource metadata;
- `WANDERWRAP_ALLOWED_ORIGINS`: comma-separated trusted browser origins;
- `WANDERWRAP_MCP_TOKEN`: local/static bearer token only; production still requires a real OAuth 2.1/PKCE authorization server and audience/scoped token validation;
- `HOST`: bind address, defaulting to loopback (`127.0.0.1`) for local safety.
