# TenderTeddy connected family experience

## One journey

`Parent account → child profile → trusted library → parent-approved lesson → TV interaction → supportive feedback → parent insight → next lesson`

The mobile/web parent app owns account, children, permissions, content review and progress. Fire TV owns the large-screen lesson. Alexa/remote/onscreen choices are input methods for the same lesson session, not separate products.

## Core experience

1. Parent creates a protected account and a minimal child profile using display name and age band.
2. Parent chooses voice settings, daily rhythm and whether personalised practice is allowed. Raw child audio is off by default.
3. Parent discovers first-party/partner lessons or submits a link. The review records rights, embed eligibility, Made-for-Kids state and age/skill tags.
4. YouTube content is played only through supported embed/link behaviour. Interactive checkpoints are before or after playback; no overlays cover or alter the YouTube player. Owned/licensed content may support in-video checkpoints.
5. Pye previews the goal, plays the lesson, pauses at a permitted checkpoint, accepts voice or remote input, gives wait time and one scaffolded hint, then explains.
6. Progress records attempts and skills, not a judgement of the child. Early-literacy screening data may help calibrate content after validation but is not a diagnosis.
7. Parent sees plain-language evidence: what was practised, how much help was used, what to try next, and full export/delete controls.

## Content strategy

Launch with original demonstration lessons and licensed/partner content. Parent-added links are an acquisition and discovery tool, not a claim of affiliation with Alphablocks, Numberblocks, Blippi or Ms Rachel. Partnership tooling later adds publisher dashboards, rights windows, territories and learning-object metadata.

## Interaction design

- Pye asks one question at a time and offers an equivalent remote path.
- Voice sessions show a persistent listening state and easy mute.
- No manipulative streak loss, child advertising, public profiles or child-to-child messaging.
- Praise effort and explanation rather than speed.
- Parent gates protect purchases, settings, outbound links and data controls.
- TV focus order, large targets, captions, reduced motion and colour-independent feedback are required.

## Technical seams

The lesson engine emits deterministic events (`lesson.started`, `checkpoint.answered`, `hint.used`, `lesson.completed`). A session token pairs web/mobile with TV. Provider adapters cover speech, video understanding and content catalogues; Gemini can enrich owned/licensed videos but its output must pass schema validation and educator/parent review before use.
