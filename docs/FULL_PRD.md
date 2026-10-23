# TenderTeddy full product requirements document

Status: implementation baseline
Product stage: proof of concept moving into an end-to-end family alpha
Primary surface: responsive parent web app with a shared TV lesson experience

## 1. Product summary

TenderTeddy turns parent-approved educational video into short, two-way learning adventures. A parent creates a protected family space, adds a minimal child profile, reviews a video or original lesson, selects a learning goal, and approves the resulting experience. On the shared screen, Pye—the original TenderTeddy guide—asks short questions, accepts voice or remote answers, scaffolds mistakes, and records plain-language learning evidence for the parent.

TenderTeddy is not an open child chatbot, a diagnostic product, a video re-hosting service, or a substitute for a teacher. Its job is to make carefully selected screen time more active, supportive, and legible to families.

## 2. Problem

Children already respond verbally and physically to educational media, but most video cannot hear or adapt to them. Parents have little visibility into whether a child understood a concept, and many adaptive products reward speed, streaks, or more screen time instead of thoughtful practice.

Parents need a safe way to:

- choose the content and learning goal;
- let a child answer by voice, remote, or touch;
- receive age-appropriate support after a mistake;
- understand what was practised without labelling the child; and
- retain control of audio, records, time limits, and deletion.

## 3. Product principles

1. Parent approval is a hard gate before child access.
2. Ask one question at a time and allow 5–8 seconds of thinking time.
3. Praise effort and explanation, not speed or passive consumption.
4. Never represent an incorrect answer as correct.
5. First miss: give a scaffolded hint. Second miss: model the skill together.
6. Voice must always have a remote/touch equivalent.
7. Raw child audio is off by default and is not required for progress.
8. Screening guides practice; it does not diagnose, rank, or label a child.
9. Third-party video remains in its official player with its branding and controls.
10. No child advertising, public profiles, social graph, free chat, or manipulative streak loss.

## 4. Target users

### Primary: parent or guardian

An adult who wants educational screen time to be more active and who expects clear privacy, content, and time controls. The parent owns the account, approves every child-facing lesson, and can export or delete records.

### Secondary: child learner

Initially ages 3–11, with the first learning depth concentrated on ages 5–7 and early literacy. The child uses a ten-foot TV UI or a responsive shared-device UI and does not create an account.

### Future: educator or licensed content partner

An approved reviewer who can validate generated checkpoints or manage rights-aware learning material. This role is not required for the first family alpha.

## 5. Core journey

`Parent account → child profile → privacy and voice settings → trusted content review → learning goal → checkpoint preview → parent approval → paired/shared-screen lesson → supportive feedback → parent insight → next lesson`

### 5.1 First-run success

A new parent should be able to create one child profile, review one supported source, approve one short lesson, complete one checkpoint, and see one progress event in under ten minutes.

### 5.2 Returning-family success

A returning parent lands on a useful “today” view with a resumable lesson, time-limit context, and one explainable next recommendation.

## 6. Functional requirements

### FR-1 Parent account and household

- The product must identify a parent before displaying private family data in production.
- A household can contain multiple child profiles.
- Parent-only areas require a parent gate; production must support re-authentication or a PIN.
- Invite links may identify a household invitation but must not include child data.

### FR-2 Child profiles

- Required fields: display name and age band.
- Optional fields: avatar and preferred input mode.
- Voice during lessons defaults off for a newly created child unless the parent explicitly enables it.
- Raw audio retention defaults off and requires a separate, explicit consent control.
- The parent can update, export, and delete a child profile and associated learning records.

### FR-3 Content discovery and review

- Supported launch modes are owned/original content, licensed partner content, and parent-selected YouTube discovery.
- Every content item stores provider, canonical URL, rights basis, embed status, age range, learning tags, and moderation/review state.
- Unsupported or non-embeddable sources remain external links and cannot become interactive lessons.
- Named programmes such as Alphablocks, Numberblocks, Blippi, and Ms Rachel are examples or partnership targets only; the product must not imply affiliation or bundle their media without permission.

### FR-4 Lesson authoring and approval

- A lesson contains a content item, child/age band, learning objective, and one or more checkpoints.
- Checkpoints include skill, prompt, accepted answers, hints, placement, and optional explanation.
- YouTube discovery checkpoints may appear only before or after official playback.
- Owned or licensed content may support in-video checkpoints when rights permit.
- Generated checkpoints are candidates until an educator or parent reviews and approves them.
- No lesson becomes child-visible without explicit parent approval.

### FR-5 TV/shared-screen session

- A parent can start locally or send an approved lesson to a paired TV.
- Pairing codes and device tokens must be short-lived in production.
- The session has deterministic states: ready, playing, checkpoint, feedback, resumed, completed, or stopped.
- Fire TV, Alexa, remote, touch, and parent controls map to the same authoritative session.
- A parent can stop the session immediately.

### FR-6 Checkpoint interaction

- The UI presents one prompt and a small number of large answer choices.
- The child can answer through any enabled input mode.
- The transcript or interpreted answer is visible and correctable when speech is used.
- The first incorrect attempt returns a verbal scaffold and another try.
- A repeated miss models the answer or skill without shame.
- A correct answer records the attempt count, offers a short explanation prompt, and resumes only after the learner or parent continues.

### FR-7 Progress and recommendations

- Progress records skill, lesson, checkpoint, attempt count, input channel, outcome, hints used, and time—not raw audio by default.
- Parents see what was practised, how much support was used, and a recommended next step.
- Recommendations must be traceable to recent practice and must avoid diagnostic language.
- Points or stars reward practice and cooperation; they must not drive excessive screen time.

### FR-8 Early-literacy screening

- The screening adapter covers phonological awareness, letter–sound knowledge, decoding, fluency, and comprehension.
- Results produce a practice band and focus areas, with visible limitations and a “not a diagnosis” statement.
- Dataset import requires a verified licence, provenance, consent basis, label definition, age/language distribution, missingness review, leakage controls, and subgroup evaluation.
- Real source columns are mapped through a versioned adapter; application code must not depend on guessed dataset columns.

### FR-9 Gemini/video understanding

- Video analysis accepts only owned/licensed uploads or approved public YouTube URLs.
- The request contains no child voice, face, private profile, or private viewing history.
- The system stores provider, model version, prompt version, source rights, and reviewer decision.
- Model output must pass schema validation and human review before child use.

### FR-10 Data controls and safety

- Parents can view consent state, mute voice, change retention, export data, and delete records.
- Sensitive actions require the parent gate.
- All authorization is household-scoped; knowing an identifier is never sufficient access.
- Production services keep an audit trail for consent, approval, deletion, pairing, and moderation actions.
- Child data is not used for behavioural advertising.

## 7. Experience requirements

- Ten-foot controls have large targets, obvious focus, captions, reduced-motion support, and colour-independent feedback.
- Web and mobile layouts are responsive and keyboard accessible.
- Listening state is persistent and unambiguous; mute is always reachable.
- Empty, loading, offline, unavailable-video, rejected-content, and no-result states are designed—not silent failures.
- Parent-facing explanations use plain language and never overstate evidence.

## 8. Data model

### Parent

`id`, `householdId`, `email`, `displayName`, `createdAt`

### ChildProfile

`id`, `householdId`, `displayName`, `ageBand`, `avatar`, `voiceEnabled`, `rawAudioStored=false`, `personalisedPractice`, `dailyLimitMinutes`, `createdAt`, `updatedAt`

### ContentItem

`id`, `householdId`, `provider`, `url`, `title`, `rightsBasis`, `embeddable`, `madeForKidsChecked`, `ageMin`, `ageMax`, `skills[]`, `status`, `reviewedAt`

### Lesson

`id`, `householdId`, `childId`, `contentId`, `title`, `skill`, `ageBand`, `checkpoints[]`, `status`, `approvedAt`

### Checkpoint

`id`, `skill`, `prompt`, `acceptedAnswers[]`, `hints[]`, `placement`, `explanation`

### LessonSession

`id`, `householdId`, `childId`, `lessonId`, `deviceId`, `status`, `checkpointId`, `answers[]`, `startedAt`, `completedAt`

### ProgressEvent

`id`, `householdId`, `childId`, `lessonId`, `checkpointId`, `skill`, `correct`, `attempts`, `hintsUsed`, `inputChannel`, `occurredAt`, `rawAudioStored=false`

### ScreeningResult

`id`, `childId`, `modelVersion`, `scoreBand`, `focus[]`, `limitations[]`, `createdAt`

## 9. Technical architecture

- Parent control plane: responsive PWA first; native wrappers may follow.
- Child surface: Fire TV application with a shared responsive web simulator during alpha.
- Voice: custom Alexa skill for TenderTeddy intents; Fire TV Video Skills Kit for supported discovery/playback controls.
- Authoritative production state: AWS Cognito, API Gateway/Lambda, DynamoDB, AppSync/WebSocket, EventBridge, CloudWatch, and S3/CloudFront for owned media.
- Provider boundaries: `SpeechProvider`, `VideoUnderstandingProvider`, and rights-aware content adapters.
- MCP exposes narrow parent-approved planning and progress tools; it is never an always-on audio channel.
- Local development may use a file-backed repository behind the same domain contracts; migration to AWS must not change the client journey.

## 10. Non-functional requirements

- Security: household-scoped authorization, signed device events, rate limits, secrets outside source, and least-privilege service roles.
- Privacy: data minimisation, consent history, defined retention, export/delete workflow, and home-region storage for authoritative family data.
- Reliability: idempotent event ingestion, reconnect-safe session state, and replay protection for signed TV/Alexa events.
- Performance: interactive state changes should feel immediate; target p95 under 300 ms for non-media API calls in-region.
- Accessibility: WCAG 2.2 AA target for the parent web app and equivalent TV focus/caption requirements.
- Observability: structured logs and metrics without raw child utterances or unnecessary identifiers.

## 11. Alpha scope

The first complete alpha includes:

1. persistent local household and child profile;
2. privacy, voice, and daily-limit settings;
3. rights-aware content review;
4. one parent-approved literacy lesson;
5. remote/touch checkpoint attempts with scaffolded feedback;
6. persistent progress evidence and a parent summary; and
7. deterministic session events that can later synchronize Fire TV and Alexa.

Not in the first alpha: production identity, billing, partner dashboards, live Alexa certification, automated Kaggle model training, or child-facing generative conversation.

## 12. Success measures

- Setup completion: percentage of new parents who create a profile and approve a first lesson.
- First learning loop: percentage who complete at least one checkpoint and view its progress evidence.
- Safety integrity: zero child-visible lessons without an approval record; zero raw-audio records when retention is off.
- Interaction quality: completion rate, retry rate, hint use, and voluntary explanation—not answer speed alone.
- Parent trust: control comprehension, content rejection reasons understood, and export/delete completion.
- Retention: families returning for another parent-approved lesson without increasing daily screen limits.

## 13. Release gates

- Production authentication and row-level household authorization are verified.
- Content rights and YouTube player behavior pass policy review.
- Parent approval cannot be bypassed in API or client paths.
- Raw audio is not retained unless explicit, auditable consent is active.
- Export and deletion are tested end to end.
- Accessibility review covers keyboard, screen reader, captions, reduced motion, and TV focus.
- Dataset licence/provenance and subgroup evaluation are documented before screening influences recommendations.

## 14. Implementation sequence

1. Family alpha vertical slice: persistent profiles, review, approval, attempts, progress.
2. Parent authentication, household authorization, consent history, export/delete.
3. TV pairing and live session synchronization.
4. Alexa custom-skill adapter and signed event ingestion.
5. Lesson-authoring workflow and reviewed video-understanding candidates.
6. Production AWS persistence, audit, observability, and deployment.
7. Licensed catalogue and partner tooling after legal/content agreements.

## 15. Acceptance scenario

Given a parent with no existing family state, when they create a child profile with voice disabled, review an eligible source, approve a phonics lesson, and begin a shared-screen session, then the child can answer by remote/touch, receive a hint after an incorrect first attempt, complete the checkpoint after a correct answer, and the parent can see a progress record containing the skill and attempts while `rawAudioStored` remains `false`.
