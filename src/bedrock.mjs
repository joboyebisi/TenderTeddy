import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

export const DEFAULT_BEDROCK_MODEL = 'global.amazon.nova-2-lite-v1:0';
let sharedClient;

export async function explainRecommendations({ recipient = {}, signals = [], recommendations = [] }, options = {}) {
  if (!recommendations.length) return fallback(recommendations);
  const enabled = options.enabled ?? process.env.BEDROCK_ENABLED === 'true';
  if (!enabled && !options.client) return fallback(recommendations);

  const modelId = options.modelId || process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL;
  const region = options.region || process.env.BEDROCK_REGION || process.env.AWS_REGION || 'eu-west-2';
  const client = options.client || (sharedClient ||= new BedrockRuntimeClient({ region }));
  const safeInput = {
    recipient: { displayName: recipient.displayName || 'the recipient', relationship: recipient.relationship || 'someone special', country: recipient.country },
    confirmedInterests: signals.map(item => item.value).filter(Boolean).slice(0, 12),
    candidates: recommendations.slice(0, 4).map(item => ({ id: item.id, name: item.name, guidePrice: item.price, story: item.story, matchedEvidence: (item.evidence || []).map(evidence => evidence.value).filter(Boolean) }))
  };

  try {
    const response = await client.send(new ConverseCommand({
      modelId,
      system: [{ text: 'You write concise, warm gift explanations for WanderWrap. Use only the supplied confirmed interests and candidates. Never invent product facts, availability, delivery, price, personality traits, or private data. Return strict JSON only: {"summary":"one spoken sentence","narratives":{"candidate-id":"one short sentence"}}.' }],
      messages: [{ role: 'user', content: [{ text: JSON.stringify(safeInput) }] }],
      inferenceConfig: { maxTokens: 400, temperature: 0.25, topP: 0.9 }
    }));
    const text = response.output?.message?.content?.find(item => item.text)?.text || '';
    const parsed = parseJson(text);
    if (!parsed?.summary || typeof parsed.narratives !== 'object') throw new Error('Bedrock returned an invalid explanation shape');
    return { summary: clean(parsed.summary, 360), narratives: Object.fromEntries(recommendations.map(item => [item.id, clean(parsed.narratives[item.id] || item.story, 280)])), generated: true, modelId };
  } catch (error) {
    return { ...fallback(recommendations), errorCode: error.name || 'BedrockError' };
  }
}

function fallback(recommendations) {
  const top = recommendations[0];
  return {
    summary: top ? `The strongest match is ${top.name}. ${top.story}` : 'Try a different interest or budget to find more ideas.',
    narratives: Object.fromEntries(recommendations.map(item => [item.id, item.story])),
    generated: false,
    modelId: null
  };
}

function parseJson(value) {
  const normalized = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(normalized); } catch { return null; }
}

function clean(value, limit) { return String(value || '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, limit); }
