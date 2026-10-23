# Alexa+ simulator-first testing and demo plan

WanderWrap does not require the developer to own an Echo. The Amazon hackathon permits an Alexa+ simulated experience in a web app, and Amazon provides hosted and local simulator tooling for an MCP add-on.

## Test ladder

### 1. Automated domain and MCP contracts

Run `npm test`. The suite verifies protocol initialization, tool discovery, recommendation, routing, approval boundaries, authentication, origins and HTTP media types. `test/alexa-demo.test.mjs` is the in-process golden journey.

Run `npm run test:e2e` for the actual HTTP-boundary journey. It starts an ephemeral authenticated server and verifies health, simulator delivery, OAuth protected-resource metadata, bearer auth, origin rejection, discovery, recommendation, routing and write-approval rejection. It uses no external credentials and leaves no server running.

### 2. WanderWrap local Alexa+ simulator

Run `npm run demo`, then open `http://127.0.0.1:4202/alexa-simulator.html`.

The page calls the real local `/mcp` endpoint and exposes the JSON-RPC trace. It provides three repeatable branches:

1. deliverable Amazon Canada physical gift;
2. Amazon-unavailable PayPal supplier fallback;
3. cross-border Xoom money-gift handoff.

Catalogue/provider availability in this page is labelled as a fixture. Recommendation and routing results come from the application code. The simulator must never be presented as live Alexa orchestration or live provider availability.

### 3. MCP Inspector and Alexa+ Local Inspector

Use the standard MCP Inspector to list and call tools with valid, invalid and repeated inputs. WanderWrap now returns a content-hashed MCP Apps `ui://` resource, so use the Alexa+ Local Inspector in both data-layer and visual modes. Verify inline and fullscreen rendering across mobile, Echo Show 8, Echo Show 15, light/dark themes, and the voice-only fallback.

Keep the generated interaction traces, latency output and readiness verdict as submission evidence.

### 4. Hosted development add-on

Deploy the MCP endpoint behind public HTTPS with OAuth 2.1/PKCE and deploy the add-on manifest to Alexa+'s development stage. After the Alexa AI CLI scaffolds its test suite, keep that suite in `test-suites/` and run it through:

```text
alexa-ai test --stage development --test-suite test-suites/mcp-tests.json
```

The command requires Amazon developer access and a deployed add-on; it is not part of the ordinary local test command.

### 5. Alexa+ Web Simulator

Use the Alexa developer console's Web Simulator, which does not require a physical device:

- **Isolation mode:** verify WanderWrap's multi-turn conversation and error recovery without other add-ons competing for the request.
- **Global mode:** verify Alexa+ selects WanderWrap from natural customer intent.
- **Development stage:** use the currently deployed development build.
- Inspect response details and device logs, and capture the final demo from the simulator.

Test complete, partial, corrected, out-of-scope and provider-failure utterances. The primary journey must remain completable on a voice-only surface and by touch alone on screened devices.

## Three-minute hackathon demo

1. **0:00–0:20 — Problem and promise:** thoughtful cross-border gifting without knowing every detail.
2. **0:20–1:20 — Alexa+ simulator:** natural request, MCP tool discovery/call, explainable recommendation and Amazon Canada route.
3. **1:20–1:50 — Fallback:** Amazon unavailable, so the same request routes to a PayPal-approved supplier.
4. **1:50–2:20 — Trust boundary:** show that MCP prepares but does not purchase; approval moves to WanderWrap.
5. **2:20–2:45 — Technical proof:** protocol version, Streamable HTTP endpoint, tests and trace.
6. **2:45–3:00 — Impact and feedback:** one channel-neutral gifting platform, plus concise Amazon tooling feedback.

## Hardware boundary

An Echo is not required for local development or the hackathon's simulated-experience path. Before a public production launch or certification, arrange representative real-device testing if Amazon's current certification requirements call for it; that can be a borrowed device, a remote tester or a later hardware QA session rather than a development prerequisite.
