# WanderWrap omnichannel architecture

## Decision

WanderWrap is one gifting platform with multiple channel adapters, not separate Alexa, web and bot products. The domain model, journey state, consent, agents, provider selection and audit history live in a channel-neutral core. Every channel verifies its native request, maps it into the same versioned envelope and renders the same application result for its own capabilities.

The existing Alexa `.mjs` implementation remains a valid adapter. The web experience moves to the Next.js App Router in `apps/web`; mobile should use Expo/React Native; messaging integrations are thin webhook gateways.

## Runtime flow

```text
Alexa MCP   Next.js web   Expo mobile   X   Messenger   Telegram
    \           |             |         |       |          /
                Channel edge adapters
       signature/auth verification + fast acknowledgement
                           |
                  Durable event inbox
                           |
             Identity link + consent/policy PDP
                           |
          Journey command bus / durable orchestrator
                           |
      bounded agents -> application services -> provider platform
                           |
             state store + audit + transactional outbox
                           |
              channel-specific response renderer
```

No channel adapter calls an ML, payment, fulfilment or gift API directly. No agent owns channel credentials. Providers do not know whether a command came from Alexa, web or Telegram.

## Channel contract

`src/channel-platform.mjs` defines `wanderwrap.channel.inbound.v1`. Each event includes:

- channel and provider event ID;
- tenant and correlation IDs;
- external actor, optional linked internal user and trust level;
- conversation identity and reply reference;
- typed interaction and normalized payload;
- granted scopes and consent receipt reference;
- locale, received time and source digest.

The adapter verifies the native signature before normalization. An unverified social actor receives public help or an account-link prompt, never private profiles, recommendations or transaction state. A channel session is not a WanderWrap journey: durable `journeyId`, `giftId` and `recipientId` values allow a user to continue on another surface.

## Channel roles

| Surface | Technology | Role | Important boundary |
| --- | --- | --- | --- |
| Web | Next.js App Router | Full authenticated dashboard, consent, approvals, claims and support | Backend-for-frontend only; domain mutations go to the core API |
| Mobile | Expo/React Native with Expo Router | Native notifications, contacts permission, camera/share sheet and deep links | OAuth code exchange and secrets stay server-side; tokens use secure device storage |
| Alexa+ | Remote Streamable HTTP MCP + MCP App | Voice-first discovery and multimodal approval | OAuth 2.1/PKCE; stable tool schemas; no channel-local journey state |
| Telegram | Signed webhook adapter | Direct and group-gift conversation | Verify webhook secret, deduplicate `update_id`, respect bot privacy mode |
| Facebook/Messenger | Meta webhook adapter | Opt-in direct messaging and recipient invitation | App review, signature verification and subject consent; Facebook login is not friend-feed permission |
| X | Approved webhook/mention adapter | Explicit mention/DM gift discovery and campaign entry | Explicit user intent, rate/policy limits and account linking before personal data |

## Next.js implementation

`apps/web` is a standalone Next.js workspace using the App Router, Server Components and Route Handlers. It owns presentation concerns:

- marketing, onboarding and authenticated dashboard layouts;
- secure session cookies and CSRF/origin controls;
- a constrained `/api/core/[...path]` backend-for-frontend route;
- streaming/loading/error UI, accessibility and responsive rendering;
- deep links for gifts, recipient claims, thank-you notes and channel linking.

It does not import PayPal, Amazon, social or recommender SDKs. It cannot advance an order by writing directly to a database. The BFF forwards an allowlisted set of core routes, propagates authenticated identity server-side, applies `no-store` to private operations and never exposes core/provider secrets through `NEXT_PUBLIC_*` variables.

The current Vite MCP App stays under `alexa/`; it is embedded by Alexa and has different lifecycle and bundle constraints from the main website. Shared UI tokens and schemas can move into packages later, but the two deployables should not be collapsed into one runtime.

## Mobile implementation

Create `apps/mobile` with Expo Router after the web identity and command contracts stabilize. Share generated API types, validation schemas, design tokens and analytics event names—not server implementations. Universal links should open the same `giftId` or `journeyId` in web or mobile. Contacts, notifications, location and share-sheet access are separate just-in-time grants recorded in consent receipts.

## Durable processing

Webhook endpoints should verify, persist and acknowledge quickly. Workers process the durable inbox using `(tenantId, channel, eventId)` idempotency. Commands carry expected state versions; mutations use optimistic concurrency. Application changes and outbound messages are committed through a transactional outbox. Delivery workers retry safe sends, apply channel rate limits and store provider message IDs. Poison messages enter a dead-letter queue with redacted diagnostics.

Payment and fulfilment use the stricter provider rules already implemented: once dispatched, an ambiguous timeout is `outcome_unknown`, never an automatic failover. A reconciliation worker queries the pinned provider before the workflow can continue.

## Identity and consent

- Web/mobile users authenticate with the central OAuth/OIDC service.
- Alexa links through OAuth 2.1 authorization code with PKCE and resource-bound tokens.
- Bots begin as `unverified`; a short-lived, single-use web deep link binds the external identity after authentication.
- Group membership never grants access to a participant's private WanderWrap profile.
- Consent is purpose-, subject-, source- and channel-specific, revocable and versioned.
- Channel credentials, provider tokens and social access tokens remain in the secret manager and encrypted token vault.

## Suggested deployment units

1. `web`: Next.js frontend and BFF.
2. `channel-gateway`: Alexa MCP plus Telegram/Meta/X webhook ingress.
3. `core-api`: profiles, recipients, evidence, journeys and approvals.
4. `workflow-workers`: reminders, group gifts, fulfilment and reconciliation.
5. `model-service`: isolated XLM-R/personality inference.
6. `provider-workers`: catalogue, payment and fulfilment adapters.

Start as a modular deployment where practical, but preserve these ownership boundaries in code. Use Aurora/PostgreSQL for transactional relationships and workflow state, DynamoDB or equivalent for webhook/idempotency inboxes, EventBridge/SQS for commands/events, S3 for authorized exports/assets and an append-only audit store. Production orchestration state must not remain solely in process memory.

## Delivery sequence

1. **Implemented:** channel-neutral envelopes, adapter registry, verification hooks, policy-before-dispatch and deduplication tests.
2. **Implemented:** Next.js App Router workspace, production build, health endpoint and allowlisted BFF proxy.
3. Central OAuth 2.1/OIDC session service, identity linking and durable consent receipts.
4. Move the current Lambda domain routes behind a versioned core API and durable workflow store.
5. Telegram adapter as the first bot reference implementation, including group-gift policy tests.
6. Expo mobile application sharing generated contracts and deep links.
7. Meta and X adapters only after app review, permissions and platform-specific compliance tests.
8. Durable event inbox/outbox, reconciliation, observability, SLOs and disaster-recovery exercises.

## Non-negotiable release tests

- The same journey can begin on one channel and continue on another without duplicate actions.
- Replayed webhooks do not repeat recommendations, messages, orders or captures.
- Spoofed signatures and cross-tenant identity links fail before agent execution.
- Channel rendering cannot add claims absent from the application result.
- Revoked consent stops queued downstream work.
- Provider or channel failure preserves recoverable journey state.
- Accessibility and equivalent approval semantics hold across voice, touch and text.
