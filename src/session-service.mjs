import crypto from 'node:crypto';
import { checkpointResponse } from './learning.mjs';

export async function startLessonSession(store, lessonId) {
  const state = await store.snapshot();
  const lesson = state.lessons.find(item => item.id === lessonId);
  if (!lesson || lesson.status !== 'approved') throw new Error('An approved lesson is required');
  const session = {
    id: crypto.randomUUID(), householdId: state.household.id, childId: lesson.childId,
    lessonId: lesson.id, status: 'checkpoint', checkpointId: lesson.checkpoints[0].id,
    attempts: 0, answers: [], startedAt: new Date().toISOString()
  };
  return store.addSession(session);
}

export async function submitSessionAnswer(store, sessionId, input) {
  const state = await store.snapshot();
  const session = state.sessions.find(item => item.id === sessionId);
  if (!session) throw new Error('Session not found');
  if (session.status === 'completed' || session.status === 'stopped') throw new Error('This session is no longer accepting answers');
  const lesson = state.lessons.find(item => item.id === session.lessonId);
  const checkpoint = lesson?.checkpoints.find(item => item.id === session.checkpointId);
  if (!checkpoint) throw new Error('Checkpoint not found');
  const attempts = session.attempts + 1;
  const result = checkpointResponse({ answer: input.answer, accepted: checkpoint.acceptedAnswers, hint: checkpoint.hints[0], attempt: attempts });
  const answer = {
    answer: String(input.answer), channel: input.channel || 'fire-tv-remote', correct: result.correct,
    attempt: attempts, occurredAt: new Date().toISOString()
  };
  const status = result.correct ? 'completed' : 'feedback';
  await store.updateSession(session.id, {
    attempts, answers: [...session.answers, answer], status,
    completedAt: result.correct ? answer.occurredAt : null
  });
  if (result.correct) await store.addProgress({
    id: crypto.randomUUID(), householdId: state.household.id, childId: session.childId,
    lessonId: lesson.id, checkpointId: checkpoint.id, skill: checkpoint.skill,
    correct: true, attempts, hintsUsed: attempts > 1 ? 1 : 0,
    inputChannel: answer.channel, occurredAt: answer.occurredAt, rawAudioStored: false
  });
  return { ...result, attempts, sessionStatus: status, sessionId: session.id };
}

export async function stopLessonSession(store, sessionId, channel = 'parent-app') {
  const state = await store.snapshot();
  const session = state.sessions.find(item => item.id === sessionId);
  if (!session) throw new Error('Session not found');
  return store.updateSession(sessionId, { status: 'stopped', stoppedBy: channel, stoppedAt: new Date().toISOString() });
}

export async function currentPrompt(store, sessionId) {
  const state = await store.snapshot();
  const session = state.sessions.find(item => item.id === sessionId);
  const lesson = state.lessons.find(item => item.id === session?.lessonId);
  return lesson?.checkpoints.find(item => item.id === session?.checkpointId)?.prompt || null;
}
