import { createHash } from 'node:crypto';

export const CHANNEL_ENVELOPE_SCHEMA = 'wanderwrap.channel.inbound.v1';
export const CHANNEL_RESPONSE_SCHEMA = 'wanderwrap.channel.response.v1';
export const CHANNELS = Object.freeze(['web', 'mobile', 'alexa', 'x', 'facebook', 'telegram', 'slack', 'teams']);

const CHANNEL_SET = new Set(CHANNELS);
const TRUST_LEVELS = new Set(['authenticated', 'linked', 'unverified']);
const clone = value => value == null ? value : structuredClone(value);

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value;
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function createInboundChannelEnvelope(input, { now = Date.now } = {}) {
  if (!CHANNEL_SET.has(input?.channel)) throw new TypeError('unsupported channel');
  if (!TRUST_LEVELS.has(input.actor?.trust)) throw new TypeError('invalid actor trust');
  const eventId = required(input.eventId, 'eventId');
  const tenantId = required(input.tenantId, 'tenantId');
  const externalActorId = required(input.actor.externalActorId, 'actor.externalActorId');
  const receivedAt = input.receivedAt || new Date(now()).toISOString();
  if (!Number.isFinite(Date.parse(receivedAt))) throw new TypeError('receivedAt must be a valid date');
  const envelope = {
    schemaVersion: CHANNEL_ENVELOPE_SCHEMA,
    eventId,
    idempotencyKey: `${input.channel}:${eventId}`,
    correlationId: input.correlationId || `${input.channel}:${eventId}`,
    channel: input.channel,
    tenantId,
    actor: {
      externalActorId,
      internalUserId: input.actor.internalUserId || null,
      identityLinkId: input.actor.identityLinkId || null,
      trust: input.actor.trust
    },
    conversation: {
      id: required(input.conversation?.id, 'conversation.id'),
      kind: input.conversation.kind || 'direct',
      replyTo: input.conversation.replyTo || null
    },
    interaction: {
      type: required(input.interaction?.type, 'interaction.type'),
      intent: input.interaction.intent || null,
      payload: clone(input.interaction.payload ?? {})
    },
    authorization: {
      scopes: Object.freeze([...(input.authorization?.scopes ?? [])]),
      consentReceiptId: input.authorization?.consentReceiptId || null
    },
    locale: input.locale || 'en-GB',
    receivedAt,
    sourceDigest: input.sourceDigest || digest(input.sourceReference ?? { eventId, externalActorId })
  };
  return freezeDeep(envelope);
}

export function createChannelResponse(envelope, input) {
  if (envelope?.schemaVersion !== CHANNEL_ENVELOPE_SCHEMA) throw new TypeError('valid inbound envelope required');
  return freezeDeep({
    schemaVersion: CHANNEL_RESPONSE_SCHEMA,
    eventId: envelope.eventId,
    correlationId: envelope.correlationId,
    channel: envelope.channel,
    conversationId: envelope.conversation.id,
    messages: clone(input?.messages ?? []),
    cards: clone(input?.cards ?? []),
    actions: clone(input?.actions ?? []),
    voiceSummary: input?.voiceSummary || null,
    nextAction: input?.nextAction || null
  });
}

export class ChannelAdapterRegistry {
  #adapters = new Map();

  register({ channel, version, verify, normalize, render }) {
    if (!CHANNEL_SET.has(channel)) throw new TypeError('unsupported channel');
    if (this.#adapters.has(channel)) throw new Error(`channel adapter already registered: ${channel}`);
    if (!version || typeof verify !== 'function' || typeof normalize !== 'function' || typeof render !== 'function') throw new TypeError('complete channel adapter contract required');
    this.#adapters.set(channel, Object.freeze({ channel, version: String(version), verify, normalize, render }));
  }

  list() { return Object.freeze([...this.#adapters.values()].map(({ channel, version }) => Object.freeze({ channel, version }))); }

  async normalize(channel, rawRequest, context = {}) {
    const adapter = this.#adapters.get(channel);
    if (!adapter) throw new Error('channel adapter unavailable');
    const verification = await adapter.verify(rawRequest, context);
    if (verification?.valid !== true) throw new Error(`channel verification failed: ${verification?.reason || 'invalid-signature'}`);
    const normalized = await adapter.normalize(rawRequest, Object.freeze({ ...context, verification }));
    const envelope = createInboundChannelEnvelope(normalized);
    if (envelope.channel !== channel) throw new Error('channel adapter attempted channel substitution');
    return envelope;
  }

  async render(envelope, response) {
    const adapter = this.#adapters.get(envelope?.channel);
    if (!adapter) throw new Error('channel adapter unavailable');
    return adapter.render(createChannelResponse(envelope, response), envelope);
  }
}

export class OmnichannelGateway {
  #registry; #authorize; #dispatch; #results = new Map();

  constructor({ registry, authorize, dispatch }) {
    if (!(registry instanceof ChannelAdapterRegistry)) throw new TypeError('channel registry required');
    if (typeof authorize !== 'function' || typeof dispatch !== 'function') throw new TypeError('authorize and dispatch functions required');
    this.#registry = registry;
    this.#authorize = authorize;
    this.#dispatch = dispatch;
  }

  async handle(channel, rawRequest, context = {}) {
    const envelope = await this.#registry.normalize(channel, rawRequest, context);
    const key = `${envelope.tenantId}:${envelope.channel}:${envelope.idempotencyKey}`;
    if (this.#results.has(key)) return clone(this.#results.get(key));
    const policy = await this.#authorize(envelope);
    if (!policy || policy.decision !== 'allow') {
      const denied = Object.freeze({ status: policy?.decision || 'deny', reason: policy?.reason || 'channel-policy-denied', envelope });
      return denied;
    }
    const applicationResult = await this.#dispatch(envelope);
    const rendered = await this.#registry.render(envelope, applicationResult);
    const result = freezeDeep({ status: 'completed', envelope, rendered });
    this.#results.set(key, clone(result));
    return result;
  }
}
