const protocolVersion = '2025-11-25';
const conversation = document.querySelector('#conversation');
const trace = document.querySelector('#trace');
const prompt = document.querySelector('#prompt');
const surface = document.querySelector('#surface');
const device = document.querySelector('.device');
const visual = document.querySelector('#visual');

surface.addEventListener('change', () => { device.dataset.surface = surface.value; });
device.dataset.surface = surface.value;

const scenarios = {
  amazon: {
    utterance: 'Find a thoughtful gift for my sister in Toronto. She likes ceramics and slow weekends. Keep it under GBP 60.',
    recipient: { budget: 60, signals: [{ value: 'creative', source: 'stated' }, { value: 'home', source: 'stated' }] },
    route: { giftKind: 'physical', senderCountry: 'GB', destinationCountry: 'CA', amazonOffer: { available: true, shipsToDestination: true, detailPageUrl: 'https://www.amazon.ca/s?k=ceramic+gift' } },
    fixture: 'Demo fixture: Amazon Canada offer marked deliverable.'
  },
  paypal: {
    utterance: 'Find a local pottery experience for Maya in Toronto, under GBP 60.',
    recipient: { budget: 60, signals: [{ value: 'creative', source: 'stated' }, { value: 'experience', source: 'stated' }] },
    route: { giftKind: 'experience', senderCountry: 'GB', destinationCountry: 'CA', amazonOffer: { available: false }, alternateSupplier: { id: 'toronto-pottery-demo', available: true }, paypalAvailable: true },
    fixture: 'Demo fixture: Amazon unavailable; approved supplier available.'
  },
  xoom: {
    utterance: 'Send my cousin in Nigeria a GBP 50 birthday money gift.',
    recipient: { budget: 50, signals: [{ value: 'travel', source: 'stated' }] },
    route: { giftKind: 'money', senderCountry: 'GB', destinationCountry: 'NG', paypalAvailable: true, xoomAvailable: true },
    fixture: 'Demo fixture: cross-border Xoom route marked eligible.'
  }
};

document.querySelector('#promptForm').addEventListener('submit', event => {
  event.preventDefault();
  runScenario(inferScenario(prompt.value), prompt.value);
});
document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => {
  const scenario = scenarios[button.dataset.scenario];
  prompt.value = scenario.utterance;
  runScenario(scenario, scenario.utterance);
}));

async function runScenario(scenario, utterance) {
  addMessage('user', 'You', utterance);
  addMessage('alexa', 'Alexa+', 'One moment while I ask WanderWrap.');
  try {
    const calls = [];
    calls.push(await mcp('initialize', { protocolVersion, capabilities: {}, clientInfo: { name: 'wanderwrap-demo-simulator', version: '1.0.0' } }));
    calls.push(await mcp('tools/list'));
    const recommendations = await mcp('tools/call', { name: 'recommend_gifts', arguments: { recipient: scenario.recipient } });
    calls.push(recommendations);
    const routing = await mcp('tools/call', { name: 'route_gift', arguments: scenario.route });
    calls.push(routing);
    const ideas = recommendations.result.structuredContent.recommendations;
    const decision = routing.result.structuredContent;
    const winner = ideas[0];
    const answer = decision.route === 'xoom-handoff'
      ? `I can prepare a GBP 50 birthday money-gift handoff through Xoom. You will review eligibility, fees and the final transfer on the provider surface before anything is sent.`
      : `My first idea is ${winner.name} at GBP ${winner.price}. ${winner.story} The proposed route is ${friendlyRoute(decision.route)}. I will send the approval step to WanderWrap; nothing has been purchased.`;
    replaceThinking(answer);
    renderVisual(recommendations.result.structuredContent, decision);
    trace.textContent = `${scenario.fixture}\n\n${JSON.stringify(calls, null, 2)}`;
  } catch (error) {
    replaceThinking(`I could not reach WanderWrap's MCP service: ${error.message}`);
    trace.textContent = error.stack || error.message;
  }
}

function renderVisual(recommendationResult, decision) {
  if (surface.value === 'voice') return;
  const cards = recommendationResult.recommendations.map(gift => `<article class="gift-card"><small>THOUGHTFUL MATCH</small><h3>${escapeText(gift.name)}</h3><b>About GBP ${gift.price}</b><p>${escapeText(gift.story)}</p></article>`).join('');
  visual.innerHTML = `<div class="gift-grid">${cards}</div><div class="route-card"><p><strong>${escapeText(friendlyRoute(decision.route))}</strong>${escapeText(decision.reason)}</p><span>No purchase yet</span></div>`;
}

async function mcp(method, params) {
  const response = await fetch('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': protocolVersion },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, ...(params ? { params } : {}) })
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.message || `HTTP ${response.status}`);
  return payload;
}

function inferScenario(value) {
  const normalized = value.toLowerCase();
  if (normalized.includes('money') || normalized.includes('send') && normalized.includes('nigeria')) return scenarios.xoom;
  if (normalized.includes('experience') || normalized.includes('pottery')) return scenarios.paypal;
  return scenarios.amazon;
}
function friendlyRoute(route) { return ({ 'amazon-retail-handoff': 'an Amazon Canada handoff', 'paypal-merchant-checkout': 'a PayPal-approved supplier checkout' })[route] || route; }
function addMessage(kind, label, text) {
  conversation.insertAdjacentHTML('beforeend', `<div class="message ${kind}"><small>${escapeText(label)}</small><p>${escapeText(text)}</p></div>`);
  conversation.scrollTop = conversation.scrollHeight;
}
function replaceThinking(text) {
  const last = conversation.querySelector('.message.alexa:last-child p');
  last.textContent = text;
  conversation.scrollTop = conversation.scrollHeight;
}
function escapeText(value) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
