# WanderWrap platform architecture

## Surfaces

- **Responsive web app — launch commerce surface.** Account, recipient profiles, reminders, recommendations, claim links, PayPal checkout and group gifts. `wanderwrap.co.uk` is the intended UK home.
- **Mobile app — high-frequency companion.** Contacts, location-triggered opt-in discovery, reminders, claim and thank-you flows. Start as an installable PWA; add native apps when background/location value is proven.
- **Alexa skill — conversational discovery.** Ask questions, shortlist gifts and send a secure handoff to the phone/web app. Alexa never confirms a purchase without an explicit authenticated approval step.
- **MCP gifting agent — channel-neutral tool layer.** Recommendation, gift-link, group-gift and checkout-preparation tools with per-call user approval and audit records.
- **Slack/Teams/Telegram agents — group gifting.** Installed by an authorized user/admin, limited to declared conversations and explicit likes/occasion facts. No silent personality scoring of an entire workspace.

## Core growth loop

Sender creates/approves gift → recipient opens claim link → recipient privately confirms delivery details → sender checks out → fulfilment provider ships → recipient sends thank-you → both are invited to save a profile/reminder. Address details are never revealed to the sender unless the recipient chooses.

## Social data boundary

OAuth grants access only where a platform offers the needed permission and review is complete. Handles can be stored as user-supplied identifiers, but the system must not scrape private feeds or guess identity matches. Signals are evidence with source, timestamp and confidence; the user confirms them before recommendation use. X reply automation requires the platform permissions/approval then in force.

## Cloud

AWS-first: Cognito, API Gateway/Lambda, DynamoDB, EventBridge Scheduler, SQS/Step Functions, KMS/Secrets Manager and CloudWatch. Provider adapters isolate PayPal, Amazon affiliate/deep links and alternate fulfilment APIs. Purchases remain human-approved.
