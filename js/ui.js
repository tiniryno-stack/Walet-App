// Small iOS-style UI helpers: sheets, confirm, prompt, action sheet, toast.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function root() { return document.getElementById('sheet-root'); }

export function sheet(innerHTML, { onMount } = {}) {
  return new Promise((resolve) => {
    const el = h(`<div class="sheet-backdrop"><div class="sheet" role="dialog">${innerHTML}</div></div>`);
    const close = (v) => { el.classList.add('out'); setTimeout(() => el.remove(), 180); resolve(v); };
    el.addEventListener('click', (e) => { if (e.target === el) close(null); });
    root().appendChild(el);
    onMount?.(el.querySelector('.sheet'), close);
  });
}

export function confirmSheet(title, message, okLabel = 'OK', { destructive = false } = {}) {
  return sheet(`
    <div class="sheet-title">${esc(title)}</div>
    ${message ? `<div class="sheet-msg">${esc(message)}</div>` : ''}
    <div class="sheet-btns"><button type="button" class="btn" data-v="0">Cancel</button>
    <button type="button" class="btn ${destructive ? 'danger' : 'primary'}" data-v="1">${esc(okLabel)}</button></div>`, {
    onMount: (s, close) => s.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => close(b.dataset.v === '1'))),
  });
}

export function promptSheet(title, value = '', { okLabel = 'Save', multiline = false, placeholder = '' } = {}) {
  return sheet(`
    <div class="sheet-title">${esc(title)}</div>
    ${multiline
    ? `<textarea class="input mono" rows="8" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
    : `<input class="input" type="text" value="${esc(value)}" placeholder="${esc(placeholder)}">`}
    <div class="sheet-btns"><button type="button" class="btn" data-v="0">Cancel</button>
    <button type="button" class="btn primary" data-v="1">${esc(okLabel)}</button></div>`, {
    onMount: (s, close) => {
      const inp = s.querySelector('input,textarea');
      setTimeout(() => inp.focus(), 50);
      s.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => close(b.dataset.v === '1' ? inp.value : null)));
    },
  });
}

export function actionSheet(title, options) {
  return sheet(`
    ${title ? `<div class="sheet-title">${esc(title)}</div>` : ''}
    <div class="sheet-list">${options.map((o, i) => `<button type="button" class="sheet-opt ${o.destructive ? 'danger' : ''} ${o.checked ? 'checked' : ''}" data-i="${i}">${esc(o.label)}${o.checked ? '<span>✓</span>' : ''}</button>`).join('')}</div>
    <div class="sheet-btns one"><button type="button" class="btn" data-i="-1">Cancel</button></div>`, {
    onMount: (s, close) => s.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i; close(i < 0 ? null : i);
    })),
  });
}

let toastTimer = 0;
export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = h('<div id="toast"></div>'); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export const sw = (on) => `<span class="switch ${on ? 'on' : ''}"><i></i></span>`;
