# WanderWrap hackathon end-to-end checklist

This checklist is repository-native because a specific Devpost event has not yet been initialized. Attach its evidence to the event-specific submission checklist once the event URL and rules are known.

## Demo-critical path

- [x] Build the Alexa+ MCP App as a single distributable UI.
  Verify: `npm run build:alexa` succeeds.
- [x] Build the Next.js companion app in production mode.
  Verify: `npm run web:build` succeeds and lists `/`, `/dashboard`, `/api/health`, and `/api/core/[...path]`.
- [x] Serve the device-free simulator and health endpoint.
  Verify: `npm run demo`, then open `/alexa-simulator.html` and `/health`.
- [x] Prove the real authenticated HTTP boundary.
  Verify: `npm run test:e2e` passes bearer auth, origin controls, MCP discovery, recommendation, routing, and approval rejection.
- [x] Prove the complete local contract suite.
  Verify: `npm run check` passes; latest checkpoint is recorded in `PROJECT_STATE.md`.
- [ ] Connect the public HTTPS MCP endpoint to an Alexa+ development add-on.
  Verify: Alexa AI CLI introspection and development deployment succeed.
- [ ] Complete OAuth 2.1 authorization-code + PKCE account linking.
  Verify: link, token refresh, revocation, wrong audience, wrong scope, and expired-token cases.
- [ ] Record the primary journey in Alexa+ Web Simulator isolation mode.
  Verify: natural request → recommendation → explanation → route → approval handoff.
- [ ] Record Alexa+ global-mode discovery.
  Verify: Alexa+ selects WanderWrap from a natural gifting request without an explicit app invocation.

## Live provider gates

- [ ] Enable one live Bedrock explanation provider.
  Verify: model-backed explanation is labelled, deterministic facts stay unchanged, timeout falls back safely, private source text is absent from logs.
- [ ] Enable Amazon Creators search in sandbox/development.
  Verify: real provider response, correct recipient marketplace and Partner Tag, rate-limit behaviour, no unsupported delivery/stock claim.
- [ ] Complete PayPal sandbox order lifecycle.
  Verify: server price → create → approve → capture → signed webhook → fulfilment update, including duplicate and forged-webhook cases.
- [ ] Complete claim/thank-you loop.
  Verify: expiring claim, private address capture, sender status, recipient thank-you, optional signup, revocation, and deletion.

## Failure and trust rehearsal

- [ ] Rehearse Bedrock unavailable.
  Expected: deterministic explanation; gifting journey continues.
- [ ] Rehearse Amazon unavailable or cannot deliver.
  Expected: approved supplier/PayPal route or honest manual review; no invented offer.
- [ ] Rehearse PayPal timeout after an ambiguous write.
  Expected: no automatic failover or duplicate order; reconcile before retry.
- [ ] Rehearse expired recipient link and replayed webhook.
  Expected: fail closed with recoverable guidance and an audit event.
- [ ] Rehearse missing social/calendar permissions.
  Expected: manual occasion and user-confirmed preference path remains complete.
- [ ] Rehearse voice-only and touch-only completion.
  Expected: equivalent information and explicit approval on each surface.

## Submission evidence pack

- [ ] Save clean output from `npm run check` and `npm run test:e2e`.
- [ ] Capture simulator screenshots for Echo Show 8, Echo Show 15, mobile, and voice-only modes.
- [ ] Capture one successful live-provider trace with secrets and personal data redacted.
- [ ] Capture one safe fallback/failure trace.
- [ ] Record a three-minute demo using the timing in `ALEXA_SIMULATOR_TESTING.md`.
- [ ] Document architecture, consent, approval, provider provenance, and what remains simulated.
- [ ] Validate the final submission against the exact event rules, judging criteria, required media, and deadline.

## Stop-ship conditions

Do not call the pilot live or submit claims of live commerce if any of these are true:

- secrets appear in Git, logs, browser bundles, screenshots, or demo traces;
- OAuth tokens are not audience/scope/expiry validated;
- a payment or fulfilment write can be duplicated or automatically failed over after an ambiguous response;
- webhook signatures or replay keys are not verified;
- fixture price, availability, delivery, Alexa behaviour, or social access is presented as provider-confirmed;
- a social/personality signal reaches ranking without the subject's explicit confirmation and provenance;
- the demo cannot recover when Bedrock or a commerce provider is unavailable.
