import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const DEFAULT_MODEL = 'gemini-3.8-flash';
const DEFAULT_FALLBACK_MODELS = ['gemini-3.6-flash'];
const SECRET_CACHE_MS = 60 * 1000;
let cachedSecret;
let cachedSecretExpiresAt = 0;

async function readSecret(secretId) {
  if (cachedSecret && Date.now() < cachedSecretExpiresAt) return cachedSecret;
  const client = new SecretsManagerClient({});
  const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const parsed = JSON.parse(result.SecretString || '{}');
  cachedSecret = parsed.GEMINI_API_KEY || parsed.apiKey;
  cachedSecretExpiresAt = Date.now() + SECRET_CACHE_MS;
  return cachedSecret;
}

export async function resolveGeminiApiKey(env = process.env) {
  if (env.GEMINI_API_KEY) return env.GEMINI_API_KEY;
  if (env.GEMINI_SECRET_ID) return readSecret(env.GEMINI_SECRET_ID);
  return null;
}

function validateLessonDraft(value) {
  const answer = String(value?.correctAnswer || '').trim();
  const distractors = Array.isArray(value?.distractors) ? value.distractors.map(String).filter(Boolean).slice(0, 2) : [];
  if (!value?.title || !value?.prompt || !answer || !value?.hint || distractors.length !== 2) {
    throw new Error('Gemini returned an incomplete lesson draft');
  }
  return {
    title: String(value.title).slice(0, 80),
    skill: String(value.skill || 'comprehension').slice(0, 50),
    prompt: String(value.prompt).slice(0, 220),
    acceptedAnswers: [answer.slice(0, 80)],
    choices: [answer, ...distractors].map(item => item.slice(0, 80)),
    hints: [String(value.hint).slice(0, 220)],
    explanation: String(value.explanation || `The answer is ${answer}.`).slice(0, 240),
    source: 'gemini-candidate',
    model: String(value.model || '')
  };
}

export function createGeminiLessonService({
  apiKeyProvider = resolveGeminiApiKey,
  fetchImpl = fetch,
  model = process.env.GEMINI_MODEL || DEFAULT_MODEL,
  fallbackModels = DEFAULT_FALLBACK_MODELS,
  requestTimeoutMs = 10_000
} = {}) {
  return {
    async isConfigured() {
      return Boolean(await apiKeyProvider());
    },
    async draftLesson({ title, url, provider, rightsBasis, ageBand, skill, learningGoal }) {
      const apiKey = await apiKeyProvider();
      if (!apiKey) throw new Error('Gemini is not configured');
      const prompt = [
        'Create one short, child-safe learning checkpoint as JSON.',
        `Age band: ${ageBand}. Skill: ${skill}. Learning goal: ${learningGoal}.`,
        `Parent-approved source title: ${title}. Provider: ${provider}. URL: ${url}. Rights basis: ${rightsBasis}.`,
        'Do not quote dialogue, reproduce copyrighted material, diagnose a child, or infer private information.',
        'The question must work before or after playback and have one short correct answer, exactly two plausible distractors, one scaffolded hint, and one plain-language explanation.'
      ].join('\n');
      const requestBody = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          responseSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' }, skill: { type: 'string' }, prompt: { type: 'string' },
              correctAnswer: { type: 'string' }, distractors: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
              hint: { type: 'string' }, explanation: { type: 'string' }
            },
            required: ['title', 'skill', 'prompt', 'correctAnswer', 'distractors', 'hint', 'explanation']
          }
        }
      });
      const candidates = [...new Set([model, ...fallbackModels])];
      let lastError;
      for (const candidateModel of candidates) {
        let response;
        try {
          response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
            body: requestBody,
            signal: AbortSignal.timeout(requestTimeoutMs)
          });
        } catch (error) {
          lastError = error?.name === 'TimeoutError'
            ? new Error(`Gemini model ${candidateModel} timed out`)
            : error;
          if (candidateModel !== candidates.at(-1)) continue;
          throw lastError;
        }
        const payload = await response.json();
        if (!response.ok) {
          const message = payload?.error?.message || 'Gemini lesson generation failed';
          lastError = new Error(message);
          const capacityFailure = [429, 503].includes(response.status) || /high demand|temporarily unavailable|capacity/i.test(message);
          if (capacityFailure && candidateModel !== candidates.at(-1)) continue;
          throw lastError;
        }
        const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('');
        if (!text) throw new Error('Gemini returned no lesson draft');
        const draft = validateLessonDraft(JSON.parse(text));
        return { ...draft, model: candidateModel };
      }
      throw lastError || new Error('Gemini lesson generation failed');
    }
  };
}
