# TenderTeddy

TenderTeddy turns parent-approved educational video into short, two-way learning adventures. Parents create an account, add children, approve a source, and choose a learning goal. On TV, Pye runs checkpoints around YouTube playback or within owned/licensed lessons, accepts Alexa/remote input, scaffolds the child, awards stars, and reports progress to the parent.

Run `npm start`, then open `http://localhost:4201`. Run `npm test` for the content, checkpoint and literacy-screening domain tests.

Run `npm run test:e2e` for an isolated full-family smoke test. For the hosted pre-demo
check and the least disruptive Fire TV install path, follow
`docs/FIRE_TV_TESTING.md`. Live-service credentials and remaining production gates are
listed in `docs/CREDENTIALS_AND_LIVE_SERVICES.md`.

The local alpha now persists family state to `data/family.json` at runtime and exposes the end-to-end journey through `/api/family`, child-profile, content-review, lesson, session and answer endpoints. Start on the marketing page to create a safe profile, then continue in the family app.

Open `http://localhost:4201/test-lab.html` for the local device lab. It combines a keyboard/D-pad Fire TV simulator, an Alexa request-envelope simulator and an authoritative shared-session event timeline.

An installable Fire TV shell now lives in `android/`. It loads the same device lab from the TenderTeddy computer over local Wi-Fi, supports D-pad/Select navigation, and lets a tester change the server address with the remote's Menu button. See `android/README.md` for build and sideload instructions.

The Kaggle Early Literacy Screening dataset is represented by a documented adapter boundary. Its exact schema and licence must be validated after an authorised download; this prototype does not pretend guessed columns are real data.

See `docs/PLATFORM_ARCHITECTURE.md` for Fire TV/Alexa/MCP synchronization and `docs/CONTENT_AND_GEMINI.md` for the YouTube and Gemini boundary.

The consolidated implementation baseline is in `docs/FULL_PRD.md`.

The hosted-alpha infrastructure is defined in `infra/template.yaml`. It uses Lambda,
API Gateway, DynamoDB and Secrets Manager without storing cloud or Gemini credentials
in the repository. See `docs/DEPLOYMENT.md` for the browser-login deployment flow and
the authentication release gate.
