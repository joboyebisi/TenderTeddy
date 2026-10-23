const state = { accessToken: sessionStorage.getItem('ww_access'), refreshToken: localStorage.getItem('ww_refresh'), me: null, recipients: [], gifts: [], evidence: [], selectedRecipient: null, authMode: 'login', pendingEmail: '' };
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

async function api(path, options = {}, retry = true) {
  const response = await fetch(path, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(state.accessToken ? { authorization: `Bearer ${state.accessToken}` } : {}), ...options.headers } });
  if (response.status === 401 && retry && state.refreshToken) {
    const refreshed = await fetch('/v1/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: state.refreshToken }) });
    if (refreshed.ok) { saveTokens(await refreshed.json()); return api(path, options, false); }
    signOut();
  }
  const value = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw Error(value.error || 'Something went wrong');
  return value;
}
function saveTokens(tokens) { state.accessToken = tokens.accessToken; sessionStorage.setItem('ww_access', tokens.accessToken); if (tokens.refreshToken) { state.refreshToken = tokens.refreshToken; localStorage.setItem('ww_refresh', tokens.refreshToken); } }
function signOut() { sessionStorage.removeItem('ww_access'); localStorage.removeItem('ww_refresh'); state.accessToken = state.refreshToken = null; state.me = null; $('#authShell').classList.remove('hidden'); setAuthMode('login'); }
function toast(message) { const node = $('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(node.timer); node.timer = setTimeout(() => node.classList.remove('show'), 3200); }
function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]); }

async function boot() { wire(); if (!state.accessToken && !state.refreshToken) return; try { await loadApp(); } catch { signOut(); } }
async function loadApp() {
  const [me, recipients, gifts] = await Promise.all([api('/v1/me'), api('/v1/recipients'), api('/v1/gifts')]);
  state.me = me; state.recipients = recipients; state.gifts = gifts; $('#authShell').classList.add('hidden');
  const first = (me.displayName || me.email || 'W').trim(); $('#accountButton').textContent = first.slice(0, 2).toUpperCase();
  $('#viewTitle').textContent = `Good to see you${me.displayName ? `, ${me.displayName.split(' ')[0]}` : ''}.`; renderAll();
}
function wire() {
  $$('[data-view]').forEach(button => button.onclick = () => showView(button.dataset.view)); $$('[data-go]').forEach(button => button.onclick = () => showView(button.dataset.go)); $('#signOut').onclick = signOut;
  ['newRecipient', 'addPersonSide', 'emptyAdd'].forEach(id => $(`#${id}`).onclick = () => $('#recipientDialog').showModal());
  $('#recipientForm').onsubmit = createRecipient; $('#authSwitch').onclick = () => setAuthMode(state.authMode === 'login' ? 'signup' : 'login'); $('#forgotPassword').onclick = () => setAuthMode('forgot'); $('#authForm').onsubmit = handleAuth;
}
function showView(id) {
  $$('.view').forEach(view => view.classList.toggle('active', view.id === id)); $$('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === id));
  const titles = { home: 'Good to see you.', people: 'People and their clues', gifts: 'Gifts awaiting action', audit: 'Your privacy log' };
  $('#viewTitle').textContent = id === 'home' && state.me?.displayName ? `Good to see you, ${state.me.displayName.split(' ')[0]}.` : titles[id]; if (id === 'audit') loadAudit();
}
function renderAll() { renderStats(); renderPeople(); renderGifts(); }
function renderStats() { $('#stats').innerHTML = [[state.recipients.length, 'people remembered'], [state.gifts.filter(g => g.status !== 'completed').length, 'gifts in progress'], [state.gifts.filter(g => g.status === 'completed').length, 'moments completed']].map(([value, label]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join(''); }
function personRow(person) { return `<div class="person-row ${person.id === state.selectedRecipient?.id ? 'selected' : ''}" data-person="${person.id}"><div class="person-icon">${escapeHtml(person.displayName[0].toUpperCase())}</div><div><b>${escapeHtml(person.displayName)}</b><span>${escapeHtml([person.relationship, person.occasion].filter(Boolean).join(' · ') || 'Add an occasion')}</span></div><i>→</i></div>`; }
function renderPeople() {
  const empty = '<div class="empty-state"><p>No people yet. Add someone to begin.</p></div>'; $('#peoplePreview').innerHTML = state.recipients.length ? state.recipients.slice(0, 4).map(personRow).join('') : empty; $('#peopleList').innerHTML = state.recipients.length ? state.recipients.map(personRow).join('') : '<p>No people yet.</p>';
  $$('[data-person]').forEach(row => row.onclick = () => selectRecipient(row.dataset.person));
}
async function createRecipient(event) {
  event.preventDefault(); const input = Object.fromEntries(new FormData(event.target));
  try { const recipient = await api('/v1/recipients', { method: 'POST', body: JSON.stringify(input) }); state.recipients.unshift(recipient); $('#recipientDialog').close(); event.target.reset(); renderAll(); showView('people'); await selectRecipient(recipient.id); toast(`${recipient.displayName} added privately.`); } catch (error) { toast(error.message); }
}
async function selectRecipient(id) { state.selectedRecipient = state.recipients.find(person => person.id === id); if (!state.selectedRecipient) return; state.evidence = await api(`/v1/recipients/${id}/evidence`); renderPeople(); renderWorkspace(); }
function renderWorkspace() {
  const person = state.selectedRecipient;
  $('#recipientWorkspace').innerHTML = `<div class="recipient-head"><div class="person-icon">${escapeHtml(person.displayName[0].toUpperCase())}</div><div><h2>${escapeHtml(person.displayName)}</h2><p>${escapeHtml([person.relationship, person.country, person.occasion].filter(Boolean).join(' · '))}</p></div><button class="delete" id="deleteRecipient">Delete profile</button></div><form class="clue-form" id="clueForm"><input name="topic" placeholder="A confirmed interest, e.g. pottery" maxlength="120" required><select name="sourceType"><option value="stated">They said it</option><option value="saved">They saved it</option><option value="liked">They liked it</option><option value="inferred">Needs confirmation</option></select><button>Add clue</button></form><div class="clues" id="clueList">${renderClues()}</div><div class="recommend-box"><div class="section-title"><div><small>EXPLAINABLE SHORTLIST</small><h3>Ideas from confirmed clues</h3></div></div><div class="recommend-controls"><label>Budget: <b id="budgetLabel">£60</b><input id="budget" type="range" min="15" max="200" value="60"></label><button class="primary" id="recommend">Build shortlist</button></div><p class="source-note" id="sourceNote"></p><div class="ideas" id="ideas"></div></div>`;
  $('#clueForm').onsubmit = addClue; $('#deleteRecipient').onclick = deleteRecipient; $('#recommend').onclick = recommend; $('#budget').oninput = event => $('#budgetLabel').textContent = `£${event.target.value}`; wireClueActions();
}
function renderClues() {
  if (!state.evidence.length) return '<div class="empty-state"><p>Add a clue. Inferred clues remain pending until you confirm them.</p></div>';
  return state.evidence.map(clue => `<div class="clue"><div><b>${escapeHtml(clue.topic)}</b><small>${escapeHtml(clue.sourceType)} · ${clue.confirmedState}</small></div><div class="clue-actions">${clue.confirmedState !== 'confirmed' ? `<button class="confirm" data-clue="${clue.id}" data-state="confirmed">Confirm</button>` : ''}${clue.confirmedState !== 'rejected' ? `<button class="reject" data-clue="${clue.id}" data-state="rejected">Reject</button>` : ''}<button class="remove" data-remove="${clue.id}">Delete</button></div></div>`).join('');
}
async function addClue(event) { event.preventDefault(); const input = Object.fromEntries(new FormData(event.target)); input.confirmedState = input.sourceType === 'inferred' ? 'pending' : 'confirmed'; try { const clue = await api(`/v1/recipients/${state.selectedRecipient.id}/evidence`, { method: 'POST', body: JSON.stringify(input) }); state.evidence.unshift(clue); event.target.reset(); $('#clueList').innerHTML = renderClues(); wireClueActions(); toast('Clue saved with its source.'); } catch (error) { toast(error.message); } }
function wireClueActions() {
  $$('[data-state]').forEach(button => button.onclick = async () => { try { const updated = await api(`/v1/recipients/${state.selectedRecipient.id}/evidence/${button.dataset.clue}`, { method: 'PATCH', body: JSON.stringify({ confirmedState: button.dataset.state }) }); state.evidence = state.evidence.map(item => item.id === updated.id ? updated : item); $('#clueList').innerHTML = renderClues(); wireClueActions(); } catch (error) { toast(error.message); } });
  $$('[data-remove]').forEach(button => button.onclick = async () => { try { await api(`/v1/recipients/${state.selectedRecipient.id}/evidence/${button.dataset.remove}`, { method: 'DELETE' }); state.evidence = state.evidence.filter(item => item.id !== button.dataset.remove); $('#clueList').innerHTML = renderClues(); wireClueActions(); } catch (error) { toast(error.message); } });
}
async function deleteRecipient() { if (!confirm(`Delete ${state.selectedRecipient.displayName}'s profile?`)) return; try { await api(`/v1/recipients/${state.selectedRecipient.id}`, { method: 'DELETE' }); state.recipients = state.recipients.filter(item => item.id !== state.selectedRecipient.id); state.selectedRecipient = null; $('#recipientWorkspace').innerHTML = '<div class="empty-state"><h3>Profile deleted</h3><p>The recipient record is gone.</p></div>'; renderAll(); } catch (error) { toast(error.message); } }
async function recommend() {
  $('#ideas').innerHTML = '<p>Wandering through the confirmed clues…</p>';
  try { const result = await api('/v1/recommendations', { method: 'POST', body: JSON.stringify({ recipientId: state.selectedRecipient.id, budget: Number($('#budget').value) }) }); $('#sourceNote').textContent = `${result.aiGenerated ? 'Amazon Bedrock explanation · ' : ''}${result.aiSummary || ''} ${result.sourceNote}`.trim(); $('#ideas').innerHTML = result.recommendations.length ? result.recommendations.map((item, index) => ideaCard(item, index)).join('') : '<p>No suitable ideas yet. Confirm another clue or raise the budget.</p>'; $$('[data-handoff]').forEach(button => button.onclick = () => providerHandoff(result.recommendations[Number(button.dataset.handoff)])); $$('[data-wrap]').forEach(button => button.onclick = () => createGift(result.recommendations[Number(button.dataset.wrap)])); } catch (error) { $('#ideas').innerHTML = `<p>${escapeHtml(error.message)}</p>`; }
}
function ideaCard(item, index) { const evidence = (item.evidence || []).map(e => e.value).join(', ') || 'your stated constraints'; const price = item.price == null ? 'Provider confirms price' : `Guide £${item.price}`; return `<article class="idea"><span class="source-label">${escapeHtml(item.dataSource || 'WANDERWRAP IDEA')}</span><h4>${escapeHtml(item.name)}</h4><p>${escapeHtml(item.aiNarrative || item.story)}<br><b>Why:</b> ${escapeHtml(evidence)}</p><span class="price">${price}</span><div class="idea-actions"><button class="provider" data-handoff="${index}">Search provider</button><button class="wrap" data-wrap="${index}">Prepare gift</button></div></article>`; }
async function providerHandoff(item) { try { const result = await api('/v1/handoffs/amazon', { method: 'POST', body: JSON.stringify({ name: item.name, destinationCountry: state.selectedRecipient.country }) }); window.open(result.url, '_blank', 'noopener,noreferrer'); toast('Provider opened. Final price, delivery and purchase stay there.'); } catch (error) { toast(error.message); } }
async function createGift(recommendation) { try { const gift = await api('/v1/gifts', { method: 'POST', body: JSON.stringify({ recipientId: state.selectedRecipient.id, recommendation, currency: 'GBP' }) }); state.gifts.unshift(gift); renderGifts(); showView('gifts'); toast('Gift prepared. Review it before creating a claim link.'); } catch (error) { toast(error.message); } }
function renderGifts() {
  $('#giftList').innerHTML = state.gifts.length ? state.gifts.map(gift => `<article class="gift-row"><div><span class="status">${escapeHtml(gift.status.replaceAll('-', ' '))}</span><h3>${escapeHtml(gift.recommendation?.name || 'Thoughtful gift')}</h3><p>${escapeHtml(gift.recommendation?.story || '')}</p>${gift.claimUrl ? `<a href="${escapeHtml(gift.claimUrl)}" target="_blank" rel="noopener">Open recipient page</a>` : ''}</div><div class="gift-actions">${gift.status === 'awaiting-sender-approval' ? `<button class="approve" data-approve="${gift.id}">Approve & create link</button>` : ''}${gift.claimUrl ? `<button class="copy" data-copy="${escapeHtml(gift.claimUrl)}">Copy link</button>` : ''}</div></article>`).join('') : '<div class="empty-state"><span>◇</span><h3>No gifts yet</h3><p>Choose a person, confirm clues and prepare an idea.</p><button class="primary" data-go="people">Start with a person</button></div>';
  $$('[data-approve]').forEach(button => button.onclick = () => approveGift(button.dataset.approve)); $$('[data-copy]').forEach(button => button.onclick = async () => { await navigator.clipboard.writeText(button.dataset.copy); toast('Private claim link copied.'); }); $$('[data-go]').forEach(button => button.onclick = () => showView(button.dataset.go));
}
async function approveGift(id) { try { const result = await api(`/v1/gifts/${id}/claim-links`, { method: 'POST', body: JSON.stringify({ userApproved: true, senderDisplayName: state.me.displayName || state.me.email }) }); state.gifts = state.gifts.map(gift => gift.id === id ? { ...gift, status: 'claimable', claimUrl: result.claimUrl } : gift); renderGifts(); await navigator.clipboard.writeText(result.claimUrl); toast('Approved. The private recipient link is copied.'); } catch (error) { toast(error.message); } }
async function loadAudit() { try { const events = await api('/v1/audit'); $('#auditList').innerHTML = events.length ? events.map(event => `<div class="audit-row"><i></i><div><b>${escapeHtml(event.type.replaceAll('_', ' ').toLowerCase())}</b><span>${escapeHtml(JSON.stringify(event.details || {}))}</span></div><span>${new Date(event.createdAt).toLocaleString()}</span></div>`).join('') : '<p>No events yet.</p>'; } catch (error) { toast(error.message); } }

function setAuthMode(mode) {
  state.authMode = mode; const confirmMode = mode === 'confirm' || mode === 'reset'; $('#authTitle').textContent = ({ login: 'Sign in', signup: 'Create account', confirm: 'Verify your email', forgot: 'Reset password', reset: 'Choose a new password' })[mode]; $('#authCopy').textContent = ({ login: 'Continue to your private gifting space.', signup: 'We will email a short verification code.', confirm: `Enter the code sent to ${state.pendingEmail}.`, forgot: 'We will send a recovery code to your verified email.', reset: 'Enter the recovery code and a new password.' })[mode]; $('#passwordLabel').hidden = mode === 'confirm' || mode === 'forgot'; $('#codeLabel').hidden = !confirmMode; $('#codeLabel input').required = confirmMode; $('#passwordLabel input').required = !$('#passwordLabel').hidden; $('#authSubmit').textContent = ({ login: 'Sign in', signup: 'Create account', confirm: 'Verify email', forgot: 'Send recovery code', reset: 'Save new password' })[mode]; $('#authSwitch').textContent = mode === 'login' ? 'New to WanderWrap? Create an account' : 'Back to sign in'; $('#forgotPassword').hidden = mode !== 'login'; $('#authMessage').textContent = '';
}
async function handleAuth(event) {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.target)); const message = $('#authMessage'); message.textContent = 'Working…';
  try {
    if (state.authMode === 'signup') { await api('/v1/auth/signup', { method: 'POST', body: JSON.stringify(data) }); state.pendingEmail = data.email; setAuthMode('confirm'); return; }
    if (state.authMode === 'confirm') { await api('/v1/auth/confirm', { method: 'POST', body: JSON.stringify({ email: state.pendingEmail, code: data.code }) }); setAuthMode('login'); message.textContent = 'Email verified. You can sign in.'; return; }
    if (state.authMode === 'forgot') { await api('/v1/auth/forgot', { method: 'POST', body: JSON.stringify(data) }); state.pendingEmail = data.email; setAuthMode('reset'); return; }
    if (state.authMode === 'reset') { await api('/v1/auth/reset', { method: 'POST', body: JSON.stringify({ email: state.pendingEmail, code: data.code, password: data.password }) }); setAuthMode('login'); message.textContent = 'Password reset. You can sign in.'; return; }
    const tokens = await api('/v1/auth/login', { method: 'POST', body: JSON.stringify(data) }); saveTokens(tokens); event.target.reset(); await loadApp();
  } catch (error) { message.textContent = error.message; }
}
boot();
