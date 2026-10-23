import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecipientProfile, confirmPreferences, createGiftLink, transitionGift, createGroupGift } from '../src/gift-flow.mjs';
import { buildPayPalOrder, captureAllowed } from '../src/paypal.mjs';
import { authorizeChannelRead, safeSignals } from '../src/channel-policy.mjs';
import { invokeTool } from '../src/mcp-tools.mjs';

test('inferred interests require confirmation', () => {
  const p = createRecipientProfile({ displayName: 'Maya', relationship: 'friend', socialSignals: [{ id: 's1', topic: 'hiking', source: 'instagram', confidence: 0.8 }] });
  assert.equal(p.preferences.length, 0);
  assert.deepEqual(confirmPreferences(p, { s1: 'confirm' }).preferences.map(x => x.topic), ['hiking']);
});

test('claim link enforces sender approval and recipient address step', () => {
  let gift = createGiftLink({ senderId: 'u1', recipientId: 'r1', recommendationId: 'g1' });
  assert.throws(() => transitionGift(gift, 'CLAIM'));
  gift = transitionGift(transitionGift(transitionGift(gift, 'APPROVE'), 'CLAIM'), 'ADDRESS_CONFIRMED');
  const order = buildPayPalOrder({ sku: 'tea-1', description: 'Tea set', unitMinor: 4500, giftLinkId: gift.id });
  assert.equal(order.purchase_units[0].amount.value, '45.00');
  assert.equal(captureAllowed({ gift, order: { ...order, status: 'APPROVED' } }), true);
});

test('group gifts store integer money', () => {
  assert.equal(createGroupGift({ organizerId: 'u1', title: 'Team gift', targetMinorUnits: 12000 }).targetMinorUnits, 12000);
});

test('chat access needs consent, admin approval and exact capability', () => {
  assert.equal(authorizeChannelRead({ channel: 'slack', userConsent: true, workspaceApproval: false, scopes: ['channels:history'] }).allowed, false);
  assert.equal(authorizeChannelRead({ channel: 'slack', userConsent: true, workspaceApproval: true, scopes: ['channels:history'] }).allowed, true);
  assert.deepEqual(safeSignals([{ authorOptedIn: false, explicitLikes: ['coffee'] }, { authorOptedIn: true, explicitLikes: ['cycling'] }]).map(x => x.topic), ['cycling']);
});

test('MCP tools are approval gated', () => {
  assert.throws(() => invokeTool('create_group_gift', { organizerId: 'u1', title: 'A', targetMinorUnits: 10 }, { userId: 'u1', approvedTools: [] }));
});
