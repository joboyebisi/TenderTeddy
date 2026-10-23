import { createHash } from 'node:crypto';
import { GIFT_PREFERENCE_LABELS, GIFT_TAXONOMY_VERSION, normalizeGiftPreferenceLabel } from './gift-taxonomy.mjs';
import { preferenceFreshness, prepareAuthorizedPreferenceBatch } from './preference-intelligence.mjs';

const ALLOWED_LICENSES = new Set(['mit', 'apache-2.0', 'bsd-3-clause']);
const ALLOWED_INTENTS = new Set(['interest', 'want', 'dislike']);
const ALLOWED_POLARITIES = new Set(['positive', 'negative']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const SCHEMA_VERSION = 'wanderwrap.preference.inference.v1';

function probability(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function stableId(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 20);
}

function modelSummary(card) {
  return Object.freeze({
    id: card.id,
    version: card.version,
    baseModel: card.baseModel,
    weightsSha256: card.weightsSha256,
    taxonomyVersion: card.taxonomyVersion
  });
}

export function validateGiftPreferenceModelCard(card) {
  if (!card?.id || !card.version || card.task !== 'gift-preference-extraction') return { valid: false, reason: 'invalid-model-card' };
  if (card.baseModel !== 'FacebookAI/xlm-roberta-base') return { valid: false, reason: 'unsupported-base-model' };
  if (!ALLOWED_LICENSES.has(String(card.license).toLowerCase())) return { valid: false, reason: 'license-not-approved' };
  if (!SHA256_PATTERN.test(card.weightsSha256 ?? '')) return { valid: false, reason: 'weights-checksum-required' };
  if (card.taxonomyVersion !== GIFT_TAXONOMY_VERSION) return { valid: false, reason: 'taxonomy-version-unsupported' };
  if (!card.trainingDomain || !card.datasetRights) return { valid: false, reason: 'model-provenance-incomplete' };
  if (!Array.isArray(card.supportedLanguages) || card.supportedLanguages.length === 0) return { valid: false, reason: 'supported-languages-required' };
  if (!Number.isInteger(card.maxBatchItems) || card.maxBatchItems < 1 || card.maxBatchItems > 100) return { valid: false, reason: 'max-batch-items-invalid' };
  if (!Number.isInteger(card.maxCharsPerItem) || card.maxCharsPerItem < 100 || card.maxCharsPerItem > 10_000) return { valid: false, reason: 'max-chars-invalid' };
  if (!probability(card.defaultThreshold) || card.defaultThreshold < 0.5) return { valid: false, reason: 'default-threshold-invalid' };
  if (!probability(card.metrics?.macroPrecision) || !probability(card.metrics?.criticalNegationAccuracy) || !probability(card.metrics?.subjectAttributionAccuracy)) {
    return { valid: false, reason: 'validation-metrics-incomplete' };
  }
  for (const [label, threshold] of Object.entries(card.thresholds ?? {})) {
    if (!GIFT_PREFERENCE_LABELS.includes(label) || !probability(threshold)) return { valid: false, reason: 'label-threshold-invalid' };
  }
  return { valid: true };
}

function validateModelResponse(response, items, card) {
  if (response?.schemaVersion !== SCHEMA_VERSION) throw new Error('invalid-model-schema');
  if (response.model?.id !== card.id || response.model?.version !== card.version ||
      response.model?.weightsSha256 !== card.weightsSha256 || response.model?.taxonomyVersion !== card.taxonomyVersion) {
    throw new Error('model-identity-mismatch');
  }
  if (!Array.isArray(response.predictions)) throw new Error('invalid-model-predictions');
  const allowedItemIds = new Set(items.map(item => item.id));
  const seenItemIds = new Set();
  for (const prediction of response.predictions) {
    if (!allowedItemIds.has(prediction?.contentId) || seenItemIds.has(prediction.contentId)) throw new Error('invalid-model-content-reference');
    seenItemIds.add(prediction.contentId);
    if (prediction.abstained === true) continue;
    if (!Array.isArray(prediction.labels)) throw new Error('invalid-model-labels');
    const seenLabels = new Set();
    for (const result of prediction.labels) {
      const label = normalizeGiftPreferenceLabel(result?.label);
      if (!label || label !== result.label || seenLabels.has(label)) throw new Error('invalid-model-label');
      if (!ALLOWED_INTENTS.has(result.intent) || !ALLOWED_POLARITIES.has(result.polarity)) throw new Error('invalid-model-semantics');
      if (!probability(result.confidence) || !probability(result.calibratedConfidence)) throw new Error('invalid-model-confidence');
      seenLabels.add(label);
    }
  }
  return response;
}

export function createOpenGiftPreferenceProvider({ modelCard, predictBatch }) {
  const validation = validateGiftPreferenceModelCard(modelCard);
  if (!validation.valid) throw new Error(validation.reason);
  if (typeof predictBatch !== 'function') throw new TypeError('predictBatch must be a function');
  return Object.freeze({
    modelCard: structuredClone(modelCard),
    async predictBatch(items) {
      const response = await predictBatch(structuredClone(items));
      return validateModelResponse(response, items, modelCard);
    }
  });
}

export function createHttpGiftPreferenceProvider({ modelCard, url, fetchImpl = globalThis.fetch, timeoutMs = 5_000 }) {
  const endpoint = new URL(url);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !local) throw new Error('preference-model-endpoint-must-use-https-or-loopback');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch implementation required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) throw new TypeError('timeoutMs must be between 100 and 30000');
  return createOpenGiftPreferenceProvider({
    modelCard,
    predictBatch: async items => {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: SCHEMA_VERSION,
          requestId: `pref_${stableId([modelCard.id, modelCard.version, ...items.map(item => item.id)])}`,
          model: modelSummary(modelCard),
          items: items.map(({ id, text, createdAt, languageHint }) => ({ contentId: id, text, createdAt, languageHint }))
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) throw new Error(`preference-model-http-${response.status}`);
      return response.json();
    }
  });
}

/**
 * Run an authorized transient batch through the model. Every returned clue is
 * proposal-only until the data subject confirms it through the existing flow.
 */
export async function inferGiftPreferenceCandidates({ connection, subjectId, content = [], provider, now = new Date().toISOString() } = {}) {
  if (!provider?.modelCard || typeof provider.predictBatch !== 'function') return { status: 'unavailable', reason: 'gift-preference-provider-required', candidates: [], rejected: [] };
  const card = provider.modelCard;
  const prepared = prepareAuthorizedPreferenceBatch({
    connection,
    subjectId,
    content,
    now,
    maxItems: card.maxBatchItems,
    maxCharsPerItem: card.maxCharsPerItem
  });
  if (prepared.items.length === 0) {
    return { status: 'no_eligible_content', candidates: [], rejected: prepared.rejected, model: modelSummary(card) };
  }

  let response;
  try {
    response = await provider.predictBatch(prepared.items);
  } catch {
    return { status: 'unavailable', reason: 'model-inference-failed', candidates: [], rejected: prepared.rejected, model: modelSummary(card) };
  }

  const byId = new Map(prepared.items.map(item => [item.id, item]));
  const candidates = [];
  const rejected = [...prepared.rejected];
  for (const prediction of response.predictions) {
    const item = byId.get(prediction.contentId);
    if (prediction.abstained) {
      rejected.push({ id: item.id, reason: prediction.abstainReason || 'model_abstained' });
      continue;
    }
    for (const result of prediction.labels) {
      const threshold = card.thresholds?.[result.label] ?? card.defaultThreshold;
      if (result.calibratedConfidence < threshold) {
        rejected.push({ id: item.id, reason: 'below_model_threshold', label: result.label });
        continue;
      }
      if (result.intent === 'dislike' || result.polarity === 'negative') {
        rejected.push({ id: item.id, reason: 'negative_signal_requires_exclusion_flow', label: result.label });
        continue;
      }
      const fresh = preferenceFreshness(item.createdAt, now);
      const confidence = Number((result.calibratedConfidence * fresh.score).toFixed(3));
      const contentHash = createHash('sha256').update(item.text).digest('hex');
      candidates.push(Object.freeze({
        id: `pc_${stableId([connection.provider, subjectId, item.id, result.label, card.id, card.version])}`,
        subjectId,
        value: result.label,
        kind: 'interest',
        intent: result.intent,
        status: 'needs_confirmation',
        rankEligible: false,
        confidence,
        freshness: fresh,
        observedAt: item.createdAt,
        provenance: Object.freeze({
          provider: connection.provider,
          contentId: item.id,
          contentKind: item.kind,
          contentHash,
          basis: 'xlmr_multitask',
          collectedUnderPurpose: 'preference_intelligence',
          consentGrantedAt: connection.consent.grantedAt,
          modelId: card.id,
          modelVersion: card.version,
          baseModel: card.baseModel,
          weightsSha256: card.weightsSha256,
          taxonomyVersion: card.taxonomyVersion,
          language: prediction.language ?? item.languageHint ?? null
        })
      }));
    }
  }
  return { status: 'completed', candidates, rejected, model: modelSummary(card) };
}

export { SCHEMA_VERSION as GIFT_PREFERENCE_INFERENCE_SCHEMA_VERSION };
