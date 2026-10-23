import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BEDROCK_MODEL, explainRecommendations } from '../src/bedrock.mjs';

const recommendations = [{ id: 'ceramic', name: 'Ceramic workshop', price: 38, story: 'A tactile afternoon.', evidence: [{ value: 'creative' }] }];

test('Bedrock explanation uses Nova Converse and preserves trusted recommendation facts', async () => {
  let input;
  const client = { send: async command => {
    input = command.input;
    return { output: { message: { content: [{ text: '{"summary":"A creative afternoon made for them.","narratives":{"ceramic":"Hands-on and grounded in their confirmed creative interest."}}' }] } } };
  } };
  const result = await explainRecommendations({ recipient: { displayName: 'Maya' }, signals: [{ value: 'creative' }], recommendations }, { client });
  assert.equal(input.modelId, DEFAULT_BEDROCK_MODEL);
  assert.equal(input.inferenceConfig.temperature, 0.25);
  assert.equal(result.generated, true);
  assert.match(result.narratives.ceramic, /confirmed creative interest/);
});

test('Bedrock failure falls back to deterministic copy without breaking gifting', async () => {
  const result = await explainRecommendations({ recommendations }, { client: { send: async () => { throw Object.assign(new Error('denied'), { name: 'AccessDeniedException' }); } } });
  assert.equal(result.generated, false);
  assert.equal(result.narratives.ceramic, recommendations[0].story);
  assert.equal(result.errorCode, 'AccessDeniedException');
});
