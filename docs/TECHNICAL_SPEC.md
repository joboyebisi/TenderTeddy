# TenderTeddy technical specification

## Current vertical slice
Responsive parent marketing/onboarding experience, interactive TV checkpoint, child profile modal, referral interaction, content policy gate, adaptive checkpoint logic and literacy-screening domain module.

## Production services
- Parent identity and child-profile service with strict row-level authorization.
- Content catalog storing provider URL, embed status, rights basis, learning objectives, age range and moderation state.
- Lesson authoring service for timestamped checkpoints; no video downloading or re-hosting.
- TV pairing service using short-lived codes and device-bound tokens.
- Speech adapter with ephemeral processing and no raw-audio retention by default.
- Progress store for skill, attempt count and outcome—not behavioural advertising.
- Screening adapter with versioned dataset/model card, validation metrics and human-readable limitations.

## Data contracts
`Parent`, `ChildProfile(displayName,ageBand,avatar,micDefault)`, `ContentItem(provider,url,rightsBasis,status)`, `Lesson(checkpoints[])`, `Checkpoint(skill,prompt,acceptedAnswers,hints[])`, `ProgressEvent(rawAudioStored=false)`, `ScreeningResult(modelVersion,scoreBand,focus[],limitations[])`.

## Safety and rights
Use official YouTube embed/player interfaces only, retain the standard player, validate availability and provide a provider-link fallback. Children have no public profiles, free chat, targeted advertising or social graph. Parent approval, deletion/export, retention and moderation are release gates.
