const TRAITS = Object.freeze(['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'emotionalStability']);
const ALLOWED_LICENSES = new Set(['mit', 'apache-2.0', 'bsd-3-clause']);

const GIFT_STYLE_MAP = Object.freeze({
  openness: ['creative', 'travel', 'experience', 'books', 'art'],
  conscientiousness: ['practical', 'home', 'books'],
  extraversion: ['experience', 'music', 'food'],
  agreeableness: ['shared', 'charity', 'experience']
});

function clamp(value) { return Math.max(0, Math.min(1, Number(value))); }
function validScore(value) { return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1; }

export function validatePersonalityModelCard(card) {
  if (!card?.id || card.task !== 'big-five-regression') return { valid: false, reason: 'invalid-model-card' };
  if (!ALLOWED_LICENSES.has(String(card.license).toLowerCase())) return { valid: false, reason: 'license-not-approved' };
  if (!card.version || !card.trainingDomain || !card.metrics) return { valid: false, reason: 'model-provenance-incomplete' };
  if (!Number.isInteger(card.minimumWords) || card.minimumWords < 100) return { valid: false, reason: 'minimum-words-invalid' };
  if (!TRAITS.every(trait => Number.isFinite(card.metrics[trait]?.correlation) || Number.isFinite(card.metrics[trait]?.mse))) {
    return { valid: false, reason: 'trait-metrics-incomplete' };
  }
  return { valid: true };
}

export function createOpenPersonalityProvider({ modelCard, predict }) {
  const validation = validatePersonalityModelCard(modelCard);
  if (!validation.valid) throw new Error(validation.reason);
  if (typeof predict !== 'function') throw new TypeError('predict must be a function');
  return Object.freeze({
    modelCard: structuredClone(modelCard),
    async predict(text) {
      const result = await predict(text);
      if (!result || !TRAITS.every(trait => validScore(result[trait]))) throw new Error('invalid-model-output');
      return Object.freeze(Object.fromEntries(TRAITS.map(trait => [trait, clamp(result[trait])])));
    }
  });
}

export function createHttpPersonalityProvider({ modelCard, url, fetchImpl = globalThis.fetch, timeoutMs = 5_000 }) {
  const endpoint = new URL(url);
  const local = endpoint.hostname === '127.0.0.1' || endpoint.hostname === 'localhost' || endpoint.hostname === '::1';
  if (endpoint.protocol !== 'https:' && !local) throw new Error('personality-model-endpoint-must-use-https-or-loopback');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  return createOpenPersonalityProvider({
    modelCard,
    predict: async text => {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, modelId: modelCard.id, modelVersion: modelCard.version }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw new Error(`personality-model-http-${response.status}`);
      return response.json();
    }
  });
}

export function scoreIpip10(responses) {
  const keys = ['O1', 'O2R', 'C1', 'C2R', 'E1', 'E2R', 'A1', 'A2R', 'ES1', 'ES2R'];
  for (const key of keys) if (!Number.isInteger(responses?.[key]) || responses[key] < 1 || responses[key] > 5) throw new TypeError(`invalid response: ${key}`);
  const pair = (positive, reverse) => ((((responses[positive] + (6 - responses[reverse])) / 2) - 1) / 4);
  return Object.freeze({
    openness: pair('O1', 'O2R'),
    conscientiousness: pair('C1', 'C2R'),
    extraversion: pair('E1', 'E2R'),
    agreeableness: pair('A1', 'A2R'),
    emotionalStability: pair('ES1', 'ES2R')
  });
}

function validateConsent(consent, subjectId, now) {
  if (!consent?.receiptId || consent.subjectId !== subjectId || consent.status !== 'active') return 'active-subject-consent-required';
  if (!consent.scopes?.includes('personality.infer') || !consent.purposes?.includes('personality_self_discovery')) return 'personality-consent-required';
  if (consent.expiresAt && Date.parse(consent.expiresAt) <= Date.parse(now)) return 'personality-consent-expired';
  return null;
}

export async function assessPersonality({ subjectId, texts = [], consent, provider, questionnaireResponses, now = new Date().toISOString() } = {}) {
  const consentError = validateConsent(consent, subjectId, now);
  if (consentError) return { status: 'denied', reason: consentError };
  if (!provider) return { status: 'unavailable', reason: 'open-model-provider-required' };
  const normalizedTexts = texts.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean);
  const wordCount = normalizedTexts.join(' ').split(/\s+/).filter(Boolean).length;
  if (wordCount < provider.modelCard.minimumWords) return { status: 'needs_more_text', wordCount, minimumWords: provider.modelCard.minimumWords };

  const textScores = await provider.predict(normalizedTexts.join('\n'));
  const questionnaireScores = questionnaireResponses ? scoreIpip10(questionnaireResponses) : null;
  const textWeight = questionnaireScores ? .3 : 1;
  const questionnaireWeight = questionnaireScores ? .7 : 0;
  const traits = Object.fromEntries(TRAITS.map(trait => [trait, Number((textScores[trait] * textWeight + (questionnaireScores?.[trait] ?? 0) * questionnaireWeight).toFixed(4))]));
  const confidence = questionnaireScores ? .72 : .42;
  return Object.freeze({
    status: questionnaireScores ? 'calibrated' : 'experimental',
    subjectId,
    traits: Object.freeze(traits),
    confidence,
    wordCount,
    model: Object.freeze({ id: provider.modelCard.id, version: provider.modelCard.version, license: provider.modelCard.license, trainingDomain: provider.modelCard.trainingDomain }),
    questionnaireUsed: Boolean(questionnaireScores),
    generatedAt: now,
    rankEligible: false,
    notice: 'A fallible Big Five estimate for self-discovery; not a diagnosis.'
  });
}

export function approvePersonalityForGiftRanking(assessment, { subjectId, decision, at = new Date().toISOString() } = {}) {
  if (!assessment || !['calibrated', 'experimental'].includes(assessment.status)) throw new TypeError('completed assessment required');
  if (assessment.subjectId !== subjectId) throw new Error('only the assessed subject may approve use');
  if (decision !== 'approve_for_my_gifts') throw new Error('explicit gift-ranking approval required');
  return Object.freeze({ ...assessment, rankEligible: true, approvedBy: subjectId, approvedAt: at, approvedPurpose: 'gift_recommendation' });
}

export function personalityGiftSignals(assessment) {
  if (!assessment?.rankEligible || assessment.approvedPurpose !== 'gift_recommendation') return [];
  const candidates = [];
  for (const [trait, categories] of Object.entries(GIFT_STYLE_MAP)) {
    const score = assessment.traits[trait];
    if (score < .6) continue;
    for (const value of categories) candidates.push({
      id: `personality:${assessment.subjectId}:${trait}:${value}`,
      value,
      source: 'personality_hypothesis',
      confidence: Number((assessment.confidence * (score - .5) * 2).toFixed(4)),
      confirmed: true,
      subjectId: assessment.subjectId,
      provenance: { modelId: assessment.model.id, modelVersion: assessment.model.version, trait, approvedAt: assessment.approvedAt },
      explanationLabel: 'your optional gifting-style profile'
    });
  }
  return candidates.sort((a, b) => b.confidence - a.confidence).slice(0, 6);
}

export { TRAITS };
