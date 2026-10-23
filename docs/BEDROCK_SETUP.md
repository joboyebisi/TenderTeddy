# Amazon Bedrock setup

WanderWrap uses Amazon Bedrock through `@aws-sdk/client-bedrock-runtime` and the Converse API. Production Lambda requests are signed with the function execution role. Do not put a long-lived Bedrock key in Lambda or commit one to this repository.

## Sign in

1. Open the AWS Console: <https://console.aws.amazon.com/bedrock/home?region=eu-west-2>
2. Sign in to AWS account `695912022574` using the same IAM/console identity used for the WanderWrap stack.
3. Keep the Region set to **Europe (London) — eu-west-2**.
4. Open **Model catalog**, select **Nova 2 Lite**, and confirm the account can invoke it. WanderWrap uses the global inference profile `global.amazon.nova-2-lite-v1:0` from London.
5. For terminal access, run `aws login` in the WanderWrap terminal and finish the browser prompt. Confirm with `aws sts get-caller-identity`.

## Authentication policy

- Production: Lambda IAM role with only `bedrock:InvokeModel` for Nova 2 Lite resources.
- Local development: normal short-lived AWS CLI/session credentials are preferred.
- Optional local bearer key: Bedrock Console → **API keys** → **Short-term API keys**. Put it in `AWS_BEARER_TOKEN_BEDROCK` only in a local `.env`, never `.env.example` with a real value.
- Do not use a long-term Bedrock API key for production.

## Runtime behaviour

- Deterministic scoring selects the recommendations and trusted guide prices.
- Bedrock receives only the confirmed interests and already-selected candidates.
- Bedrock may write the concise summary and card narrative; it may not select fulfilment, claim availability, or authorize checkout.
- If Bedrock is disabled, unavailable, throttled, or returns invalid JSON, WanderWrap uses deterministic copy and continues normally.

Configuration:

```text
BEDROCK_ENABLED=true
BEDROCK_REGION=eu-west-2
BEDROCK_MODEL_ID=global.amazon.nova-2-lite-v1:0
```
