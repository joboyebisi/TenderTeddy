'use client';

import { FormEvent, useEffect, useState } from 'react';

type Session = { authenticated: boolean; user?: { displayName?: string } };
type Trace = { name: string; status: string; detail: string };
type Recommendation = { id: string; name: string; price?: number; story?: string; aiNarrative?: string };

let rpcId = 0;
async function callMcp(method: string, params?: Record<string, unknown>) {
  const response = await fetch('/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }) });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || `MCP request failed (${response.status})`);
  if (value.error) throw new Error(value.error.message || 'MCP tool error');
  return value.result;
}

export default function AlexaSimulator() {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [spoken, setSpoken] = useState('Tell me who the gift is for, what they enjoy, and your budget.');
  const [trace, setTrace] = useState<Trace[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [route, setRoute] = useState('');

  useEffect(() => { fetch('/api/auth/session', { cache: 'no-store' }).then(r => r.json()).then(setSession).catch(() => setSession({ authenticated: false })); }, []);

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setRecommendations([]); setRoute('');
    const form = new FormData(event.currentTarget);
    const recipient = String(form.get('recipient') || 'someone special');
    const interest = String(form.get('interest') || '').trim();
    const budget = Number(form.get('budget') || 60);
    const destinationCountry = String(form.get('destinationCountry') || 'GB').toUpperCase();
    setSpoken(`I’m looking for a thoughtful gift for ${recipient}, based only on the clue you confirmed: ${interest}.`);
    const nextTrace: Trace[] = [];
    try {
      const initialized = await callMcp('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'wanderwrap-web-simulator', version: '1.0' } });
      nextTrace.push({ name: 'initialize', status: 'Connected', detail: `MCP ${initialized.protocolVersion}` }); setTrace([...nextTrace]);
      const listed = await callMcp('tools/list');
      nextTrace.push({ name: 'tools/list', status: 'Ready', detail: `${listed.tools.length} approved tools discovered` }); setTrace([...nextTrace]);
      const ideas = await callMcp('tools/call', { name: 'recommend_gifts', arguments: { recipient: { name: recipient, budget, signals: [{ value: interest, source: 'stated' }] } } });
      if (ideas.isError) throw new Error(ideas.content?.[0]?.text || 'Recommendation failed');
      setRecommendations(ideas.structuredContent.recommendations || []); setSpoken(ideas.structuredContent.voiceSummary);
      nextTrace.push({ name: 'recommend_gifts', status: 'Complete', detail: 'Used one confirmed preference; no private feed analysis' }); setTrace([...nextTrace]);
      const routed = await callMcp('tools/call', { name: 'route_gift', arguments: { giftKind: 'physical', senderCountry: 'GB', destinationCountry, amazonOffer: { available: false, shipsToDestination: false } } });
      if (routed.isError) throw new Error(routed.content?.[0]?.text || 'Routing failed');
      setRoute(routed.structuredContent.voiceSummary);
      nextTrace.push({ name: 'route_gift', status: 'Complete', detail: 'Fixture routing only; availability and delivery are not provider-verified' }); setTrace([...nextTrace]);
    } catch (error) {
      setSpoken(error instanceof Error ? error.message : 'The demo could not complete.');
      nextTrace.push({ name: 'journey', status: 'Stopped safely', detail: 'No purchase or external provider action occurred' }); setTrace([...nextTrace]);
    } finally { setBusy(false); }
  }

  if (session === null) return <section className="workspaceState" aria-live="polite">Opening the secure demo…</section>;
  if (!session.authenticated) return <section className="workspaceState"><p className="eyebrow">ACCOUNT REQUIRED</p><h2>Create a normal customer account to run the demo.</h2><p>Cognito verifies the email, then returns you to WanderWrap with a protected browser session. The simulator never exposes the access token to JavaScript.</p><div className="actions centered"><a className="primary" href="/api/auth/signup">Create account</a><a className="secondary" href="/api/auth/login">I already have one</a></div></section>;

  return <section className="simulatorShell" aria-busy={busy}>
    <div className="simulatorControls"><p className="stepLabel">YOUR REQUEST</p><form className="stackForm" onSubmit={run}>
      <label>Who is it for?<input name="recipient" required defaultValue="my sister" maxLength={80} /></label>
      <label>What have they told you they enjoy?<input name="interest" required defaultValue="ceramics and slow weekends" maxLength={120} /></label>
      <div className="formRow"><label>Budget (£)<input name="budget" type="number" min="5" max="5000" defaultValue="60" /></label><label>Destination country<input name="destinationCountry" defaultValue="CA" maxLength={2} /></label></div>
      <button className="primary" disabled={busy}>{busy ? 'Running the journey…' : 'Ask WanderWrap'}</button>
    </form><p className="privacyNote">Signed in{session.user?.displayName ? ` as ${session.user.displayName}` : ''}. This demo uses deterministic catalogue fixtures; it does not verify live stock or transact.</p></div>
    <div className="conversationPanel"><div className="alexaHeader"><div className="voiceOrb small" aria-hidden="true"><span /><span /><span /></div><div><strong>Alexa+ journey preview</strong><small>Browser simulator · protected MCP</small></div></div><div className="speechBubble" role="status" aria-live="polite">{spoken}</div>
      {recommendations.length > 0 && <div className="miniResults">{recommendations.slice(0, 3).map((item, i) => <article key={item.id}><span>0{i + 1}</span><div><strong>{item.name}</strong><p>{item.aiNarrative || item.story}</p>{item.price && <small>Guide price: £{item.price}</small>}</div></article>)}</div>}
      {route && <div className="routeNote"><strong>Fulfilment check</strong><p>{route}</p></div>}
    </div>
    <aside className="tracePanel"><p className="stepLabel">LIVE TOOL TRACE</p>{trace.length ? trace.map((item, i) => <div className="traceItem" key={`${item.name}-${i}`}><span aria-hidden="true">✓</span><div><strong>{item.name}</strong><small>{item.status} · {item.detail}</small></div></div>) : <p className="emptyTrace">Run the journey to see each authenticated MCP call.</p>}</aside>
  </section>;
}
