# WanderWrap live integration and credential checklist

This is the ordered path from the deterministic demo to a live hackathon pilot. Never paste secrets into chat, commit them, place them in `NEXT_PUBLIC_*`, or put them in an Alexa/MCP client bundle. Use short-lived local authentication and AWS Secrets Manager (or an equivalent encrypted deployment secret store) for deployed values.

## 0. Git and hackathon identity

Provide first:

- Git remote URL and intended default branch;
- whether the remote is empty or already contains work;
- the exact Devpost event URL and submission deadline.

These are not secrets. The folder is not currently a Git repository, so no push should occur until the remote is inspected and the histories are reconciled safely.

## 1. AWS deployment identity and Bedrock

Preferred access:

- AWS account and deployment region;
- an AWS IAM Identity Center/SSO profile or a narrowly scoped deployment role;
- permission to deploy/update the WanderWrap CloudFormation stack and its Lambda, API Gateway, Cognito, DynamoDB, CloudWatch, IAM, and artifact-bucket resources;
- Bedrock model invocation permission for the application Lambda role.

Do **not** send an AWS root password or long-lived access key in chat. If temporary local CLI access is needed, configure SSO/role credentials in the AWS CLI on this machine. Production Bedrock calls should use the Lambda execution role, not an API key. If Claude is selected, the AWS account must complete Anthropic's first-time-use requirements and have model access in the chosen region. The current default is Nova 2 Lite, so Claude is optional rather than a launch dependency. See [AWS Bedrock model access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html).

Configuration after access is established:

- `BEDROCK_ENABLED=true`
- `BEDROCK_REGION`
- `BEDROCK_MODEL_ID` or inference-profile ID
- public HTTPS API and auth hostnames
- DNS/certificate ownership for those hostnames

Acceptance gate: a deployed recommendation request produces an attributed model explanation, while model failure falls back safely and no raw private social text appears in logs.

## 2. Alexa+ developer onboarding and account linking

Provide/configure:

- Amazon developer account access through `alexa-ai configure` (browser login; do not share the stored CLI credential file);
- deployed public HTTPS MCP URL;
- Alexa+ Add-on ID after scaffolding/deployment;
- privacy-policy and terms URLs;
- OAuth client registration for Alexa and the Alexa redirect URI returned by onboarding.

WanderWrap needs user identity and write actions, so production account linking requires OAuth 2.1 authorization code with PKCE S256, access and refresh tokens, audience/resource validation, and scopes. A static `WANDERWRAP_MCP_TOKEN` is local testing only. See the [Alexa+ MCP quickstart](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart) and [account-linking requirements](https://www.developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking).

Acceptance gate: development-stage add-on passes isolation and global Web Simulator journeys, authorization failures relink correctly, and no tool round trip exceeds the Alexa+ readiness target.

## 3. Amazon product catalogue and handoff

Provide through the server-side secret store:

- `AMAZON_CREATORS_CREDENTIAL_ID`
- `AMAZON_CREATORS_CREDENTIAL_SECRET`
- `AMAZON_CREATORS_CREDENTIAL_VERSION`
- Partner Tag for every enabled marketplace (begin with UK, US, and Canada)
- confirmation that the Associates owner has approved WanderWrap's use and required disclosures.

Creators API uses its own credential ID/secret and marketplace Partner Tags; AWS access keys are not Creators API credentials. Only the primary Associates account owner can register an application. See [Creators API registration](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/onboarding/register-for-creators-api) and [marketplace/Partner Tag rules](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/concepts/common-request-headers-and-parameters).

Acceptance gate: searches return provider-sourced ASIN, link, price/availability fields where offered, correct marketplace attribution, rate-limit handling, and an honest fallback when delivery cannot be verified.

## 4. PayPal sandbox, then live

Provide through the server-side secret store:

- sandbox `PAYPAL_CLIENT_ID`
- sandbox `PAYPAL_CLIENT_SECRET`
- sandbox merchant and buyer test accounts (identifiers only where safe; passwords stay in PayPal's test tooling)
- `PAYPAL_WEBHOOK_ID` after the HTTPS listener is registered.

PayPal REST authentication exchanges the client ID/secret for a short-lived OAuth access token. The webhook ID is required to verify signed webhook deliveries. See [PayPal REST authentication](https://developer.paypal.com/api/rest/authentication) and [webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/).

Acceptance gate: create → buyer approve → server capture → signature-verified webhook → idempotent fulfilment status completes in sandbox; duplicates and altered signatures are rejected. Move to live credentials only after that evidence passes.

## 5. Transactional notifications

For email through Amazon SES, provide domain/DNS authority to verify the sending domain and choose sender/reply-to addresses. For SMS/push, select the provider first; credentials should not be collected until the adapter and consent policy exist.

Acceptance gate: opt-in, unsubscribe/revocation, bounce handling, rate limits, and a reminder-to-thank-you journey are proven without exposing recipient data.

## 6. Calendar connections

Choose Google Calendar and/or Microsoft Graph before creating apps. Each requires a provider project/tenant, OAuth client ID and secret, exact redirect URIs, and approved minimal calendar scopes. Birthday visibility is provider- and contact-permission-dependent; WanderWrap must always support manual occasion entry and must not promise that social APIs expose birthdays.

Acceptance gate: connect, import only consented events, create/update reminder, revoke, delete imported data, and survive expired tokens.

## 7. Telegram reference channel

Provide after its adapter endpoint exists:

- BotFather-issued bot token;
- random `TELEGRAM_WEBHOOK_SECRET`;
- public HTTPS webhook URL.

Telegram can send the configured secret in `X-Telegram-Bot-Api-Secret-Token`; validate it and deduplicate update IDs. See the [Telegram Bot API `setWebhook`](https://core.telegram.org/bots/api#setwebhook).

Acceptance gate: verified inbound message → channel-neutral envelope → recommendation → safe reply, with duplicate and forged webhook tests.

## 8. Meta and X (optional, approval-dependent)

Do not make these launch blockers and do not promise feed or birthday access. Create provider apps only after confirming that the exact current products, scopes, app-review rules, retention rules, and automation policies permit the intended experience.

Likely server-side inputs include app/client IDs, secrets, exact OAuth redirect URIs, webhook verification secrets, signing secrets, approved scopes, and page/account tokens. Record the provider approval evidence beside the adapter before enabling `FACEBOOK_CHANNEL_ENABLED` or `X_CHANNEL_ENABLED`.

Acceptance gate: explicit user consent, scope minimization, signature verification, token revocation, data deletion, provenance, and platform-policy review all pass. The safe fallback is a share sheet, pasted link, or user-confirmed preference—not feed scraping.

## Credential handoff sequence

We will request only one tranche at a time:

1. Git remote and hackathon event (non-secret).
2. AWS SSO/deployment role and domain choices.
3. Alexa+ developer login/onboarding outputs.
4. Amazon Creators credentials in the secret store.
5. PayPal sandbox credentials in the secret store.
6. Optional calendar, notifications, Telegram, Meta, and X credentials only as their adapters reach a testable gate.

For each tranche: configure → run a sandbox smoke test → add webhook/failure tests → capture evidence → mark live. Possessing a key alone never changes a capability from simulated to live.
