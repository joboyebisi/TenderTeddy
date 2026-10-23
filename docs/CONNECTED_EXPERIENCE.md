# WanderWrap connected experience

## Product promise

One relationship-aware gifting plan from “I should remember them” to delivery and thanks. Personal gifting, self-gifting and enterprise campaigns use the same people, evidence, recommendation, approval and fulfilment primitives.

## Personal and Christmas journey

1. **Account and market:** email/passkey login; home market, currency, budget and accessibility preferences.
2. **Permission centre:** connect one source at a time. Each connection shows what is read, why, retention and revoke controls.
3. **Occasion discovery:** read-only calendar events and birthday event types become suggestions, never silently created recipient records. The user confirms the person match.
4. **Relationship page:** the giver adds explicit knowledge. Imported clues retain source, time, confidence and deletion controls.
5. **Personal agent:** the giver creates a named, expiring agent and sends a private invite. A recipient must accept before it asks questions. Only confirmed preferences are stored; it cannot covertly monitor a group chat.
6. **Shortlist:** ideas are ranked by confirmed interests, occasion, budget, geography, delivery date, novelty and negative preferences. Every item explains why it matched.
7. **Approval:** the giver approves item, recipient, address path, price, merchant and payment route. There is no autonomous purchase.
8. **Fulfilment:** Amazon catalogue/deep-link handoff when suitable; PayPal merchant checkout or value-gift route where it is a better fit; Xoom is a consumer handoff for cross-border money until partner access is approved; supplier adapters cover other markets.
9. **Claim and thanks:** a privacy-preserving gift link can collect address/variant or allow exchange. Delivery events trigger a thank-you prompt and optional invitation loop.

## Self-gifting journey

The user connects only their own permitted sources. X bookmarks can be read with user OAuth. Instagram/Facebook saved collections are not assumed to be available through public APIs; the launch path is a share-to-WanderWrap link, browser extension/mobile share sheet, or manual collection import. Travel and book ideas become a private “maybe someday” shelf. Location reminders use coarse, time-limited location and never book automatically.

## Enterprise journey

Campaign owner imports recipients, region and policy; recipients privately confirm preferences/address; the catalogue filters by budget, dietary/accessibility rules and delivery feasibility; finance approves the batch; each order is routed by market; delivery exceptions share one operational queue; recipients can thank the team or donate/exchange where supported. Slack/Teams are invitation and status surfaces, not unrestricted chat-reading channels.

## Shared domain model

`Person → Occasion → ConsentReceipt → Evidence → Preference → Recommendation → Approval → Fulfilment → Delivery → Thanks`

The domain model prevents the web, Alexa, MCP, mobile and enterprise experiences from becoming separate products. Each surface resumes the same server-side journey.

## UX principles

- Calm Christmas planning instead of urgency loops.
- Evidence before inference; confirmation before persistence.
- Progressive disclosure for permissions and payment.
- One primary action per screen.
- A recommendation always explains source, confidence and trade-off.
- Restricted integrations display an honest fallback, not a fake “connected” state.

