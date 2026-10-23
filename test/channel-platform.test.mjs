import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelAdapterRegistry, OmnichannelGateway } from '../src/channel-platform.mjs';

function telegramRegistry(counter = { renders: 0 }) {
  const registry = new ChannelAdapterRegistry();
  registry.register({
    channel: 'telegram', version: '1.0.0',
    verify: (_request, context) => ({ valid: context.secret === 'expected' }),
    normalize: request => ({
      channel: 'telegram', eventId: String(request.update_id), tenantId: 'personal-u1',
      actor: { externalActorId: String(request.message.from.id), internalUserId: 'u1', identityLinkId: 'link-1', trust: 'linked' },
      conversation: { id: String(request.message.chat.id), kind: request.message.chat.type },
      interaction: { type: 'message', payload: { text: request.message.text } },
      authorization: { scopes: ['gifts:read'] }, sourceReference: { updateId: request.update_id }
    }),
    render: response => { counter.renders += 1; return { method: 'sendMessage', text: response.messages[0]?.text, chat_id: response.conversationId }; }
  });
  return registry;
}

const update = { update_id: 42, message: { from: { id: 7 }, chat: { id: 9, type: 'private' }, text: 'gift ideas for Maya' } };

test('channel adapters verify and normalize untrusted webhook payloads', async () => {
  const registry = telegramRegistry();
  await assert.rejects(registry.normalize('telegram', update, { secret: 'wrong' }), /verification failed/);
  const envelope = await registry.normalize('telegram', update, { secret: 'expected' });
  assert.equal(envelope.actor.internalUserId, 'u1');
  assert.equal(envelope.idempotencyKey, 'telegram:42');
  assert.equal(envelope.channel, 'telegram');
  assert.throws(() => { envelope.actor.trust = 'authenticated'; }, TypeError);
});

test('omnichannel gateway applies policy once and deduplicates channel events', async () => {
  const counter = { renders: 0 };
  let dispatches = 0;
  const gateway = new OmnichannelGateway({
    registry: telegramRegistry(counter),
    authorize: envelope => ({ decision: envelope.authorization.scopes.includes('gifts:read') ? 'allow' : 'deny' }),
    dispatch: async envelope => {
      dispatches += 1;
      return { messages: [{ text: `Received: ${envelope.interaction.payload.text}` }], nextAction: 'find-gifts' };
    }
  });
  const first = await gateway.handle('telegram', update, { secret: 'expected' });
  const replay = await gateway.handle('telegram', update, { secret: 'expected' });
  assert.equal(first.rendered.text, 'Received: gift ideas for Maya');
  assert.deepEqual(replay, first);
  assert.equal(dispatches, 1);
  assert.equal(counter.renders, 1);
});

test('unlinked social actors can be restricted before agent dispatch', async () => {
  const registry = new ChannelAdapterRegistry();
  registry.register({
    channel: 'x', version: '1.0.0', verify: () => ({ valid: true }),
    normalize: () => ({
      channel: 'x', eventId: 'tweet-1', tenantId: 'public',
      actor: { externalActorId: 'x-user', trust: 'unverified' },
      conversation: { id: 'thread-1', kind: 'public' }, interaction: { type: 'mention', payload: { text: 'buy this' } }, authorization: { scopes: [] }
    }), render: response => response
  });
  let dispatched = false;
  const gateway = new OmnichannelGateway({
    registry,
    authorize: envelope => ({ decision: envelope.actor.trust === 'unverified' ? 'require_linking' : 'allow', reason: 'account-link-required' }),
    dispatch: () => { dispatched = true; }
  });
  const result = await gateway.handle('x', {}, {});
  assert.equal(result.status, 'require_linking');
  assert.equal(dispatched, false);
});
