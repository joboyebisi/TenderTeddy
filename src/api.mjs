import crypto from 'node:crypto';
import { createLesson, reviewContentCandidate } from './content-discovery.mjs';
import { handleAlexaRequest } from './alexa.mjs';
import { startLessonSession, submitSessionAnswer } from './session-service.mjs';

const json = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
async function requestBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('Request body must be valid JSON'); }
}

export function createApi(store, { geminiService = null } = {}) {
  return async function handleApi(req, res, url) {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const aiConfigured = geminiService ? await geminiService.isConfigured() : false;
      json(res, 200, { ok: true, service: 'tender-teddy', aiConfigured }); return true;
    }
    if (req.method === 'GET' && url.pathname === '/api/family') { json(res, 200, await store.snapshot()); return true; }
    if (req.method === 'POST' && url.pathname === '/api/children') { json(res, 201, await store.createChild(await requestBody(req))); return true; }
    if (req.method === 'POST' && url.pathname === '/api/alexa') { json(res, 200, await handleAlexaRequest(await requestBody(req), store)); return true; }

    const childMatch = url.pathname.match(/^\/api\/children\/([^/]+)$/);
    if (req.method === 'PATCH' && childMatch) { json(res, 200, await store.updateChild(childMatch[1], await requestBody(req))); return true; }
    if (req.method === 'DELETE' && childMatch) { json(res, 200, await store.deleteChild(childMatch[1])); return true; }

    if (req.method === 'POST' && url.pathname === '/api/content/review') {
      const input = await requestBody(req); let parsed;
      try { parsed = new URL(input.url); } catch { throw new Error('Enter a valid content URL'); }
      const host = parsed.hostname.replace(/^www\./, '');
      const candidate = reviewContentCandidate({
        id: crypto.randomUUID(), householdId: (await store.snapshot()).household.id,
        title: String(input.title || 'Parent-selected video').trim(),
        provider: ['youtube.com', 'youtu.be'].includes(host) ? 'youtube' : input.provider,
        url: parsed.toString(), rights: input.rights || 'third-party',
        rightsBasis: String(input.rightsBasis || '').trim(), embeddable: Boolean(input.embeddable),
        madeForKidsChecked: Boolean(input.madeForKidsChecked), reviewedAt: new Date().toISOString()
      });
      if (!candidate.rightsBasis) throw new Error('A rights or embed basis is required');
      json(res, 201, await store.addContent(candidate)); return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/lesson-draft') {
      if (!geminiService) throw new Error('Gemini is not configured');
      const input = await requestBody(req); const state = await store.snapshot();
      const child = state.children.find(item => item.id === input.childId);
      const content = state.content.find(item => item.id === input.contentId);
      if (!child) throw new Error('Choose a child profile');
      if (!content || content.status !== 'eligible') throw new Error('Choose eligible parent-reviewed content');
      const draft = await geminiService.draftLesson({
        title: content.title, url: content.url, provider: content.provider, rightsBasis: content.rightsBasis,
        ageBand: child.ageBand, skill: input.skill || 'comprehension', learningGoal: input.learningGoal || 'understand one key idea'
      });
      json(res, 200, { ...draft, status: 'candidate', parentApprovalRequired: true }); return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/lessons') {
      const input = await requestBody(req); const state = await store.snapshot();
      const child = state.children.find(item => item.id === input.childId);
      const candidate = state.content.find(item => item.id === input.contentId);
      if (!child) throw new Error('Choose a child profile');
      if (!candidate) throw new Error('Choose reviewed content');
      const checkpoint = {
        id: crypto.randomUUID(), skill: input.skill || 'letterSound',
        prompt: input.prompt || 'Which picture begins with /b/?',
        acceptedAnswers: input.acceptedAnswers?.length ? input.acceptedAnswers : ['ball'],
        choices: input.choices?.length ? input.choices.slice(0, 3) : ['ball', 'cat', 'sun'],
        hints: input.hints?.length ? input.hints : ['Stretch the first sound: b-b-b.'],
        placement: candidate.checkpointPlacements.includes('during') ? 'during' : 'after',
        explanation: input.explanation || 'Ball begins with the /b/ sound.'
      };
      const draft = createLesson({ candidate, skill: checkpoint.skill, ageBand: child.ageBand, questions: [checkpoint] });
      const lesson = {
        ...draft, id: crypto.randomUUID(), householdId: state.household.id, childId: child.id,
        title: input.title || 'Sound Safari', checkpoints: [checkpoint],
        status: input.parentApproved ? 'approved' : 'awaiting-parent-approval',
        approvedAt: input.parentApproved ? new Date().toISOString() : null
      };
      json(res, 201, await store.addLesson(lesson)); return true;
    }

    const approveMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)\/approve$/);
    if (req.method === 'POST' && approveMatch) {
      json(res, 200, await store.updateLesson(approveMatch[1], { status: 'approved', approvedAt: new Date().toISOString() })); return true;
    }

    if (req.method === 'POST' && url.pathname === '/api/sessions') {
      const input = await requestBody(req);
      json(res, 201, await startLessonSession(store, input.lessonId)); return true;
    }

    const answerMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/answer$/);
    if (req.method === 'POST' && answerMatch) {
      json(res, 200, await submitSessionAnswer(store, answerMatch[1], await requestBody(req))); return true;
    }
    return false;
  };
}

export function handleApiError(res, error) { json(res, 400, { error: error.message || 'Request failed' }); }
