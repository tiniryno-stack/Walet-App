// Screen 3 — Builder (ticket editor). Frozen header/preview/reference bar/picker,
// scrolling settings, fixed save bar. No drag-to-edit: precise 0.5pt steppers + sliders.
import { ELEMENTS, FIELD_IDS, SWATCHES, LAYOUT } from './constants.js';
import { renderCard, fitTitles, glowFor } from './card.js';
import { activeTake, getState, save, clone, elementData, applyLook, styleOf, applyToAll, uid, defaultTicket } from './store.js';
import { putImage, imageUrl, listImages, cachedUrl, deleteImage } from './images.js';
import { esc, sheet, actionSheet, confirmSheet, promptSheet, toast, sw } from './ui.js';

const REF_KEY = 'walletProp.builderRef';
const PREVIEW_SCALE = 0.75;

let el; let onBack; let index = 0; let draft; let original;
let sel = 0;
let open = 'content';
let ref = loadRef();
let refImg = null;         // HTMLImageElement of the reference
let refSwatches = [];
let genReport = null;
let lowConf = new Set();
let busy = '';

function loadRef() {
  try { return { mode: 'off', opacity: 50, wipe: 50, imageId: null, align: null, ...JSON.parse(localStorage.getItem(REF_KEY) || '{}') }; } catch { return { mode: 'off', opacity: 50, wipe: 50, imageId: null, align: null }; }
}
function saveRef() { try { localStorage.setItem(REF_KEY, JSON.stringify(ref)); } catch { /* ignore */ } }

// debug handle for automated checks
window.__builder = { get draft() { return draft; }, get lowConf() { return [...lowConf]; } };

export async function showBuilder(container, opts) {
  el = container;
  onBack = opts.onBack;
  loadTicket(opts.index);
  if (ref.imageId) await loadRefImage(ref.imageId);
  renderAll();
}

function loadTicket(i) {
  const take = activeTake();
  index = Math.max(0, Math.min(i, take.tickets.length - 1));
  original = take.tickets[index];
  draft = clone(original);
  lowConf = new Set();
}

const dirty = () => JSON.stringify(draft) !== JSON.stringify(original);
const cur = () => ELEMENTS[sel];
const data = () => elementData(draft, cur().id);
const cardW = () => window.innerWidth - LAYOUT.sideInset * 2;

async function loadRefImage(id) {
  const url = await imageUrl(id);
  if (!url) { ref.imageId = null; return; }
  refImg = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
}

// ---------------------------------------------------------------- layout
function renderAll() {
  const take = activeTake();
  const n = take.tickets.length;
  const W = cardW();
  const stageLeft = (window.innerWidth - W * PREVIEW_SCALE) / 2;
  el.innerHTML = `
  <div class="builder">
    <div class="b-nav">
      <button type="button" class="link" data-act="back">‹ Tickets</button>
      <span class="b-title">Ticket ${index + 1} of ${n}${dirty() ? ' •' : ''}</span>
      <span class="b-navbtns"><button type="button" class="sq" data-act="prevTicket" aria-label="Previous ticket" ${index === 0 ? 'disabled' : ''}>‹</button><button type="button" class="sq" data-act="nextTicket" aria-label="Next ticket" ${index >= n - 1 ? 'disabled' : ''}>›</button></span>
    </div>
    <div class="b-preview" style="height:${Math.round(LAYOUT.cardHeight * PREVIEW_SCALE + 18)}px">
      <div class="b-stage" style="left:${stageLeft}px;width:${W}px;--card-w:${W}px;transform:scale(${PREVIEW_SCALE})">
        <div class="b-card"></div>
        <div class="b-ref" hidden><img alt=""></div>
        <div class="b-wipe" hidden><div class="b-wipe-line"></div><div class="b-wipe-handle" role="slider" aria-label="Wipe divider"><svg width="24" height="14" viewBox="0 0 22 12"><path d="M7 1 L2 6 L7 11 M15 1 L20 6 L15 11" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <span class="b-tag l">REFERENCE</span><span class="b-tag r">YOUR BUILD</span></div>
        <div class="b-align-hint" hidden>Drag to move · pinch to scale</div>
      </div>
    </div>
    <div class="b-refbar">
      <div class="row">
        <label class="sq up" aria-label="Upload reference photo"><svg width="16" height="16" viewBox="0 0 16 16"><rect x="1.5" y="3" width="13" height="10" rx="2" stroke="#0A84FF" stroke-width="1.4" fill="none"/><circle cx="5.5" cy="6.5" r="1.3" fill="#0A84FF"/><path d="M2.5 12 L6.5 8.5 L9 10.5 L11 9 L14 11.5" stroke="#0A84FF" stroke-width="1.4" fill="none"/></svg><input type="file" accept="image/*" data-act="refUpload" hidden></label>
        <div class="seg small" role="group" aria-label="Reference mode">
          ${['overlay', 'wipe', 'off'].map((m) => `<button type="button" data-act="refMode" data-v="${m}" class="${ref.mode === m ? 'on' : ''}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}
        </div>
        <button type="button" class="chip ${ref.aligning ? 'on' : ''}" data-act="align" ${ref.imageId ? '' : 'disabled'}>Align</button>
        ${ref.mode === 'wipe' ? '<button type="button" class="chip" data-act="wipe50">50/50</button>' : ''}
        <span class="b-reflabel"></span>
      </div>
      <input type="range" min="0" max="100" step="1" class="b-refslider" data-act="refSlider" ${ref.mode === 'off' ? 'hidden' : ''}>
      <div class="row picker">
        <button type="button" class="sq wide" data-act="prevEl" aria-label="Previous element">‹</button>
        <div class="picker-mid"><span class="picker-name"></span><span class="picker-sub"></span></div>
        <button type="button" class="sq wide" data-act="nextEl" aria-label="Next element">›</button>
      </div>
    </div>
    <div class="b-settings"></div>
    <div class="b-bottom">
      <button type="button" class="bigbtn secondary" data-act="applyAll">Apply to All ${n}</button>
      <button type="button" class="bigbtn primary" data-act="save">Save Ticket</button>
    </div>
  </div>`;
  bindStatic();
  renderPreview();
  renderRef();
  renderPicker();
  renderSettings();
}

function renderPreview() {
  const host = el.querySelector('.b-card');
  host.innerHTML = '';
  const card = renderCard(draft);
  card.style.filter = glowFor(draft);
  host.appendChild(card);
  fitTitles(host);
  const id = cur().id;
  host.querySelectorAll(`[data-el="${id}"]`).forEach((n) => n.classList.add('sel'));
  const title = el.querySelector('.b-title');
  if (title) title.textContent = `Ticket ${index + 1} of ${activeTake().tickets.length}${dirty() ? ' •' : ''}`;
}

function renderRef() {
  const layer = el.querySelector('.b-ref');
  const wipe = el.querySelector('.b-wipe');
  const slider = el.querySelector('.b-refslider');
  const label = el.querySelector('.b-reflabel');
  const hint = el.querySelector('.b-align-hint');
  const has = !!(ref.imageId && refImg);
  layer.hidden = !has || ref.mode === 'off';
  wipe.hidden = !has || ref.mode !== 'wipe';
  hint.hidden = !ref.aligning;
  slider.hidden = ref.mode === 'off';
  if (ref.mode === 'overlay') { slider.value = ref.opacity; label.textContent = `Opacity ${ref.opacity}%`; } else if (ref.mode === 'wipe') { slider.value = ref.wipe; label.textContent = `Divider ${ref.wipe}%`; } else label.textContent = has ? '' : 'No reference';
  if (!has) return;
  const img = layer.querySelector('img');
  if (img.src !== refImg.src) img.src = refImg.src;
  const a = ref.align || defaultAlign();
  img.style.cssText = `position:absolute;left:${a.x}px;top:${a.y}px;width:${a.w}px;height:auto;max-width:none`;
  layer.style.opacity = ref.mode === 'overlay' ? ref.opacity / 100 : 1;
  layer.style.clipPath = ref.mode === 'wipe' ? `inset(-40px ${100 - ref.wipe}% -40px -40px)` : 'none';
  wipe.querySelector('.b-wipe-line').style.left = `${ref.wipe}%`;
  wipe.querySelector('.b-wipe-handle').style.left = `${ref.wipe}%`;
}

function defaultAlign() {
  // Assume a full-screen iPhone screenshot: card spans x 20 → W-20, y 128 (SPEC §9.1)
  if (!refImg) return { x: 0, y: 0, w: cardW() };
  const nat = refImg.naturalWidth;
  const ratio = refImg.naturalHeight / nat;
  if (nat >= 1000 && ratio > 1.9 && ratio < 2.3) {
    const ptW = nat / 3;
    const s = cardW() / (ptW - 40);
    return { x: -20 * s, y: -LAYOUT.cardTop * s, w: ptW * s };
  }
  return { x: 0, y: 0, w: cardW() };
}

function renderPicker() {
  const e = cur();
  el.querySelector('.picker-name').innerHTML = `${esc(e.name)}${lowConf.has(e.id) ? ' <i class="lowdot" title="Check OCR"></i>' : ''}`;
  el.querySelector('.picker-sub').textContent = `${sel + 1} of ${ELEMENTS.length} · tap the card to jump`;
}

// ---------------------------------------------------------------- settings
const r1 = (v) => Math.round(v * 2) / 2;
const fmt = (v) => (Math.round(v * 10) / 10).toString();

function swatchRow(key, current, list = SWATCHES) {
  const c = (current || '').toUpperCase();
  return `<div class="swatches">${list.map((hx) => `<button type="button" class="sw ${hx.toUpperCase() === c ? 'on' : ''}" style="background:${hx}" data-act="color" data-key="${key}" data-v="${hx}" aria-label="${hx}"></button>`).join('')}
    <label class="sw pick" aria-label="Custom color"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(current) ? current : '#ffffff'}" data-act="colorInput" data-key="${key}"></label></div>
    <input class="input hex" type="text" value="${esc(current || '')}" data-act="hexInput" data-key="${key}" spellcheck="false" autocapitalize="characters">`;
}

function stepper(label, act, value, min, max, unit = 'pt') {
  return `<div class="ctl"><span class="ctl-l">${label}</span>
    <button type="button" class="sq" data-act="${act}" data-d="-0.5">${act.startsWith('x') ? '←' : act.startsWith('y') ? '↑' : '−'}</button>
    <input type="range" min="${min}" max="${max}" step="0.5" value="${value}" data-act="${act}Slide">
    <button type="button" class="sq" data-act="${act}" data-d="0.5">${act.startsWith('x') ? '→' : act.startsWith('y') ? '↓' : '+'}</button>
    <span class="ctl-v" data-readout="${act}">${fmt(value)}${unit}</span></div>`;
}

function section(id, title, body) {
  const isOpen = open === id;
  return `<div class="box"><button type="button" class="box-h" data-act="toggle" data-v="${id}" aria-expanded="${isOpen}"><span>${title}</span><span class="chev">${isOpen ? '⌃' : '⌄'}</span></button>${isOpen ? `<div class="box-b">${body}</div>` : ''}</div>`;
}

function imageButtons(slot) {
  return `<div class="grid3">
    <label class="btn2">Upload…<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp,image/*" data-act="imgUpload" data-slot="${slot}" hidden></label>
    <button type="button" class="btn2" data-act="imgLibrary" data-slot="${slot}">Library</button>
    <button type="button" class="btn2 muted" data-act="imgClear" data-slot="${slot}">Use text</button></div>`;
}

function valuesEditor(d) {
  return d.values.map((v, k) => `<div class="field-l">${k === 0 ? 'Value' : `Alt value ${k} (glitch)`}</div>
    <div class="inrow"><input class="input" type="text" value="${esc(v)}" data-act="value" data-k="${k}">${k > 0 ? `<button type="button" class="sq" data-act="rmAlt" data-k="${k}" aria-label="Remove">×</button>` : ''}</div>`).join('')
    + '<button type="button" class="linkbtn" data-act="addAlt">+ alt value (for glitch)</button>';
}

function contentBody() {
  const e = cur(); const d = data(); const s = draft.style;
  if (e.kind === 'field') {
    return `<div class="field-l">Label</div><input class="input lbl" type="text" value="${esc(d.label)}" data-act="label">
      <button type="button" class="togrow" data-act="toggleKey" data-key="labelVisible"><span>Show label</span>${sw(d.labelVisible)}</button>
      ${valuesEditor(d)}
      <button type="button" class="togrow" data-act="toggleKey" data-key="visible"><span>Show field</span>${sw(d.visible)}</button>`;
  }
  if (e.kind === 'text') {
    return `${valuesEditor(d)}<button type="button" class="togrow" data-act="toggleKey" data-key="visible"><span>Show</span>${sw(d.visible)}</button>`;
  }
  if (e.id === 'headerLogo') {
    return `${imageButtons('headerLogo')}${s.headerLogo.imageId ? '<div class="note">Using an image. “Use text” switches back to the wordmark.</div>' : `<div class="field-l">Wordmark text</div><input class="input" type="text" value="${esc(s.headerLogo.text)}" data-act="styleText" data-key="text">`}`;
  }
  if (e.id === 'band') {
    const b = s.band;
    return `<div class="field-l">Band</div>
      <div class="seg">${['color', 'image'].map((m) => `<button type="button" data-act="bandMode" data-v="${m}" class="${b.mode === m ? 'on' : ''}">${m === 'color' ? 'Solid color + logo' : 'Full-bleed image'}</button>`).join('')}</div>
      ${b.mode === 'image'
    ? `<div class="grid3"><label class="btn2">Upload…<input type="file" accept="image/*" data-act="imgUpload" data-slot="bandImage" hidden></label><button type="button" class="btn2" data-act="imgLibrary" data-slot="bandImage">Library</button><button type="button" class="btn2 muted" data-act="bandMode" data-v="color">Solid</button></div>`
    : `<div class="field-l">Centered logo</div>${imageButtons('bandLogo')}${b.logoImageId ? '' : `<div class="field-l">Logo text</div><input class="input" type="text" value="${esc(b.logoText)}" data-act="styleText" data-key="logoText">`}`}`;
  }
  if (e.id === 'appIcon') {
    return `<button type="button" class="togrow" data-act="toggleIcon"><span>Show app icon</span>${sw(s.appIcon.visible)}</button>${imageButtons('appIcon').replace('Use text', 'Default')}`;
  }
  if (e.id === 'footer') {
    const f = s.footer;
    return `<div class="seg">${[['nfc', 'NFC symbol'], ['text', 'Text'], ['none', 'None']].map(([m, l]) => `<button type="button" data-act="footerMode" data-v="${m}" class="${f.mode === m ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${f.mode === 'text' ? `<div class="field-l">Footer text</div><input class="input" type="text" value="${esc(f.text)}" data-act="styleText" data-key="text">` : ''}`;
  }
  return '';
}

function styleBody() {
  const e = cur(); const d = data();
  let out = '';
  const refSw = refSwatches.length ? `<div class="field-l">From reference: tap to apply to ${esc(e.name)}</div><div class="swatches">${refSwatches.map((hx) => `<button type="button" class="sw sq8" style="background:${hx}" data-act="color" data-key="${e.kind === 'field' ? 'color' : 'color'}" data-v="${hx}" aria-label="${hx}"></button>`).join('')}</div>` : '';
  if (e.id === 'appIcon') return '<div class="note">The default app icon uses the band color. Upload an image in Content to replace it.</div>';
  const colorTitle = e.kind === 'field' ? 'Value color' : e.id === 'band' ? 'Band color' : 'Color';
  out += `<div class="field-l row-sb"><span>${colorTitle}</span></div>${swatchRow('color', d.color)}`;
  if (e.kind === 'field') out += `<div class="field-l">Label color</div>${swatchRow('labelColor', d.labelColor)}`;
  if (e.id === 'band' && draft.style.band.mode === 'color' && !draft.style.band.logoImageId) out += `<div class="field-l">Logo color</div>${swatchRow('logoColor', draft.style.band.logoColor)}`;
  out += refSw;
  const hasSize = !(e.id === 'footer' && draft.style.footer.mode !== 'text') && !(e.id === 'band' && draft.style.band.mode === 'image');
  if (hasSize) out += stepper(e.id === 'band' ? 'Logo size' : e.id === 'headerLogo' && draft.style.headerLogo.imageId ? 'Height' : 'Text size', 'size', d.size, 8, e.id === 'band' ? 120 : 60);
  if (e.kind === 'field') out += stepper('Label size', 'labelSize', d.labelSize || 10, 6, 30);
  return out;
}

function positionBody() {
  const d = data();
  if (cur().id === 'band' && draft.style.band.mode === 'image') return '<div class="note">A full-bleed band image fills the band. Position applies to the centered logo in solid mode.</div>';
  return `${stepper('Left / right', 'x', d.x || 0, -60, 60)}${stepper('Up / down', 'y', d.y || 0, -60, 60)}
    <div class="row-sb"><span class="note">Arrows move 0.5pt. The slider is for big moves.</span><button type="button" class="linkbtn" data-act="resetPos">Reset</button></div>`;
}

function cardBody() {
  const looks = getState().looks || {};
  const layout = draft.style.layout || '3+2';
  return `<div class="field-l">Looks: tap to restyle this ticket</div>
    <div class="looks">${Object.entries(looks).map(([id, lk]) => `<button type="button" class="look" data-act="look" data-v="${id}"><span class="look-sw" style="background:${lk.style.cardBg}"><i style="background:${lk.style.band?.color}"></i></span>${esc(lk.name)}</button>`).join('')}
      <button type="button" class="look add" data-act="saveLook">+ Save as look</button>
      ${Object.keys(looks).length ? '<button type="button" class="look add muted" data-act="manageLooks">Manage…</button>' : ''}</div>
    <div class="field-l">Card background</div>${swatchRow('cardBg', draft.style.cardBg)}
    <div class="field-l">Field layout</div>
    <div class="seg">${[['3+2', '3 + 2'], ['3+1', '3 + 1'], ['1+GA', '1 + GA']].map(([v, l]) => `<button type="button" data-act="layout" data-v="${v}" class="${layout === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="note">3 + 1 hides Ticket Type. 1 + GA shows Section plus a right-aligned value with no label (e.g. “General Admission”).</div>
    <button type="button" class="linkbtn danger" data-act="resetTicket">Reset this ticket to the starter design…</button>`;
}

function renderSettings() {
  const host = el.querySelector('.b-settings');
  const top = host.scrollTop;
  const gen = `<div class="box pad">
    <div class="row gap"><button type="button" class="bigbtn primary flex" data-act="generate" ${busy ? 'disabled' : ''}>${busy === 'gen' ? 'Generating…' : 'Generate from reference'}</button>
    <button type="button" class="bigbtn secondary" data-act="swatches" ${busy ? 'disabled' : ''}>Swatches only</button></div>
    ${busy && busy.startsWith('ocr') ? `<div class="note">${esc(busy.slice(4))}</div>` : ''}
    ${genReport ? `<div class="report">${genReport}</div>` : ''}
    ${!ref.imageId ? '<div class="note">Upload a reference photo (the picture button above) to generate a look from it.</div>' : ''}
  </div>`;
  host.innerHTML = gen
    + section('content', 'Content', contentBody())
    + section('style', 'Color &amp; size', styleBody())
    + section('position', 'Position', positionBody())
    + section('card', 'Whole card &amp; looks', cardBody());
  host.scrollTop = top;
  bindSettings(host);
}

function refreshAfterEdit({ settings = false } = {}) {
  renderPreview();
  renderPicker();
  if (settings) renderSettings();
}

// ---------------------------------------------------------------- events
function bindStatic() {
  el.querySelectorAll('.b-nav [data-act], .b-refbar [data-act], .b-bottom [data-act]').forEach((b) => {
    const ev = b.tagName === 'INPUT' ? (b.type === 'file' ? 'change' : 'input') : 'click';
    b.addEventListener(ev, (e) => handle(b.dataset.act, b, e));
  });
  const stage = el.querySelector('.b-preview');
  stage.addEventListener('click', (e) => {
    if (ref.aligning) return;
    const t = e.target.closest('[data-el]');
    if (!t) return;
    const k = ELEMENTS.findIndex((x) => x.id === t.dataset.el);
    if (k >= 0) { sel = k; refreshAfterEdit({ settings: true }); }
  });
  setupWipeDrag();
  setupAlignGestures();
}

function bindSettings(host) {
  host.querySelectorAll('[data-act]').forEach((b) => {
    let ev = 'click';
    if (b.tagName === 'INPUT') ev = b.type === 'file' ? 'change' : (b.type === 'range' || b.type === 'text' || b.type === 'color') ? 'input' : 'change';
    b.addEventListener(ev, (e) => handle(b.dataset.act, b, e));
    if (b.dataset.act === 'hexInput') b.addEventListener('change', () => renderSettings());
  });
}

function setColor(key, hex) {
  const e = cur();
  if (key === 'cardBg') { draft.style.cardBg = hex; return; }
  if (key === 'logoColor') { draft.style.band.logoColor = hex; return; }
  const d = data();
  if (e.id === 'appIcon') return;
  d[key] = hex;
}

async function handle(act, b, e) {
  const d = data();
  const delta = +b.dataset.d;
  switch (act) {
    case 'back': if (await leave()) onBack(); return;
    case 'prevTicket': case 'nextTicket': {
      if (!(await leave())) return;
      loadTicket(index + (act === 'nextTicket' ? 1 : -1));
      renderAll(); return;
    }
    case 'save': commit(); toast(`Saved Ticket ${index + 1}`); onBack(); return;
    case 'applyAll': await applyAllFlow(); return;
    case 'prevEl': sel = (sel + ELEMENTS.length - 1) % ELEMENTS.length; refreshAfterEdit({ settings: true }); return;
    case 'nextEl': sel = (sel + 1) % ELEMENTS.length; refreshAfterEdit({ settings: true }); return;

    // reference bar
    case 'refUpload': {
      const f = b.files?.[0]; if (!f) return;
      const id = await putImage(f, f.name || 'reference');
      ref.imageId = id; ref.align = null; ref.mode = ref.mode === 'off' ? 'wipe' : ref.mode;
      await loadRefImage(id);
      try { const { findCard } = await import('./generate.js'); const a = findCard(refImg, cardW()); if (a) ref.align = a.align; } catch (err) { console.warn(err); }
      refSwatches = []; genReport = null;
      saveRef(); renderAll(); toast('Reference loaded'); return;
    }
    case 'refMode': ref.mode = b.dataset.v; saveRef(); renderAll(); return;
    case 'wipe50': ref.wipe = 50; saveRef(); renderRef(); return;
    case 'align': ref.aligning = !ref.aligning; if (!ref.align) ref.align = defaultAlign(); saveRef(); renderAll(); return;
    case 'refSlider':
      if (ref.mode === 'overlay') ref.opacity = +b.value; else ref.wipe = +b.value;
      saveRef(); renderRef(); return;

    // sections
    case 'toggle': open = open === b.dataset.v ? '' : b.dataset.v; renderSettings(); return;

    // content
    case 'label': d.label = b.value; refreshAfterEdit(); return;
    case 'value': d.values[+b.dataset.k] = b.value; lowConf.delete(cur().id); refreshAfterEdit(); return;
    case 'addAlt': d.values.push(d.values[0]); renderSettings(); return;
    case 'rmAlt': d.values.splice(+b.dataset.k, 1); refreshAfterEdit({ settings: true }); return;
    case 'toggleKey': d[b.dataset.key] = !d[b.dataset.key]; refreshAfterEdit({ settings: true }); return;
    case 'styleText': d[b.dataset.key] = b.value; refreshAfterEdit(); return;
    case 'toggleIcon': draft.style.appIcon.visible = !draft.style.appIcon.visible; refreshAfterEdit({ settings: true }); return;
    case 'footerMode': draft.style.footer.mode = b.dataset.v; refreshAfterEdit({ settings: true }); return;
    case 'bandMode':
      if (b.dataset.v === 'image' && !draft.style.band.imageId) { toast('Upload or pick a band image'); }
      draft.style.band.mode = b.dataset.v; refreshAfterEdit({ settings: true }); return;
    case 'imgUpload': {
      const f = b.files?.[0]; if (!f) return;
      const id = await putImage(f, f.name || b.dataset.slot);
      await imageUrl(id);
      setSlot(b.dataset.slot, id); refreshAfterEdit({ settings: true }); return;
    }
    case 'imgLibrary': {
      const id = await pickFromLibrary();
      if (!id) return;
      await imageUrl(id);
      setSlot(b.dataset.slot, id); refreshAfterEdit({ settings: true }); return;
    }
    case 'imgClear': setSlot(b.dataset.slot, null); refreshAfterEdit({ settings: true }); return;

    // color & size
    case 'color': setColor(b.dataset.key, b.dataset.v); refreshAfterEdit({ settings: true }); return;
    case 'colorInput': setColor(b.dataset.key, b.value.toUpperCase()); refreshAfterEdit(); syncHex(b.dataset.key, b.value.toUpperCase()); return;
    case 'hexInput': {
      const v = b.value.trim();
      if (/^#?[0-9a-f]{6}$/i.test(v)) { setColor(b.dataset.key, (`#${v.replace('#', '')}`).toUpperCase()); refreshAfterEdit(); }
      return;
    }
    case 'size': d.size = clamp(r1((d.size || 0) + delta), 8, 120); refreshAfterEdit(); readout('size', d.size); return;
    case 'sizeSlide': d.size = +b.value; refreshAfterEdit(); readout('size', d.size, false); return;
    case 'labelSize': d.labelSize = clamp(r1((d.labelSize || 10) + delta), 6, 30); refreshAfterEdit(); readout('labelSize', d.labelSize); return;
    case 'labelSizeSlide': d.labelSize = +b.value; refreshAfterEdit(); readout('labelSize', d.labelSize, false); return;

    // position
    case 'x': d.x = clamp(r1((d.x || 0) + delta), -200, 200); refreshAfterEdit(); readout('x', d.x); return;
    case 'y': d.y = clamp(r1((d.y || 0) + delta), -200, 200); refreshAfterEdit(); readout('y', d.y); return;
    case 'xSlide': d.x = +b.value; refreshAfterEdit(); readout('x', d.x, false); return;
    case 'ySlide': d.y = +b.value; refreshAfterEdit(); readout('y', d.y, false); return;
    case 'resetPos': d.x = 0; d.y = 0; refreshAfterEdit({ settings: true }); return;

    // whole card
    case 'look': {
      const lk = getState().looks[b.dataset.v];
      if (lk) { applyLook(draft, lk); refreshAfterEdit({ settings: true }); toast(`Look: ${lk.name}`); }
      return;
    }
    case 'saveLook': {
      const name = await promptSheet('Save as look', 'My look');
      if (!name) return;
      const st = getState();
      st.looks = st.looks || {};
      st.looks[uid('look')] = { name, style: styleOf(draft) };
      save(); renderSettings(); toast(`Saved look “${name}”`); return;
    }
    case 'manageLooks': {
      const st = getState();
      const ids = Object.keys(st.looks || {});
      const r = await actionSheet('Delete a look', ids.map((id) => ({ label: `Delete “${st.looks[id].name}”`, destructive: true })));
      if (r == null) return;
      delete st.looks[ids[r]]; save(); renderSettings(); return;
    }
    case 'layout': setLayout(b.dataset.v); refreshAfterEdit({ settings: true }); return;
    case 'resetTicket': {
      if (!(await confirmSheet('Reset this ticket?', 'Restores the starter design, keeping this ticket’s seats.', 'Reset', { destructive: true }))) return;
      const keep = clone(draft.fields);
      const fresh = defaultTicket(); fresh.id = draft.id;
      for (const k of ['section', 'row', 'seat']) fresh.fields[k].values = keep[k].values;
      draft = fresh; refreshAfterEdit({ settings: true }); return;
    }

    // generate
    case 'swatches': await runSwatches(); return;
    case 'generate': await runGenerate(); return;
    default:
  }
}

function syncHex(key, v) {
  const inp = el.querySelector(`.hex[data-key="${key}"]`);
  if (inp) inp.value = v;
}
function readout(act, v, syncSlider = true) {
  const r = el.querySelector(`[data-readout="${act}"]`);
  if (r) r.textContent = `${fmt(v)}pt`;
  if (syncSlider) { const s = el.querySelector(`[data-act="${act}Slide"]`); if (s) s.value = v; }
}
const clamp = (v, a, b2) => Math.max(a, Math.min(b2, v));

function setSlot(slot, id) {
  const s = draft.style;
  if (slot === 'headerLogo') s.headerLogo.imageId = id;
  else if (slot === 'bandLogo') s.band.logoImageId = id;
  else if (slot === 'bandImage') { s.band.imageId = id; if (id) s.band.mode = 'image'; }
  else if (slot === 'appIcon') s.appIcon.imageId = id;
}

function setLayout(v) {
  const f = draft.fields;
  draft.style.layout = v;
  if (v === '3+2') { for (const k of FIELD_IDS) { f[k].visible = true; f[k].labelVisible = true; } if (f.seat.label === '') f.seat.label = 'SEAT'; }
  if (v === '3+1') { for (const k of FIELD_IDS) { f[k].visible = true; f[k].labelVisible = true; } f.ticketType.visible = false; }
  if (v === '1+GA') {
    f.section.visible = true; f.section.labelVisible = true;
    f.row.visible = false;
    f.seat.visible = true; f.seat.labelVisible = false;
    if (/^\d+$/.test(f.seat.values[0])) f.seat.values[0] = 'General Admission';
  }
}

async function pickFromLibrary() {
  const imgs = await listImages();
  if (!imgs.length) { toast('The image library is empty — upload one first'); return null; }
  await Promise.all(imgs.map((i) => imageUrl(i.id)));
  return sheet(`<div class="sheet-title">Image library</div>
    <div class="lib">${imgs.map((i) => `<button type="button" class="lib-item" data-id="${i.id}"><img src="${cachedUrl(i.id)}" alt=""></button>`).join('')}</div>
    <div class="note">Long-press an image to delete it.</div>
    <div class="sheet-btns one"><button type="button" class="btn" data-x>Cancel</button></div>`, {
    onMount: (s, close) => {
      s.querySelector('[data-x]').onclick = () => close(null);
      s.querySelectorAll('.lib-item').forEach((btn) => {
        let t = 0;
        btn.addEventListener('pointerdown', () => { t = setTimeout(async () => { t = -1; if (await confirmSheet('Delete this image?', 'Tickets using it fall back to text.', 'Delete', { destructive: true })) { await deleteImage(btn.dataset.id); btn.remove(); } }, 650); });
        btn.addEventListener('pointerup', () => { if (t > 0) clearTimeout(t); });
        btn.addEventListener('click', () => { if (t !== -1) close(btn.dataset.id); });
      });
    },
  });
}

function commit() {
  const take = activeTake();
  take.tickets[index] = clone(draft);
  original = take.tickets[index];
  save();
}

async function leave() {
  if (!dirty()) return true;
  const r = await actionSheet(`Ticket ${index + 1} has unsaved changes`, [{ label: 'Save Ticket' }, { label: 'Discard Changes', destructive: true }]);
  if (r == null) return false;
  if (r === 0) commit();
  return true;
}

async function applyAllFlow() {
  const n = activeTake().tickets.length;
  let keep = true;
  const ok = await sheet(`<div class="sheet-title">Apply to all ${n} tickets?</div>
    <div class="sheet-msg">Copies this ticket’s text, labels, colors, sizes, positions and images onto every ticket in this take, replacing what they have now.</div>
    <button type="button" class="togrow boxed" data-k><span>Keep each ticket’s Section, Row and Seat</span>${sw(true)}</button>
    <div class="sheet-btns"><button type="button" class="btn" data-v="0">Cancel</button><button type="button" class="btn primary" data-v="1">Apply</button></div>`, {
    onMount: (s, close) => {
      const k = s.querySelector('[data-k]');
      k.onclick = () => { keep = !keep; k.querySelector('.switch').classList.toggle('on', keep); };
      s.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => close(b.dataset.v === '1'); });
    },
  });
  if (!ok) return;
  commit();
  applyToAll(activeTake(), index, keep);
  save();
  toast(`Applied to all ${n}${keep ? ' (seats kept)' : ''}`);
  renderAll();
}

// ---------------------------------------------------------------- wipe divider & align gestures
function setupWipeDrag() {
  const handleEl = el.querySelector('.b-wipe-handle');
  const stage = el.querySelector('.b-stage');
  handleEl.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    handleEl.setPointerCapture(e.pointerId);
    const rect = stage.getBoundingClientRect();
    const move = (ev) => {
      ref.wipe = Math.round(clamp((ev.clientX - rect.left) / rect.width * 100, 0, 100));
      renderRef();
    };
    const up = () => { handleEl.removeEventListener('pointermove', move); handleEl.removeEventListener('pointerup', up); saveRef(); };
    handleEl.addEventListener('pointermove', move);
    handleEl.addEventListener('pointerup', up);
  });
}

function setupAlignGestures() {
  const area = el.querySelector('.b-preview');
  const pts = new Map();
  let start = null;
  area.addEventListener('pointerdown', (e) => {
    if (!ref.aligning) return;
    area.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { a: { ...(ref.align || defaultAlign()) }, pts: new Map([...pts].map(([k, v]) => [k, { ...v }])) };
  });
  area.addEventListener('pointermove', (e) => {
    if (!ref.aligning || !pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const k = PREVIEW_SCALE;
    const ids = [...pts.keys()];
    if (ids.length === 1) {
      const p0 = start.pts.get(ids[0]); const p = pts.get(ids[0]);
      if (!p0) return;
      ref.align = { ...start.a, x: start.a.x + (p.x - p0.x) / k, y: start.a.y + (p.y - p0.y) / k };
    } else if (ids.length >= 2) {
      const [a0, b0] = [start.pts.get(ids[0]), start.pts.get(ids[1])];
      const [a1, b1] = [pts.get(ids[0]), pts.get(ids[1])];
      if (!a0 || !b0) return;
      const s = Math.hypot(a1.x - b1.x, a1.y - b1.y) / Math.max(1, Math.hypot(a0.x - b0.x, a0.y - b0.y));
      const stage = el.querySelector('.b-stage').getBoundingClientRect();
      const cx = ((a0.x + b0.x) / 2 - stage.left) / k; const cy = ((a0.y + b0.y) / 2 - stage.top) / k;
      const nx = ((a1.x + b1.x) / 2 - stage.left) / k; const ny = ((a1.y + b1.y) / 2 - stage.top) / k;
      ref.align = { w: start.a.w * s, x: nx - (cx - start.a.x) * s, y: ny - (cy - start.a.y) * s };
    }
    renderRef();
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (ref.aligning) { start = { a: { ...(ref.align || defaultAlign()) }, pts: new Map([...pts].map(([kk, v]) => [kk, { ...v }])) }; saveRef(); }
  };
  area.addEventListener('pointerup', end);
  area.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------- generate
async function runSwatches() {
  if (!refImg) { toast('Upload a reference photo first'); return; }
  busy = 'sw'; renderSettings();
  try {
    const { extractSwatches } = await import('./generate.js');
    refSwatches = extractSwatches(refImg, 8);
    open = 'style';
  } catch (err) { console.error(err); toast('Could not read colors'); }
  busy = ''; renderSettings();
}

async function runGenerate() {
  if (!refImg) { toast('Upload a reference photo first'); return; }
  busy = 'gen'; genReport = null; renderSettings();
  try {
    const gen = await import('./generate.js');
    const result = await gen.generateFromReference(refImg, draft, {
      cardWidth: cardW(),
      onProgress: (msg) => { busy = `ocr:${msg}`; renderSettings(); },
    });
    draft = result.ticket;
    lowConf = new Set(result.lowConfidence);
    if (result.align) { ref.align = result.align; saveRef(); }
    refSwatches = result.swatches || refSwatches;
    genReport = result.report;
    if (ref.mode === 'off') ref.mode = 'wipe';
    busy = '';
    renderAll();
    toast('Generated from reference');
  } catch (err) {
    console.error(err);
    busy = ''; genReport = `<span class="bad">Couldn’t generate: ${esc(err.message || err)}</span>`;
    renderSettings();
  }
}
