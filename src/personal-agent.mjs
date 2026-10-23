export function createPersonalAgent({ ownerId, name = 'My WanderWrap', channels = [], expiresAt }) {
  if (!ownerId || !expiresAt) throw new Error('Owner and expiry are required');
  return { ownerId, name, channels, expiresAt, status: 'draft', permissions: [], facts: [] };
}

export function activateAgent(agent, { ownerConsent, participantInviteAccepted }) {
  if (!ownerConsent || !participantInviteAccepted) throw new Error('Owner and participant opt-in required');
  return { ...agent, status: 'active', permissions: ['ask-gift-questions', 'store-confirmed-preferences'] };
}

export function recordPreference(agent, fact) {
  if (agent.status !== 'active') throw new Error('Agent is not active');
  if (!fact.participantConfirmed || !fact.provenance) throw new Error('Confirmed preference and provenance required');
  return { ...agent, facts: [...agent.facts, { ...fact, confidence: 'confirmed' }] };
}

export function mayReadChannel(agent, channel) {
  return agent.status === 'active' && agent.channels.includes(channel) && agent.permissions.includes('ask-gift-questions');
}

