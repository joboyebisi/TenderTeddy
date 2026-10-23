import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLearningEvent, applyLearningEvent, routeInteraction } from '../src/orchestration.mjs';
import { buildVideoAnalysisRequest, approveCandidate } from '../src/gemini-video.mjs';
import { playbackMode, canAttachInteractiveCheckpoint } from '../src/content-policy.mjs';

test('Alexa answer updates the shared Fire TV session', () => {
  const event = normalizeLearningEvent({ sessionId: 's1', channel: 'alexa-skill', type: 'ANSWER_SUBMITTED', payload: { answer: 'b' } });
  const result = applyLearningEvent({ id: 's1', status: 'checkpoint', checkpointId: 'c1', answers: [] }, event);
  assert.equal(result.status, 'feedback');
  assert.equal(result.answers[0].channel, 'alexa-skill');
  assert.deepEqual(routeInteraction(event).sort(), ['fire-tv-app', 'parent-dashboard', 'session-service'].sort());
});

test('Gemini request is limited to approved source classes and educator review', () => {
  assert.throws(() => buildVideoAnalysisRequest({ sourceType: 'scraped-copy', uri: 'x', lessonGoal: 'counting' }));
  const request = buildVideoAnalysisRequest({ sourceType: 'public-youtube-url', uri: 'https://youtube.com/watch?v=x', lessonGoal: 'counting' });
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.throws(() => approveCandidate({ timestamp: '00:10', question: 'How many?' }, { role: 'parent' }));
});

test('YouTube checkpoints cannot cover or interrupt the player', () => {
  const item = { provider: 'youtube', embeddable: true, madeForKidsChecked: true, rights: 'third-party' };
  assert.equal(playbackMode(item), 'youtube-iframe');
  assert.equal(canAttachInteractiveCheckpoint(item, 'overlay'), false);
  assert.equal(canAttachInteractiveCheckpoint(item, 'after'), true);
});
