import crypto from 'node:crypto';

const CHANNELS = new Set(['fire-tv-remote', 'alexa-skill', 'parent-app', 'mcp-tool']);

export function normalizeLearningEvent(input) {
  if (!CHANNELS.has(input.channel)) throw new Error('Unsupported interaction channel');
  if (!input.sessionId || !input.type) throw new Error('sessionId and type are required');
  return {
    id: input.id || crypto.randomUUID(),
    sessionId: input.sessionId,
    channel: input.channel,
    type: input.type,
    payload: input.payload || {},
    occurredAt: input.occurredAt || new Date().toISOString()
  };
}

export function applyLearningEvent(session, event) {
  const next = { ...session, lastEventId: event.id, updatedAt: event.occurredAt };
  if (event.type === 'LESSON_STARTED') return { ...next, status: 'playing', lessonId: event.payload.lessonId };
  if (event.type === 'CHECKPOINT_OPENED') return { ...next, status: 'checkpoint', checkpointId: event.payload.checkpointId };
  if (event.type === 'ANSWER_SUBMITTED') {
    const answers = [...(session.answers || []), { checkpointId: session.checkpointId, answer: event.payload.answer, channel: event.channel }];
    return { ...next, status: 'feedback', answers };
  }
  if (event.type === 'LESSON_RESUMED') return { ...next, status: 'playing', checkpointId: null };
  if (event.type === 'PARENT_STOP') return { ...next, status: 'stopped', stoppedBy: 'parent' };
  throw new Error('Unsupported event type');
}

export function routeInteraction(event) {
  const destinations = new Set(['session-service']);
  if (event.channel !== 'fire-tv-remote') destinations.add('fire-tv-app');
  if (event.type === 'ANSWER_SUBMITTED' || event.type === 'PARENT_STOP') destinations.add('parent-dashboard');
  return [...destinations];
}
