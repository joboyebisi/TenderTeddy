export const JOURNEY_STAGES = Object.freeze([
  'signed-out', 'onboarding', 'sources-connected', 'occasion-found',
  'agent-invited', 'preferences-confirmed', 'ideas-ready', 'approved',
  'fulfilled', 'thanked'
]);

export const CONNECTOR_CAPABILITIES = Object.freeze({
  googleCalendar: { mode: 'oauth', reads: ['events', 'birthdays'], scope: 'calendar.events.readonly' },
  xBookmarks: { mode: 'oauth', reads: ['authenticated-user-bookmarks'], scope: 'bookmark.read' },
  instagram: { mode: 'shared-link', reads: [], note: 'Saved posts are not assumed available.' },
  facebook: { mode: 'shared-link', reads: [], note: 'Saved items are not assumed available.' },
  amazon: { mode: 'catalogue-handoff', reads: ['product-catalogue'], purchases: 'user-approved-handoff' },
  travel: { mode: 'partner-adapter', reads: ['offers'], purchases: 'user-approved-handoff' }
});

const TRANSITIONS = Object.freeze({
  'signed-out': ['onboarding'], onboarding: ['sources-connected'],
  'sources-connected': ['occasion-found'], 'occasion-found': ['agent-invited', 'preferences-confirmed'],
  'agent-invited': ['preferences-confirmed'], 'preferences-confirmed': ['ideas-ready'],
  'ideas-ready': ['approved'], approved: ['fulfilled'], fulfilled: ['thanked'], thanked: []
});

export function advanceJourney(journey, next, evidence = {}) {
  if (!TRANSITIONS[journey.stage]?.includes(next)) throw new Error(`Invalid journey transition: ${journey.stage} -> ${next}`);
  if (next === 'sources-connected' && !evidence.consentReceipt) throw new Error('Connection consent receipt required');
  if (next === 'preferences-confirmed' && !evidence.confirmedByRecipient && !evidence.confirmedByGiver) throw new Error('Preferences must be confirmed');
  if (next === 'approved' && !evidence.approvedByUser) throw new Error('User approval required');
  return { ...journey, stage: next, history: [...(journey.history || []), { stage: next, at: evidence.at || 'now' }] };
}

export function occasionCandidates(events, now = new Date()) {
  return events.filter(event => new Date(event.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(event => ({ ...event, source: event.source || 'calendar', needsRecipientMatch: !event.recipientId }));
}

