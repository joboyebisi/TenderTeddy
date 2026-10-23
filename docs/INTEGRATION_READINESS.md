# WanderWrap integration readiness

| Capability | Launch state | Production requirement | Safe fallback |
|---|---|---|---|
| Google Calendar birthdays/events | Adapter and consent UX specified | OAuth consent screen, narrow read-only scope, verification as required | Manual occasion entry / ICS import |
| X bookmarks | Adapter contract specified | Approved developer project, OAuth 2.0 PKCE, current access tier | Share post link to WanderWrap |
| Instagram/Facebook saves | Not represented as a public API connection | Reassess only against approved Meta product and permissions | Mobile share sheet, pasted link, manual collection |
| Amazon products | Marketplace-aware catalogue/handoff module | Creators API credentials and compliance review | Merchant/supplier search |
| Travel | Partner adapter | Current enterprise/provider agreement; live price confirmation | Deep link to an approved booking partner |
| PayPal | Intent and approval flow specified | Sandbox then production app; webhook verification | Merchant link/manual review |
| Xoom | Consumer handoff only | Written partner/product approval for deeper integration | Open Xoom with user confirmation |
| Slack/Teams/social chat | Invite/status adapter | App review, minimal scopes, workspace/admin consent | Private WanderWrap web invite |
| Goody/other gifting API | Provider slot | Commercial/API agreement and destination coverage | Amazon/PayPal/manual route |

## Credential boundary

Secrets stay server-side. OAuth tokens are encrypted, provider-scoped, revocable and never sent to the browser or MCP client. Webhooks require signature verification and idempotency keys. The current UI demonstrates connection states; it does not claim to perform live OAuth without credentials.

## Recommendation evidence

Each clue stores `subject`, `source`, `scope`, `capturedAt`, `consentReceiptId`, `confidence`, `expiresAt` and `userDecision`. Personality diagnosis from social feeds is explicitly excluded. Ranking uses confirmed interests and constraints, with diversity and “not interested” feedback.

