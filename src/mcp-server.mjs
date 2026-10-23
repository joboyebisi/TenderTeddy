import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { invokeTool } from './mcp-tools.mjs';

export const PROTOCOL_VERSION = '2025-11-25';
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';

const UI_HTML_URL = new URL('../alexa/dist/index.html', import.meta.url);
let uiHtmlPromise;

async function loadUiHtml() {
  uiHtmlPromise ||= readFile(UI_HTML_URL, 'utf8');
  return uiHtmlPromise;
}

const uiHash = createHash('sha256').update(await loadUiHtml()).digest('hex').slice(0, 12);
export const UI_RESOURCE_URI = `ui://wanderwrap/gift-board-${uiHash}.html`;

const objectOutput = (properties, required = Object.keys(properties)) => ({
  type: 'object', properties, required, additionalProperties: true
});

const commonUiMeta = {
  ui: { resourceUri: UI_RESOURCE_URI, visibility: ['model', 'app'] },
  'ui/resourceUri': UI_RESOURCE_URI
};

const TOOL_DEFINITIONS = [
  tool({
    name: 'recommend_gifts', title: 'Find thoughtful gifts',
    description: 'Find and rank up to four gift ideas using only recipient preferences the customer has confirmed. Use this before routing or checkout. Returns concise spoken context and structured cards for a screen.',
    properties: { recipient: { type: 'object', description: 'Confirmed preferences, including budget, signals and exclusions.' }, catalog: { type: 'array', description: 'Optional trusted catalog override.', items: { type: 'object' } } },
    required: ['recipient'],
    outputSchema: objectOutput({ voiceSummary: { type: 'string' }, recommendations: { type: 'array', items: { type: 'object' } }, nextAction: { type: 'string' } }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
  }),
  tool({
    name: 'route_gift', title: 'Check gift fulfilment',
    description: 'Choose an eligible Amazon, PayPal, Xoom, or manual-review route for one selected gift. This does not purchase, charge, or transfer money. Always explain the route and require confirmation before an external handoff.',
    properties: { giftKind: { enum: ['physical', 'experience', 'digital', 'money'] }, destinationCountry: { type: 'string' }, senderCountry: { type: 'string' }, amazonOffer: { type: 'object' }, paypalAvailable: { type: 'boolean' }, xoomAvailable: { type: 'boolean' }, alternateSupplier: { type: 'object' } },
    required: ['giftKind', 'destinationCountry', 'senderCountry'],
    outputSchema: objectOutput({ voiceSummary: { type: 'string' }, route: { type: 'string' }, reason: { type: 'string' }, requiresUserApproval: { type: 'boolean' }, autoPurchase: { type: 'boolean' } }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
  }),
  tool({
    name: 'create_gift_link', title: 'Create a private gift claim',
    description: 'After explicit customer approval, create a private recipient claim flow for the selected recommendation. Never infer approval.',
    properties: { senderId: { type: 'string' }, recipientId: { type: 'string' }, recommendationId: { type: 'string' }, country: { type: 'string' }, userApproved: { const: true, description: 'True only after explicit customer confirmation.' } },
    required: ['senderId', 'recipientId', 'recommendationId', 'userApproved'],
    outputSchema: objectOutput({ voiceSummary: { type: 'string' }, giftLink: { type: 'object' }, nextAction: { type: 'string' } }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }),
  tool({
    name: 'create_group_gift', title: 'Start a group gift',
    description: 'After explicit customer approval, create a group-gift target in integer minor currency units. This creates a collection record but takes no payment.',
    properties: { organizerId: { type: 'string' }, title: { type: 'string' }, targetMinorUnits: { type: 'integer', minimum: 1 }, currency: { type: 'string' }, userApproved: { const: true } },
    required: ['organizerId', 'title', 'targetMinorUnits', 'userApproved'],
    outputSchema: objectOutput({ voiceSummary: { type: 'string' }, groupGift: { type: 'object' }, nextAction: { type: 'string' } }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }),
  tool({
    name: 'prepare_paypal_order', title: 'Prepare supplier checkout',
    description: 'After explicit customer approval, prepare but do not capture a PayPal supplier order using server-validated product data. Alexa+ owns purchase confirmation and payment selection.',
    properties: { sku: { type: 'string' }, description: { type: 'string' }, quantity: { type: 'integer', minimum: 1 }, unitMinor: { type: 'integer', minimum: 1 }, currency: { type: 'string' }, giftLinkId: { type: 'string' }, userApproved: { const: true } },
    required: ['sku', 'description', 'unitMinor', 'giftLinkId', 'userApproved'],
    outputSchema: objectOutput({ voiceSummary: { type: 'string' }, order: { type: 'object' }, nextAction: { type: 'string' } }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }),
  tool({
    name: 'search_amazon_catalog', title: 'Search an Amazon marketplace',
    description: 'Build a server-side Amazon Creators API search for a supported recipient marketplace. Never state price, stock, or delivery unless returned by the live provider response.',
    properties: { keywords: { type: 'string' }, destinationCountry: { type: 'string' }, partnerTag: { type: 'string' } },
    required: ['keywords', 'destinationCountry', 'partnerTag'],
    outputSchema: objectOutput({ voiceSummary: { type: 'string' }, request: { type: 'object' }, nextAction: { type: 'string' } }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true }
  })
];

const WRITE_TOOLS = new Set(['create_gift_link', 'create_group_gift', 'prepare_paypal_order']);

export async function handleMcpRequest(message, context = {}) {
  if (!message || message.jsonrpc !== '2.0') return failure(message?.id ?? null, -32600, 'Invalid Request');
  if (message.method === 'initialize') return success(message.id, {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, extensions: { 'io.modelcontextprotocol/ui': {} } },
    serverInfo: { name: 'wanderwrap', version: '0.5.0', description: 'Multimodal gifting companion for Alexa+' },
    instructions: 'Help the customer discover and route thoughtful gifts. Speak voiceSummary naturally. Use structured content for visuals. Never purchase, capture payment, disclose a private address, or transfer money without the provider flow and explicit customer confirmation.'
  });
  if (message.method === 'notifications/initialized') return null;
  if (message.method === 'tools/list') return success(message.id, { tools: TOOL_DEFINITIONS });
  if (message.method === 'resources/list') return success(message.id, { resources: [uiResourceDescriptor()] });
  if (message.method === 'resources/read') {
    if (message.params?.uri !== UI_RESOURCE_URI) return failure(message.id, -32002, 'Unknown resource');
    return success(message.id, { contents: [{
      uri: UI_RESOURCE_URI, mimeType: MCP_APP_MIME_TYPE, text: await loadUiHtml(),
      _meta: { ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: [] }, permissions: {}, supportedDisplayModes: ['inline', 'fullscreen'] } }
    }] });
  }
  if (message.method === 'tools/call') {
    const name = message.params?.name;
    const args = message.params?.arguments || {};
    if (WRITE_TOOLS.has(name) && args.userApproved !== true) return failure(message.id, -32001, 'Explicit user approval required');
    try {
      const value = await invokeTool(name, args, {
        userId: context.userId,
        tenantId: context.tenantId,
        providerId: context.providerSelections?.[name],
        toolSet: context.toolSet,
        idempotencyKey: `mcp:${context.userId}:${message.id}:${name}`,
        approvedTools: context.approvedTools || TOOL_DEFINITIONS.map(item => item.name)
      });
      const structuredContent = await presentToolResult(name, value, context);
      return success(message.id, { content: [{ type: 'text', text: structuredContent.voiceSummary }], structuredContent, _meta: { 'wanderwrap/resultVersion': '1.0' } });
    } catch (error) {
      return success(message.id, { isError: true, content: [{ type: 'text', text: `WanderWrap could not complete that step: ${error.message}` }] });
    }
  }
  return failure(message.id, -32601, 'Method not found');
}

async function presentToolResult(name, value, context) {
  if (name === 'recommend_gifts') {
    const top = value[0];
    const enrichment = context.enrichRecommendations ? await context.enrichRecommendations(value) : null;
    const recommendations = enrichment ? value.map(item => ({ ...item, aiNarrative: enrichment.narratives[item.id] || item.story })) : value;
    return { voiceSummary: enrichment?.summary || (top ? `I found ${value.length} ideas. My top suggestion is ${top.name} at about ${top.price} pounds. ${top.story}` : 'I could not find an idea within those preferences yet.'), recommendations, aiGenerated: Boolean(enrichment?.generated), nextAction: top ? 'Choose an idea to check fulfilment.' : 'Ask for a different budget or interest.' };
  }
  if (name === 'route_gift') return { ...value, voiceSummary: `${friendlyRoute(value.route)}. ${value.reason}. Nothing has been purchased.` };
  if (name === 'create_gift_link') return { voiceSummary: 'The private gift claim is ready to share. No address or payment has been collected yet.', giftLink: value, nextAction: 'Share the private claim with the recipient.' };
  if (name === 'create_group_gift') return { voiceSummary: `The group gift target is ready in ${value.currency}. No contributions have been charged.`, groupGift: value, nextAction: 'Invite contributors.' };
  if (name === 'prepare_paypal_order') return { voiceSummary: 'The supplier order is prepared for review. It has not been captured or paid.', order: value, nextAction: 'Ask the customer to continue to Alexa+ checkout.' };
  if (name === 'search_amazon_catalog') return { voiceSummary: 'The Amazon marketplace search is ready. Live availability, delivery, and price still need verification.', request: value, nextAction: 'Run the provider search and present verified offers.' };
  return { voiceSummary: 'WanderWrap completed the step.', result: value };
}

function friendlyRoute(route) {
  return ({ 'amazon-retail-handoff': 'This gift can continue on the recipient’s Amazon marketplace', 'paypal-merchant-checkout': 'This gift can continue with an approved PayPal supplier', 'paypal-value-gift': 'A PayPal value gift is available instead', 'paypal-send-handoff': 'A PayPal money-gift handoff is available', 'xoom-handoff': 'An eligible Xoom cross-border handoff is available', 'manual-review': 'This gift needs a manual fulfilment review' })[route] || 'A fulfilment route is ready';
}

function uiResourceDescriptor() {
  return { uri: UI_RESOURCE_URI, name: 'WanderWrap gift board', title: 'WanderWrap gift board', description: 'Accessible adaptive gift recommendations and fulfilment review.', mimeType: MCP_APP_MIME_TYPE, _meta: { ui: { supportedDisplayModes: ['inline', 'fullscreen'] } } };
}

function tool({ name, title, description, properties, required = [], outputSchema, annotations }) {
  return { name, title, description, inputSchema: { type: 'object', properties, required, additionalProperties: false }, outputSchema, annotations: { title, ...annotations }, _meta: commonUiMeta };
}

function success(id, result) { return { jsonrpc: '2.0', id, result }; }
function failure(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
