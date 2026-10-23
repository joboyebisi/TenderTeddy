# WanderWrap — Amazon Alexa+ hackathon PRD

## Entry thesis

WanderWrap is a voice-first gifting concierge exposed through a self-hosted MCP server. The Alexa+ demo converts a natural request into transparent gift ideas and a deliverable route, using Amazon catalogue/retail handoff for eligible physical gifts and a clearly disclosed PayPal/Xoom fallback when Amazon cannot satisfy the intent.

## Primary track

Alexa+. The attached event snapshot requires a self-hosted MCP server using protocol `2025-11-25` or later with Streamable HTTP, or an Agent Skill. This project chooses MCP so the same controlled tools can serve web/mobile and Alexa+.

## Demo user story

“Alexa, ask WanderWrap for a thoughtful Christmas gift for my sister in Toronto. She likes ceramics and slow weekends; keep it under £60.”

Alexa+ obtains confirmed preferences, calls `recommend_gifts`, checks delivery with `route_gift`, explains the winning idea, and returns an Amazon Canada handoff if a verified offer can deliver. In a second branch, Amazon is unavailable and the tool returns a PayPal-funded approved supplier route. A third short branch demonstrates an eligible Xoom money-gift handoff.

## Required product behavior

- remote `/mcp` endpoint supporting Streamable HTTP JSON-RPC;
- `initialize`, `tools/list` and `tools/call` for protocol `2025-11-25`;
- deterministic tool definitions and structured results;
- OAuth 2.1/PKCE and protected-resource metadata before Alexa onboarding;
- sub-500 ms tool response target excluding provider latency;
- tools distinguish recommendation/preparation from purchase;
- purchase intent hands off to Alexa+/provider confirmation, never a silent MCP transaction;
- meaningful confirmation data for subsequent questions;
- written confirmation and cancellation/refund guidance for completed commerce.

## Judging-aligned acceptance

- **Technical implementation:** live MCP introspection and tool calls are visible in the demo; provider decision is produced by code.
- **Design:** voice questions are short, recoverable and work without visuals.
- **Impact:** one agent handles physical, local and money gifts across recipient markets.
- **Idea quality:** the differentiator is a deliverability-aware, privacy-safe router rather than another gift list generator.

## Submission evidence

- public/open-source repository or correctly shared private repository as allowed by the event snapshot;
- under-three-minute public English demo;
- source and setup instructions;
- explicit list of changes made within the event window;
- product feedback/friction log for MCP Toolkit, Alexa AI CLI, simulator and any AWS services;
- AWS Builder mini-challenge evidence if deployed on AWS.

## Demo non-goals

- no claim of direct Amazon order placement through Creators API;
- no live money movement;
- no private social feed scraping;
- no unsupported assertion that Xoom exposes a public transfer API.

## Device-free development and demo acceptance

- Owning an Echo is not a prerequisite for development or the hackathon demo.
- The repository includes a web-based simulated Alexa+ conversation that calls the real MCP endpoint and visibly exposes the tool trace.
- Automated tests prove initialization, tool discovery, recommendation, routing and approval boundaries without hardware.
- The deployed add-on is exercised in Amazon's Alexa+ Web Simulator in both isolation and global-routing modes when preview access is available.
- Provider fixtures are clearly labelled and are never presented as live catalogue, availability or payment results.
- Physical-device testing is a later certification/production-quality activity if required by Amazon, not a blocker for the simulator-first hackathon path.
