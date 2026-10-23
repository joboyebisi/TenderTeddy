# WanderWrap — PayPal AI Hackathon PRD

## Entry thesis

WanderWrap is an AI gifting agent that makes PayPal central to alternate-supplier checkout, group gifting and value gifts. AI explains what fits; PayPal provides the trusted approval and money movement. Amazon remains a valuable physical fulfilment route, but PayPal takes precedence for money gifts and for merchant routes Amazon cannot fulfil.

## Demo user story

The user requests a birthday experience for a friend in a location where Amazon has no suitable offer. WanderWrap confirms preferences, ranks an approved local experience, shows why it fits, creates a server-priced PayPal sandbox order, receives user approval and processes a signed sandbox completion webhook. The recipient opens a claim link and sends thanks.

## Required behavior

- real PayPal sandbox credentials supplied only at runtime;
- server-side Orders API create and capture;
- PayPal JavaScript SDK/provider approval surface;
- trusted SKU and amount calculation;
- idempotency and duplicate-click protection;
- signed webhook validation and replay-safe state transition;
- AI recommendation with inspectable evidence;
- recipient claim flow tied to the PayPal order reference;
- failure, cancellation and refund-ready states;
- Xoom shown as an eligible external handoff unless contracted capability exists.

## Agentic commerce boundary

The agent can search, rank, compare, route and prepare. It cannot capture payment until the customer has reviewed provider, recipient, amount, currency, fees/delivery implications and approved on a trusted surface.

## Judging-aligned acceptance

- **Technology:** judges can see a non-trivial PayPal sandbox order and AI recommendation working end-to-end.
- **Design:** one coherent journey from intent to claim, not separate AI and payment demos.
- **Impact:** handles underserved cross-border, group and non-Amazon gifting cases.
- **Innovation:** delivery-aware routing chooses between goods, supplier checkout and money-value routes.
- **Presentation:** the video shows the problem, recommendation evidence, PayPal approval and recipient outcome inside three minutes.

## Submission readiness

The attached event snapshot requires a public open-source repository with a visible licence, complete run instructions, functional build/hosted URL, source, under-three-minute public YouTube demo and disclosure of AI/PayPal tools. These requirements remain subject to the live official rules at submission time.
