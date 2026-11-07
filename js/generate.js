// Generate from reference (SPEC §9): no AI. Every Wallet pass shares one layout, so we
// find the card in the photo, then measure the known spots with <canvas> + getImageData.
import { LAYOUT, FIELD_IDS } from './constants.js';
import { clone } from './store.js';
import { putImage, imageUrl } from './images.js';

const REF_W = 362; // card width on the 402pt reference, in pt
const REF_H = LAYOUT.cardHeight;

// ------------------------------------------------------------ pixels
// Sample in Display P3 so hex values match how the card renders them (see p3() in card.js).
function p3ctx(c) {
  try { return c.getContext('2d', { willReadFrequently: true, colorSpace: 'display-p3' }) || c.getContext('2d'); } catch { return c.getContext('2d', { willReadFrequently: true }); }
}
function readP3(ctx, w, h) {
  try { return ctx.getImageData(0, 0, w, h, { colorSpace: 'display-p3' }); } catch { return ctx.getImageData(0, 0, w, h); }
}
function toCanvas(img, maxW = 1600) {
  const s = Math.min(1, maxW / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  const ctx = p3ctx(c);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { c, ctx, data: readP3(ctx, c.width, c.height).data, W: c.width, H: c.height, s };
}
const px = (P, x, y) => { const i = (Math.round(y) * P.W + Math.round(x)) * 4; return [P.data[i], P.data[i + 1], P.data[i + 2]]; };
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// ------------------------------------------------------------ 9.1 find the card
export function findCard(img, cardWidth) {
  const P = toCanvas(img);
  const rect = locate(P);
  if (!rect) return null;
  return { rect, align: alignFor(rect, P, cardWidth) };
}

function alignFor(rect, P, cardWidth) {
  const s = cardWidth / rect.w; // canvas px → card pt
  return { x: -rect.x * s, y: -rect.y * s, w: P.W * s };
}

function locate(P) {
  const { W, H } = P;
  const ratio = H / W;
  if (ratio > 0.85 && ratio < 1.2) return { x: 0, y: 0, w: W, h: H }; // already cropped to the card
  if (ratio < 1.6 || ratio > 2.5) return null;
  const k = W / (W / 3 > 300 ? W / 3 : 402); // canvas px per pt (screenshot @3x → ~3)
  const ptW = W / k;
  // Estimate from the known layout, then refine by scanning edges.
  let x0 = 20 * k; let x1 = (ptW - 20) * k; let y0 = LAYOUT.cardTop * k; let y1 = (LAYOUT.cardTop + REF_H) * k;
  // Find a blank row in the lower body (the card's y differs between the pass view and the
  // detail sheet): uniform color across 30→150pt that isn't the screen background.
  const screenBg = px(P, 5 * k, y1);
  let probeY = y0 + (REF_H * 0.82) * k;
  for (let yy = y0 + 290 * k; yy < Math.min(H - 2, y1 + 80 * k); yy += k) {
    const ref0 = px(P, x0 + 30 * k, yy);
    if (dist(ref0, screenBg) < 12) continue;
    let ok = true;
    for (let xx = x0 + 30 * k; xx < x0 + 150 * k && ok; xx += k) if (dist(px(P, xx, yy), ref0) > 6) ok = false;
    if (ok) { probeY = yy; break; }
  }
  const inside = px(P, x0 + 40 * k, probeY);
  const near = (c) => dist(c, inside) < 20;
  // left edge
  let x = x0 + 40 * k; while (x > 0 && near(px(P, x - 1, probeY))) x -= 1; x0 = x;
  // right edge
  x = x0 + 60 * k; while (x < W - 1 && near(px(P, x + 1, probeY))) x += 1; x1 = x + 1;
  // bottom edge, then top from the fixed card aspect (the band breaks a straight upward scan)
  const probeX = x0 + 3 * k; // just inside the left edge: clear of text and the app icon
  let y = probeY; while (y < H - 1 && near(px(P, probeX, y + 1))) y += 1; y1 = y + 1;
  y0 = y1 - (x1 - x0) * (REF_H / REF_W);
  const w = x1 - x0; const h = y1 - y0;
  const asp = h / w;
  if (w < W * 0.6 || asp < 0.85 || asp > 1.35) {
    // refinement failed: fall back to the layout estimate
    return { x: 20 * k, y: LAYOUT.cardTop * k, w: (ptW - 40) * k, h: REF_H * k };
  }
  return { x: x0, y: y0, w, h };
}

// card pt (362×381 basis) → canvas px
function mapper(rect) {
  const sx = rect.w / REF_W; const sy = rect.h / REF_H;
  return { sx, sy, X: (u) => rect.x + u * sx, Y: (v) => rect.y + v * sy };
}

// ------------------------------------------------------------ region stats
function regionPixels(P, M, box, step = 1) {
  const out = [];
  const xa = Math.max(0, Math.floor(M.X(box.x0))); const xb = Math.min(P.W - 1, Math.ceil(M.X(box.x1)));
  const ya = Math.max(0, Math.floor(M.Y(box.y0))); const yb = Math.min(P.H - 1, Math.ceil(M.Y(box.y1)));
  for (let y = ya; y <= yb; y += step) for (let x = xa; x <= xb; x += step) out.push(px(P, x, y));
  return out;
}

function modeColor(pixels, bits = 4) {
  const sh = 8 - bits; const bins = new Map();
  for (const p of pixels) {
    const key = (p[0] >> sh) << 16 | (p[1] >> sh) << 8 | (p[2] >> sh);
    const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n += 1; b.r += p[0]; b.g += p[1]; b.b += p[2]; bins.set(key, b);
  }
  let best = null;
  for (const b of bins.values()) if (!best || b.n > best.n) best = b;
  if (!best) return { color: [0, 0, 0], share: 0 };
  return { color: [best.r / best.n, best.g / best.n, best.b / best.n], share: best.n / pixels.length };
}

function stdLum(pixels) {
  let s = 0; let s2 = 0;
  for (const p of pixels) { const l = lum(p); s += l; s2 += l * l; }
  const m = s / pixels.length;
  return Math.sqrt(Math.max(0, s2 / pixels.length - m * m));
}

// Main "ink" color inside a box: pixels far from the background, strongest bin.
function inkColor(P, M, box, bg) {
  const ink = regionPixels(P, M, box).filter((p) => dist(p, bg) > 90);
  if (ink.length < 6) return null;
  // keep the most contrasting half (anti-aliased edges blend toward the bg)
  ink.sort((a, b) => dist(b, bg) - dist(a, bg));
  return modeColor(ink.slice(0, Math.max(6, Math.floor(ink.length * 0.5))), 3).color;
}

// Bounding box (card pt) of non-bg content in a box.
function contentBBox(P, M, box, bg, thr = 70) {
  const xa = Math.max(0, Math.floor(M.X(box.x0))); const xb = Math.min(P.W - 1, Math.ceil(M.X(box.x1)));
  const ya = Math.max(0, Math.floor(M.Y(box.y0))); const yb = Math.min(P.H - 1, Math.ceil(M.Y(box.y1)));
  let minx = Infinity; let maxx = -1; let miny = Infinity; let maxy = -1; let n = 0;
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      if (dist(px(P, x, y), bg) > thr) { n++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    }
  }
  if (n < 4) return null;
  const R = M.rect;
  return { x0: (minx - R.x) / M.sx, x1: (maxx + 1 - R.x) / M.sx, y0: (miny - R.y) / M.sy, y1: (maxy + 1 - R.y) / M.sy, n };
}

// Column occupancy in a box → segments of content (card pt) for finding field splits.
function columnSegments(P, M, box, bg, minGapPt = 7) {
  const xa = Math.floor(M.X(box.x0)); const xb = Math.ceil(M.X(box.x1));
  const ya = Math.floor(M.Y(box.y0)); const yb = Math.ceil(M.Y(box.y1));
  const occ = [];
  for (let x = xa; x <= xb; x++) {
    let hit = false;
    for (let y = ya; y <= yb && !hit; y++) if (dist(px(P, x, y), bg) > 80) hit = true;
    occ.push(hit);
  }
  const segs = []; let start = -1; let gap = 0;
  const minGap = minGapPt * M.sx;
  occ.forEach((h, i) => {
    if (h) { if (start < 0) start = i; gap = 0; } else if (start >= 0) {
      gap++; if (gap > minGap) { segs.push([start, i - gap]); start = -1; gap = 0; }
    }
  });
  if (start >= 0) segs.push([start, occ.length - 1 - gap]);
  const R = M.rect;
  return segs.map(([a, b]) => [(xa + a - R.x) / M.sx, (xa + b + 1 - R.x) / M.sx]);
}

// ------------------------------------------------------------ crops
async function cropToImage(P, M, box, { knockout = null, tol = 40, name = 'crop' } = {}) {
  const x = Math.floor(M.X(box.x0)); const y = Math.floor(M.Y(box.y0));
  const w = Math.max(1, Math.ceil(M.X(box.x1)) - x); const h = Math.max(1, Math.ceil(M.Y(box.y1)) - y);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = p3ctx(c);
  ctx.drawImage(P.c, x, y, w, h, 0, 0, w, h);
  if (knockout) {
    const id = readP3(ctx, w, h); const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const dd = dist([d[i], d[i + 1], d[i + 2]], knockout);
      if (dd < tol) d[i + 3] = 0; else if (dd < tol * 2.2) d[i + 3] = Math.round(255 * (dd - tol) / (tol * 1.2));
    }
    ctx.putImageData(id, 0, 0);
  }
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const id = await putImage(blob, name);
  await imageUrl(id);
  return id;
}

function ocrCanvas(P, M, box0, bg) {
  // Crop tight to the ink (plus a margin) and scale so the text is ~85px tall — reads best.
  const bb = contentBBox(P, M, box0, bg, 60);
  const box = bb ? { x0: Math.max(box0.x0 - 2, bb.x0 - 5), x1: Math.min(box0.x1 + 2, bb.x1 + 5), y0: bb.y0 - 4, y1: bb.y1 + 4 } : box0;
  const x = Math.floor(M.X(box.x0)); const y = Math.floor(M.Y(box.y0));
  const w = Math.max(1, Math.ceil(M.X(box.x1)) - x); const h = Math.max(1, Math.ceil(M.Y(box.y1)) - y);
  const inkH = bb ? Math.max(4, (bb.y1 - bb.y0) * M.sy) : h * 0.6;
  const scale = Math.max(1, 85 / inkH);
  const pad = 40;
  const c = document.createElement('canvas'); c.width = Math.round(w * scale) + pad * 2; c.height = Math.round(h * scale) + pad * 2;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(P.c, x, y, w, h, pad, pad, w * scale, h * scale);
  // Raw pixels on a padded card-colored canvas read best (Tesseract inverts light-on-dark itself).
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = `rgb(${bg.map(Math.round).join(',')})`;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

// ------------------------------------------------------------ 9.4 swatches only
export function extractSwatches(img, k = 8) {
  const s = Math.min(1, 200 / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const ctx = p3ctx(c);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = readP3(ctx, c.width, c.height).data;
  const pts = [];
  for (let i = 0; i < d.length; i += 4) pts.push([d[i], d[i + 1], d[i + 2]]);
  return kmeans(pts, k).map(hex);
}

function kmeans(pts, k) {
  // k-means++ with a deterministic seed
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const cents = [pts[Math.floor(rnd() * pts.length)]];
  while (cents.length < k) {
    const ds = pts.map((p) => Math.min(...cents.map((c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)));
    const sum = ds.reduce((a, b) => a + b, 0) || 1;
    let r = rnd() * sum; let idx = 0;
    while (r > ds[idx] && idx < ds.length - 1) { r -= ds[idx]; idx++; }
    cents.push(pts[idx]);
  }
  let counts = [];
  for (let it = 0; it < 12; it++) {
    const acc = cents.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let bi = 0; let bd = Infinity;
      cents.forEach((c, j) => { const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (dd < bd) { bd = dd; bi = j; } });
      const a = acc[bi]; a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3] += 1;
    }
    acc.forEach((a, j) => { if (a[3]) cents[j] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
    counts = acc.map((a) => a[3]);
  }
  return cents.map((c, j) => ({ c, n: counts[j] })).sort((a, b) => b.n - a.n)
    .filter((x, i, arr) => arr.findIndex((y) => dist(y.c, x.c) < 24) === i).map((x) => x.c);
}

// Fix the usual OCR slips in the fixed-format fields.
function tidy(id, text) {
  let t = text.trim();
  if (id === 'time') {
    t = t.toUpperCase().replace(/[^0-9:APM ]/g, '');
    const m = /(\d{1,2})\s*:?\s*(\d{2})\s*([AP])\s*M?/.exec(t);
    if (m) t = `${+m[1]}:${m[2]} ${m[3]}M`;
  } else if (id === 'date') {
    const m = /([A-Za-z]{3})[a-z.]*\s*(\d{1,2})\s*[,.]?\s*(\d{4})/.exec(t);
    if (m) t = `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${+m[2]}, ${m[3]}`;
  } else if (id === 'venueLabel') t = t.toUpperCase();
  return t;
}

// ------------------------------------------------------------ 9.2 + 9.3 generate
export async function generateFromReference(img, ticket, { cardWidth, onProgress, ocr = true } = {}) {
  const P = toCanvas(img);
  const rect = locate(P);
  if (!rect) throw new Error('No Wallet card found — align it manually and match with Wipe');
  const M = { ...mapper(rect), rect };
  const t = clone(ticket);
  const notes = [];
  const lowConfidence = [];

  // Card background: mode of the header, avoiding logo/date/notch boxes
  const hdrPix = [
    ...regionPixels(P, M, { x0: 4, x1: 120, y0: 3, y1: 10 }, 2),
    ...regionPixels(P, M, { x0: 4, x1: 358, y0: 50, y1: 62 }, 2),
    ...regionPixels(P, M, { x0: 4, x1: 358, y0: 340, y1: 372 }, 2),
  ];
  const bgC = modeColor(hdrPix, 4).color;
  t.style.cardBg = hex(bgC);

  // Band: solid vs photo
  const bandBox = { x0: 3, x1: REF_W - 3, y0: 67, y1: 158 };
  const bandPix = regionPixels(P, M, bandBox, 2);
  const bandMode = modeColor(bandPix, 4);
  const bandStd = stdLum(bandPix);
  const solid = bandMode.share > 0.55 || (bandMode.share > 0.4 && bandStd < 25);
  if (solid) {
    t.style.band.mode = 'color';
    t.style.band.color = hex(bandMode.color);
    t.style.band.imageId = null;
    const lb = contentBBox(P, M, { x0: 40, x1: REF_W - 40, y0: 68, y1: 158 }, bandMode.color, 80);
    if (lb && lb.x1 - lb.x0 < 300) {
      const pad = 1;
      const box = { x0: lb.x0 - pad, x1: lb.x1 + pad, y0: lb.y0 - pad, y1: lb.y1 + pad };
      t.style.band.logoImageId = await cropToImage(P, M, box, { knockout: bandMode.color, name: 'band-logo' });
      const hgt = box.y1 - box.y0;
      t.style.band.size = Math.round((hgt / 0.88) * 2) / 2;
      t.style.band.x = Math.round(((box.x0 + box.x1) / 2 - REF_W / 2) * 2) / 2;
      t.style.band.y = Math.round(((box.y0 + box.y1) / 2 - (LAYOUT.headerHeight + LAYOUT.bandHeight / 2)) * 2) / 2;
      notes.push('Band: solid color with a centered logo (cropped).');
    } else { t.style.band.logoImageId = null; t.style.band.logoText = ''; notes.push('Band: solid color, no logo found.'); }
  } else {
    t.style.band.mode = 'image';
    t.style.band.imageId = await cropToImage(P, M, { x0: 0, x1: REF_W, y0: LAYOUT.headerHeight, y1: LAYOUT.headerHeight + LAYOUT.bandHeight }, { name: 'band-photo' });
    t.style.band.color = hex(bandMode.color);
    notes.push('Band: photo (cropped full-bleed).');
  }

  // Header logo crop (left of the header)
  const hl = contentBBox(P, M, { x0: 4, x1: 190, y0: 12, y1: 56 }, bgC, 80);
  if (hl) {
    const box = { x0: hl.x0 - 1, x1: hl.x1 + 1, y0: hl.y0 - 1, y1: hl.y1 + 1 };
    t.style.headerLogo.imageId = await cropToImage(P, M, box, { knockout: bgC, name: 'header-logo' });
    const h = box.y1 - box.y0;
    t.style.headerLogo.size = Math.round((h / 1.25) * 2) / 2;
    t.style.headerLogo.x = Math.round((box.x0 - 13) * 2) / 2;
    t.style.headerLogo.y = Math.round((box.y0 - (32.5 - h / 2)) * 2) / 2;
  }

  // App icon
  const ai = { x0: 7, x1: 27, y0: REF_H - 26, y1: REF_H - 6 };
  const aiBox = contentBBox(P, M, ai, bgC, 60);
  if (aiBox && aiBox.n > 40) {
    t.style.appIcon.visible = true;
    t.style.appIcon.imageId = await cropToImage(P, M, ai, { knockout: bgC, tol: 18, name: 'app-icon' });
  } else { t.style.appIcon.visible = false; }

  // Footer right: NFC symbol vs text vs none
  const fb = contentBBox(P, M, { x0: 230, x1: REF_W - 2, y0: REF_H - 32, y1: REF_H - 3 }, bgC, 70);
  let footerText = null;
  if (!fb) { t.style.footer.mode = 'none'; } else {
    const w = fb.x1 - fb.x0; const h = fb.y1 - fb.y0;
    const fc = inkColor(P, M, fb, bgC);
    if (fc) t.style.footer.color = hex(fc);
    if (w <= 26 && h >= 15 && h <= 28 && fb.x1 > REF_W - 20) { t.style.footer.mode = 'nfc'; } else {
      t.style.footer.mode = 'text';
      footerText = fb;
      t.style.footer.size = Math.round((h / 0.7046) * 2) / 2;
    }
  }

  // Colors of labels and values
  const labelBoxes = { venueLabel: { x0: 13, x1: 300, y0: 168, y1: 180 }, row1: { x0: 13, x1: 350, y0: 216, y1: 228 }, row2: { x0: 13, x1: 350, y0: 264, y1: 276 }, time: { x0: 222, x1: 350, y0: 9, y1: 22 } };
  const valueBoxes = { eventTitle: { x0: 13, x1: 350, y0: 181, y1: 199 }, row1: { x0: 13, x1: 350, y0: 231, y1: 250 }, row2: { x0: 13, x1: 350, y0: 278, y1: 298 }, date: { x0: 180, x1: 350, y0: 23, y1: 46 } };
  const labelC = inkColor(P, M, labelBoxes.row1, bgC) || inkColor(P, M, labelBoxes.venueLabel, bgC);
  const valueC = inkColor(P, M, valueBoxes.row1, bgC) || inkColor(P, M, valueBoxes.eventTitle, bgC);
  if (labelC) for (const id of FIELD_IDS) t.fields[id].labelColor = hex(labelC);
  if (valueC) for (const id of FIELD_IDS) t.fields[id].color = hex(valueC);
  const timeC = inkColor(P, M, labelBoxes.time, bgC); if (timeC) t.fields.time.color = hex(timeC);
  const venueC = inkColor(P, M, labelBoxes.venueLabel, bgC); if (venueC) t.fields.venueLabel.color = hex(venueC);
  const dateC = inkColor(P, M, valueBoxes.date, bgC); if (dateC) t.fields.date.color = hex(dateC);
  const titleC = inkColor(P, M, valueBoxes.eventTitle, bgC); if (titleC) t.fields.eventTitle.color = hex(titleC);
  if (!hl && valueC) t.style.headerLogo.color = hex(valueC);

  // Field layout: which boxes are empty; where row 2 splits
  const has = (box) => !!contentBBox(P, M, box, bgC, 80);
  const sectionL = has({ x0: 13, x1: 150, y0: 216, y1: 228 });
  const rowL = has({ x0: 170, x1: 260, y0: 216, y1: 228 });
  const seatL = has({ x0: 280, x1: 350, y0: 216, y1: 228 });
  const seatV = has({ x0: 200, x1: 350, y0: 231, y1: 250 });
  const r2segs = columnSegments(P, M, { x0: 13, x1: 352, y0: 264, y1: 276 }, bgC, 6);
  const r2v = has({ x0: 13, x1: 352, y0: 278, y1: 298 });
  let split = 160;
  if (r2segs.length >= 2) {
    let gi = 0; let gw = 0;
    for (let i = 0; i < r2segs.length - 1; i++) { const g = r2segs[i + 1][0] - r2segs[i][1]; if (g > gw) { gw = g; gi = i; } }
    split = r2segs[gi + 1][0] - 1;
  }
  const ticketTypeShown = r2segs.length >= 2 || (r2segs.length === 1 && r2segs[0][0] > 120);
  t.fields.section.visible = true; t.fields.section.labelVisible = sectionL;
  if (!rowL && !seatL && seatV) {
    t.style.layout = '1+GA'; t.fields.row.visible = false; t.fields.seat.visible = true; t.fields.seat.labelVisible = false;
  } else {
    t.fields.row.visible = rowL; t.fields.row.labelVisible = true; t.fields.seat.visible = seatL || seatV; t.fields.seat.labelVisible = seatL;
    t.style.layout = ticketTypeShown ? '3+2' : '3+1';
  }
  t.fields.ticketType.visible = ticketTypeShown;
  t.fields.entryInfo.visible = r2v || r2segs.length > 0;
  notes.push(`Layout: ${t.style.layout}. Footer: ${t.style.footer.mode === 'nfc' ? 'NFC symbol' : t.style.footer.mode === 'text' ? 'text' : 'none'}.`);

  // Sizes from cap heights (digits/caps only, so the measurement is clean)
  const capSize = (box) => { const bb = contentBBox(P, M, box, bgC, 90); return bb ? Math.round(((bb.y1 - bb.y0) / 0.7046) * 2) / 2 : null; };
  const dsz = capSize({ x0: 300, x1: 350, y0: 23, y1: 44 }); if (dsz && dsz > 12 && dsz < 40) t.fields.date.size = dsz;
  const ssz = capSize({ x0: 13, x1: 60, y0: 231, y1: 249 }); if (ssz && ssz > 12 && ssz < 40) ['section', 'row', 'seat'].forEach((k) => { t.fields[k].size = ssz; });

  // ---- OCR each field's box separately
  if (ocr) {
    const boxes = [
      { key: 'time', box: { x0: 222, x1: 352, y0: 8, y1: 21.5 } },
      { key: 'date', box: { x0: 200, x1: 352, y0: 23, y1: 47 } },
      { key: 'venueLabel', box: { x0: 12, x1: 352, y0: 166, y1: 181 } },
      { key: 'eventTitle', box: { x0: 12, x1: 352, y0: 180, y1: 201 } },
      { key: 'section.label', box: { x0: 12, x1: 160, y0: 214, y1: 229 } },
      { key: 'section', box: { x0: 12, x1: 160, y0: 229, y1: 252 } },
      { key: 'row.label', box: { x0: 172, x1: 268, y0: 214, y1: 229 } },
      { key: 'row', box: { x0: 172, x1: 268, y0: 229, y1: 252 } },
      { key: 'seat.label', box: { x0: 272, x1: 352, y0: 214, y1: 229 } },
      { key: 'seat', box: { x0: t.style.layout === '1+GA' ? 160 : 272, x1: 352, y0: 229, y1: 252 } },
      { key: 'entryInfo.label', box: { x0: 12, x1: split, y0: 262, y1: 277 } },
      { key: 'entryInfo', box: { x0: 12, x1: split, y0: 276, y1: 300 } },
      { key: 'ticketType.label', box: { x0: split, x1: 352, y0: 262, y1: 277 } },
      { key: 'ticketType', box: { x0: split, x1: 352, y0: 276, y1: 300 } },
    ];
    if (footerText) boxes.push({ key: 'footer', box: { x0: footerText.x0 - 2, x1: footerText.x1 + 2, y0: footerText.y0 - 2, y1: footerText.y1 + 2 } });
    const jobs = boxes.filter((b) => {
      const [id, part] = b.key.split('.');
      if (b.key === 'footer') return true;
      const f = t.fields[id];
      if (!f.visible) return false;
      if (part === 'label' && !f.labelVisible) return false;
      return has(b.box);
    }).map((b) => {
      const bb = contentBBox(P, M, b.box, bgC, 60);
      const single = bb && (bb.x1 - bb.x0) < (bb.y1 - bb.y0) * 1.05; // one glyph → single-char mode
      return { key: b.key, canvas: ocrCanvas(P, M, b.box, bgC), psm: single ? '10' : '7' };
    });
    try {
      const { ocrBoxes } = await import('./ocr.js');
      const res = await ocrBoxes(jobs, onProgress);
      for (const [key, r] of Object.entries(res)) {
        if (!r.text) { lowConfidence.push(key.split('.')[0]); continue; }
        const [id, part] = key.split('.');
        if (key === 'footer') { t.style.footer.text = r.text.toUpperCase(); if (r.confidence < 70) lowConfidence.push('footer'); continue; }
        const f = t.fields[id];
        if (part === 'label') f.label = r.text.toUpperCase();
        else f.values[0] = tidy(id, r.text);
        if (r.confidence < 70) lowConfidence.push(id);
      }
      notes.push(`Text: read ${jobs.length} boxes on the phone (offline).${lowConfidence.length ? ' Check the fields marked with a dot.' : ''}`);
    } catch (e) {
      console.warn(e);
      notes.push(`Text: OCR unavailable (${e.message}). Colors and layout were still applied.`);
    }
  }

  return {
    ticket: t,
    align: alignFor(rect, P, cardWidth || REF_W),
    lowConfidence: [...new Set(lowConfidence)],
    swatches: extractSwatches(img, 8),
    debug: { rect, bg: hex(bgC), bandShare: bandMode.share, bandStd, split, r2segs },
    report: `<span class="good">Filled from the photo. Check it with Wipe, then tweak.</span>
      <span>Colors: card ${hex(bgC)}, band ${t.style.band.mode === 'color' ? t.style.band.color : 'photo'}, labels ${labelC ? hex(labelC) : '—'}, values ${valueC ? hex(valueC) : '—'}.</span>
      ${notes.map((n) => `<span>${n}</span>`).join('')}
      <span class="warn">Cropped logos copy the original brand’s art — replace them with original art before shooting.</span>`,
  };
}
