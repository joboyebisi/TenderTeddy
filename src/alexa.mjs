import { currentPrompt, startLessonSession, stopLessonSession, submitSessionAnswer } from './session-service.mjs';

const speech = (text, attributes = {}, shouldEndSession = false) => ({
  version: '1.0', sessionAttributes: attributes,
  response: { outputSpeech: { type: 'PlainText', text }, shouldEndSession }
});

function slotValue(intent, name) {
  return intent?.slots?.[name]?.value?.trim();
}

export async function handleAlexaRequest(envelope, store) {
  const request = envelope?.request || {};
  const attributes = { ...(envelope?.session?.attributes || {}) };

  if (request.type === 'LaunchRequest') {
    return speech('Welcome to Tender Teddy. Say start lesson when your parent-approved lesson is ready.', attributes);
  }
  if (request.type === 'SessionEndedRequest') return speech('', attributes, true);
  if (request.type !== 'IntentRequest') throw new Error('Unsupported Alexa request type');

  const intent = request.intent || {};
  if (intent.name === 'StartLessonIntent') {
    const state = await store.snapshot();
    const lessonId = slotValue(intent, 'lessonId') || attributes.lessonId || state.lessons.find(item => item.status === 'approved')?.id;
    const session = await startLessonSession(store, lessonId);
    const prompt = await currentPrompt(store, session.id);
    return speech(`Your lesson is ready. ${prompt}`, { ...attributes, lessonId, sessionId: session.id });
  }
  if (intent.name === 'AnswerIntent') {
    if (!attributes.sessionId) throw new Error('Start a lesson before answering');
    const answer = slotValue(intent, 'answer');
    if (!answer) return speech('I did not catch an answer. Please say the picture name.', attributes);
    const result = await submitSessionAnswer(store, attributes.sessionId, { answer, channel: 'alexa-skill' });
    return speech(result.reply, { ...attributes, lastAnswer: answer, sessionStatus: result.sessionStatus });
  }
  if (intent.name === 'RepeatPromptIntent' || intent.name === 'AMAZON.RepeatIntent') {
    if (!attributes.sessionId) return speech('There is no active lesson. Say start lesson.', attributes);
    const prompt = await currentPrompt(store, attributes.sessionId);
    return speech(prompt || 'The lesson has finished.', attributes);
  }
  if (intent.name === 'StopLessonIntent' || intent.name === 'AMAZON.StopIntent' || intent.name === 'AMAZON.CancelIntent') {
    if (attributes.sessionId) await stopLessonSession(store, attributes.sessionId, 'alexa-skill');
    return speech('Okay. I stopped the Tender Teddy lesson.', { ...attributes, sessionStatus: 'stopped' }, true);
  }
  if (intent.name === 'AMAZON.HelpIntent') {
    return speech('You can say start lesson, repeat that, or answer with the picture name.', attributes);
  }
  return speech('I am not sure what you meant. Say help to hear your choices.', attributes);
}
