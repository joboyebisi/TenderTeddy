# Alexa+ capability and launch readiness

WanderWrap uses the Alexa+ MCP Toolkit because gifting does not fit a current category SDK. “Use all Alexa+ features” means implementing every capability relevant to this customer journey, not adding unrelated device permissions or payment methods.

| Alexa+ capability | WanderWrap implementation | Status |
|---|---|---|
| Streamable HTTP MCP | Stateless `POST /mcp`, protocol `2025-11-25`, content negotiation and origin checks | Implemented and tested |
| Tool discovery and calls | Six single-purpose tools with strict inputs, declared object outputs, annotations and approval gates | Implemented and tested |
| Voice-only baseline | Every tool returns a concise plain-text `voiceSummary`; no screen is required to finish discovery or routing | Implemented and tested |
| MCP Apps visuals | Hashed `ui://` resource served as `text/html;profile=mcp-app`, backed by the official MCP Apps SDK | Implemented and tested |
| Inline and fullscreen | Adaptive gift cards, route review and host-requested display-mode switching | Implemented locally |
| Device adaptation | Host context drives display mode/theme; local harness previews Echo Show 8/15, mobile and voice-only | Implemented locally |
| Touch interaction | Gift selection sends `ui/message` back into the Alexa+ conversation; purchase intent hands control to Alexa+ | Implemented locally |
| Accessibility | Voice/touch parity, semantic content, 48px targets, focus states, contrast-aware themes, reduced motion and listing alt text | Implemented baseline; device QA pending |
| Account linking | Protected Resource Metadata and scoped bearer boundary exist | OAuth 2.1 Authorization Code + PKCE S256, refresh-token and production token validation pending |
| Personalisation | Stable linked-user context is accepted by MCP and stored domain data already exists | Enabled after account linking |
| Generative AI | Amazon Bedrock Nova 2 Lite explains deterministic matches; IAM role auth, constrained prompts and deterministic fallback prevent an AI outage from blocking gifting | Implemented and tested locally; account invocation pending login |
| Payments | Discovery provides product context; Alexa+ owns confirmation, payment selection and PIN; no payment UI is embedded | UCP checkout endpoints and Amazon Pay/PSP onboarding pending |
| Store listing | `alexa/addon-package/addon.json`, six icon sizes, carousel art, privacy and terms pages | Draft complete; public asset verification pending deployment |
| Testing | 63 automated contracts plus local multimodal harness | Passing; Local Inspector, Web Simulator and real-device QA pending |
| Certification | Clear no-auto-purchase boundary, provider disclosures and customer-facing policies | Submission pending external onboarding and QA |

## Identity decision

Facebook and X login are not required. The recommended launch path is Login with Amazon for the lowest-friction Alexa account-linking journey, mapped to a WanderWrap user record. A WanderWrap OAuth 2.1/PKCE service backed by Cognito is the alternative if the companion web app needs first-party email accounts across channels.

Facebook or X can later be optional, revocable preference-data connectors. They should not be authentication dependencies, and X access must remain separate because its API permissions, costs and review constraints are unrelated to Alexa account linking.

## External launch gates

1. Alexa+ developer/add-on onboarding and final add-on ID.
2. Login with Amazon client details, or approval to build the Cognito-backed OAuth 2.1 facade.
3. Amazon Pay or supported PSP onboarding for Alexa+ UCP checkout.
4. Amazon Creators/Associates credentials and marketplace partner tags.
5. PayPal sandbox merchant credentials if PayPal supplier fulfilment remains in scope.
6. Local Inspector, Web Simulator, VoiceView, mobile, Echo Show and voice-only evidence.

No production deployment should occur until these gates and the companion web handoff are ready.
