import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSourceAccess,
  extractPreferenceCandidates,
  hypothesizeBigFive,
  rankablePreferenceEvidence,
  resolvePreferenceCandidate
} from '../src/preference-intelligence.mjs';

const NOW = '2026-10-22T12:00:00.000Z';
const consent = (overrides = {}) => ({
  provider: 'x', accountOwnerId: 'maya', enabled: true,
  consent: {
    subjectId: 'maya', selfConsented: true, grantedAt: '2026-01-01T00:00:00.000Z',
    scopes: ['posts.read', 'bookmarks.read'], purposes: ['preference_intelligence'], ...overrides
  }
});
const post = (id, text, createdAt = '2026-10-01T00:00:00.000Z') => ({ id, kind: 'post', authorId: 'maya', text, createdAt });

test('requires current, granular, subject-owned consent', () => {
  assert.equal(evaluateSourceAccess(consent(), { subjectId: 'maya', kind: 'post', now: NOW }).allowed, true);
  assert.equal(evaluateSourceAccess(consent(), { subjectId: 'other', kind: 'post', now: NOW }).reason, 'account_not_owned_by_subject');
  assert.equal(evaluateSourceAccess(consent({ revokedAt: '2026-09-01T00:00:00Z' }), { subjectId: 'maya', kind: 'post', now: NOW }).reason, 'consent_revoked');
  assert.equal(evaluateSourceAccess(consent({ scopes: ['bookmarks.read'] }), { subjectId: 'maya', kind: 'post', now: NOW }).reason, 'scope_not_consented');
});

test('enforces provider capabilities instead of pretending APIs expose data', () => {
  const facebook = { ...consent(), provider: 'facebook' };
  assert.equal(evaluateSourceAccess(facebook, { subjectId: 'maya', kind: 'bookmark', now: NOW }).reason, 'capability_unavailable');
});

test('extracts only explicit controlled interests with provenance', () => {
  const result = extractPreferenceCandidates({
    connection: consent(), subjectId: 'maya', now: NOW,
    content: [post('1', 'I love pottery and reading.'), post('2', 'Walked past a shop today.')]
  });
  assert.deepEqual(result.candidates.map(x => x.value).sort(), ['books', 'creative']);
  assert.equal(result.candidates[0].status, 'needs_confirmation');
  assert.equal(result.candidates[0].rankEligible, false);
  assert.equal(result.candidates[0].provenance.provider, 'x');
  assert.equal(result.candidates[0].provenance.contentId, '1');
  assert.ok(result.candidates[0].confidence > 0 && result.candidates[0].confidence <= 1);
});

test('supports structured bookmark metadata without analysing arbitrary prose', () => {
  const { candidates } = extractPreferenceCandidates({
    connection: consent(), subjectId: 'maya', now: NOW,
    content: [{ id: 'b1', kind: 'bookmark', authorId: 'someone-else', text: 'A product', tags: ['travel'], createdAt: '2026-10-20T00:00:00Z' }]
  });
  assert.equal(candidates[0].value, 'travel');
  assert.equal(candidates[0].provenance.basis, 'declared_metadata');
});

test('discards sensitive content and does not retain its text', () => {
  const result = extractPreferenceCandidates({ connection: consent(), subjectId: 'maya', now: NOW, content: [post('s1', 'I love books and I am in therapy')] });
  assert.equal(result.candidates.length, 0);
  assert.deepEqual(result.rejected, [{ id: 's1', reason: 'sensitive_trait', traits: ['health'] }]);
  assert.equal(JSON.stringify(result).includes('therapy'), false);
});

test('rejects third-party posts even through the subject connection', () => {
  const foreign = { ...post('f1', 'I love music'), authorId: 'friend' };
  const result = extractPreferenceCandidates({ connection: consent(), subjectId: 'maya', now: NOW, content: [foreign] });
  assert.equal(result.rejected[0].reason, 'content_not_authored_by_subject');
});

test('confirmation creates attributable rankable evidence', () => {
  const { candidates } = extractPreferenceCandidates({ connection: consent(), subjectId: 'maya', now: NOW, content: [post('1', 'I love reading')] });
  const evidence = resolvePreferenceCandidate(candidates[0], { decision: 'confirm', actorId: 'maya', at: NOW, connection: consent() });
  assert.equal(evidence.kind, 'confirmed_interest');
  assert.equal(evidence.rankEligible, true);
  assert.deepEqual(rankablePreferenceEvidence([candidates[0], evidence]), [evidence]);
  assert.throws(() => resolvePreferenceCandidate(candidates[0], { decision: 'confirm', actorId: 'gifter', at: NOW, connection: consent() }), /only the subject/);
  assert.throws(
    () => resolvePreferenceCandidate(candidates[0], { decision: 'confirm', actorId: 'maya', at: NOW, connection: consent({ revokedAt: '2026-10-21T00:00:00Z' }) }),
    /consent_revoked/
  );
});

test('rejection can never enter ranking', () => {
  const { candidates } = extractPreferenceCandidates({ connection: consent(), subjectId: 'maya', now: NOW, content: [post('1', '#travel')] });
  const rejected = resolvePreferenceCandidate(candidates[0], { decision: 'reject', actorId: 'maya', at: NOW });
  assert.equal(rejected.rankEligible, false);
  assert.deepEqual(rankablePreferenceEvidence([rejected]), []);
});

test('personality hypotheses require separate opt-in and sufficient samples', () => {
  const noScope = hypothesizeBigFive({ connection: consent(), subjectId: 'maya', content: [], now: NOW });
  assert.equal(noScope.reason, 'personality_scope_not_consented');
  const optedIn = consent({
    scopes: ['posts.read', 'personality.hypothesize'],
    purposes: ['preference_intelligence', 'self_reflection']
  });
  const sparse = hypothesizeBigFive({ connection: optedIn, subjectId: 'maya', content: [post('1', 'I am curious')], now: NOW });
  assert.equal(sparse.reason, 'insufficient_sample');
});

test('personality output is unverified, self-reflection-only, and structurally excluded from ranking', () => {
  const optedIn = consent({
    scopes: ['posts.read', 'personality.hypothesize'],
    purposes: ['preference_intelligence', 'self_reflection']
  });
  const content = Array.from({ length: 20 }, (_, index) =>
    post(String(index), index % 2 ? 'Curious creative art project with friends' : 'Plan and organise a kind volunteer meetup', `2026-${String((index % 8) + 1).padStart(2, '0')}-01T00:00:00Z`)
  );
  const result = hypothesizeBigFive({ connection: optedIn, subjectId: 'maya', content, now: NOW });
  assert.equal(result.allowed, true);
  assert.equal(result.status, 'unverified_hypotheses');
  assert.equal(result.permittedUse, 'self_reflection_only');
  assert.ok(result.hypotheses.every(x => x.rankEligible === false && x.label === 'unverified_hypothesis'));
  assert.deepEqual(rankablePreferenceEvidence(result.hypotheses), []);
});

test('candidate IDs and scores are deterministic and freshness-aware', () => {
  const args = { connection: consent(), subjectId: 'maya', now: NOW, content: [post('old', 'I love music', '2025-01-01T00:00:00Z'), post('new', 'I love music', '2026-10-20T00:00:00Z')] };
  const first = extractPreferenceCandidates(args);
  const second = extractPreferenceCandidates(args);
  assert.deepEqual(first, second);
  assert.ok(first.candidates[1].confidence > first.candidates[0].confidence);
});
