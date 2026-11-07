// Screen 1 — Pass view (on camera).
import { LAYOUT, CARD, COLORS, TIMING } from './constants.js';
import { renderCard, fitTitles } from './card.js';
import { tickets, activeTake } from './store.js';

const N = LAYOUT.nfc;
let root, pager, dotsEl, prompt, phoneEnter, phone, sheen;
let anims = [];
let step = 0;
let settledIndex = 0;
let fading = false;
let settleTimer = 0;
let hiddenAt = 0;
let onOpenOrganizer = () => {};

const TILT_REST = 'translateZ(-12px) rotateX(4deg)';
const TILT_FAR = 'translateZ(-23px) rotateX(26deg)';
const SHEEN_OFF = 'translate(62px,-62px)';
const SHEEN_PEAK = 'translate(-6.5px,6.5px)';
const ease = 'ease-in-out';

export function mountPassView(el, { openOrganizer }) {
  root = el;
  onOpenOrganizer = openOrganizer;
  root.innerHTML = `
    <button class="topbtn close" type="button" aria-label="Close">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2.2 2.2 L15.8 15.8 M15.8 2.2 L2.2 15.8" stroke="#FFF" stroke-width="2.3" stroke-linecap="round" fill="none"/></svg>
    </button>
    <button class="topbtn more" type="button" aria-label="More"><i></i><i></i><i></i></button>
    <div class="pager" tabindex="-1"></div>
    <div class="dots" aria-hidden="true"></div>
    <div class="nfc-prompt" aria-hidden="true">
      <div class="nfc-ring-wrap">
        <div class="nfc-ring"></div>
        <div class="nfc-clip">
          <div class="nfc-enter">
            <div class="nfc-phone">
              <div class="nfc-screen"><div class="nfc-sheen"></div></div>
              <div class="nfc-speaker"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="nfc-text" data-field="nfcText">Hold Near Reader</div>
    </div>`;
  pager = root.querySelector('.pager');
  dotsEl = root.querySelector('.dots');
  prompt = root.querySelector('.nfc-prompt');
  phoneEnter = root.querySelector('.nfc-enter');
  phone = root.querySelector('.nfc-phone');
  sheen = root.querySelector('.nfc-sheen');

  setupLongPress(root.querySelector('.more'));
  pager.addEventListener('scroll', onScroll, { passive: true });
  if ('onscrollend' in window) pager.addEventListener('scrollend', onSettle);
  window.addEventListener('resize', () => { layout(); jumpTo(settledIndex); });
  layout();
}

function layout() {
  const W = window.innerWidth;
  const cardW = W - LAYOUT.sideInset * 2;
  step = cardW + LAYOUT.gap;
  root.style.setProperty('--card-w', `${cardW}px`);
  // NFC ring on whole pixels so ring and phone share one center (SPEC §5.4)
  const wrap = root.querySelector('.nfc-ring-wrap');
  wrap.style.left = `${Math.round(W / 2 - N.ringOuter / 2)}px`;
  wrap.style.top = `${Math.round(N.centerY - N.ringOuter / 2)}px`;
}

export function renderPassView() {
  const list = tickets();
  pager.innerHTML = '';
  list.forEach((t, i) => {
    const slide = document.createElement('div');
    slide.className = 'slide';
    slide.dataset.index = i;
    slide.appendChild(renderCard(t));
    pager.appendChild(slide);
  });
  fitTitles(pager);
  renderDots(list.length);
}

function renderDots(n) {
  dotsEl.innerHTML = Array.from({ length: n }, () => '<span></span>').join('');
  updateDots(settledIndex);
}

function updateDots(active) {
  const dots = dotsEl.children;
  const n = dots.length;
  for (let i = 0; i < n; i++) {
    const d = dots[i];
    d.classList.toggle('on', i === active);
    let scale = 1;
    if (n > LAYOUT.dotsShrinkAfter) {
      const dist = Math.abs(i - active);
      scale = dist >= 6 ? 0.45 : dist >= 4 ? 0.65 : 1;
    }
    d.style.transform = scale === 1 ? '' : `scale(${scale})`;
  }
}

export function jumpTo(index) {
  const n = tickets().length;
  settledIndex = Math.max(0, Math.min(index, n - 1));
  pager.style.scrollSnapType = 'none';
  pager.scrollLeft = settledIndex * step;
  // re-enable snapping on the next frame so the programmatic jump isn't animated
  requestAnimationFrame(() => { pager.style.scrollSnapType = ''; });
  updateDots(settledIndex);
}

export function showPassView() {
  renderPassView();
  const take = activeTake();
  jumpTo(take.startIndex || 0);
  startEntrance(TIMING.launchDelay);
}

// ---------- swipe → NFC prompt reset (SPEC §5.5) ----------
function onScroll() {
  const pos = pager.scrollLeft;
  const live = Math.round(pos / step);
  updateDots(Math.max(0, Math.min(live, tickets().length - 1)));
  if (!fading && Math.abs(pos - settledIndex * step) > step * TIMING.swipeCommitFraction) {
    fading = true;
    fadeOutPrompt();
  }
  clearTimeout(settleTimer);
  settleTimer = setTimeout(onSettle, 140); // fallback for browsers without scrollend
}

function onSettle() {
  clearTimeout(settleTimer);
  const idx = Math.max(0, Math.min(Math.round(pager.scrollLeft / step), tickets().length - 1));
  if (Math.abs(pager.scrollLeft - idx * step) > 1) return; // still moving
  const changed = idx !== settledIndex;
  settledIndex = idx;
  updateDots(idx);
  if (fading) {
    fading = false;
    const sinceHidden = (performance.now() - hiddenAt) / 1000;
    const wait = Math.max(0, TIMING.fadeOutDur + TIMING.hiddenHold - sinceHidden);
    startEntrance(wait);
  } else if (changed) {
    startEntrance(0);
  }
}

function cancelAnims() {
  anims.forEach((a) => a.cancel());
  anims = [];
}

function fadeOutPrompt() {
  cancelAnims();
  hiddenAt = performance.now();
  const a = prompt.animate([{ opacity: getComputedStyle(prompt).opacity }, { opacity: 0 }],
    { duration: TIMING.fadeOutDur * 1000, easing: 'ease-out', fill: 'forwards' });
  anims.push(a);
  // keep the phone where it is while fading; it restarts from below on entrance
}

// Entrance: ring + text fade in (empty ring), phone slides up, holds flat, then the tilt loop starts.
export function startEntrance(delaySec = 0) {
  cancelAnims();
  const d = delaySec * 1000;
  const fadeIn = TIMING.fadeInDur * 1000;
  const enter = TIMING.phoneEnterDur * 1000;
  const hold = TIMING.flatHold * 1000;
  const loop = TIMING.loopDur * 1000;

  anims.push(prompt.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeIn, delay: d, easing: 'ease-out', fill: 'both' }));
  anims.push(phoneEnter.animate(
    [{ transform: `translateY(${TIMING.phoneEnterTravel}px)` }, { transform: 'translateY(0)' }],
    { duration: enter, delay: d + fadeIn + TIMING.phoneEnterDelay * 1000, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }));

  const loopStart = d + fadeIn + enter + hold;
  // First cycle starts from flat (100%) — measured once right after the phone enters.
  const first = phone.animate([
    { transform: 'none', offset: 0, easing: ease },
    { transform: TILT_FAR, offset: 0.31 },
    { transform: TILT_FAR, offset: 0.40, easing: ease },
    { transform: TILT_REST, offset: 0.65 },
    { transform: TILT_REST, offset: 1 },
  ], { duration: loop, delay: loopStart, fill: 'both' });
  anims.push(first);
  const loopPhone = phone.animate([
    { transform: TILT_REST, offset: 0, easing: ease },
    { transform: TILT_FAR, offset: 0.31 },
    { transform: TILT_FAR, offset: 0.40, easing: ease },
    { transform: TILT_REST, offset: 0.65 },
    { transform: TILT_REST, offset: 1 },
  ], { duration: loop, delay: loopStart + loop, iterations: Infinity, fill: 'none' });
  anims.push(loopPhone);
  anims.push(sheen.animate([
    { transform: SHEEN_OFF, offset: 0 },
    { transform: SHEEN_OFF, offset: 0.07, easing: ease },
    { transform: 'translate(0,0)', offset: 0.18, easing: ease },
    { transform: SHEEN_PEAK, offset: 0.29 },
    { transform: SHEEN_PEAK, offset: 0.37, easing: ease },
    { transform: 'translate(0,0)', offset: 0.53, easing: ease },
    { transform: SHEEN_OFF, offset: 0.64 },
    { transform: SHEEN_OFF, offset: 1 },
  ], { duration: loop, delay: loopStart, iterations: Infinity, fill: 'both' }));
}

// ---------- long-press ⋯ (600 ms) opens the Organizer; a tap does nothing ----------
function setupLongPress(btn) {
  let timer = 0; let sx = 0; let sy = 0;
  const clear = () => { clearTimeout(timer); timer = 0; };
  btn.addEventListener('pointerdown', (e) => {
    sx = e.clientX; sy = e.clientY;
    clear();
    timer = setTimeout(() => { timer = 0; onOpenOrganizer(); }, TIMING.longPressMs);
  });
  btn.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 12) clear(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => btn.addEventListener(ev, clear));
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

export const passConstants = { CARD, COLORS };
