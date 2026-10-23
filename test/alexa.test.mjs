import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAlexaRequest } from '../src/alexa.mjs';
import { FamilyStore } from '../src/family-store.mjs';

test('Alexa launch and help responses keep the skill session open', async () => {
  const store = new FamilyStore();
  const launch = await handleAlexaRequest({ request: { type: 'LaunchRequest' }, session: { attributes: {} } }, store);
  assert.equal(launch.response.shouldEndSession, false);
  assert.match(launch.response.outputSpeech.text, /start lesson/i);
  const help = await handleAlexaRequest({
    request: { type: 'IntentRequest', intent: { name: 'AMAZON.HelpIntent' } }, session: { attributes: {} }
  }, store);
  assert.match(help.response.outputSpeech.text, /repeat/i);
});
