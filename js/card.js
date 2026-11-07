// Renders one pass card. Shared by the pass view (on camera) and the Builder preview.
import { LAYOUT, CARD, FIELD_IDS } from './constants.js';
import { cachedUrl } from './images.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const v0 = (f) => (f && f.values ? f.values[0] ?? '' : '');

// Stored hex colors are Display P3 values (the reference screenshots are P3), so render them
// with color(display-p3 …) to match the iPhone exactly. Grays are identical in sRGB and P3.
export function p3(hex, alpha = 1) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex || 'transparent';
  const n = parseInt(m[1], 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => +(v / 255).toFixed(4));
  return `color(display-p3 ${c[0]} ${c[1]} ${c[2]}${alpha < 1 ? ` / ${alpha}` : ''})`;
}

// SF Pro: (ascender - descender)/2 = (0.952 - 0.241)/2 ≈ 0.3555 em. With an explicit
// line-height L the baseline sits at top + L/2 + 0.3555*size; most fallback fonts are close.
const BASE_K = 0.3555;
const lhFor = (size) => Math.round(size * 1.2 * 2) / 2;
const topFor = (baseline, size, lh = lhFor(size)) => baseline - lh / 2 - BASE_K * size;

function textStyle(size, color, extra = '') {
  const lh = lhFor(size);
  return `font-size:${size}px;line-height:${lh}px;color:${p3(color)};${extra}`;
}
const move = (e) => `transform:translate(${e.x || 0}px,${e.y || 0}px);`;
const LABEL_EXTRA = 'font-weight:600;letter-spacing:0.06em;text-transform:uppercase;';

function fieldBlock(id, f, { left, right, align = 'left', labelBaseline, valueBaseline }) {
  if (!f.visible) return '';
  const ls = f.labelSize || CARD.labelSize;
  const llh = lhFor(ls);
  const vlh = lhFor(f.size);
  const labelTop = topFor(labelBaseline, ls, llh);
  const valueTop = topFor(valueBaseline, f.size, vlh);
  const top = f.labelVisible ? labelTop : valueTop;
  const pos = right != null ? `right:${right}px;` : `left:${left}px;`;
  const label = f.labelVisible
    ? `<div class="lbl" data-field="${id}.label" style="${textStyle(ls, f.labelColor, LABEL_EXTRA)}">${esc(f.label)}</div>`
    : '';
  const gap = f.labelVisible ? valueTop - (labelTop + llh) : 0;
  return `<div class="el fld" data-el="${id}" style="${pos}top:${top}px;text-align:${align};align-items:${align === 'right' ? 'flex-end' : 'flex-start'};${move(f)}">
    ${label}<div class="val" data-field="${id}" style="${textStyle(f.size, f.color)}margin-top:${gap}px">${esc(v0(f))}</div></div>`;
}

const NFC_SVG = (color) => `<svg viewBox="0 0 20 23" width="${CARD.nfcSymbol.w}" height="${CARD.nfcSymbol.h}" aria-hidden="true">
  <path d="M2.5 9.6 Q4.1 11.5 2.5 13.4 M6.4 7.1 Q9.9 11.5 6.4 15.9 M10.4 4.6 Q15.5 11.5 10.4 18.4 M14.4 2.1 Q21.1 11.5 14.4 20.9" style="stroke:${p3(color)}" stroke-width="1.75" fill="none" stroke-linecap="round"/></svg>`;

export function cardHTML(ticket) {
  const s = ticket.style;
  const f = ticket.fields;
  const parts = [];

  // Header logo (image or text wordmark), anchored by baseline at x 13
  const hl = s.headerLogo;
  const hlUrl = cachedUrl(hl.imageId);
  if (hlUrl) {
    const h = hl.size * 1.25;
    parts.push(`<div class="el" data-el="headerLogo" data-field="headerLogo" style="left:${CARD.headerLogo.x}px;top:${32.5 - h / 2}px;height:${h}px;${move(hl)}"><img src="${hlUrl}" alt="" style="height:100%;width:auto;display:block"></div>`);
  } else {
    parts.push(`<div class="el wordmark" data-el="headerLogo" data-field="headerLogo" style="left:${CARD.headerLogo.x}px;top:${topFor(CARD.headerLogo.baseline, hl.size)}px;${textStyle(hl.size, hl.color || '#FFFFFF')}${move(hl)}">${esc(hl.text)}</div>`);
  }

  // Header column: time over date, pinned right, contents left-aligned (matches reference)
  const t = f.time; const d = f.date;
  const tTop = topFor(CARD.time.baseline, t.size);
  const dTop = topFor(CARD.date.baseline, d.size);
  parts.push(`<div class="hcol" style="right:${CARD.headerCol.right}px;top:${Math.min(tTop, dTop)}px">
    ${t.visible ? `<div class="el" data-el="time" data-field="time" style="position:absolute;left:0;top:${tTop - Math.min(tTop, dTop)}px;${textStyle(t.size, t.color, LABEL_EXTRA)}${move(t)}">${esc(v0(t))}</div>` : ''}
    ${d.visible ? `<div class="el date" data-el="date" data-field="date" style="position:relative;top:${dTop - Math.min(tTop, dTop)}px;${textStyle(d.size, d.color)}${move(d)}">${esc(v0(d))}</div>` : ''}
  </div>`);

  // Band
  const b = s.band;
  const bandImg = b.mode === 'image' ? cachedUrl(b.imageId) : null;
  const logoUrl = b.mode === 'color' ? cachedUrl(b.logoImageId) : null;
  let bandInner = '';
  if (b.mode === 'color') {
    bandInner = logoUrl
      ? `<img src="${logoUrl}" alt="" style="height:${b.size * 0.88}px;width:auto;${move(b)}">`
      : `<span class="bandlogo" style="font-size:${b.size * 1.18}px;color:${p3(b.logoColor || '#FFFFFF')};${move(b)}">${esc(b.logoText ?? 'p')}</span>`;
  }
  parts.push(`<div class="el band" data-el="band" data-field="band" style="top:${LAYOUT.headerHeight}px;height:${LAYOUT.bandHeight}px;background-color:${p3(b.color)};${bandImg ? `background-image:url('${bandImg}');` : ''}">${bandInner}</div>`);

  // Body: venue + title
  const vl = f.venueLabel; const et = f.eventTitle;
  if (vl.visible) parts.push(`<div class="el" data-el="venueLabel" data-field="venueLabel" style="left:${CARD.body.left}px;top:${topFor(CARD.venueLabel.baseline, vl.size)}px;white-space:nowrap;${textStyle(vl.size, vl.color, LABEL_EXTRA)}${move(vl)}">${esc(v0(vl))}</div>`);
  if (et.visible) parts.push(`<div class="el title" data-el="eventTitle" data-field="eventTitle" data-size="${et.size}" style="left:${CARD.body.left}px;right:${CARD.body.right}px;top:${topFor(CARD.eventTitle.baseline, et.size)}px;${textStyle(et.size, et.color)}${move(et)}">${esc(v0(et))}</div>`);

  // Field rows
  parts.push(fieldBlock('section', f.section, { left: CARD.body.left, labelBaseline: CARD.row1.labelBaseline, valueBaseline: CARD.row1.valueBaseline }));
  parts.push(fieldBlock('row', f.row, { left: CARD.rowX, labelBaseline: CARD.row1.labelBaseline, valueBaseline: CARD.row1.valueBaseline }));
  parts.push(fieldBlock('seat', f.seat, { right: CARD.body.right, align: 'right', labelBaseline: CARD.row1.labelBaseline, valueBaseline: CARD.row1.valueBaseline }));
  parts.push(fieldBlock('entryInfo', f.entryInfo, { left: CARD.body.left, labelBaseline: CARD.row2.labelBaseline, valueBaseline: CARD.row2.valueBaseline }));
  parts.push(fieldBlock('ticketType', f.ticketType, { right: CARD.ticketTypeRight, labelBaseline: CARD.row2.labelBaseline, valueBaseline: CARD.row2.valueBaseline }));

  // Footer left: app icon
  const ai = s.appIcon;
  const aiUrl = cachedUrl(ai.imageId);
  const A = CARD.appIcon;
  parts.push(`<div class="el appicon" data-el="appIcon" data-field="appIcon" style="left:${A.left}px;bottom:${A.bottom}px;width:${A.size}px;height:${A.size}px;border-radius:${A.radius}px;${aiUrl ? '' : `background:${p3(b.mode === 'color' ? b.color : '#2D6BE0')};`}opacity:${ai.visible ? 1 : 0};${move(ai)}">${aiUrl ? `<img src="${aiUrl}" alt="">` : '<span>p</span>'}</div>`);

  // Footer right: NFC symbol / text / none
  const ft = s.footer;
  if (ft.mode === 'nfc') {
    parts.push(`<div class="el footer" data-el="footer" data-field="footer" style="right:${CARD.nfcSymbol.right}px;bottom:${CARD.nfcSymbol.bottom}px;${move(ft)}">${NFC_SVG(ft.color)}</div>`);
  } else if (ft.mode === 'text') {
    const top = LAYOUT.cardHeight - CARD.footerText.baselineFromBottom;
    parts.push(`<div class="el footer" data-el="footer" data-field="footer" style="right:${CARD.footerText.right}px;top:${topFor(top, ft.size)}px;white-space:nowrap;letter-spacing:0.03em;${textStyle(ft.size, ft.color)}${move(ft)}">${esc(ft.text)}</div>`);
  } else {
    parts.push(`<div class="el footer empty" data-el="footer" style="right:${CARD.nfcSymbol.right}px;bottom:${CARD.nfcSymbol.bottom}px;width:${CARD.nfcSymbol.w}px;height:${CARD.nfcSymbol.h}px;${move(ft)}"></div>`);
  }

  return `<div class="card-face" style="background:${p3(s.cardBg)}">${parts.join('')}</div>`;
}

export function glowFor(ticket) {
  // SPEC §13.5: very faint glow (≈12% alpha), mostly left & bottom.
  const c = ticket.style.band.color;
  const glow = /^#?[0-9a-f]{6}$/i.test(c || '') ? p3(c, 0.13) : 'rgba(45,107,224,0.13)';
  return `drop-shadow(-5px 8px 16px ${glow}) drop-shadow(0 3px 8px rgba(0,0,0,0.55))`;
}

export function renderCard(ticket) {
  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.style.filter = glowFor(ticket);
  wrap.innerHTML = cardHTML(ticket);
  return wrap;
}

// Auto-shrink the event title (single line, down to 14pt). Call after the card is in the DOM.
export function fitTitles(root) {
  root.querySelectorAll('.title').forEach((el) => {
    const base = parseFloat(el.dataset.size);
    let size = base;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth + 0.5 && size > CARD.eventTitle.minSize) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
    el.style.marginTop = `${BASE_K * (base - size)}px`; // keep the baseline fixed while shrinking
  });
}

export { FIELD_IDS };
