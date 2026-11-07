// Screen 2 — Organizer (hidden, never on camera). iOS Settings style.
import { getState, setState, save, activeTake, newTicketFrom, clone, uid, imageIdsIn, migrate, defaultTicket } from './store.js';
import { exportImages, importImages, cachedUrl, warm } from './images.js';
import { esc, h, actionSheet, confirmSheet, promptSheet, sheet, toast } from './ui.js';

let el; let onDone; let editing = false;

export function showOrganizer(container, opts) {
  el = container;
  onDone = opts.onDone;
  render();
}

const v0 = (f) => f?.values?.[0] ?? '';

function thumb(t) {
  const b = t.style.band;
  const img = b.mode === 'image' ? cachedUrl(b.imageId) : null;
  return `<span class="thumb" style="background-color:${b.color};${img ? `background-image:url('${img}')` : ''}">${img ? '' : esc(b.logoText ?? 'p')}</span>`;
}

function seatLine(t) {
  const f = t.fields;
  const parts = [];
  if (f.section.visible) parts.push(`Sec ${v0(f.section)}`);
  if (f.row.visible) parts.push(`Row ${v0(f.row)}`);
  if (f.seat.visible) parts.push(`${f.seat.labelVisible ? 'Seat ' : ''}${v0(f.seat)}`);
  return parts.join(' · ');
}

export function render() {
  const state = getState();
  const take = activeTake();
  const n = take.tickets.length;
  const src = take.newTicketSource === 'last' || take.newTicketSource == null ? 'Last ticket' : `Ticket ${+take.newTicketSource + 1}`;
  el.innerHTML = `
  <div class="scroll">
    <div class="navbar"><button type="button" class="link" data-a="edit">${editing ? 'Done Editing' : 'Edit'}</button>
      <button type="button" class="link bold" data-a="done">Done</button></div>
    <h1 class="large-title">Organizer</h1>

    <div class="group-title">CURRENT TAKE</div>
    <div class="group">
      <button type="button" class="cell" data-a="switch"><span>${esc(take.name)}</span><span class="detail">Switch ›</span></button>
      <div class="cell"><span>Number of tickets</span>
        <span class="stepper-wrap"><span class="detail num">${n}</span>
          <span class="stepper"><button type="button" data-a="dec" aria-label="Fewer tickets">−</button><button type="button" data-a="inc" aria-label="More tickets">+</button></span></span></div>
      <button type="button" class="cell" data-a="source"><span>New tickets copy</span><span class="detail">${src} ›</span></button>
      <button type="button" class="cell" data-a="start"><span>Start on</span><span class="detail">Ticket ${(take.startIndex || 0) + 1} ›</span></button>
    </div>

    <div class="group-title">TICKETS</div>
    <div class="group tickets ${editing ? 'editing' : ''}">
      ${take.tickets.map((t, i) => `
      <div class="trow" data-i="${i}">
        <div class="trow-actions"><button type="button" class="dup" data-a="dup" data-i="${i}">Duplicate</button><button type="button" class="del" data-a="del" data-i="${i}">Delete</button></div>
        <div class="trow-inner">
          ${editing ? `<button type="button" class="minus" data-a="del" data-i="${i}" aria-label="Delete">−</button>` : ''}
          <button type="button" class="trow-main" data-a="open" data-i="${i}">
            ${thumb(t)}
            <span class="trow-text"><span class="t1">${i + 1}. ${esc(v0(t.fields.eventTitle))}</span><span class="t2">${esc(seatLine(t))}</span></span>
          </button>
          ${editing ? `<button type="button" class="mini" data-a="dup" data-i="${i}">Copy</button>` : ''}
          <span class="handle" data-i="${i}" aria-label="Reorder"><svg width="16" height="12" viewBox="0 0 16 12"><path d="M1 2 H15 M1 6 H15 M1 10 H15" stroke="#5A5A5E" stroke-width="1.6" stroke-linecap="round"/></svg></span>
        </div>
      </div>`).join('')}
      <button type="button" class="cell add" data-a="inc"><svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="#0A84FF"/><path d="M11 6 V16 M6 11 H16" stroke="#FFF" stroke-width="2" stroke-linecap="round"/></svg>Add Ticket</button>
    </div>
    <div class="group-foot">Tap a ticket to open it in the Builder. Swipe a row left to duplicate or delete. Drag ≡ to reorder.</div>

    <div class="group-title">TAKES &amp; SETUP</div>
    <div class="group">
      <button type="button" class="cell link" data-a="newtake">Save as New Take…</button>
      <button type="button" class="cell link" data-a="rename">Rename Take…</button>
      <button type="button" class="cell link danger" data-a="deltake" ${Object.keys(state.takes).length < 2 ? 'disabled' : ''}>Delete Take…</button>
    </div>
    <div class="group">
      <button type="button" class="cell link" data-a="export">Export JSON (Copy)</button>
      <button type="button" class="cell link" data-a="exportfile">Export JSON (Share / Save File)</button>
      <button type="button" class="cell link" data-a="import">Import JSON (Paste)</button>
      <label class="cell link">Import JSON (File)…<input type="file" accept="application/json,.json,text/plain" data-a="importfile" hidden></label>
    </div>
    <div class="group">
      <button type="button" class="cell link danger" data-a="reset">Reset Everything to Defaults…</button>
    </div>
    <div class="group-foot">Wallet Prop · all data stays on this phone · works offline</div>
  </div>`;
  bind();
}

function bind() {
  el.querySelectorAll('[data-a]').forEach((b) => {
    const ev = b.tagName === 'INPUT' ? 'change' : 'click';
    b.addEventListener(ev, (e) => act(b.dataset.a, b, e));
  });
  el.querySelectorAll('.trow').forEach(setupSwipe);
  el.querySelectorAll('.handle').forEach(setupDrag);
}

async function act(a, btn, e) {
  const state = getState();
  const take = activeTake();
  const i = btn.dataset.i != null ? +btn.dataset.i : -1;
  switch (a) {
    case 'done': onDone(); return;
    case 'edit': editing = !editing; break;
    case 'inc':
      if (take.tickets.length >= 20) { toast('20 tickets max'); return; }
      take.tickets.push(newTicketFrom(take));
      save(); break;
    case 'dec': {
      if (take.tickets.length <= 1) return;
      const last = take.tickets[take.tickets.length - 1];
      const prev = take.tickets[take.tickets.length - 2];
      if (wasEdited(last, prev) && !(await confirmSheet(`Remove Ticket ${take.tickets.length}?`, 'This ticket has its own edits. They will be lost.', 'Remove', { destructive: true }))) return;
      take.tickets.pop();
      take.startIndex = Math.min(take.startIndex, take.tickets.length - 1);
      save(); break;
    }
    case 'source': {
      const opts = [{ label: 'Last ticket', checked: take.newTicketSource === 'last' }, ...take.tickets.map((t, k) => ({ label: `Ticket ${k + 1}`, checked: take.newTicketSource === k }))];
      const r = await actionSheet('New tickets copy', opts);
      if (r == null) return;
      take.newTicketSource = r === 0 ? 'last' : r - 1;
      save(); break;
    }
    case 'start': {
      const r = await actionSheet('Start on', take.tickets.map((t, k) => ({ label: `Ticket ${k + 1} — ${seatLine(t)}`, checked: (take.startIndex || 0) === k })));
      if (r == null) return;
      take.startIndex = r; save(); break;
    }
    case 'switch': {
      const ids = Object.keys(state.takes);
      const r = await actionSheet('Load take', ids.map((id) => ({ label: `${state.takes[id].name} (${state.takes[id].tickets.length})`, checked: id === state.activeTake })));
      if (r == null) return;
      state.activeTake = ids[r]; save(); break;
    }
    case 'newtake': {
      const name = await promptSheet('Save as New Take', `Take ${Object.keys(state.takes).length + 1}`);
      if (!name) return;
      const id = uid('take');
      state.takes[id] = { ...clone(take), name };
      state.takes[id].tickets.forEach((t) => { t.id = uid('t'); });
      state.activeTake = id; save(); toast(`Saved “${name}”`); break;
    }
    case 'rename': {
      const name = await promptSheet('Rename Take', take.name);
      if (!name) return;
      take.name = name; save(); break;
    }
    case 'deltake': {
      if (!(await confirmSheet(`Delete “${take.name}”?`, 'This can’t be undone.', 'Delete', { destructive: true }))) return;
      delete state.takes[state.activeTake];
      state.activeTake = Object.keys(state.takes)[0]; save(); break;
    }
    case 'open': {
      if (el.querySelector('.trow.open')) { closeSwipes(); return; }
      const { showBuilder } = await import('./builder.js');
      const b = document.getElementById('builder');
      b.hidden = false; el.hidden = true;
      showBuilder(b, { index: i, onBack: () => { b.hidden = true; el.hidden = false; render(); } });
      return;
    }
    case 'dup': {
      const copy = clone(take.tickets[i]); copy.id = uid('t');
      take.tickets.splice(i + 1, 0, copy); save(); break;
    }
    case 'del': {
      if (take.tickets.length <= 1) { toast('A take needs at least one ticket'); return; }
      take.tickets.splice(i, 1);
      take.startIndex = Math.min(take.startIndex, take.tickets.length - 1);
      save(); break;
    }
    case 'export': {
      const json = await exportJSON();
      try { await navigator.clipboard.writeText(json); toast(`Copied (${Math.round(json.length / 1024)} KB)`); } catch {
        await sheet(`<div class="sheet-title">Copy this JSON</div><textarea class="input mono" rows="10" readonly>${esc(json)}</textarea><div class="sheet-btns one"><button type="button" class="btn primary" data-v>Close</button></div>`,
          { onMount: (s, close) => { const ta = s.querySelector('textarea'); ta.focus(); ta.select(); s.querySelector('[data-v]').onclick = () => close(); } });
      }
      return;
    }
    case 'exportfile': {
      const json = await exportJSON();
      const name = `wallet-prop-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); } catch { /* cancelled */ }
      } else {
        const a2 = document.createElement('a');
        a2.href = URL.createObjectURL(file); a2.download = name; a2.click();
        setTimeout(() => URL.revokeObjectURL(a2.href), 5000);
      }
      return;
    }
    case 'import': {
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch { /* ignore */ }
      const val = await promptSheet('Import JSON', text.trim().startsWith('{') ? text : '', { okLabel: 'Import', multiline: true, placeholder: 'Paste exported JSON here' });
      if (!val) return;
      await importJSON(val); return;
    }
    case 'importfile': {
      const f = e.target.files?.[0];
      if (!f) return;
      await importJSON(await f.text()); return;
    }
    case 'reset': {
      if (!(await confirmSheet('Reset everything?', 'All takes and tickets go back to the starter set. Your image library is kept.', 'Reset', { destructive: true }))) return;
      const res = await fetch('./fixtures/default-config.json');
      setState(await res.json()); break;
    }
    default: return;
  }
  render();
}

function wasEdited(a, b) {
  if (!b) return false;
  const strip = (t) => { const c = clone(t); delete c.id; for (const k of ['section', 'row', 'seat']) c.fields[k].values = []; return JSON.stringify(c); };
  return strip(a) !== strip(b);
}

export async function exportJSON() {
  const state = clone(getState());
  state.images = await exportImages(imageIdsIn(state));
  return JSON.stringify(state);
}

export async function importJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { toast('That isn’t valid JSON'); return false; }
  const images = data.images || {};
  delete data.images;
  const migrated = migrate(clone(data));
  if (!migrated) { toast('Not a Wallet Prop config'); return false; }
  await importImages(images); // images first, then config (SPEC §10.3)
  setState(migrated);
  await warm(imageIdsIn(migrated));
  toast('Imported');
  render();
  return true;
}

// ---------- swipe a row to reveal Duplicate / Delete ----------
function closeSwipes(except) {
  el.querySelectorAll('.trow.open').forEach((r) => { if (r !== except) { r.classList.remove('open'); r.querySelector('.trow-inner').style.transform = ''; } });
}

function setupSwipe(row) {
  const inner = row.querySelector('.trow-inner');
  const W = 168;
  let sx = 0; let sy = 0; let dx = 0; let mode = null; let base = 0;
  inner.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.handle')) return;
    sx = e.clientX; sy = e.clientY; dx = 0; mode = null; base = row.classList.contains('open') ? -W : 0;
    inner.style.transition = 'none';
  });
  inner.addEventListener('pointermove', (e) => {
    if (sx === 0 && sy === 0) return;
    const mx = e.clientX - sx; const my = e.clientY - sy;
    if (!mode) { if (Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my)) { mode = 'x'; closeSwipes(row); inner.setPointerCapture(e.pointerId); } else if (Math.abs(my) > 8) mode = 'y'; }
    if (mode === 'x') { dx = Math.max(-W - 30, Math.min(0, base + mx)); inner.style.transform = `translateX(${dx}px)`; }
  });
  const end = () => {
    inner.style.transition = '';
    if (mode === 'x') {
      const open = dx < -W / 2;
      row.classList.toggle('open', open);
      inner.style.transform = open ? `translateX(${-W}px)` : '';
      inner.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { once: true, capture: true });
    }
    sx = 0; sy = 0; mode = null;
  };
  inner.addEventListener('pointerup', end);
  inner.addEventListener('pointercancel', end);
}

// ---------- drag ≡ to reorder ----------
function setupDrag(handle) {
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const row = handle.closest('.trow');
    const rows = [...el.querySelectorAll('.trow')];
    const from = rows.indexOf(row);
    const hgt = row.getBoundingClientRect().height;
    const startY = e.clientY;
    let to = from;
    handle.setPointerCapture(e.pointerId);
    row.classList.add('dragging');
    const move = (ev) => {
      const dy = ev.clientY - startY;
      row.style.transform = `translateY(${dy}px)`;
      to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / hgt)));
      rows.forEach((r, k) => {
        if (r === row) return;
        let shift = 0;
        if (from < to && k > from && k <= to) shift = -hgt;
        if (from > to && k < from && k >= to) shift = hgt;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      if (to !== from) {
        const take = activeTake();
        const startId = take.tickets[take.startIndex || 0]?.id;
        const [t] = take.tickets.splice(from, 1);
        take.tickets.splice(to, 0, t);
        take.startIndex = Math.max(0, take.tickets.findIndex((x) => x.id === startId));
        save();
      }
      render();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

export { defaultTicket, h };
