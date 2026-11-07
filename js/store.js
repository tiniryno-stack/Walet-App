// Config store: data model v2, v1 migration, persistence in localStorage.
import { STORAGE_KEY, STORAGE_KEY_V1, FIELD_IDS, TEXT_IDS, CARD } from './constants.js';

export const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
export const uid = (p = 'id') => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Defaults measured from the reference screenshot (see SPEC §14 decision log).
const DEFAULT_SIZES = {
  time: 11.5, date: 22, venueLabel: 10, eventTitle: 16.5,
  section: 20.5, row: 20.5, seat: 20.5, entryInfo: 19.5, ticketType: 19.5,
};
const DEFAULT_LABELS = { section: 'SECTION', row: 'ROW', seat: 'SEAT', entryInfo: 'ENTRY INFO', ticketType: 'TICKET TYPE' };
const DEFAULT_VALUES = {
  time: '7:00 PM', date: 'Nov 7, 2026', venueLabel: 'HALCYON ARENA', eventTitle: 'NOVA REYES - AFTERGLOW ARENA TOUR',
  section: '114', row: '19', seat: '11', entryInfo: 'LOWER LEVEL', ticketType: 'Card Member Presale',
};

export function defaultTicket() {
  const fields = {};
  for (const id of TEXT_IDS) {
    fields[id] = {
      values: [DEFAULT_VALUES[id]], size: DEFAULT_SIZES[id], x: 0, y: 0, visible: true,
      color: id === 'time' || id === 'venueLabel' ? '#5093F6' : '#FFFFFF',
    };
  }
  for (const id of FIELD_IDS) {
    fields[id] = {
      label: DEFAULT_LABELS[id], labelVisible: true, labelSize: CARD.labelSize, values: [DEFAULT_VALUES[id]],
      size: DEFAULT_SIZES[id], x: 0, y: 0, color: '#FFFFFF', labelColor: '#5093F6', visible: true,
    };
  }
  return {
    id: uid('t'),
    style: {
      cardBg: '#22262D',
      band: { mode: 'color', color: '#2D6BE0', imageId: null, logoImageId: null, logoText: 'p', logoColor: '#FFFFFF', size: CARD.band.logoSize, x: 0, y: 0 },
      footer: { mode: 'nfc', color: '#BDBEC0', text: 'EXPIRED', size: 12, x: 0, y: 0 },
      appIcon: { visible: true, imageId: null, x: 0, y: 0 },
      headerLogo: { imageId: null, text: 'passline', size: 23, x: 0, y: 0, color: '#FFFFFF' },
      layout: '3+2',
    },
    fields,
  };
}

// Fill any missing keys so older/partial tickets (imports, v1, fixtures) render.
export function normalizeTicket(t) {
  const d = defaultTicket();
  const out = t ? clone(t) : d;
  out.id = out.id || d.id;
  out.style = out.style || {};
  for (const k of Object.keys(d.style)) {
    if (typeof d.style[k] === 'object' && d.style[k] !== null) out.style[k] = { ...d.style[k], ...(out.style[k] || {}) };
    else if (out.style[k] === undefined) out.style[k] = d.style[k];
  }
  out.fields = out.fields || {};
  for (const k of Object.keys(d.fields)) {
    const f = { ...d.fields[k], ...(out.fields[k] || {}) };
    if (!Array.isArray(f.values) || !f.values.length) f.values = [...d.fields[k].values];
    out.fields[k] = f;
  }
  return out;
}

export function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.version === 2) {
    data.looks = data.looks || {};
    data.takes = data.takes || {};
    for (const take of Object.values(data.takes)) {
      take.tickets = (take.tickets || []).map(normalizeTicket);
      if (!take.tickets.length) take.tickets = [defaultTicket()];
      take.startIndex = Math.min(take.startIndex || 0, take.tickets.length - 1);
      take.newTicketSource = take.newTicketSource ?? 'last';
    }
    if (!data.takes[data.activeTake]) data.activeTake = Object.keys(data.takes)[0];
    return data;
  }
  if (data.version === 1) {
    const out = { version: 2, activeTake: data.activeTake, looks: {}, takes: {} };
    for (const [id, take] of Object.entries(data.takes || {})) {
      out.takes[id] = {
        name: take.name || id,
        startIndex: take.startIndex || 0,
        newTicketSource: 'last',
        tickets: (take.tickets || []).map((v1) => {
          const t = defaultTicket();
          t.id = v1.id || t.id;
          if (v1.bandColor) { t.style.band.color = v1.bandColor; }
          for (const [k, f] of Object.entries(v1.fields || {})) {
            if (!t.fields[k]) continue;
            if (Array.isArray(f.values) && f.values.length) t.fields[k].values = [...f.values];
            if (f.label) t.fields[k].label = f.label;
          }
          return t;
        }),
      };
    }
    return migrate(out);
  }
  return null;
}

let state = null;
const listeners = new Set();

export async function loadConfig() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { raw = null; }
  if (!raw) {
    try {
      const v1 = JSON.parse(localStorage.getItem(STORAGE_KEY_V1) || 'null');
      if (v1) raw = migrate(v1);
    } catch { /* ignore */ }
  }
  if (!raw) {
    try {
      const res = await fetch('./fixtures/default-config.json');
      raw = await res.json();
    } catch {
      raw = { version: 2, activeTake: 'take-1', looks: {}, takes: { 'take-1': { name: 'Take 1', startIndex: 0, newTicketSource: 'last', tickets: [defaultTicket()] } } };
    }
  }
  state = migrate(raw);
  save();
  return state;
}

export const getState = () => state;
export function setState(next) { state = migrate(next); save(); }
export function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); }
  listeners.forEach((fn) => fn(state));
}
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const activeTake = () => state.takes[state.activeTake];
export const tickets = () => activeTake().tickets;

// ---- element access helpers (shared by card renderer & builder) ----
export function elementData(ticket, id) {
  if (ticket.fields[id]) return ticket.fields[id];
  return ticket.style[id];
}

// ---- looks ----
export function styleOf(ticket) {
  const f = ticket.fields;
  const elements = {};
  for (const id of [...TEXT_IDS, ...FIELD_IDS]) elements[id] = { size: f[id].size, x: f[id].x, y: f[id].y };
  for (const id of ['headerLogo', 'band', 'appIcon', 'footer']) {
    const s = ticket.style[id];
    elements[id] = { size: s.size, x: s.x, y: s.y };
  }
  return {
    cardBg: ticket.style.cardBg,
    band: clone(ticket.style.band),
    labelColor: f.section.labelColor,
    valueColor: f.section.color,
    timeColor: f.time.color,
    venueColor: f.venueLabel.color,
    footer: { mode: ticket.style.footer.mode, color: ticket.style.footer.color },
    appIcon: clone(ticket.style.appIcon),
    headerLogo: clone(ticket.style.headerLogo),
    elements,
  };
}

export function applyLook(ticket, look) {
  const s = look.style;
  const t = ticket;
  if (s.cardBg) t.style.cardBg = s.cardBg;
  if (s.band) t.style.band = { ...t.style.band, ...clone(s.band) };
  if (s.footer) t.style.footer = { ...t.style.footer, ...clone(s.footer) };
  if (s.appIcon) t.style.appIcon = { ...t.style.appIcon, ...clone(s.appIcon) };
  if (s.headerLogo) t.style.headerLogo = { ...t.style.headerLogo, ...clone(s.headerLogo) };
  if (s.valueColor) {
    for (const id of FIELD_IDS) t.fields[id].color = s.valueColor;
    t.fields.date.color = s.valueColor;
    t.fields.eventTitle.color = s.valueColor;
    if (!s.headerLogo || !s.headerLogo.color) t.style.headerLogo.color = s.valueColor;
  }
  if (s.labelColor) {
    for (const id of FIELD_IDS) t.fields[id].labelColor = s.labelColor;
    t.fields.time.color = s.timeColor || s.labelColor;
    t.fields.venueLabel.color = s.venueColor || s.labelColor;
  }
  for (const [id, e] of Object.entries(s.elements || {})) {
    const target = elementData(t, id);
    if (!target) continue;
    for (const k of ['size', 'x', 'y']) if (e[k] !== undefined) target[k] = e[k];
  }
  return t;
}

// ---- apply to all (SPEC §10.4) ----
export function applyToAll(take, sourceIndex, keepSeats) {
  const src = take.tickets[sourceIndex];
  take.tickets = take.tickets.map((t, i) => {
    if (i === sourceIndex) return t;
    const copy = clone(src);
    copy.id = t.id;
    if (keepSeats) for (const k of ['section', 'row', 'seat']) copy.fields[k].values = clone(t.fields[k].values);
    return copy;
  });
}

export function newTicketFrom(take) {
  const src = take.newTicketSource === 'last' || take.newTicketSource == null
    ? take.tickets[take.tickets.length - 1]
    : take.tickets[Math.min(+take.newTicketSource, take.tickets.length - 1)];
  const t = clone(src || defaultTicket());
  t.id = uid('t');
  return normalizeTicket(t);
}

export function imageIdsIn(obj, set = new Set()) {
  if (!obj || typeof obj !== 'object') return set;
  for (const [k, v] of Object.entries(obj)) {
    if ((k === 'imageId' || k === 'logoImageId') && typeof v === 'string') set.add(v);
    else if (typeof v === 'object') imageIdsIn(v, set);
  }
  return set;
}
