# WanderWrap launch accounts and signup links

Use these in order. Do not paste passwords, access keys, client secrets, refresh tokens, test-account passwords, or private provider responses into chat or Git. Put deployed secrets in AWS Secrets Manager; keep `.env.example` empty.

## 1. AWS access and domains

- [AWS Console](https://console.aws.amazon.com/)
- [AWS IAM Identity Center setup](https://docs.aws.amazon.com/singlesignon/latest/userguide/getting-started.html)
- [AWS Certificate Manager](https://console.aws.amazon.com/acm/home?region=eu-west-2)
- [Amazon Route 53](https://console.aws.amazon.com/route53/)

Required outcome: a non-root SSO/deployment identity, `eu-west-2` access, and DNS/certificates for the chosen `www`, `api`, and `auth` hostnames. The current domain uses GoDaddy nameservers, so DNS changes must be made there unless the zone is deliberately moved to Route 53.

## 2. Alexa+

- [Amazon Developer Console](https://developer.amazon.com/alexa/console/ask)
- [Alexa+ MCP Toolkit quickstart](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart)
- [Alexa+ account linking](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking)
- [Alexa+ Web Simulator testing](https://developer.amazon.com/docs/alexaplus/add-ons/test-web-simulator.html)

Required outcome: developer access, an add-on ID, the Alexa redirect URI, development deployment, and Web Simulator access. Configure the redirect URI in the AWS stack; do not invent it.

## 3. Amazon catalogue

- [Amazon Associates UK](https://affiliate-program.amazon.co.uk/)
- [Creators API registration](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/onboarding/register-for-creators-api)
- [Creators API reference](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference)

Required outcome: Creators credential ID/secret/version and a Partner Tag for each enabled marketplace. These are separate from AWS credentials.

## 4. PayPal sandbox

- [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
- [Sandbox apps](https://developer.paypal.com/dashboard/applications/sandbox)
- [Sandbox accounts](https://developer.paypal.com/dashboard/accounts)
- [Orders API integration](https://developer.paypal.com/api/rest/integration/orders-api/)
- [Webhook verification](https://developer.paypal.com/api/rest/webhooks/rest/)

Required outcome: sandbox client ID/secret, sandbox merchant and buyer accounts, and a webhook ID registered against the public HTTPS listener. Complete sandbox evidence before requesting live credentials.

## 5. Optional Google Calendar and Contacts connector

Google is not required for WanderWrap sign-in. It is a separately consented source connection.

- [Google Cloud Console](https://console.cloud.google.com/)
- [API library](https://console.cloud.google.com/apis/library)
- [OAuth consent configuration](https://console.cloud.google.com/apis/credentials/consent)
- [OAuth clients](https://console.cloud.google.com/apis/credentials)
- [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)
- [Google People API](https://console.cloud.google.com/apis/library/people.googleapis.com)

Required outcome: web OAuth client ID/secret, exact redirect URI, minimal approved scopes, and testing/verification status. Manual occasion entry remains available when this connector is absent or revoked.

## 6. Companion-web hosting

Choose one web host; do not point the same hostname at two platforms.

- [Vercel new project](https://vercel.com/new) — recommended for the fastest Next.js companion launch.
- [AWS Amplify Hosting](https://console.aws.amazon.com/amplify/apps) — AWS-only alternative.

Recommended split: `www.wanderwrap.co.uk` on the selected Next.js host, `api.wanderwrap.co.uk` on AWS API Gateway, and Cognito for authorization. Provider secrets remain in AWS even if the web frontend is on Vercel.

## 7. Later provider/channel accounts

- [Goody developer platform](https://developer.ongoody.com/introduction/overview)
- [Amazon SES](https://console.aws.amazon.com/ses/home?region=eu-west-2)
- [Telegram BotFather](https://t.me/BotFather)

Do not create Meta, X, Telegram, SMS, or additional supplier credentials until the corresponding adapter and consent/review gate is ready for a sandbox test.
