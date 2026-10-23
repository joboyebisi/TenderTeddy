# TenderTeddy platform architecture

## Product surfaces

- **Fire TV app — primary child experience.** Ten-foot UI, Pye the π-shaped teddy guide, video playback, large answer choices and synchronized lesson state.
- **Alexa skill — voice companion.** Opens lessons, accepts short answers and repeats prompts. A Voice Remote is push-to-talk; compatible Cube/Omni devices or a linked Echo can be hands-free.
- **Parent web/mobile app — account and control plane.** Parents create the household, add child profiles, select content, approve goals, set time limits and review progress. Ship as a responsive PWA first; native wrappers can follow.
- **MCP server — agent/integration boundary.** Exposes narrow tools to plan a lesson, inspect approved progress and queue content for parent review. It is not an audio transport and never receives an always-on child microphone feed.

## Three-way interaction

1. Fire TV opens a checkpoint and writes `CHECKPOINT_OPENED` to the session service.
2. Alexa or the Voice Remote maps speech to a custom-skill intent and posts a signed `ANSWER_SUBMITTED` event.
3. The session service scores the answer and publishes the new state to Fire TV and the parent dashboard.
4. Fire TV animates Pye's feedback and resumes only after the learner or parent continues.

Use Amazon's Video Skills Kit for discovery, launch and supported playback control. Use a custom Alexa skill for TenderTeddy-specific learning intents. These are complementary integrations, not one continuous conversation socket.

## Hosting

AWS-first: Cognito (parent identity), API Gateway + Lambda (signed events), DynamoDB (household and session state), AppSync/WebSocket API (TV synchronization), S3/CloudFront (owned media), EventBridge (workflows), CloudWatch (audit). Gemini video analysis remains a replaceable Google adapter; no child data or raw viewing history is sent without verified parental consent.

Multi-cloud is provider isolation, not duplicated infrastructure: media-analysis jobs use a `VideoUnderstandingProvider` interface; all authoritative child/profile/session data remains in the selected home region.
