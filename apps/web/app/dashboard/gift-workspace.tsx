'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Recipient = { id: string; displayName: string; relationship?: string; country?: string; occasion?: string };
type Recommendation = { id: string; name: string; price?: number; story?: string; aiNarrative?: string; handoffUrl?: string; priceType?: string };
type Session = { authenticated: boolean };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/core/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store'
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || 'That step could not be completed.');
  return value as T;
}

export default function GiftWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRecipients = useCallback(async () => {
    const list = await api<Recipient[]>('recipients');
    setRecipients(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [selectedId]);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' }).then(response => response.json()).then(async value => {
      setSession(value);
      if (value.authenticated) await loadRecipients();
    }).catch(() => setSession({ authenticated: false }));
  }, [loadRecipients]);

  async function createRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      const person = await api<Recipient>('recipients', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) });
      setRecipients(current => [person, ...current]); setSelectedId(person.id); event.currentTarget.reset();
      setMessage(`${person.displayName} is ready. Add only preferences they have actually shared.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not add that person.'); }
    finally { setBusy(false); }
  }

  async function findIdeas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) { setMessage('Add or choose someone first.'); return; }
    setBusy(true); setMessage(''); setRecommendations([]);
    const form = new FormData(event.currentTarget);
    try {
      const topic = String(form.get('topic') || '').trim();
      await api(`recipients/${selectedId}/evidence`, { method: 'POST', body: JSON.stringify({ topic, sourceType: 'stated', confidence: 1, confirmedState: 'confirmed' }) });
      const result = await api<{ recommendations: Recommendation[]; aiSummary?: string }>('recommendations', { method: 'POST', body: JSON.stringify({ recipientId: selectedId, budget: Number(form.get('budget') || 75) }) });
      setRecommendations(result.recommendations); setMessage(result.aiSummary || `I found ${result.recommendations.length} explainable ideas.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not find ideas.'); }
    finally { setBusy(false); }
  }

  async function saveGift(item: Recommendation) {
    setBusy(true); setMessage('');
    try {
      await api('gifts', { method: 'POST', body: JSON.stringify({ recipientId: selectedId, recommendation: item, currency: 'GBP' }) });
      setMessage(`${item.name} is saved for review. Nothing has been purchased.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save that gift.'); }
    finally { setBusy(false); }
  }

  if (session === null) return <section className="workspaceState" aria-live="polite">Opening your private gift space…</section>;
  if (!session.authenticated) return (
    <section className="workspaceState">
      <p className="eyebrow">ACCOUNT LINK REQUIRED</p>
      <h2>Keep one journey across web and Alexa+.</h2>
      <p>Sign in to save people, confirmed preferences and gifting progress. Connecting a calendar or social source is always separate and optional.</p>
      <a className="primary" href="/api/auth/login">Sign in securely</a>
      <small>If sign-in is not configured yet, this button will explain which deployment setting is missing.</small>
    </section>
  );

  return (
    <section className="workspace" aria-busy={busy}>
      <article className="workspacePanel">
        <p className="stepLabel">01 · PERSON</p><h2>Who are you showing up for?</h2>
        <form className="stackForm" onSubmit={createRecipient}>
          <label>Name<input name="displayName" required maxLength={80} placeholder="Maya" /></label>
          <div className="formRow"><label>Relationship<input name="relationship" maxLength={80} placeholder="Sister" /></label><label>Country<input name="country" defaultValue="GB" maxLength={2} /></label></div>
          <label>Occasion<input name="occasion" maxLength={120} placeholder="Christmas" /></label>
          <button className="secondary" disabled={busy}>Add person</button>
        </form>
        {recipients.length > 0 && <label className="selectLabel">Working on<select value={selectedId} onChange={event => setSelectedId(event.target.value)}>{recipients.map(person => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>}
      </article>

      <article className="workspacePanel accentPanel">
        <p className="stepLabel">02 · CONFIRMED CLUE</p><h2>What have they told you they enjoy?</h2>
        <form className="stackForm" onSubmit={findIdeas}>
          <label>Interest<input name="topic" required maxLength={120} placeholder="Ceramics and slow weekends" /></label>
          <label>Maximum budget (£)<input name="budget" type="number" min="5" max="5000" defaultValue="60" /></label>
          <button className="primary" disabled={busy}>{busy ? 'Thinking…' : 'Find thoughtful ideas'}</button>
        </form>
        <p className="privacyNote">We use this as confirmed gifting evidence. It is never treated as a personality diagnosis.</p>
      </article>

      <div className="statusMessage" role="status" aria-live="polite">{message || 'Your next step will appear here.'}</div>

      {recommendations.length > 0 && <section className="recommendationSection">
        <div className="sectionHeading"><p className="stepLabel">03 · SHORTLIST</p><h2>Ideas with a reason behind them</h2></div>
        <div className="recommendationGrid">{recommendations.map((item, index) => <article className="recommendationCard" key={item.id}>
          <span className="cardNumber">0{index + 1}</span><h3>{item.name}</h3>
          <p>{item.aiNarrative || item.story}</p>
          <div className="cardMeta"><span>{item.price ? `About £${item.price}` : 'Provider-priced'}</span><span>{item.priceType === 'guide' ? 'Guide price' : 'Verify with provider'}</span></div>
          <button className="secondary" disabled={busy} onClick={() => saveGift(item)}>Save for approval</button>
          {item.handoffUrl && <a className="textLink" href={item.handoffUrl} target="_blank" rel="noreferrer">Check on provider ↗</a>}
        </article>)}</div>
      </section>}
    </section>
  );
}
