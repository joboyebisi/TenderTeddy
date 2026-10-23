import { App } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'WanderWrap gift board', version: '1.0.0' });
const root = document.querySelector('#app');
const content = document.querySelector('#content');
const modeButton = document.querySelector('#modeButton');
let hostContext = {};

app.ontoolresult = result => render(result.structuredContent || parseText(result.content));
app.onhostcontextchanged = context => applyHostContext(context);
app.onteardown = async () => ({});
app.ontoolcancelled = () => showMessage('That request was cancelled. You can continue when you are ready.');

modeButton.addEventListener('click', async () => {
  const nextMode = hostContext.displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
  const response = await app.requestDisplayMode({ mode: nextMode });
  applyHostContext({ ...hostContext, displayMode: response.mode });
});

content.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  button.disabled = true;
  const message = button.dataset.action === 'choose'
    ? `I choose ${button.dataset.name}. Check the safest fulfilment option, but do not purchase it yet.`
    : 'Continue to Alexa+ checkout for this gift.';
  try {
    await app.sendMessage({ role: 'user', content: [{ type: 'text', text: message }] });
  } finally {
    button.disabled = false;
  }
});

function render(data = {}) {
  if (Array.isArray(data.recommendations)) return renderRecommendations(data);
  const title = routeTitle(data.route) || 'Gift step ready';
  content.innerHTML = `<section class="hero"><div class="eyebrow">WanderWrap update</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(data.voiceSummary || 'Your gift journey is ready to continue.')}</p></section><section class="next"><div><span class="status">Review required</span><p>${escapeHtml(data.nextAction || 'Alexa+ will ask before anything is purchased or sent.')}</p></div>${data.route && data.route !== 'manual-review' ? '<button class="choose" data-action="checkout" type="button">Continue</button>' : ''}</section>`;
}

function renderRecommendations(data) {
  const cards = data.recommendations.map((gift, index) => `<article class="card"><div class="eyebrow">Idea ${index + 1}</div><h2>${escapeHtml(gift.name)}</h2><div class="price">About £${Number(gift.price).toFixed(0)}</div><p class="story">${escapeHtml(gift.story)}</p><p class="why">${escapeHtml(reason(gift))}</p><button class="choose" data-action="choose" data-name="${escapeHtml(gift.name)}" type="button" aria-label="Choose ${escapeHtml(gift.name)}">Choose this</button></article>`).join('');
  content.innerHTML = `<section class="hero"><div class="eyebrow">Thoughtful matches</div><h1>Gift ideas with a reason</h1><p>${escapeHtml(data.voiceSummary)}</p></section><section class="grid" aria-label="Gift recommendations">${cards}</section><section class="next"><p>${escapeHtml(data.nextAction)}</p><span class="status">No purchase yet</span></section>`;
}

function applyHostContext(context = {}) {
  hostContext = context;
  root.classList.toggle('fullscreen', context.displayMode === 'fullscreen');
  document.documentElement.dataset.theme = context.theme || 'light';
  const modes = context.availableDisplayModes || [];
  modeButton.hidden = !modes.includes('fullscreen');
  modeButton.textContent = context.displayMode === 'fullscreen' ? 'Close' : 'Expand';
  modeButton.setAttribute('aria-label', context.displayMode === 'fullscreen' ? 'Return gift board inline' : 'Open gift board full screen');
}

function parseText(blocks = []) {
  const text = blocks.find(block => block.type === 'text')?.text;
  try { return JSON.parse(text); } catch { return { voiceSummary: text }; }
}

function reason(gift) {
  const signals = (gift.evidence || []).map(item => item.value).filter(Boolean);
  return signals.length ? `Matches: ${signals.join(', ')}` : gift.local ? 'A local experience' : 'Within the selected budget';
}

function routeTitle(route) {
  return ({ 'amazon-retail-handoff': 'Amazon handoff ready', 'paypal-merchant-checkout': 'Supplier checkout ready', 'paypal-value-gift': 'Value gift available', 'paypal-send-handoff': 'Money gift handoff ready', 'xoom-handoff': 'Cross-border handoff ready', 'manual-review': 'Manual review needed' })[route];
}

function showMessage(text) { content.innerHTML = `<div class="empty">${escapeHtml(text)}</div>`; }
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }

await app.connect();
applyHostContext(app.getHostContext() || {});
