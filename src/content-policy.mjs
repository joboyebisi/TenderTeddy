export function playbackMode(item) {
  if (item.rights === 'owned' || item.rights === 'licensed') return 'integrated-player';
  if (item.provider === 'youtube' && item.embeddable && item.madeForKidsChecked) return 'youtube-iframe';
  return 'external-link';
}

export function canAttachInteractiveCheckpoint(item, placement) {
  const mode = playbackMode(item);
  if (mode === 'youtube-iframe') return placement === 'before' || placement === 'after';
  return mode === 'integrated-player';
}
