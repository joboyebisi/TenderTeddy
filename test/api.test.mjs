import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createTenderTeddyServer } from '../server.mjs';
import { FamilyStore } from '../src/family-store.mjs';

async function withServer(run) {
  const server = createTenderTeddyServer({ store: new FamilyStore() });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base); } finally { await new Promise(resolve => server.close(resolve)); }
}

async function post(base, path, value) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value)
  });
  return { status: response.status, body: await response.json() };
}

test('family alpha completes an approved learning loop without raw audio', async () => {
  await withServer(async base => {
    const child = await post(base, '/api/children', { displayName: 'Amina', ageBand: '5-7', voiceEnabled: false });
    assert.equal(child.status, 201);
    assert.equal(child.body.rawAudioStored, false);

    const content = await post(base, '/api/content/review', {
      url: 'https://youtube.com/watch?v=demo', rightsBasis: 'Official embeddable link',
      embeddable: true, madeForKidsChecked: true
    });
    assert.equal(content.body.status, 'eligible');
    assert.deepEqual(content.body.checkpointPlacements, ['before', 'after']);

    const lesson = await post(base, '/api/lessons', {
      childId: child.body.id, contentId: content.body.id, parentApproved: true
    });
    assert.equal(lesson.body.status, 'approved');
    assert.equal(lesson.body.checkpoints[0].placement, 'after');

    const session = await post(base, '/api/sessions', { lessonId: lesson.body.id });
    const miss = await post(base, `/api/sessions/${session.body.id}/answer`, { answer: 'cat' });
    assert.equal(miss.body.correct, false);
    assert.equal(miss.body.needsScaffold, true);

    const success = await post(base, `/api/sessions/${session.body.id}/answer`, { answer: 'ball' });
    assert.equal(success.body.correct, true);
    assert.equal(success.body.attempts, 2);

    const family = await fetch(`${base}/api/family`).then(response => response.json());
    assert.equal(family.progress.length, 1);
    assert.equal(family.progress[0].hintsUsed, 1);
    assert.equal(family.progress[0].rawAudioStored, false);
  });
});

test('unapproved lessons cannot start a child session', async () => {
  await withServer(async base => {
    const child = await post(base, '/api/children', { displayName: 'Sam', ageBand: '5-7' });
    const content = await post(base, '/api/content/review', {
      url: 'https://youtube.com/watch?v=demo', rightsBasis: 'Official embeddable link',
      embeddable: true, madeForKidsChecked: true
    });
    const lesson = await post(base, '/api/lessons', { childId: child.body.id, contentId: content.body.id });
    const session = await post(base, '/api/sessions', { lessonId: lesson.body.id });
    assert.equal(session.status, 400);
    assert.match(session.body.error, /approved lesson/i);
  });
});

test('deleting a child cascades lessons, sessions and progress', async () => {
  await withServer(async base => {
    const child = await post(base, '/api/children', { displayName: 'Maya', ageBand: '5-7' });
    const content = await post(base, '/api/content/review', { url: 'https://youtube.com/watch?v=delete', rightsBasis: 'Official link', embeddable: true, madeForKidsChecked: true });
    const lesson = await post(base, '/api/lessons', { childId: child.body.id, contentId: content.body.id, parentApproved: true });
    const session = await post(base, '/api/sessions', { lessonId: lesson.body.id });
    await post(base, `/api/sessions/${session.body.id}/answer`, { answer: 'ball' });
    const deleted = await fetch(`${base}/api/children/${child.body.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
    const family = await fetch(`${base}/api/family`).then(response => response.json());
    assert.equal(family.children.length, 0); assert.equal(family.lessons.length, 0);
    assert.equal(family.sessions.length, 0); assert.equal(family.progress.length, 0);
  });
});

test('Alexa and Fire TV share the same authoritative lesson session', async () => {
  await withServer(async base => {
    const child = await post(base, '/api/children', { displayName: 'Amina', ageBand: '5-7', voiceEnabled: true });
    const content = await post(base, '/api/content/review', {
      url: 'https://youtube.com/watch?v=simulator', rightsBasis: 'Synthetic simulator fixture',
      embeddable: true, madeForKidsChecked: true
    });
    const lesson = await post(base, '/api/lessons', { childId: child.body.id, contentId: content.body.id, parentApproved: true });
    const startEnvelope = {
      version: '1.0', session: { attributes: {} },
      request: { type: 'IntentRequest', intent: { name: 'StartLessonIntent', slots: { lessonId: { value: lesson.body.id } } } }
    };
    const started = await post(base, '/api/alexa', startEnvelope);
    const attributes = started.body.sessionAttributes;
    assert.ok(attributes.sessionId);
    assert.match(started.body.response.outputSpeech.text, /Which picture/i);

    const miss = await post(base, '/api/alexa', {
      version: '1.0', session: { attributes },
      request: { type: 'IntentRequest', intent: { name: 'AnswerIntent', slots: { answer: { value: 'cat' } } } }
    });
    assert.match(miss.body.response.outputSpeech.text, /b-b-b/i);

    const success = await post(base, `/api/sessions/${attributes.sessionId}/answer`, { answer: 'ball', channel: 'fire-tv-remote' });
    assert.equal(success.body.correct, true);
    const state = await fetch(`${base}/api/family`).then(response => response.json());
    const session = state.sessions.find(item => item.id === attributes.sessionId);
    assert.deepEqual(session.answers.map(item => item.channel), ['alexa-skill', 'fire-tv-remote']);
    assert.equal(state.progress[0].rawAudioStored, false);
  });
});

test('API rejects oversized JSON bodies before processing them', async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/api/children`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'x'.repeat(70 * 1024), ageBand: '5-7' })
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /too large/i);
  });
});
