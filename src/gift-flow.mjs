import crypto from 'node:crypto';

export function createRecipientProfile({ displayName, relationship, socialSignals = [] }) {
  return { id: crypto.randomUUID(), displayName, relationship, socialSignals, signalStatus: 'unconfirmed', preferences: [] };
}

export function confirmPreferences(profile, decisions) {
  const preferences = profile.socialSignals
    .filter(signal => decisions[signal.id] === 'confirm')
    .map(signal => ({ topic: signal.topic, source: signal.source, confidence: signal.confidence, confirmed: true }));
  return { ...profile, preferences, signalStatus: 'confirmed' };
}

export function createGiftLink({ senderId, recipientId, recommendationId, country = 'GB' }) {
  if (!senderId || !recipientId || !recommendationId) throw new Error('Gift link requires sender, recipient and recommendation');
  return {
    id: crypto.randomUUID(), senderId, recipientId, recommendationId, country,
    status: 'awaiting-sender-approval', events: ['CREATED']
  };
}

export function transitionGift(gift, action) {
  const allowed = {
    'awaiting-sender-approval': { APPROVE: 'claimable' },
    claimable: { CLAIM: 'address-pending' },
    'address-pending': { ADDRESS_CONFIRMED: 'ready-for-checkout' },
    'ready-for-checkout': { PAY: 'paid' },
    paid: { FULFIL: 'fulfilled' },
    fulfilled: { THANK: 'completed' }
  };
  const status = allowed[gift.status]?.[action];
  if (!status) throw new Error(`Invalid gift transition: ${gift.status} -> ${action}`);
  return { ...gift, status, events: [...gift.events, action] };
}

export function createGroupGift({ organizerId, title, targetMinorUnits, currency = 'GBP' }) {
  if (!Number.isInteger(targetMinorUnits) || targetMinorUnits < 1) throw new Error('Positive integer target required');
  return { id: crypto.randomUUID(), organizerId, title, targetMinorUnits, currency, pledgedMinorUnits: 0, members: [], status: 'collecting' };
}
