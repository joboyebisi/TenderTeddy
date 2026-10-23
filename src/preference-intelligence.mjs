import { createHash } from 'node:crypto';
import { normalizeGiftPreferenceLabel } from './gift-taxonomy.mjs';

/**
 * @typedef {'facebook'|'x'|'manual_export'} SocialProvider
 * @typedef {'post'|'bookmark'} ContentKind
 * @typedef {{
 *   provider: SocialProvider,
 *   accountOwnerId: string,
 *   enabled: boolean,
 *   consent: {
 *     subjectId: string,
 *     selfConsented: boolean,
 *     grantedAt: string,
 *     revokedAt?: string,
 *     scopes: string[],
 *     purposes: string[]
 *   }
 * }} SourceConnection
 * @typedef {{
 *   id: string,
 *   kind: ContentKind,
 *   authorId: string,
 *   text?: string,
 *   createdAt: string,
 *   url?: string,
 *   tags?: string[],
 *   categories?: string[]
 * }} SocialContent
 */

export const SOURCE_CAPABILITIES = Object.freeze({
  facebook: Object.freeze({ post: true, bookmark: false }),
  x: Object.freeze({ post: true, bookmark: true }),
  manual_export: Object.freeze({ post: true, bookmark: true })
});

const REQUIRED_SCOPES = Object.freeze({ post: 'posts.read', bookmark: 'bookmarks.read' });
const PURPOSE = 'preference_intelligence';
const DAY_MS = 86_400_000;

// These categories must never be inferred, stored as preference evidence, or
// exposed in explanations. Terms are deliberately conservative.
export const SENSITIVE_TRAIT_DENYLIST = Object.freeze({
  health: ['cancer', 'diabetes', 'depression', 'anxiety', 'therapy', 'pregnant', 'pregnancy', 'hiv', 'autism'],
  religion: ['christian', 'muslim', 'jewish', 'hindu', 'buddhist', 'church', 'mosque', 'synagogue'],
  politics: ['labour party', 'conservative party', 'democrat', 'republican', 'political party', 'voting for'],
  sexuality: ['gay', 'lesbian', 'bisexual', 'transgender', 'sexual orientation'],
  ethnicity: ['ethnicity', 'racial identity', 'black identity', 'asian identity'],
  disability: ['disabled', 'disability', 'wheelchair user'],
  finance: ['in debt', 'bankruptcy', 'credit score', 'salary', 'income']
});

const INTERESTS = Object.freeze({
  travel: ['travel', 'travelling', 'trip', 'city break', 'holiday'],
  food: ['food', 'cooking', 'baking', 'restaurant', 'coffee', 'tea'],
  books: ['books', 'book', 'reading', 'novel', 'bookshop'],
  music: ['music', 'concert', 'vinyl', 'guitar', 'piano'],
  creative: ['art', 'painting', 'drawing', 'museum', 'gallery', 'ceramics', 'pottery'],
  gardening: ['gardening', 'garden', 'plants', 'houseplants'],
  tech: ['technology', 'tech', 'gadgets', 'coding', 'robotics'],
  photography: ['photography', 'camera', 'photos'],
  outdoors: ['hiking', 'camping', 'outdoors', 'nature', 'cycling'],
  games: ['games', 'gaming', 'board games', 'chess', 'puzzles'],
  home: ['home decor', 'interiors', 'homemaking'],
  theatre: ['theatre', 'theater', 'musical', 'stage show']
});

function validDate(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function includesTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z])${escaped}(?:$|[^a-z])`, 'i').test(text);
}

export function sensitiveTraitLabels(text, categories = []) {
  const haystack = `${text} ${categories.join(' ')}`.toLowerCase();
  return Object.entries(SENSITIVE_TRAIT_DENYLIST)
    .filter(([, terms]) => terms.some(term => includesTerm(haystack, term)))
    .map(([trait]) => trait);
}

function stableId(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 20);
}

function freshness(createdAt, now) {
  const ageDays = Math.max(0, (now - createdAt) / DAY_MS);
  const score = Math.max(0.2, Math.exp(-ageDays / 365));
  return { ageDays: Math.floor(ageDays), score: Number(score.toFixed(3)) };
}

export function preferenceFreshness(createdAt, now = Date.now()) {
  const itemTime = typeof createdAt === 'number' ? createdAt : validDate(createdAt);
  const nowTime = typeof now === 'number' ? now : validDate(now);
  if (itemTime === null || nowTime === null) throw new TypeError('valid dates required');
  return freshness(itemTime, nowTime);
}

function invalid(reason, details = {}) {
  return { allowed: false, reason, ...details };
}

function normalizeInferenceText(text, maxChars) {
  return String(text ?? '')
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/**
 * Build the transient batch allowed to reach a preference model. The returned
 * text must be processed in-memory only and must not be logged or persisted.
 */
export function prepareAuthorizedPreferenceBatch({
  connection,
  subjectId,
  content = [],
  now = new Date().toISOString(),
  maxItems = 50,
  maxCharsPerItem = 2_000
} = {}) {
  const nowMs = validDate(now);
  if (nowMs === null) throw new TypeError('now must be an ISO-compatible date');
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 100) throw new TypeError('maxItems must be between 1 and 100');
  if (!Number.isInteger(maxCharsPerItem) || maxCharsPerItem < 100 || maxCharsPerItem > 10_000) throw new TypeError('maxCharsPerItem must be between 100 and 10000');
  const items = [];
  const rejected = [];

  for (const item of content.slice(0, maxItems)) {
    if (!item?.id || !item.kind || !item.authorId || validDate(item.createdAt) === null) {
      rejected.push({ id: item?.id ?? null, reason: 'invalid_content_contract' });
      continue;
    }
    const access = evaluateSourceAccess(connection, { subjectId, kind: item.kind, now });
    if (!access.allowed) {
      rejected.push({ id: item.id, reason: access.reason });
      continue;
    }
    if (item.authorId !== subjectId && item.kind === 'post') {
      rejected.push({ id: item.id, reason: 'content_not_authored_by_subject' });
      continue;
    }
    const traits = sensitiveTraitLabels(item.text ?? '', item.categories ?? []);
    if (traits.length) {
      rejected.push({ id: item.id, reason: 'sensitive_trait', traits });
      continue;
    }
    if (validDate(item.createdAt) > nowMs) {
      rejected.push({ id: item.id, reason: 'future_content' });
      continue;
    }
    const text = normalizeInferenceText(item.text, maxCharsPerItem);
    const metadata = [...(item.tags ?? []), ...(item.categories ?? [])]
      .map(normalizeGiftPreferenceLabel)
      .filter(Boolean);
    if (!text && metadata.length === 0) {
      rejected.push({ id: item.id, reason: 'empty_content' });
      continue;
    }
    items.push(Object.freeze({
      id: item.id,
      kind: item.kind,
      text,
      createdAt: item.createdAt,
      languageHint: item.languageHint ?? null,
      tags: Object.freeze(metadata)
    }));
  }
  if (content.length > maxItems) rejected.push({ id: null, reason: 'batch_limit_exceeded', omitted: content.length - maxItems });
  return { items, rejected };
}

/** Check provider capability and granular, current, subject-owned consent. */
export function evaluateSourceAccess(connection, { subjectId, kind, now = new Date().toISOString() } = {}) {
  if (!connection || !SOURCE_CAPABILITIES[connection.provider]) return invalid('unsupported_provider');
  const nowMs = validDate(now);
  if (nowMs === null) return invalid('invalid_evaluation_time');
  if (!connection.enabled) return invalid('source_disabled');
  if (!SOURCE_CAPABILITIES[connection.provider][kind]) return invalid('capability_unavailable');
  if (!subjectId || connection.accountOwnerId !== subjectId) return invalid('account_not_owned_by_subject');
  const consent = connection.consent;
  if (!consent?.selfConsented || consent.subjectId !== subjectId) return invalid('subject_consent_required');
  if (validDate(consent.grantedAt) === null || validDate(consent.grantedAt) > nowMs) return invalid('invalid_consent_time');
  if (consent.revokedAt) return invalid('consent_revoked');
  if (!consent.purposes?.includes(PURPOSE)) return invalid('purpose_not_consented');
  const requiredScope = REQUIRED_SCOPES[kind];
  if (!requiredScope || !consent.scopes?.includes(requiredScope)) return invalid('scope_not_consented', { requiredScope });
  return { allowed: true, provider: connection.provider, scope: requiredScope, purpose: PURPOSE };
}

function explicitInterestMatches(item) {
  const text = (item.text ?? '').toLowerCase();
  const metadata = [...(item.tags ?? []), ...(item.categories ?? [])].map(value => String(value).toLowerCase());
  const matches = [];
  for (const [interest, aliases] of Object.entries(INTERESTS)) {
    const metadataMatch = metadata.some(value => value === interest || aliases.includes(value));
    const phraseMatch = aliases.some(alias => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b(?:i love|i like|i enjoy|i'm into|i am into|my favourite|my favorite|interested in|wish ?list|want to try)[^.!?\\n]{0,48}(?:^|[^a-z])${escaped}(?:$|[^a-z])`, 'i').test(text);
    });
    const hashtagMatch = aliases.some(alias => text.includes(`#${alias.replaceAll(' ', '')}`));
    if (metadataMatch || phraseMatch || hashtagMatch) {
      const basis = metadataMatch ? 'declared_metadata' : phraseMatch ? 'explicit_statement' : 'hashtag';
      matches.push({ interest, basis });
    }
  }
  return matches;
}

/**
 * Extract confirmation candidates, never ranking evidence, from authorized
 * structured content. Invalid or sensitive records are reported but discarded.
 */
export function extractPreferenceCandidates({ connection, subjectId, content = [], now = new Date().toISOString() } = {}) {
  const nowMs = validDate(now);
  if (nowMs === null) throw new TypeError('now must be an ISO-compatible date');
  const candidates = [];
  const prepared = prepareAuthorizedPreferenceBatch({ connection, subjectId, content, now });
  for (const item of prepared.items) {
    const itemTime = validDate(item.createdAt);
    const fresh = freshness(itemTime, nowMs);
    for (const match of explicitInterestMatches(item)) {
      const base = item.kind === 'bookmark' ? 0.76 : match.basis === 'explicit_statement' ? 0.84 : 0.68;
      candidates.push(Object.freeze({
        id: `pc_${stableId([connection.provider, subjectId, item.id, match.interest])}`,
        subjectId,
        value: match.interest,
        kind: 'interest',
        status: 'needs_confirmation',
        rankEligible: false,
        confidence: Number((base * fresh.score).toFixed(3)),
        freshness: fresh,
        observedAt: item.createdAt,
        provenance: Object.freeze({
          provider: connection.provider,
          contentId: item.id,
          contentKind: item.kind,
          basis: match.basis,
          collectedUnderPurpose: PURPOSE,
          consentGrantedAt: connection.consent.grantedAt
        })
      }));
    }
  }
  return { candidates, rejected: prepared.rejected };
}

/** Confirm or reject a candidate through an attributable user action. */
export function resolvePreferenceCandidate(candidate, { decision, actorId, at = new Date().toISOString(), connection } = {}) {
  if (!candidate || candidate.status !== 'needs_confirmation') throw new TypeError('candidate must need confirmation');
  if (actorId !== candidate.subjectId) throw new Error('only the subject may confirm preference evidence');
  if (!['confirm', 'reject'].includes(decision)) throw new TypeError('decision must be confirm or reject');
  if (validDate(at) === null) throw new TypeError('at must be an ISO-compatible date');
  if (decision === 'reject') {
    return { ...candidate, status: 'rejected', rankEligible: false, resolvedAt: at, resolvedBy: actorId };
  }
  if (validDate(at) < validDate(candidate.observedAt)) throw new Error('confirmation cannot predate the observation');
  if (!connection || connection.provider !== candidate.provenance?.provider) throw new Error('matching source connection is required');
  const access = evaluateSourceAccess(connection, { subjectId: candidate.subjectId, kind: candidate.provenance.contentKind, now: at });
  if (!access.allowed) throw new Error(`source access denied: ${access.reason}`);
  return Object.freeze({
    id: `pe_${candidate.id.slice(3)}`,
    subjectId: candidate.subjectId,
    value: candidate.value,
    source: 'recipient_confirmed',
    kind: 'confirmed_interest',
    status: 'confirmed',
    rankEligible: true,
    confidence: candidate.confidence,
    freshness: candidate.freshness,
    observedAt: candidate.observedAt,
    confirmedAt: at,
    confirmedBy: actorId,
    provenance: candidate.provenance
  });
}

const BIG_FIVE_MARKERS = Object.freeze({
  openness: ['curious', 'imagine', 'creative', 'art', 'explore', 'novel'],
  conscientiousness: ['plan', 'organise', 'organize', 'deadline', 'routine', 'prepared'],
  extraversion: ['party', 'together', 'friends', 'social', 'meetup', 'crowd'],
  agreeableness: ['kind', 'help', 'support', 'grateful', 'care', 'volunteer'],
  emotionalSensitivity: ['worried', 'stress', 'nervous', 'overwhelmed', 'uncertain']
});

/**
 * Produce explicitly unverified Big Five-style hypotheses. These are available
 * only for self-reflection UX and are structurally barred from gift ranking.
 */
export function hypothesizeBigFive({ connection, subjectId, content = [], now = new Date().toISOString(), minimumSamples = 20, minimumSpanDays = 30 } = {}) {
  const baseAccess = evaluateSourceAccess(connection, { subjectId, kind: 'post', now });
  if (!baseAccess.allowed) return invalid(baseAccess.reason);
  if (!connection.consent.scopes.includes('personality.hypothesize')) return invalid('personality_scope_not_consented');
  if (!connection.consent.purposes.includes('self_reflection')) return invalid('personality_purpose_not_consented');
  const eligible = content.filter(item =>
    item?.kind === 'post' && item.authorId === subjectId && validDate(item.createdAt) !== null &&
    validDate(item.createdAt) <= validDate(now) && sensitiveTraitLabels(item.text ?? '', item.categories ?? []).length === 0
  );
  if (eligible.length < minimumSamples) return invalid('insufficient_sample', { sampleSize: eligible.length, minimumSamples });
  const times = eligible.map(item => validDate(item.createdAt));
  const spanDays = Math.floor((Math.max(...times) - Math.min(...times)) / DAY_MS);
  if (spanDays < minimumSpanDays) return invalid('insufficient_time_span', { spanDays, minimumSpanDays });
  const hypotheses = Object.entries(BIG_FIVE_MARKERS).map(([trait, markers]) => {
    const hits = eligible.reduce((count, item) => count + markers.filter(marker => includesTerm(item.text ?? '', marker)).length, 0);
    const score = Number(Math.min(1, 0.35 + hits / (eligible.length * 3)).toFixed(3));
    return Object.freeze({ trait, score, label: 'unverified_hypothesis', rankEligible: false });
  });
  return {
    allowed: true,
    subjectId,
    sampleSize: eligible.length,
    spanDays,
    generatedAt: now,
    status: 'unverified_hypotheses',
    permittedUse: 'self_reflection_only',
    rankEligible: false,
    hypotheses
  };
}

/** Defense-in-depth selector for consumers of recommendation evidence. */
export function rankablePreferenceEvidence(records = []) {
  return records.filter(record =>
    record?.kind === 'confirmed_interest' && record.status === 'confirmed' && record.rankEligible === true
  );
}
