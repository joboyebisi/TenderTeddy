import { AgentOrchestrator, AgentRegistry, createAgentProposal } from './agent-orchestrator.mjs';
import { CAPABILITIES } from './provider-platform.mjs';
import { createDefaultProviderPlatform } from './provider-adapters.mjs';

const TOOL_CAPABILITY = Object.freeze({
  recommend_gifts: CAPABILITIES.RECOMMENDATION_RANK,
  create_gift_link: CAPABILITIES.GIFT_CLAIM_CREATE,
  create_group_gift: CAPABILITIES.GIFT_GROUP_CREATE,
  prepare_paypal_order: CAPABILITIES.PAYMENT_ORDER_PREPARE,
  route_gift: CAPABILITIES.FULFILLMENT_ROUTE,
  search_amazon_catalog: CAPABILITIES.CATALOGUE_SEARCH
});

export const defaultProviderPlatform = createDefaultProviderPlatform();

function providerContext(input, context = {}) {
  return {
    tenantId: context.tenantId ?? context.userId ?? '*',
    market: context.market ?? input.destinationCountry ?? input.market ?? null,
    currency: context.currency ?? input.currency ?? null,
    providerId: context.providerId ?? null,
    idempotencyKey: context.idempotencyKey ?? null,
    authorized: context.userApproved === true,
    allowFallback: context.allowFallback
  };
}

async function executeTool(platform, name, input, context = {}) {
  const capability = TOOL_CAPABILITY[name];
  if (!capability) throw new Error('Unknown tool');
  return platform.execute(capability, input, providerContext(input, context));
}

export function createToolSet({ platform = defaultProviderPlatform } = {}) {
  return Object.freeze(Object.fromEntries(Object.keys(TOOL_CAPABILITY).map(name => [name, async (input, context) => {
    const result = await executeTool(platform, name, input, context);
    return result.output;
  }])));
}

export const tools = createToolSet();

export function invokeTool(name, input, context) {
  if (!context?.userId) throw new Error('Authenticated user required');
  if (!context.approvedTools?.includes(name)) throw new Error('Tool approval required');
  if (!tools[name]) throw new Error('Unknown tool');
  const toolSet = context.toolSet ?? tools;
  return toolSet[name](input, {
    ...context,
    userApproved: input?.userApproved === true,
    idempotencyKey: context.idempotencyKey ?? `tool:${context.userId}:${name}`
  });
}

const TOOL_AGENT = Object.freeze({
  recommend_gifts: { agentId: 'recommendation-agent', proposedAction: 'present-recommendations', approvalRequired: false, capability: CAPABILITIES.RECOMMENDATION_RANK },
  search_amazon_catalog: { agentId: 'catalogue-agent', proposedAction: 'present-catalogue-results', approvalRequired: false, capability: CAPABILITIES.CATALOGUE_SEARCH },
  route_gift: { agentId: 'routing-agent', proposedAction: 'present-route', approvalRequired: false, capability: CAPABILITIES.FULFILLMENT_ROUTE },
  create_gift_link: { agentId: 'recipient-agent', proposedAction: 'create-claim', approvalRequired: true, capability: CAPABILITIES.GIFT_CLAIM_CREATE },
  create_group_gift: { agentId: 'group-gift-agent', proposedAction: 'create-group-gift', approvalRequired: true, capability: CAPABILITIES.GIFT_GROUP_CREATE },
  prepare_paypal_order: { agentId: 'transaction-agent', proposedAction: 'prepare-paypal-order', approvalRequired: true, capability: CAPABILITIES.PAYMENT_ORDER_PREPARE }
});

/** Build least-privilege, proposal-only workers around the existing domain tools. */
export function createToolAgentRegistry(tenantId, { preferenceProvider, platform } = {}) {
  const activePlatform = platform ?? (preferenceProvider ? createDefaultProviderPlatform({ preferenceProvider }) : defaultProviderPlatform);
  const registry = new AgentRegistry();
  for (const [toolName, definition] of Object.entries(TOOL_AGENT)) {
    registry.register({
      id: definition.agentId,
      tenantId,
      actions: { [toolName]: { consentRequired: true, approvalRequired: definition.approvalRequired } },
      handler: async request => {
        const executed = await executeTool(activePlatform, toolName, request.payload, {
          tenantId: request.tenantId,
          providerId: request.context?.providerId,
          idempotencyKey: request.idempotencyKey,
          userApproved: !definition.approvalRequired || Boolean(request.approvalArtifact)
        });
        return createAgentProposal(request, {
          proposedAction: definition.proposedAction,
          arguments: executed.output,
          evidence: request.context?.evidenceIds || [],
          confidence: request.context?.confidence ?? null,
          provider: executed.provider,
          capability: definition.capability
        });
      }
    });
  }
  if (activePlatform.discover({ tenantId, capability: CAPABILITIES.PREFERENCE_EXTRACT }).length) {
    registry.register({
      id: 'preference-intelligence-agent',
      tenantId,
      actions: { infer_preference_candidates: { consentRequired: true, approvalRequired: false } },
      timeoutMs: Math.min(30_000, Math.max(100, preferenceProvider.modelCard?.timeoutMs ?? 5_000)),
      handler: async request => {
        const executed = await activePlatform.execute(CAPABILITIES.PREFERENCE_EXTRACT, {
          ...request.payload, subjectId: request.actorId
        }, { tenantId: request.tenantId, providerId: request.context?.providerId, idempotencyKey: request.idempotencyKey });
        const result = executed.output;
        return createAgentProposal(request, {
          proposedAction: 'present-preference-confirmations',
          arguments: result,
          evidence: result.candidates.map(candidate => candidate.id),
          confidence: result.candidates.length
            ? Math.min(...result.candidates.map(candidate => candidate.confidence))
            : null,
          risks: result.status === 'unavailable' ? ['model-unavailable'] : [],
          provider: executed.provider,
          capability: CAPABILITIES.PREFERENCE_EXTRACT
        });
      }
    });
  }
  return registry;
}

export function createToolAgentOrchestrator({ tenantId, approvalSecret, clock, auditSink, preferenceProvider, platform } = {}) {
  if (!tenantId) throw new Error('tenantId is required');
  return new AgentOrchestrator({ registry: createToolAgentRegistry(tenantId, { preferenceProvider, platform }), approvalSecret, clock, auditSink });
}
