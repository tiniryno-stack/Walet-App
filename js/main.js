import { loadConfig, imageIdsIn, getState } from './store.js';
import { warm } from './images.js';
import { mountPassView, showPassView } from './passview.js';

const $ = (id) => document.getElementById(id);
let organizerMod = null;

export async function openOrganizer() {
  if (!organizerMod) organizerMod = await import('./organizer.js');
  $('organizer').hidden = false;
  organizerMod.showOrganizer($('organizer'), { onDone: closeOrganizer });
  $('pass').hidden = true;
}

export async function closeOrganizer() {
  await warm(imageIdsIn(getState()));
  $('organizer').hidden = true;
  $('builder').hidden = true;
  $('pass').hidden = false;
  showPassView();
}

// Screen Wake Lock while visible (SPEC §3). Fails silently.
let lock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener?.('release', () => { lock = null; });
    }
  } catch { /* ignore */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') requestWakeLock(); });
document.addEventListener('pointerdown', () => { if (!lock) requestWakeLock(); }, { passive: true });

// No pinch / double-tap zoom anywhere.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
let lastTouch = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouch < 300 && !e.target.closest('input,textarea,select')) e.preventDefault();
  lastTouch = now;
}, { passive: false });

async function boot() {
  const state = await loadConfig();
  await warm(imageIdsIn(state)).catch(() => {});
  mountPassView($('pass'), { openOrganizer });
  showPassView();
  requestWakeLock();
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !new URLSearchParams(location.search).has('nosw')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
