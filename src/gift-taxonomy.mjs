export const GIFT_TAXONOMY_VERSION = 'gift-v1';

export const GIFT_PREFERENCE_LABELS = Object.freeze([
  'books',
  'music',
  'food',
  'travel',
  'creative',
  'home',
  'tech',
  'outdoors',
  'games',
  'gardening',
  'photography',
  'theatre',
  'experience',
  'wellbeing',
  'shared',
  'charity',
  'practical'
]);

const LABEL_ALIASES = Object.freeze({
  art: 'creative',
  arts: 'creative',
  technology: 'tech',
  gadget: 'tech',
  gadgets: 'tech',
  theater: 'theatre'
});

const LABEL_SET = new Set(GIFT_PREFERENCE_LABELS);

export function normalizeGiftPreferenceLabel(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  const canonical = LABEL_ALIASES[normalized] ?? normalized;
  return LABEL_SET.has(canonical) ? canonical : null;
}

export function isGiftPreferenceLabel(value) {
  return normalizeGiftPreferenceLabel(value) === value;
}
