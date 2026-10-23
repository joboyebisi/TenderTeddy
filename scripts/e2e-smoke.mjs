import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createTenderTeddyServer } from '../server.mjs';
import { FamilyStore } from '../src/family-store.mjs';

const requestedBaseUrl = process.env.E2E_BASE_URL || process.argv[2] || '';
const requireAi = /^(1|true|yes)$/i.test(process.env.E2E_REQUIRE_AI || '');
const skipAi = /^(1|true|yes)$/i.test(process.env.E2E_SKIP_AI || '');
let server;
let baseUrl = requestedBaseUrl.replace(/\/$/, '');
let childId;
let lessonId;
let sessionId;

async function request(path, { expected = 200, ...options } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { text }; }
  assert.equal(response.status, expected, `${options.method || 'GET'} ${path}: ${response.status} ${text}`);
  return body;
}

const post = (path, body, expected = 200) => request(path, {
  method: 'POST', expected, body: JSON.stringify(body)
});

async function startLocalServer() {
  server = createTenderTeddyServer({ store: new FamilyStore() });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function run() {
  if (!baseUrl) await startLocalServer();
  console.log(`TenderTeddy E2E target: ${baseUrl}`);

  const health = await request('/api/health');
  assert.equal(health.ok, true);
  if (requireAi) assert.equal(health.aiConfigured, true, 'AI is required but is not configured');
  console.log(`PASS health (AI ${health.aiConfigured ? 'configured' : 'not configured'})`);

  let state = await request('/api/family');
  let content = state.content.find(item => item.status === 'eligible');
  if (!content) {
    content = await post('/api/content/review', {
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      title: 'Big Buck Bunny - E2E fixture',
      rightsBasis: 'Creative Commons Attribution 3.0; official Blender Foundation upload',
      embeddable: true,
      madeForKidsChecked: true
    }, 201);
    console.log('NOTE created a reusable eligible content fixture because none existed');
  }

  const suffix = `${Date.now()}`.slice(-6);
  const child = await post('/api/children', {
    displayName: `E2E-${suffix}`,
    ageBand: '5-7',
    voiceEnabled: false
  }, 201);
  childId = child.id;
  assert.equal(child.rawAudioStored, false);
  console.log('PASS temporary child profile');

  let draft = {
    title: 'E2E Sound Check',
    skill: 'letterSound',
    prompt: 'Which word starts with the /b/ sound?',
    acceptedAnswers: ['ball'],
    choices: ['ball', 'cat', 'sun'],
    hints: ['Stretch the first sound: b-b-b.'],
    explanation: 'Ball starts with the /b/ sound.'
  };
  if (health.aiConfigured && !skipAi) {
    draft = await post('/api/ai/lesson-draft', {
      childId,
      contentId: content.id,
      skill: 'comprehension',
      learningGoal: 'identify one clear detail from the parent-approved video'
    });
    assert.equal(draft.parentApprovalRequired, true);
    assert.equal(draft.source, 'gemini-candidate');
    console.log(`PASS live Gemini candidate (${draft.model})`);
  } else if (skipAi) {
    console.log('SKIP live Gemini candidate (E2E_SKIP_AI requested)');
  }

  const lesson = await post('/api/lessons', {
    childId,
    contentId: content.id,
    title: draft.title,
    skill: draft.skill,
    prompt: draft.prompt,
    acceptedAnswers: draft.acceptedAnswers,
    choices: draft.choices,
    hints: draft.hints,
    explanation: draft.explanation,
    parentApproved: true
  }, 201);
  lessonId = lesson.id;
  assert.equal(lesson.status, 'approved');
  console.log('PASS parent approval gate');

  const session = await post('/api/sessions', { lessonId }, 201);
  sessionId = session.id;
  const miss = await post(`/api/sessions/${sessionId}/answer`, {
    answer: '__known_incorrect_answer__', channel: 'fire-tv-remote'
  });
  assert.equal(miss.correct, false);
  assert.equal(miss.needsScaffold, true);

  const success = await post(`/api/sessions/${sessionId}/answer`, {
    answer: draft.acceptedAnswers[0], channel: 'alexa-skill'
  });
  assert.equal(success.correct, true);
  assert.equal(success.attempts, 2);
  console.log('PASS shared Fire TV/Alexa answer loop and scaffold');

  state = await request('/api/family');
  const progress = state.progress.find(item => item.childId === childId && item.lessonId === lessonId);
  assert.ok(progress, 'Progress event was not persisted');
  assert.equal(progress.hintsUsed, 1);
  assert.equal(progress.rawAudioStored, false);
  console.log('PASS progress persistence and raw-audio privacy invariant');
}

async function cleanup() {
  if (!childId || !baseUrl) return;
  try {
    await request(`/api/children/${childId}`, { method: 'DELETE' });
    const state = await request('/api/family');
    assert.equal(state.children.some(item => item.id === childId), false);
    assert.equal(state.lessons.some(item => item.id === lessonId), false);
    assert.equal(state.sessions.some(item => item.id === sessionId), false);
    assert.equal(state.progress.some(item => item.childId === childId), false);
    console.log('PASS cleanup cascade');
  } catch (error) {
    console.error(`CLEANUP FAILED for child ${childId}: ${error.message}`);
    process.exitCode = 1;
  }
}

try {
  await run();
  console.log('E2E PASS');
} catch (error) {
  console.error(`E2E FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  await cleanup();
  if (server) await new Promise(resolve => server.close(resolve));
}
