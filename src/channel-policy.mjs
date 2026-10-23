const READ_CAPABILITY = { slack: 'channels:history', teams: 'ChannelMessage.Read.Group', telegram: 'bot-chat-membership', x: 'approved-reply-automation' };

export function authorizeChannelRead({ channel, userConsent, workspaceApproval, scopes = [] }) {
  const capability = READ_CAPABILITY[channel];
  if (!capability) return { allowed: false, reason: 'unsupported-channel' };
  if (!userConsent) return { allowed: false, reason: 'user-consent-required' };
  if ((channel === 'slack' || channel === 'teams') && !workspaceApproval) return { allowed: false, reason: 'workspace-approval-required' };
  if (!scopes.includes(capability)) return { allowed: false, reason: 'missing-capability' };
  return { allowed: true, capability };
}

export function safeSignals(messages) {
  return messages
    .filter(message => message.authorOptedIn)
    .flatMap(message => message.explicitLikes || [])
    .map(topic => ({ topic, basis: 'explicit-like', confidence: 0.7 }));
}
