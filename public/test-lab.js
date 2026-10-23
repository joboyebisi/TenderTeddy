const $ = selector => document.querySelector(selector);
let family = null;
let activeSessionId = null;
let alexaAttributes = {};
let previousAnswerCount = 0;

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Simulator request failed');
  return value;
}

function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 2400);
}

function addEvent(channel, type, detail) {
  const log = $('#eventLog'); log.querySelector('.empty')?.remove();
  const item = document.createElement('div'); item.className = 'event';
  item.innerHTML = `<time>${new Date().toLocaleTimeString()}</time><b>${channel}</b><span><strong>${type}</strong> · ${detail}</span>`;
  log.prepend(item);
}

function currentSession() { return family?.sessions.find(item => item.id === activeSessionId); }
function approvedLesson() { return family?.lessons.find(item => item.status === 'approved'); }

function render() {
  const child = family?.children[0]; const lesson = approvedLesson(); const session = currentSession();
  $('#serverLight').classList.add('on'); $('#serverStatus').textContent = 'Local API connected';
  $('#familySummary').textContent = child && lesson ? `${child.displayName} · ${lesson.title}` : 'No approved demo lesson';
  $('#startSession').disabled = !lesson;
  $('#sessionSummary').textContent = session ? `${session.status} · ${session.attempts} attempt${session.attempts === 1 ? '' : 's'}` : 'Not started';
  const checkpoint = lesson?.checkpoints[0];
  if (checkpoint) $('#tvPrompt').textContent = checkpoint.prompt;
  const active = session && !['completed', 'stopped'].includes(session.status);
  document.querySelectorAll('[data-answer]').forEach(button => { button.disabled = !active; });
  $('#tvConnection').textContent = session ? `Session ${session.id.slice(0, 8)} · ${session.status}` : 'Waiting for a session';
  if (!session) $('#tvFeedback').textContent = 'Remote and Alexa answers arrive in the same session.';
  else if (session.status === 'completed') $('#tvFeedback').textContent = 'Checkpoint complete. Progress is visible to the parent.';
  else if (session.status === 'stopped') $('#tvFeedback').textContent = 'The session was stopped.';
}

async function refresh({ logNewAnswers = false } = {}) {
  family = await api('/api/family');
  const session = currentSession();
  if (logNewAnswers && session && session.answers.length > previousAnswerCount) {
    for (const answer of session.answers.slice(previousAnswerCount)) addEvent(answer.channel, 'ANSWER_SUBMITTED', `${answer.answer} · ${answer.correct ? 'correct' : 'try again'}`);
  }
  previousAnswerCount = session?.answers.length || 0; render();
}

async function setupDemo() {
  $('#setupDemo').disabled = true;
  try {
    await refresh();
    let child = family.children[0];
    if (!child) child = await api('/api/children', { method: 'POST', body: JSON.stringify({ displayName: 'Amina', ageBand: '5-7', voiceEnabled: true }) });
    let content = family.content.find(item => item.status === 'eligible');
    if (!content) content = await api('/api/content/review', { method: 'POST', body: JSON.stringify({
      url: 'https://youtube.com/watch?v=tenderteddy-demo', title: 'Sound Safari demo', rightsBasis: 'Synthetic local simulator fixture', embeddable: true, madeForKidsChecked: true
    }) });
    if (!family.lessons.some(item => item.status === 'approved')) await api('/api/lessons', { method: 'POST', body: JSON.stringify({
      childId: child.id, contentId: content.id, title: 'Sound Safari', skill: 'letterSound', parentApproved: true
    }) });
    await refresh(); addEvent('parent-app', 'LESSON_APPROVED', 'Sound Safari is ready for device testing'); toast('Demo family and approved lesson are ready.');
  } catch (error) { toast(error.message); }
  finally { $('#setupDemo').disabled = false; }
}

async function startSession() {
  try {
    const session = await api('/api/sessions', { method: 'POST', body: JSON.stringify({ lessonId: approvedLesson().id }) });
    activeSessionId = session.id; alexaAttributes = { lessonId: session.lessonId, sessionId: session.id };
    previousAnswerCount = 0; await refresh();
    document.querySelector('[data-answer="ball"]').focus(); addEvent('session-service', 'CHECKPOINT_OPENED', `Session ${session.id.slice(0, 8)}`);
  } catch (error) { toast(error.message); }
}

async function submitRemoteAnswer(answer) {
  if (!activeSessionId) return;
  try {
    const result = await api(`/api/sessions/${activeSessionId}/answer`, { method: 'POST', body: JSON.stringify({ answer, channel: 'fire-tv-remote' }) });
    $('#tvFeedback').textContent = result.reply;
    const button = document.querySelector(`[data-answer="${answer}"]`); button.classList.add(result.correct ? 'correct' : 'try');
    await refresh({ logNewAnswers: true });
  } catch (error) { toast(error.message); }
}

function alexaIntent(utterance) {
  const clean = utterance.toLowerCase().trim();
  if (clean.includes('start lesson')) return { name: 'StartLessonIntent', slots: {} };
  if (clean.includes('repeat')) return { name: 'RepeatPromptIntent', slots: {} };
  if (clean === 'stop' || clean.includes('stop lesson')) return { name: 'StopLessonIntent', slots: {} };
  if (clean === 'help') return { name: 'AMAZON.HelpIntent', slots: {} };
  return { name: 'AnswerIntent', slots: { answer: { name: 'answer', value: clean.replace(/^the answer is /, '') } } };
}

async function sendAlexa(utterance) {
  if (!utterance.trim()) return;
  const user = document.createElement('div'); user.className = 'bubble user'; user.textContent = utterance; $('#conversation').append(user);
  const intent = alexaIntent(utterance);
  const envelope = { version: '1.0', session: { new: !alexaAttributes.sessionId, sessionId: `lab-${Date.now()}`, attributes: alexaAttributes }, request: { type: 'IntentRequest', requestId: `request-${Date.now()}`, timestamp: new Date().toISOString(), locale: 'en-GB', intent } };
  $('.echo-ring').classList.add('listening');
  try {
    const response = await api('/api/alexa', { method: 'POST', body: JSON.stringify(envelope) });
    alexaAttributes = response.sessionAttributes || alexaAttributes;
    if (alexaAttributes.sessionId) activeSessionId = alexaAttributes.sessionId;
    const text = response.response.outputSpeech.text || 'Session ended.';
    const bubble = document.createElement('div'); bubble.className = 'bubble alexa'; bubble.textContent = text; $('#conversation').append(bubble);
    $('#alexaJson').textContent = JSON.stringify({ request: envelope, response }, null, 2);
    addEvent('alexa-skill', intent.name, utterance); await refresh({ logNewAnswers: true });
    $('#conversation').scrollTop = $('#conversation').scrollHeight;
  } catch (error) { toast(error.message); }
  finally { $('.echo-ring').classList.remove('listening'); }
}

$('#setupDemo').onclick = setupDemo;
$('#startSession').onclick = startSession;
document.querySelectorAll('[data-answer]').forEach(button => { button.onclick = () => submitRemoteAnswer(button.dataset.answer); });
document.querySelectorAll('[data-key]').forEach(button => { button.onclick = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: button.dataset.key })); });
document.addEventListener('keydown', event => {
  const choices = [...document.querySelectorAll('[data-answer]:not(:disabled)')]; if (!choices.length) return;
  const current = choices.indexOf(document.activeElement);
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); choices[(current <= 0 ? choices.length : current) - 1].focus(); }
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); choices[(current + 1) % choices.length].focus(); }
  if (event.key === 'Enter' && choices.includes(document.activeElement)) { event.preventDefault(); document.activeElement.click(); }
});
$('#alexaForm').onsubmit = event => { event.preventDefault(); const value = $('#utterance').value; $('#utterance').value = ''; sendAlexa(value); };
document.querySelectorAll('.quick-utterances button').forEach(button => { button.onclick = () => sendAlexa(button.textContent); });
$('#clearLog').onclick = () => { $('#eventLog').innerHTML = '<p class="empty">The visible event log was cleared. Stored session data is unchanged.</p>'; };

refresh().catch(error => { $('#serverStatus').textContent = 'API unavailable'; toast(error.message); });
setInterval(() => refresh({ logNewAnswers: true }).catch(() => {}), 1500);
