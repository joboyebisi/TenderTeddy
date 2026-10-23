# WanderWrap product requirements document

**Status:** Product definition 1.0  
**Date:** 22 October 2026  
**Launch wedge:** Christmas 2026, United Kingdom first  
**Next markets:** United States and Canada  
**Primary surfaces:** Alexa+ and responsive web  
**Product promise:** Connect the sources you trust, tell us who matters, and WanderWrap will help you show up thoughtfully and on time.

## 1. Executive summary

WanderWrap is a relationship and occasion intelligence platform. It helps people remember meaningful moments, understand what a recipient may genuinely appreciate, select a deliverable gift, coordinate with other contributors, complete a purchase through a trusted provider, follow fulfilment where the provider permits it, and close the emotional loop with a private claim and thank-you experience.

The initial product is a Christmas-first gifting companion on Alexa+ and web. It uses a consented people graph, calendar intelligence, explainable recommendations and provider-aware fulfilment routing. The long-term platform supports birthdays, Easter, Thanksgiving, personal wish lists, group and business gifting, experiences, food and travel inspiration, and local-market gifting rails.

WanderWrap is not a social surveillance product. Signing in with Facebook or X does not imply access to friends, birthdays, feeds or bookmarks. Authentication, source connection, recipient permission, messaging authority and transaction approval are separate grants. When a provider does not expose a capability, WanderWrap uses an honest fallback: calendar/contact import, manual entry, a shared link, recipient questions or a provider handoff.

## 2. Vision and positioning

### 2.1 Customer problem

People care about birthdays and holidays but forget dates, run out of time, lack confidence in what to buy, do not know the recipient's address, struggle with international delivery and lose track of group contributions. Existing gift guides are generic; retailer search starts with products instead of relationships; social platforms contain useful clues but do not safely expose a complete relationship graph to third-party apps.

### 2.2 Product thesis

WanderWrap wins by joining five systems that are usually separate:

1. A user-controlled relationship and occasion memory.
2. An evidence-based, explainable recommendation engine.
3. A deliverability-aware multi-provider router.
4. A private recipient claim and response experience.
5. A channel-neutral agent available on Alexa+, web and approved group-chat surfaces.

### 2.3 Marketing position

**Category:** Relationship and gifting intelligence.  
**Christmas message:** “Everyone who matters, every gift handled, without the panic.”  
**Trust message:** “Thoughtful, not creepy. You control every source and every purchase.”  
**Growth loop:** Every completed gift creates a useful recipient moment—claim, choice, delivery and thanks—followed by an optional invitation to create their own gifting circle.

### 2.4 North-star metric

**Successful appreciated gift moments per active giver per quarter.**

A moment counts only when an intent or occasion is identified, the user selects a recommendation, fulfilment is confirmed where measurable, and the recipient produces a positive signal such as acceptance, thanks, keep/exchange feedback or a rating.

## 3. Product principles

1. **Consent before inference.** Every data source and purpose is separately granted, visible and revocable.
2. **Evidence before confidence.** Explicit preferences and recipient answers outrank observed or inferred signals.
3. **Explain, do not expose.** Explain with safe themes without quoting private content to another person.
4. **Human approval at consequential boundaries.** No purchase, transfer, group message, recipient invitation or address disclosure occurs without authorization.
5. **Never fabricate access or provider state.** Connected, unavailable, stale, revoked and inferred states are distinct.
6. **Deliverability before novelty.** An idea that cannot reach the recipient by the required date is not a valid recommendation.
7. **Recipient dignity.** The recipient may accept, decline, exchange, donate, keep their address private and delete their data.
8. **Graceful degradation.** Every connector-dependent journey has a manual or recipient-mediated fallback.
9. **No dark-pattern virality.** Receiving a gift and sending thanks never require registration; referral consent is separate.
10. **Regional rails, one experience.** Providers vary by market while the customer journey remains coherent.

## 4. Users and jobs

### 4.1 Thoughtful but busy giver

“When someone important has a birthday or holiday approaching, help me remember, choose confidently and act in a few minutes.”

### 4.2 Private recipient

“Let me receive a suitable gift without exposing my home address and give me a graceful way to decline or exchange it.”

### 4.3 Group organizer and contributor

“Coordinate ideas, decisions, contributions, purchase and refunds without chasing everyone or exposing private payment information.”

### 4.4 Anonymous giver

“Let me create a safe surprise while keeping my identity hidden from the recipient, within clear abuse and legal limits.”

### 4.5 Self-discovery user

“Use links and collections I deliberately save to help me remember things I may want to buy, eat or visit.”

### 4.6 Business administrator

“Run governed gifting programs with budgets, roles, approvals, audit records and market-specific fulfilment.”

### 4.7 Trust and operations administrator

“Understand every consent, recommendation, payment and fulfilment decision and resolve ambiguous or unsafe cases.”

## 5. Capability reality and provider strategy

### 5.1 Social and calendar sources

| Source | Supported product use | Important boundary | Fallback |
|---|---|---|---|
| Facebook Login | Optional authentication | Login does not grant friend, birthday or feed access | Email/passkey or Login with Amazon |
| Facebook data | Authenticated user's approved fields only | `user_friends` is limited to friends who also use the app; no broad friend birthday/feed sync | Google/Microsoft contacts, manual entry, recipient invite |
| X OAuth | Optional account connection | Separate scopes and commercial API access | Standard WanderWrap account |
| X bookmarks | Self-discovery for the authenticated user | Cannot read another person's private bookmarks | Save/share links to WanderWrap |
| X public content | User-requested, capability- and cost-gated signal | No X birthday field; protected/private data is unavailable without authorization | Recipient questionnaire or selected public links |
| Google Contacts/Calendar | Primary birthday import and reminder sync | Only data present in the user's account; scopes and provenance required | Manual/CSV/ICS import |
| Microsoft Contacts/Outlook | First-class alternative birthday/calendar source | Tenant or admin consent may restrict access | Manual/CSV/ICS import |
| Slack | Explicit group-gift commands and interactions | No ambient workspace surveillance; app sees only scoped, authorized events | Shareable web group link |
| Telegram | Commands, mentions and Mini App journey | Privacy mode and group permissions control visibility | Shareable web group link |

The live product must maintain a connector capability registry covering identity, profile, contacts, birthdays, owned content, bookmarks, incremental sync, webhooks, posting, retention, review status and cost. UI claims must be generated from this registry.

### 5.2 Commerce and gifting providers

| Provider | Role | Product boundary |
|---|---|---|
| Amazon Creators API | Marketplace product discovery and attributed handoff | Catalogue data, not access to a consumer's retail-order lifecycle |
| Alexa Shopping Actions | Alexa-owned cart/buy action where available | Alexa owns eligibility, address, payment and PIN confirmation |
| Goody | Preferred first addressless physical-gift rail | Production/commercial onboarding required; provider status is authoritative |
| Tremendous | Digital reward and value-gift rail | Use-case and market approval required |
| Giftbit | Not planned for consumer/group gifting | Published restrictions exclude peer/crowd gifting unless written approval changes the boundary |
| Snappy | Candidate enterprise gifting rail | Sales-led and enterprise-oriented |
| Runa | Candidate regional digital-value rail | KYB and commercial onboarding required |
| PayPal Orders | Alternate merchant checkout and contributor payments | Server-side order/capture, verified webhooks and approved platform use |
| Stripe Checkout/Connect | Group contributions and marketplace payments | Does not by itself authorize WanderWrap to operate a pooled wallet |

WanderWrap says **“handed off to Amazon”**, not “ordered” or “tracked,” unless it receives an authorized provider event. End-to-end delivery claims are reserved for orders created through a provider contract WanderWrap controls.

## 6. Core journeys

### 6.1 First-run and connection journey

1. User creates an account with email/passkey, Login with Amazon or another supported identity provider.
2. WanderWrap asks for home market, currency, time zone, accessibility needs and notification preference.
3. The product explains that login and data connections are independent.
4. User may continue with no connector or add Google, Microsoft, Facebook or X individually.
5. Before each connection, WanderWrap shows the exact data requested, purpose, retention, sync frequency and revoke control.
6. The People Hub presents imported candidates and asks the user to confirm identity, relationship and birthday before activating reminders.
7. User selects reminder timing and whether to create private calendar events.

**Acceptance criteria**

- No optional connector is preselected.
- Denying or revoking one capability does not break unrelated journeys.
- “Synced” is displayed only after a successful sync and always includes a timestamp.
- Authentication never silently activates social analysis.
- Duplicate people are proposed, never automatically merged solely by name.
- Revocation stops future processing immediately and queues deletion or re-derivation of dependent features.

### 6.2 Birthday-to-gift journey

1. Occasion Agent finds a confirmed birthday or the user creates it manually.
2. Reminder lead time accounts for destination, provider cutoff and gift type.
3. User receives: “Maya's birthday is in eight days. Want ideas?”
4. Web or Alexa+ confirms recipient, occasion, budget, destination, arrival date and exclusions.
5. Recommendation Agent returns at most four diverse, eligible options.
6. Each card shows why it fits, which evidence categories were used, price freshness, provider, delivery confidence and uncertainty.
7. User can compare, refine, dismiss, save, correct evidence or select.
8. Merchant Router selects Amazon, Goody, approved local merchant, digital reward or manual review.
9. User approves the provider handoff on a trusted surface.
10. Fulfilment Agent follows authorized provider events or clearly asks for optional tracking import.
11. After verified delivery or recipient acknowledgement, WanderWrap prompts for thanks.

**Acceptance criteria**

- Hard constraints are not knowingly violated.
- Weak observed signals never override explicit dislikes or restrictions.
- No purchase is inferred from a link click.
- Price, stock and delivery statements show provider and observation time.
- Unsupported fulfilment status is shown as unavailable, never guessed.
- The journey resumes across Alexa+ and web without repeating confirmed answers.

### 6.3 Christmas planner

1. User opens “Christmas with WanderWrap.”
2. WanderWrap proposes a gifting circle from confirmed relationships and previous choices; the user approves every member.
3. Planner shows budget, relationship, country, deadline, gift state and last gift.
4. User can mark “not gifting,” combine households, set per-person budgets and create group gifts.
5. International and handmade gifts receive earlier target dates.
6. The planner avoids duplicate gifts and prioritizes incomplete, time-sensitive recipients.
7. A calm weekly digest summarizes decisions needed without urgency manipulation.

The same planner template supports Easter, Thanksgiving, birthdays and custom cultural occasions. Participation is never inferred from religion, ethnicity, name or location.

### 6.4 Self-discovery for gifts, travel and food

1. User deliberately saves a link, post, product, restaurant or destination, or connects an approved self-data source.
2. Signal Agent extracts candidate themes and shows them for confirmation.
3. The user may organize items into “gift me,” food, travel or private inspiration collections.
4. When asked “Where should I travel?” or “What should I eat?”, WanderWrap uses confirmed themes plus current location, budget, opening/safety facts and explicit constraints.
5. The user can remove an item, category or entire source and re-run the recommendation.

Continuous monitoring is optional, source-specific, visible in an activity log and never a launch dependency. Self-discovery data is not reused to profile someone else or for advertising without a separate grant.

### 6.5 Recipient claim, thanks and referral loop

1. Giver creates a sender-approved, single-purpose claim.
2. Recipient opens the expiring link without registration.
3. Recipient sees the giver identity unless the approved anonymous mode applies, the gift purpose and the data requested.
4. Recipient may accept, decline, redirect, donate or exchange where supported.
5. Address and variant details go directly to the authorized fulfilment path and remain hidden from the giver by default.
6. Recipient may send text, audio, photo or Alexa-mediated thanks.
7. Only after the task is complete does WanderWrap offer optional signup and calendar import.

**Acceptance criteria**

- Claims are opaque, rate-limited, revocable and bound to one gift.
- Recipient does not need an account to receive or thank.
- Decline reasons remain private unless the recipient chooses to share them.
- Referral and marketing consent are separate from claim and thank-you actions.
- Suspicious claim attempts trigger verification or manual review.

### 6.6 Anonymous and surprise gifting

“Anonymous” means hidden from the recipient, not hidden from WanderWrap, the merchant, payment provider or lawful process.

- The recipient may reject anonymous gifts or require identity disclosure.
- The giver may schedule identity reveal after delivery.
- WanderWrap can ask for preferences or an address without revealing the giver.
- Cash-like products, minors, repeated unwanted contact and high-risk goods receive stricter checks.
- The recipient can block the invitation, giver and future contact.
- No forwarding address or recipient contact detail is exposed.

### 6.7 Group gifting in Slack, Telegram and web

1. Authorized organizer creates a gift from a command, mention, shortcut, Mini App or web link.
2. Organizer sets recipient, goal, currency, deadline, visibility, refund rule and decision method.
3. Members privately suggest, vote or contribute.
4. Each contribution has its own PSP authorization/payment record; WanderWrap maintains a ledger but does not claim escrow.
5. Group Gift Agent handles target reached, deadline reached, insufficient funds, excess funds, organizer departure and cancellation.
6. An identified organizer approves final selection and purchase.
7. Members receive receipts and refund/chargeback status without seeing others' financial details.

**Acceptance criteria**

- Bots use authorized channels and explicit interactions; unrelated history is not ingested by default.
- Slack requests and provider webhooks are signature verified.
- Sensitive responses are private or ephemeral.
- Duplicate capture or purchase is impossible under retry.
- Multiple currency, partial failure, overfunding and organizer loss have explicit states.
- Pooled-fund functionality cannot launch without payments and legal approval.

### 6.8 My Gift DNA — self-discovery and acquisition

1. A new user chooses “Discover my gifting style” before connecting any friends.
2. WanderWrap explains that the experience estimates Big Five tendencies from the user's own writing and optionally calibrates them with a short IPIP-style questionnaire.
3. The user may paste or upload their own writing, connect an approved self-data source, or use the questionnaire alone. Source permissions and retention are shown before analysis.
4. A self-hosted open-weight model returns five continuous estimates with confidence, sample sufficiency, model/version and limitations.
5. The product presents an editable gifting-style narrative, not a diagnosis: preferred novelty, social/solo experiences, planning style and likely gift categories.
6. The user confirms or corrects the profile and separately chooses whether its non-sensitive gift-style signals may influence recommendations for themselves.
7. WanderWrap generates “gifts you may love” with an explanation that separates personality contribution from explicit interests, price, occasion and delivery.
8. The user may privately invite a friend to create their own Gift DNA. A friend cannot be profiled merely because the giver connected a social account.

**Acceptance criteria**

- The experience works with a questionnaire and no social connection.
- Text-based inference requires the assessed adult's active consent and a model-specific minimum sample.
- Results show uncertainty and never use clinical, protected or sensitive-trait language.
- The user can correct, delete, keep private or disable the profile.
- The first assessment is not rank-eligible; a separate subject approval enables gift use.
- Personality contribution is capped at 0.10 of the evidence score and cannot override dislikes, budget, safety, market or delivery constraints.
- Explanations say “your optional gifting-style profile,” not “your personality proves.”
- Sharing results and inviting friends are optional, separate actions.

This is the non-invasive acquisition loop: **learn about yourself → receive useful self-gift ideas → invite someone to discover their own profile → gain permission to recommend for them**.

### 6.9 Enterprise gifting

- Organization workspace, SSO and domain controls.
- Roles: owner, admin, program manager, organizer, contributor, viewer and audited support.
- Budget policies, approval thresholds, supplier restrictions and regional catalogues.
- Recipient import with lawful basis and private preference/address collection.
- Bulk campaigns, exception queues, receipts and audit export.
- Branded claim experiences without weakening recipient consent.

## 7. Explainable recommendation system

### 7.0 Social-content and personality boundary

WanderWrap does not silently infer a recipient's personality, psychographic profile, protected traits, diagnosis or life circumstances from posts. It extracts narrowly scoped, gift-relevant **interest clues**—topics, activities, explicit wants/dislikes, saved places/items and occasion clues—from content the subject intentionally shared with WanderWrap or that a separate, documented policy permits.

A giver's Facebook or X connection may personalize the giver; it does not authorize ongoing profiling of friends. A giver-selected public link is an unconfirmed clue. Continuous recipient analysis requires the recipient's own, separate opt-in. Product language uses “interest clues,” “signals” and “confirmed preferences,” never “we know their personality.”

An optional Big Five self-discovery feature is available only to adults who explicitly opt in to analysis of their own content. A short IPIP-style self-report can calibrate the text estimate. The initial result is a fallible, private hypothesis and is not disclosed to a giver. After a separate approval by the assessed person, non-sensitive gifting-style features may contribute a capped auxiliary signal to recommendations. They never override explicit preferences or hard constraints.

### 7.0.1 Open-source personality model

The UCLA Hackers GiftHub prototype sent Twitter text to IBM Watson Personality Insights, displayed Big Five/needs/values, selected the highest trait and mapped it to fixed eBay searches. WanderWrap preserves the compelling self-discovery-to-gift journey while replacing the closed Watson dependency and single-trait keyword mapping.

The production design is:

1. A self-hosted, permissively licensed open-weight Big Five regression model behind a versioned provider contract.
2. A mandatory model card containing licence, version, training domain, minimum word count and per-trait validation metrics.
3. Optional IPIP-style questionnaire calibration, weighted more heavily than passive text inference.
4. Continuous trait scores converted to non-sensitive gift-style features.
5. A strict aggregate personality contribution cap of 0.10 in the recommendation evidence ledger.
6. Explicit interests, recipient confirmations, occasion, relationship, novelty, budget and delivery remain independent, higher-authority features.
7. Model changes run offline evaluation, shadow traffic and canary release before activation.

The initial integration candidate is the MIT-licensed `vladinc/bigfive-regression-model` DistilBERT model, served locally or through WanderWrap-controlled HTTPS infrastructure. It is a candidate, not a production endorsement: its essay-domain training, cross-cultural validity, short-post performance, per-trait error and dataset rights must pass WanderWrap's benchmark before launch. The provider interface allows replacement without changing the journey or ranking contract.

### 7.0.2 Gift-preference extraction model

WanderWrap may use a self-hosted, fine-tuned `FacebookAI/xlm-roberta-base` encoder to identify narrowly scoped gift-preference candidates from content the data subject authorized for this purpose. The model predicts canonical interests, explicit wants, dislikes, polarity, language and uncertainty. It does not diagnose personality, infer protected traits, choose products, authorize evidence for ranking or generate provider facts.

Model output is untrusted proposal-only evidence. Deterministic policy checks authorization, subject ownership, dates and sensitive categories before inference and validates labels, confidence, model identity and artifact checksum afterward. Every candidate remains `needs_confirmation` and `rankEligible:false` until the assessed subject confirms it. Connecting a giver's account never authorizes analysis of a friend's feed.

The deployed artifact requires an immutable adapter revision and checksum plus a model card recording licence, training-data rights, taxonomy, languages, calibration and validation metrics. Raw post text is processed transiently and is not retained or logged by default. Stored candidates contain a content hash/reference, model provenance, consent lineage, confidence and user decision. Revocation invalidates derived candidates and caches.

Rollout is staged: offline benchmark, opt-in shadow, 1-5% deterministic canary, active adult opt-in, then a separate learned-ranking project using confirmed outcomes. Turning `GIFT_PREFERENCE_MODEL_ROLLOUT_MODE` to `off` restores the deterministic extractor without changing the consent or confirmation workflow.

### 7.0.3 Social signal pipeline

1. Verify data subject, grantor authority, visibility, purpose, lawful basis, retention and connector capability.
2. Treat post text, links and attachments as untrusted input; strip instructions and block unapproved URLs.
3. Classify authored/replied/reposted/liked/bookmarked/shared action, organic/sponsored status, language and time.
4. Extract typed topics/entities, explicit desire/dislike, polarity, negation, intended subject, temporal context and confidence.
5. Block sensitive categories and abstain when subject attribution, sarcasm or meaning is ambiguous.
6. Deduplicate and aggregate corroboration with source reliability and time decay.
7. Ask for confirmation when clues are weak, stale, contradictory, expensive or consequential.
8. Store structured evidence and source hashes/lineage; do not retain raw feeds by default.
9. Give only eligible structured features to ranking; explanations use only recorded contributions.

Reliability order is: recipient-confirmed preference → explicit wishlist/save → recipient-authored desire → repeated recipient-authored interest → giver-entered knowledge → repost/like/bookmark → single ambiguous public post. A like or repost alone is never enough for a sensitive or high-cost recommendation.

### 7.1 Evidence hierarchy

1. Recipient-confirmed preferences, constraints and wish-list items.
2. Giver-entered explicit knowledge confirmed for the current purpose.
3. Saved items and explicit likes from a connected self-data source.
4. Permitted observations from selected public/user-owned content.
5. General occasion, relationship and market priors.

Sensitive traits, private friend feeds, medical status, financial distress, grief, fertility, religion, sexuality and political views are excluded from gift targeting.

### 7.2 Pipeline

1. Retrieve candidates from eligible provider catalogues, approved local inventory, wish lists and experience/digital rails.
2. Apply hard filters for destination, arrival date, budget, stock freshness, age/safety, allergies, exclusions, merchant status and duplicate gift history.
3. Rank deterministically from versioned features.
4. Re-rank for category, merchant and price diversity.
5. Generate explanation text only from the contribution ledger.
6. Validate every explanation claim against stored evidence and provider facts.
7. Record outcome feedback without optimizing solely for clicks or spend.

### 7.3 Initial scoring model

```text
score =
  0.28 explicitPreferenceFit
+ 0.16 confirmedObservedFit
+ 0.14 occasionFit
+ 0.14 deliveryConfidence
+ 0.08 budgetFit
+ 0.07 relationshipFit
+ 0.05 novelty
+ 0.04 merchantQuality
+ 0.04 sustainabilityOrLocalPreference
- staleEvidencePenalty
- uncertaintyPenalty
- repeatGiftPenalty
```

Weights are versioned by market and validated offline before release. They may later be learned from outcomes, but model changes run in shadow and canary modes against the deterministic baseline.

An approved gifting-style profile adds a separately visible auxiliary contribution capped at `0.10` across all personality-derived features. It does not reduce or bypass any hard filter.

### 7.4 Explanation contract

Every recommendation stores candidate/ranker versions, feature values, additive contributions, evidence IDs, filtered alternatives with reason codes, provider timestamps, missing facts, uncertainty, experiment cohort and explanation hash.

Safe example:

> “Recommended because Maya confirmed ceramics and creative workshops; it is within £50 and the supplier currently indicates delivery before 18 December.”

The language model may improve phrasing but cannot invent suitability, price, availability or fulfilment.

### 7.5 Quality requirements

- Constraint satisfaction: 100% in release scenarios.
- Explanation evidence precision: 100%.
- Sensitive inference violations: zero.
- Unconsented or revoked evidence use: zero.
- Provider-fact hallucinations: zero.
- Track NDCG@4, Recall@20, catalogue coverage, intra-list diversity, recipient accept/keep, exchange/decline/return and “creepy” feedback.
- Explicit want/dislike extraction precision: at least 95% on the frozen opt-in benchmark; precision is preferred to recall.
- Negation and recipient-subject handling: at least 99% on the adversarial critical set.
- Low-confidence and poorly calibrated outputs abstain and request confirmation.
- XLM-R output never becomes rankable without subject confirmation; raw post text never appears in evidence, explanations or ordinary logs.
- Learned ranking must beat the deterministic baseline without degrading delivery feasibility, diversity, underserved-market coverage or the “creepy” rate.

The benchmark uses synthetic adversarial examples plus licensed or voluntarily donated, de-identified content—not scraped private feeds. Labels cover subject, authorship/action, topic/entity, want/dislike, negation, sarcasm, sponsored content, staleness, sensitivity, confidence and whether inference is allowed. Splits are by person/household to prevent leakage and include frozen, temporal, multilingual and red-team sets. Two annotators plus adjudication are required for the gold set.

Failure coverage includes sarcasm, a gift mentioned for someone else, negative statements, sponsorship, reposts, shared accounts, already-owned items, outdated interests, multilingual slang, sensitive contexts, source-feed amplification, popularity and commission bias, click feedback loops, model drift, revoked content in caches and prompt injection. Required behaviour is abstain, ask or correct—never quiet overconfidence.

GiftHub is product inspiration rather than a validated UCLA scientific model. The defensible description is **open-model Big Five self-discovery plus user-controlled contextual learning-to-rank with evidence-grounded explanations**.

## 8. Multi-agent operating model

Multi-agent means bounded specialists coordinated by a durable workflow, not autonomous language models sharing unrestricted memory.

| Agent | Responsibility | Forbidden authority |
|---|---|---|
| Journey Orchestrator | Journey state, delegation, retries, timeouts and composition | Cannot bypass policy or approval |
| Identity and Consent | Validate actor, tenant, purpose, scope and consent snapshot | Cannot grant its own consent |
| People Graph | Import candidates, propose matches and preserve provenance | Cannot silently merge people |
| Occasion | Normalize dates, holidays, lead times and reminders | Cannot activate unconfirmed inferred events |
| Signal | Extract permitted candidate interests | Cannot confirm its own inference |
| Recipient Concierge | Ask scoped questions and record direct answers | Cannot reveal giver/recipient secrets |
| Recommendation | Retrieve, filter, rank and diversify | Cannot buy or claim provider facts |
| Explanation/Critic | Phrase and validate grounded explanations | Cannot introduce new claims |
| Catalogue/Router | Normalize offers and select viable route | Cannot fabricate availability |
| Transaction | Prepare provider handoff and reconcile payment state | Cannot capture without valid approval |
| Fulfilment | Apply provider-authoritative status events | Cannot infer delivery from silence |
| Group Gift | Manage members, votes, ledger and organizer authority | Cannot custody funds without an approved product |
| Thank-you/Growth | Prompt after verified completion | Cannot force signup or marketing consent |
| Support | Explain failures and escalate exceptions | Cannot mutate protected state without permission |

### 8.1 Agent request contract

Each invocation includes request/correlation/tenant IDs, actor and roles, purpose, subject IDs, consent snapshot, input references, deadline and policy version. Output is a proposal containing action, typed arguments, evidence IDs, confidence, uncertainty and required approvals.

Only deterministic application services execute mutations. A policy decision point returns `allow`, `deny`, `require_confirmation` or `manual_review` before every external read, message, disclosure, payment or provider action.

The central durable state machine owns the allowed workflow graph. Specialists are stateless, least-privilege, proposal-only workers: they cannot make free-form calls to one another or share mutable memory. Every step records versioned schemas, capability-scoped identity, correlation/causation IDs, deadline and cost budget, idempotency key, consent/policy snapshot, input/output hashes and model/prompt/tool versions. A planner may propose a plan, but only an allowlisted workflow can execute it.

### 8.2 Plug-and-play provider platform

Agents request stable capabilities rather than naming vendors. Versioned adapters implement preference extraction, recommendation ranking, catalogue search/enrichment, explanation, fulfilment, payment and gift APIs behind immutable manifests. A new provider requires one reviewed adapter, manifest, normalized-output validator, conformance fixture and configuration entry; it does not require changes to agents, workflows, MCP tools, public APIs or UI.

Resolution filters by tenant allowlist, kill switch, capability contract, market/currency, data policy and health, then selects deterministically by configured provider, priority and provider ID. Read-only or proposal work may fall back before a side effect. A dispatched or ambiguous payment/fulfilment operation never moves to another provider: it becomes outcome-unknown and enters reconciliation. Provider selection and version are included in execution provenance and signed approvals.

Configuration may select only code-reviewed providers registered at boot. It cannot load arbitrary code or carry credentials. Manifests and audit records are secret-free; adapters resolve secrets server-side.

### 8.3 Mandatory policy gates

- Tenant/resource authorization and role.
- Exact provider scope and active purpose-specific consent.
- Evidence subject match, lineage, freshness and sensitivity policy.
- Channel/workspace authorization.
- Catalogue freshness, destination and deadline feasibility.
- Budget, currency, fee and market eligibility.
- Server-issued approval artifact bound to actor, action digest, recipient, amount/currency, nonce and expiry.
- Idempotency and legal state transition.
- Abuse/fraud/rate limits and step-up authentication where required.
- Manual review whenever provider authority or identity is ambiguous.

## 9. Data and state model

Core graph:

`Tenant → User → Person → Relationship → Occasion → ConsentReceipt → SourceConnection → Evidence → Preference → Recommendation → Approval → Gift → ProviderHandoff → Fulfilment → Delivery → Thanks`

Group extension:

`GroupGift → Membership → Suggestion → Vote → Contribution → OrganizerApproval → Purchase → Refund`

### 9.1 Consent receipt

Stores grantor, data subject, grantor authority, lawful basis, subject notice status, source, purposes, scopes, allowed decisions, data categories, processing actions, channels, raw/derived retention, notice/policy version, jurisdiction, grant/expiry/revocation times and proof hash. A giver cannot consent to continuous analysis on behalf of a recipient.

### 9.2 Evidence

Stores subject, topic, source reference, observation time, extractor version, raw-content hash, confidence, confirmation state, allowed purposes, consent receipt, sensitivity labels, expiry and revocation.

Derived evidence retains lineage to every source. Revocation disables use immediately, cancels scheduled work and asynchronously deletes or re-derives downstream features. Normal logs contain evidence IDs and hashes, not raw private content.

Revocation also invalidates affected recommendations, rebuilds caches/indexes/embeddings and completes deletion within a documented SLA.

### 9.3 Approval

Production approval is a signed, short-lived server artifact—not a browser-provided Boolean. It is bound to actor, action, recipient, provider, amount/currency, action digest, expiry and nonce.

### 9.4 Provider events

Webhook flow:

`receive raw event → verify signature → persist immutable inbox → deduplicate → enqueue → apply guarded state transition → append audit/outbox → acknowledge`

Every consumer tolerates duplicates and out-of-order events. Ambiguous states go to reconciliation or manual review.

## 10. Robust journey and agent harness

The harness runs the same domain and application code used in production against versioned scenarios.

Required capabilities:

- Virtual clock for birthdays, holidays, deadlines, expiry and time zones.
- Seeded IDs and randomness.
- Deterministic model stub plus recorded response fixtures.
- Provider record/replay with PII and secrets redacted.
- Duplicate, delayed, reordered and invalid-signature webhook injection.
- Timeouts, throttling, stale price, stock change and partial-failure injection.
- Event-log replay into a clean store with state-hash comparison.
- Web, Alexa+, Slack and Telegram transcript runners against one journey.
- Policy mutation tests proving gates fail closed.
- Tenant-leak canaries and authorization isolation tests.
- Christmas peak load profiles.
- Golden explanation snapshots plus entailment validation.
- Feature flags and kill switches by connector, market, provider and agent.
- Workflow cost, latency and token budgets.

Example scenario:

```yaml
scenario: christmas_cross_border_provider_timeout
clock: 2026-12-16T10:00:00Z
tenant: personal-gb
consents: [calendar_read, recommendation]
provider_scripts:
  amazon: [timeout]
  goody: [quote_ok, handoff_ok, delivered]
assert:
  - no_unconsented_evidence_used
  - route == goody
  - purchase_count <= 1
  - explanation_claims_subset_of_ledger
```

### 10.1 Zero-tolerance release gates

- Cross-tenant access: zero.
- Unauthorized external action: zero.
- Duplicate capture, charge or purchase: zero.
- Invalid webhook mutation: zero.
- Sensitive or unconsented evidence use: zero.
- Unsupported explanation/provider claim: zero.
- Illegal state transition: zero.
- Replay divergence for deterministic workflows: zero.
- Provider degradation fails safely to saved progress or manual review: 100%.
- Crash/restart at every workflow step resumes without duplicate external action.
- Duplicated or reordered callbacks converge to the same state.
- Concurrent web, Alexa+ and group-channel actions cannot overwrite approval or double-purchase.
- Consent revocation during a run cancels downstream signal and ranking work.
- Schema, policy or version mismatches reject stale agent output.
- Exhausted latency, token or cost budgets degrade to deterministic baseline or manual review.
- An agent cannot expand its scope or invoke an undeclared tool.

## 11. Security, privacy and enterprise requirements

- OAuth authorization code + PKCE, exact redirect allowlists, state/nonce, scoped audience validation and token rotation.
- Encrypted provider tokens and recipient address fields; no tokens, addresses or raw social content in normal logs.
- Tenant isolation enforced in repositories, not only route handlers.
- RBAC plus relationship/purpose/data-class ABAC.
- Append-only audit with actor, action, target, consent snapshot, policy result, approval, before/after hashes and correlation.
- Prompt-injection isolation: source and merchant text is untrusted data; tools are schema validated and provider URLs allowlisted.
- Idempotent writes, inbox/outbox, bounded retries with jitter, circuit breakers, dead-letter queues and replay tools.
- Data export, correction, deletion and retention jobs, including caches, embeddings and derived features.
- Abuse controls for claim enumeration, harassment, anonymous gifting, account takeover and group fraud.
- PCI-sensitive entry remains on provider surfaces; sanctions, KYC/AML and transfer eligibility remain with regulated providers.
- WCAG 2.2 AA web target and voice/touch parity.
- Privacy impact, consumer protection, payments, tax, data residency and children's-data review before relevant launch.

Target SLOs:

- Core API availability: 99.9%.
- Scheduled reminders executed within 15 minutes: 99.99%.
- Provider event lag: p95 under 5 minutes where providers deliver timely events.
- Recommendation response: p95 under 3 seconds excluding disclosed provider search progress.
- RPO: 15 minutes or better; RTO: 4 hours or better.

## 12. Edge cases that must have product behavior

- Connector grants login but not requested data scopes.
- Source is revoked after recommendations were derived.
- Conflicting birthdays or duplicate people.
- February 29, missing year, lunar/religious/custom dates and time-zone changes.
- Holiday is irrelevant or distressing to the recipient.
- Source content is sarcastic, outdated, sponsored or describes a dislike.
- Recipient already owns the gift or received it previously.
- Price, stock or arrival date changes during selection.
- Merchant handoff succeeds but purchase/status cannot be observed.
- Tracking says delivered but recipient reports non-receipt.
- Partial shipment, substitution, cancellation, return or lost parcel.
- Anonymous gifting becomes repeated unwanted contact.
- Recipient is a minor or in an unsupported/sanctioned destination.
- Group has insufficient/excess funds, multiple currencies, chargebacks or no organizer.
- Slack/Telegram app loses permission mid-journey.
- Alexa is used in a shared household and risks revealing a surprise.
- Model, calendar or provider fails close to a deadline.

## 13. Phased delivery

### Phase 0 — Trust and capability validation

- Live connector capability registry.
- Consent receipts, evidence lineage and revocation propagation.
- Provider commercial/legal confirmation.
- Threat model and data protection impact assessment.
- Recommendation evaluation set and harness foundation.
- Alexa household privacy patterns.
- Supplier/market coverage map.

**Exit:** no core journey depends on an unconfirmed third-party permission or API.

### Phase 1 — Christmas 2026 focused MVP

- Existing verified-email/Cognito account plus Alexa+ linking decision.
- Manual people entry and Google/Microsoft calendar/contact import.
- Christmas gifting circle, budgets, deadlines and calm reminders.
- User-entered preferences and share-to-WanderWrap saves.
- Explainable recommendation cards and evidence correction.
- Amazon discovery/handoff plus one contracted provider rail, preferably Goody.
- Manual order/tracking import when provider status is unavailable.
- Alexa+ discovery/recommendation with secure web continuation.
- Recipient claim, private address, thanks and optional referral.
- Fulfilment exception queue.

**Explicitly not launch dependencies:** broad Facebook friend birthdays, private feed analysis, continuous social monitoring, pooled group funds or guaranteed Amazon retail order status.

### Phase 2 — Connected intelligence and group pilots

- Approved X/Meta self-data capabilities.
- Production Google/Outlook synchronization and incremental watches.
- Browser/mobile share extension.
- Recipient preference invitations.
- Slack and Telegram group gifting pilots.
- Stripe/PayPal contribution reconciliation.
- Goody/Tremendous and selected local-provider adapters.
- Returns and delivery exception automation.
- Birthday and Easter campaigns.

### Phase 3 — Multi-market gifting rails

- Local merchant/supplier portal for inventory, quotes, fulfilment and status.
- Cross-border duty, tax, address and currency rules.
- Market-specific payments and refunds.
- Experiences, restaurants, charity and digital gifts.
- Consented self-bookmark intelligence.
- Thanksgiving and other regional seasonal templates.
- Merchant quality scores and SLA reporting.

### Phase 4 — Enterprise platform

- Organization workspaces, SSO, SCIM and regional controls.
- Corporate gifting policies, procurement and approval chains.
- Branded recipient experiences and bulk campaigns.
- Audit/compliance export.
- Recommendation and provider-routing APIs.
- Supplier marketplace and advanced experimentation.

## 14. Metrics

### Acquisition and activation

- Signup and first-run completion.
- First person confirmed, occasion scheduled and useful recommendation.
- Connector attach/revoke rate by source.
- Christmas planner adoption.
- Recipient-to-consented-user conversion.
- Group invite-to-contributor conversion.

### Recommendation and trust

- Save/select rate and time to confident selection.
- Explanation open/helpful rate.
- Constraint violation and provider-fact error rate.
- Diversity, coverage, freshness and cold-start performance.
- “Already owns,” “irrelevant” and “creepy” feedback.
- Consent withdrawal/deletion completion time.

### Commerce and delight

- Handoff-to-confirmed-purchase where measurable.
- On-time delivery, cancellation, return and exception rates.
- Claim acceptance and thank-you completion.
- Repeat gifting and occasions completed on time.
- Recipient keep/exchange/decline outcomes.
- Gross merchandise value, provider margin and contribution margin without optimizing recommendation relevance for spend.

## 15. Business model hypotheses

1. Affiliate revenue for attributable retailer handoffs.
2. Merchant commission or routing fee for contracted suppliers.
3. Consumer premium plan for household planning, advanced reminders and concierge support.
4. Enterprise SaaS plus per-recipient campaign fees.
5. Provider/platform API fees for recommendation and recipient experience infrastructure.

Commercial ranking never overrides user fit, disclosed constraints or provider truth. Sponsored placement must be labelled and remain eligible under the same hard filters.

## 16. Non-goals for the initial launch

- Scraping social networks or importing every friend.
- Reading arbitrary private feeds, Slack history or Telegram conversations.
- Inferring protected traits, sensitive life events or clinical personality profiles.
- Autonomous purchasing, transfers or booking.
- Claiming Amazon fulfilment visibility without authorized order access.
- WanderWrap custody, escrow or stored value.
- Requiring recipient registration.
- Full travel booking or universal global delivery.
- Publicly claiming a university-affiliated recommendation method without evidence.

## 17. Critical product decisions

1. Login with Amazon versus a Cognito-backed OAuth facade for Alexa+ account linking.
2. Google versus Microsoft as the first production birthday/contact connector.
3. Goody production eligibility, markets, margins and SLA as the first physical-gift fallback.
4. Amazon Creators/Associates onboarding and Alexa Shopping Actions eligibility.
5. First Christmas 2026 launch markets and their supplier coverage.
6. Whether WanderWrap ever becomes merchant of record.
7. Group contribution design: authorize-until-threshold, separate checkout or regulated platform partner.
8. Allowed evidence classes and retention windows for gift, food and travel recommendations.
9. Recipient data permitted before the recipient interacts.
10. Anonymous-gifting limits and escalation policy.
11. Launch business model and sponsored-content policy.

## 18. Research basis

The feasibility decisions above were checked against current official documentation:

- [UCLA Hackers GiftHub repository](https://github.com/UCLA-Hackers/twitter-watson-personality-insights)
- [Open Big Five regression candidate and model card](https://huggingface.co/vladinc/bigfive-regression-model)
- [Original digital-footprint personality study](https://www.pnas.org/content/110/15/5802)
- [Recent social-text Big Five validation study](https://pmc.ncbi.nlm.nih.gov/articles/PMC13359307/)
- [ICO profiling and automated decision guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/rights-related-to-automated-decision-making-including-profiling)
- [Meta permissions reference](https://developers.facebook.com/docs/permissions/reference/)
- [X OAuth 2.0 Authorization Code with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [X bookmarks API](https://docs.x.com/x-api/posts/bookmarks/introduction)
- [X timelines API](https://docs.x.com/x-api/posts/timelines/introduction)
- [Google People connections](https://developers.google.com/people/api/rest/v1/people.connections/list)
- [Google Calendar birthday events](https://developers.google.com/workspace/calendar/api/guides/event-types)
- [Google Calendar incremental synchronization](https://developers.google.com/workspace/calendar/api/guides/sync)
- [Microsoft Graph contact resource](https://learn.microsoft.com/en-us/graph/api/resources/contact?view=graph-rest-1.0)
- [Microsoft Calendar delta synchronization](https://learn.microsoft.com/en-us/graph/api/event-delta?view=graph-rest-1.0)
- [Amazon Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference)
- [Alexa Shopping Actions](https://developer.amazon.com/en-US/docs/alexa/alexa-shopping/alexa-shopping-actions-for-alexa-skills-api-reference.html)
- [Amazon SP-API Orders](https://developer-docs.amazon.com/sp-api/docs/orders-api)
- [Goody developer overview](https://developer.ongoody.com/introduction/overview)
- [Tremendous API introduction](https://developers.tremendous.com/docs/introduction)
- [Giftbit developer hub](https://www.giftbit.com/developers/)
- [Slack Events API](https://api.slack.com/apis/connections/events-api)
- [Telegram bot privacy](https://core.telegram.org/bots/features)
- [Stripe Connect](https://docs.stripe.com/connect)
- [PayPal Orders integration](https://developer.paypal.com/api/rest/integration/orders-api)
- [PayPal webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/)

Provider permissions, pricing, eligibility and product terms change. The capability registry and launch review must revalidate them before implementation and release.
