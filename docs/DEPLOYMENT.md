# TenderTeddy AWS deployment

## Current hosted alpha

- App: `https://kb03uya0w8.execute-api.eu-west-2.amazonaws.com/`
- Fire TV APK: `https://kb03uya0w8.execute-api.eu-west-2.amazonaws.com/downloads/TenderTeddy-firetv-debug.apk`
- Region: `eu-west-2`
- Stack: `tenderteddy-alpha`

The deployed APK opens the hosted `/test-lab.html` endpoint by default. It is a
debug-signed sideload build, not an Amazon Appstore release.

The hosted alpha uses one HTTPS API Gateway endpoint backed by Lambda. Lambda serves
the web/Fire TV assets, persists the family state in encrypted DynamoDB, and reads the
Gemini key from AWS Secrets Manager. CloudFormation creates least-privilege execution
permissions; no AWS access keys are stored in this repository.

## Resources

- API Gateway HTTP API for the web, Fire TV assets and JSON API.
- Lambda (`arm64`, Node.js 22) for the existing domain/API layer.
- DynamoDB on-demand table with encryption and point-in-time recovery.
- Secrets Manager secret containing `GEMINI_API_KEY`.
- CloudWatch logs created automatically by Lambda.

## Deploy

Bootstrap once from an AWS CLI browser login rather than a permanent access key. The
current root browser session may create the two roles and pass the execution role to
CloudFormation, but AWS does not allow root to assume the deployment role:

```powershell
aws login --profile tenderteddy --region eu-west-2
aws cloudformation deploy --template-file .\infra\bootstrap.yaml --stack-name tenderteddy-deployment-bootstrap --capabilities CAPABILITY_NAMED_IAM --profile tenderteddy --region eu-west-2
.\scripts\deploy-aws.ps1
```

For ongoing non-root deployment, use an existing IAM Identity Center or IAM profile
that is permitted to call `sts:AssumeRole` on `TenderTeddyDeploymentRole`:

```powershell
aws configure set profile.tenderteddy-deployer.role_arn arn:aws:iam::YOUR_ACCOUNT_ID:role/TenderTeddyDeploymentRole
aws configure set profile.tenderteddy-deployer.source_profile YOUR_NON_ROOT_PROFILE
aws configure set profile.tenderteddy-deployer.region eu-west-2
.\scripts\deploy-aws.ps1 -Profile tenderteddy-deployer
```

The deployment script creates a private, encrypted artifact bucket, packages only the
runtime files under `infra/package`, delegates resource changes to the separate
CloudFormation execution role, deploys the stack, and prints the hosted URL and secret
identifier. The root browser session is bootstrap-only and no permanent access key is
created.

## Configure Gemini safely

The stack deliberately creates an empty secret. Revoke any key that has appeared in a
chat, terminal history or source file. Create a replacement in Google AI Studio, then
put it directly into the stack's Secrets Manager secret as:

```json
{"GEMINI_API_KEY":"your-new-key"}
```

Do not add the value to `.env`, CloudFormation parameters, Android resources or source
control. The Lambda role can read only the created secret.

## Release gate

This stack is a hosted alpha with one shared household. Do not enter real child data.
Cognito parent authentication and per-household authorization are required before a
family beta.
