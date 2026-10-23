# TenderTeddy agent checkpoint

Read this file before changing the project. Update it whenever a work session changes
the verified state, release gates, deployment URL, or next actions. Never record secret
values here, in source, in chat summaries, or in Git.

## Last verified checkpoint — 23 October 2026

- Git is initialized on `main` with origin
  `https://github.com/joboyebisi/WanderWrap.git`, as supplied by the owner.
- `npm test` passes 24/24 tests and `npm run check` passes.
- `npm run test:e2e` runs an isolated local full-family smoke test and cleans up its
  temporary child, lesson, session, and progress records.
- Hosted alpha: `https://kb03uya0w8.execute-api.eu-west-2.amazonaws.com/`.
- Hosted `/api/health` is live and reports `aiConfigured: true`, but the 23 October
  hosted E2E run received HTTP 503 while waiting for lesson generation. The local fix
  bounds each Gemini attempt to 10 seconds; it must be deployed and re-tested.
- Hosted Fire TV APK is live at `/downloads/TenderTeddy-firetv-debug.apk`.
- The Android shell package is `com.tenderteddy.firetv`. A normal debug build defaults
  to the hosted device lab; Menu lets a tester override the URL.
- `scripts/install-fire-tv.ps1` uses `adb install -r`, which preserves app data and
  launches TenderTeddy. It requires Android SDK Platform-Tools and the Fire TV IP.
- AWS CLI has no local `tenderteddy` profile in this workspace. Use browser-based
  `aws login`; do not create or request long-lived AWS access keys.
- Gemini is the implemented AI provider. Claude on Bedrock is optional and is not
  currently wired into the application.

## Honest product state

The hosted alpha is suitable for fictional/demo data only. It has a shared household
and no production parent authentication. The Alexa route is an envelope simulator,
not a deployed/certified Alexa skill. YouTube eligibility flags are currently supplied
by the parent UI rather than verified through the YouTube Data API. These are real
release gates, not documentation tasks.

## Next actions

1. Deploy the bounded Gemini timeout and repeat the hosted AI-required E2E test.
2. Install Android SDK Platform-Tools or locate `adb`, then run the Fire TV install
   command in `docs/FIRE_TV_TESTING.md` against the physical device.
3. Add Cognito household authorization before any real child/family data is entered.
4. Create/configure an Alexa custom skill only if voice is part of the judged demo.
5. Add server-side YouTube verification before claiming automated content eligibility.

## Secret handling

- `.env.example` must contain names/placeholders only.
- `.env`, AWS profiles, Android resources, logs, screenshots, and Git must not contain
  copied credentials.
- Store the Gemini key in the stack-created Secrets Manager secret.
- If any real key is pasted into an editor, chat, or terminal command, rotate it before
  deployment even if it was later deleted.
