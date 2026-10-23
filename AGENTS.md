# WanderWrap agent operating notes

Before changing this repository, read `PROJECT_STATE.md`, then the relevant product and technical documents it links. Treat `PROJECT_STATE.md` as the durable handoff between sessions and update its checkpoint, verification result, blockers, and next actions after material work.

Never place credentials, access tokens, customer data, or private provider responses in this repository. Use `.env.example` only for empty placeholders and store real deployed secrets in AWS Secrets Manager or the deployment platform's encrypted secret store.

Do not describe fixture catalogue availability, simulated Alexa behaviour, prepared payment payloads, or routing decisions as live transactions. A capability is live only after its credential, provider sandbox, webhook/signature verification, and end-to-end evidence gates in `docs/LIVE_INTEGRATION_CHECKLIST.md` pass.

Run `npm run check` before handing off code changes. Run `npm run test:e2e` when the MCP server, authentication boundary, recommendation path, routing path, simulator, or approval behaviour changes.
