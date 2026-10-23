import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiLessonService } from '../src/gemini-service.mjs';

test('Gemini lesson drafts use structured child-safe candidates without exposing the key', async () => {
  let request;
  const service = createGeminiLessonService({
    model: 'gemini-test',
    apiKeyProvider: async () => 'secret-test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        async json() {
          return { candidates: [{ content: { parts: [{ text: JSON.stringify({
            title: 'Sound Hunt', skill: 'letterSound', prompt: 'Which word begins with /b/?',
            correctAnswer: 'ball', distractors: ['cat', 'sun'], hint: 'Stretch the first sound.',
            explanation: 'Ball begins with the /b/ sound.'
          }) }] } }] };
        }
      };
    }
  });
  const result = await service.draftLesson({ title: 'Demo', url: 'https://youtube.com/watch?v=demo', provider: 'youtube',
    rightsBasis: 'Parent-confirmed official link', ageBand: '5-7', skill: 'letterSound', learningGoal: 'Hear /b/' });
  assert.equal(result.prompt, 'Which word begins with /b/?');
  assert.deepEqual(result.choices, ['ball', 'cat', 'sun']);
  assert.equal(request.options.headers['x-goog-api-key'], 'secret-test-key');
  assert.doesNotMatch(request.options.body, /secret-test-key/);
  assert.match(request.options.body, /Do not quote dialogue/);
});

test('Gemini rejects incomplete lesson drafts', async () => {
  const service = createGeminiLessonService({ apiKeyProvider: async () => 'key', fetchImpl: async () => ({
    ok: true, async json() { return { candidates: [{ content: { parts: [{ text: '{"title":"Missing fields"}' }] } }] }; }
  }) });
  await assert.rejects(() => service.draftLesson({ title: 'Demo', url: 'https://example.com', provider: 'owned', rightsBasis: 'owned', ageBand: '5-7', skill: 'reading', learningGoal: 'read' }), /incomplete/i);
});

test('Gemini configuration status reflects whether a key resolves', async () => {
  const configured = createGeminiLessonService({ apiKeyProvider: async () => 'test-key', fetchImpl: async () => ({}) });
  const missing = createGeminiLessonService({ apiKeyProvider: async () => null, fetchImpl: async () => ({}) });
  assert.equal(await configured.isConfigured(), true);
  assert.equal(await missing.isConfigured(), false);
});

test('Gemini falls back to the stable previous Flash model on capacity errors', async () => {
  const urls = [];
  const service = createGeminiLessonService({
    model: 'gemini-primary', fallbackModels: ['gemini-fallback'], apiKeyProvider: async () => 'key',
    fetchImpl: async url => {
      urls.push(url);
      if (url.includes('gemini-primary')) return {
        ok: false, status: 503, async json() { return { error: { message: 'This model is currently experiencing high demand.' } }; }
      };
      return { ok: true, status: 200, async json() { return { candidates: [{ content: { parts: [{ text: JSON.stringify({
        title: 'Fallback lesson', skill: 'comprehension', prompt: 'What did you notice?', correctAnswer: 'rabbit',
        distractors: ['boat', 'moon'], hint: 'Look at the main character.', explanation: 'The main character is a rabbit.'
      }) }] } }] }; } };
    }
  });
  const result = await service.draftLesson({ title: 'Demo', url: 'https://example.com', provider: 'owned',
    rightsBasis: 'owned', ageBand: '5-7', skill: 'comprehension', learningGoal: 'notice details' });
  assert.equal(result.model, 'gemini-fallback');
  assert.equal(urls.length, 2);
});

test('Gemini bounds each model attempt and falls back after a timeout', async () => {
  const models = [];
  const service = createGeminiLessonService({
    apiKeyProvider: async () => 'not-a-real-key',
    model: 'primary-model',
    fallbackModels: ['fallback-model'],
    requestTimeoutMs: 5,
    fetchImpl: async (url, options) => {
      const model = decodeURIComponent(url.match(/models\/([^:]+)/)[1]);
      models.push(model);
      if (model === 'primary-model') {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 100);
          options.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(options.signal.reason);
          }, { once: true });
        });
      }
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
          title: 'Fallback lesson', skill: 'comprehension', prompt: 'What happened?',
          correctAnswer: 'The rabbit woke up', distractors: ['It rained', 'It snowed'],
          hint: 'Think about the beginning.', explanation: 'The rabbit woke up.'
        }) }] } }] })
      };
    }
  });

  const draft = await service.draftLesson({
    title: 'Fixture', url: 'https://example.test/video', provider: 'owned',
    rightsBasis: 'Owned fixture', ageBand: '5-7', skill: 'comprehension', learningGoal: 'recall'
  });
  assert.deepEqual(models, ['primary-model', 'fallback-model']);
  assert.equal(draft.model, 'fallback-model');
});
