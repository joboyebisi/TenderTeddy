# Credentials and live-service activation

Provide these one at a time. Never paste a secret into this repository or into chat.
The preferred handoff is to enter it directly in the provider console or AWS Secrets
Manager while we verify only the resulting status.

## 1. AWS deployment login — required for the next deployment

What you provide: no access key. Sign in through the browser when this command opens it:

```powershell
aws login --profile tenderteddy --region eu-west-2
```

Then deploy with `scripts/deploy-aws.ps1`. A permanent `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY` are neither needed nor wanted. The current machine does not
have the `tenderteddy` profile configured.

## 2. Gemini API key — present, but live generation must be re-verified

The live health check reports `aiConfigured: true`, which proves that a non-empty key
can be resolved. A hosted E2E attempt on 23 October 2026 timed out at the gateway with
HTTP 503 during generation, so this is not yet a green live-AI check. The local code
now bounds primary/fallback calls to fit the Lambda window; deploy and rerun the hosted
test. If the current key is not known to be private, rotate it in Google AI Studio and
place the replacement directly into the CloudFormation-created Secrets Manager secret:

```json
{"GEMINI_API_KEY":"replacement-value-entered-in-the-AWS-console"}
```

Do not put the value in `.env`, `.env.example`, a deployment command, Android, or Git.
The app currently uses `gemini-3.8-flash` and falls back to `gemini-3.6-flash` on
capacity errors.

## 3. Git remote access — required to push

What you provide: the repository HTTPS or SSH URL. Authenticate locally with your Git
provider's browser/device login or credential manager. Do not send a personal access
token in chat. This workspace is not currently a Git repository.

## 4. Physical Fire TV access — required for on-device proof

What you provide: the Fire TV's local IP address, shown under **Settings → My Fire TV
→ About → Network**. This is not a secret. Enable ADB debugging and approve the computer
on the TV. No Amazon account password is needed by the install script.

## 5. YouTube Data API key — required for verified catalogue metadata

Not implemented yet. The current alpha accepts the parent's `embeddable` and
`madeForKidsChecked` confirmations; it does not independently verify those claims.
For a production-quality catalogue, create a restricted Google Cloud API key with only
YouTube Data API v3 access. Store it in Secrets Manager, restrict it to the deployed
backend, and add server-side status/embeddability checks. Do not expose it to WebView
JavaScript.

## 6. Cognito parent authentication — required before real family data

Not implemented yet. CloudFormation should create the User Pool, app client, hosted
login/domain, and API authorizer; these create IDs and URLs, not a hand-copied password.
Until household-scoped authorization exists, use fictional data only.

## 7. Alexa developer configuration — only required for real voice testing

Not implemented yet. Needed items are an Amazon Developer account, a Custom Skill ID,
the Lambda/API endpoint configuration, interaction-model locales, and account linking
to the future Cognito parent identity. The current `/api/alexa` path is a working Alexa
request-envelope simulator, not a published skill. Do not provide Amazon passwords.

## 8. Claude on Amazon Bedrock — optional, not currently required

No Anthropic API key is needed when Claude is used through Bedrock. Enable the chosen
model in the AWS region and grant the Lambda execution role narrowly scoped
`bedrock:InvokeModel` permission. Adding a second provider also requires a provider
adapter, safety tests, cost limits, and an explicit fallback policy. Gemini already
powers the live lesson-candidate path, so Bedrock is not a demo prerequisite.
