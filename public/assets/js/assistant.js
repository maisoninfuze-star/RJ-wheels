// RJ assistant — chat with Claude through /api/chat (see api/chat.js).
// Loaded on first open (main.js). The conversation lives in this tab only
// (sessionStorage) and is sent back to the server each turn.

const cfg = JSON.parse(document.getElementById('assistant-config').textContent);
const T = cfg.t;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const STORE = 'rjChat:' + cfg.lang;

let root, log, chips, form, input, fileInput, sendBtn, opener;
let history = [];   // Claude message history (round-tripped to the server)
let busy = false;
let bookingRef = null;
let bookingInfo = null;
let photos = [];    // resized File objects waiting to be sent with a booking

const icon = {
  send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
  attach: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6M4 4v4.6h4.6"/></svg>',
};

function build() {
  root = document.createElement('div');
  root.className = 'as-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', T.title);
  root.innerHTML = `
  <div class="as-scrim" data-as-close></div>
  <section class="as-panel">
    <header class="as-head">
      <span class="as-avatar" aria-hidden="true">${cfg.mark}</span>
      <div class="as-id"><b>${esc(T.title)}</b><small><i></i>${esc(T.status)} <em>${esc(T.badge)}</em></small></div>
      <button type="button" class="as-icon" data-as-restart aria-label="${esc(T.restart)}">${icon.restart}</button>
      <button type="button" class="as-icon" data-as-close aria-label="${esc(T.close)}">${icon.close}</button>
    </header>
    <div class="as-log" aria-live="polite" aria-relevant="additions"></div>
    <div class="as-chips"></div>
    <form class="as-form" autocomplete="off">
      <button type="button" class="as-icon as-attach" aria-label="${esc(T.attach)}">${icon.attach}</button>
      <input type="file" accept="image/*" multiple hidden>
      <input class="as-text" type="text" enterkeyhint="send" maxlength="1200" placeholder="${esc(T.placeholder)}" aria-label="${esc(T.placeholder)}">
      <button type="submit" class="as-send" aria-label="${esc(T.send)}">${icon.send}</button>
    </form>
    <p class="as-note">${esc(T.privacy)}</p>
  </section>`;
  document.body.append(root);
  log = root.querySelector('.as-log');
  chips = root.querySelector('.as-chips');
  form = root.querySelector('.as-form');
  input = root.querySelector('.as-text');
  sendBtn = root.querySelector('.as-send');
  fileInput = root.querySelector('input[type=file]');
  root.querySelectorAll('[data-as-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelector('[data-as-restart]').addEventListener('click', reset);
  root.querySelector('.as-attach').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', onFiles);
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = input.value.trim(); if (v) { input.value = ''; send(v); } });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// ---------- rendering ----------
function scroll() { log.scrollTo({ top: log.scrollHeight, behavior: reduced ? 'auto' : 'smooth' }); }
function add(el) { log.append(el); scroll(); return el; }
// Plain text from Claude → safe HTML (paragraphs, "- " lists, phone links).
function format(text) {
  const lines = esc(text).split('\n');
  let html = '', list = false;
  for (const l of lines) {
    const item = /^\s*[-•]\s+(.*)/.exec(l);
    if (item) { if (!list) { html += '<ul>'; list = true; } html += `<li>${item[1]}</li>`; continue; }
    if (list) { html += '</ul>'; list = false; }
    if (l.trim()) html += `<p>${l}</p>`;
  }
  if (list) html += '</ul>';
  return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(\d{3}[-\s.]\d{3}[-\s.]\d{4})/g, (m) => `<a href="tel:+1${m.replace(/\D/g, '')}">${m}</a>`);
}
function bubble(who, html) {
  const d = document.createElement('div');
  d.className = `as-msg ${who}`;
  d.innerHTML = `<div class="as-bubble">${html}</div>`;
  return add(d);
}
function typing() {
  return add(Object.assign(document.createElement('div'), { className: 'as-msg bot as-typing', innerHTML: '<div class="as-bubble"><i></i><i></i><i></i></div>' }));
}
function setChips(list) {
  chips.replaceChildren(...list.map((label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'as-chip';
    b.textContent = label;
    b.addEventListener('click', () => send(label));
    return b;
  }));
}

// ---------- persistence (this tab only) ----------
function save() { try { sessionStorage.setItem(STORE, JSON.stringify({ history, bookingRef, bookingInfo })); } catch {} }
function restore() {
  try {
    const s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
    if (!s?.history?.length) return false;
    history = s.history; bookingRef = s.bookingRef; bookingInfo = s.bookingInfo;
    for (const m of history) {
      if (m.role === 'user' && typeof m.content === 'string') bubble('me', esc(m.content));
      if (m.role === 'assistant' && Array.isArray(m.content)) {
        const text = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        if (text) bubble('bot', format(text));
      }
    }
    if (bookingInfo) bookedCard(bookingInfo, false);
    return true;
  } catch { return false; }
}

// ---------- conversation ----------
async function send(text) {
  if (busy) return;
  busy = true;
  sendBtn.disabled = true;
  setChips([]);
  bubble('me', esc(text));
  const draft = [...history, { role: 'user', content: text }];
  const dots = typing();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lang: cfg.lang, messages: draft }),
    });
    const data = await res.json().catch(() => ({}));
    dots.remove();
    if (!res.ok || !Array.isArray(data.messages)) throw new Error(data.error || String(res.status));
    history = data.messages;
    if (data.reply) bubble('bot', format(data.reply));
    if (data.booking && !bookingRef) {
      bookingRef = data.booking.ref;
      bookingInfo = data.booking;
      bookedCard(bookingInfo, true);
      if (photos.length) uploadPhotos();
    }
    save();
  } catch (err) {
    dots.remove();
    console.warn('assistant', err.message);
    const wa = cfg.whatsapp ? ` <a href="https://wa.me/${cfg.whatsapp}" target="_blank" rel="noopener">WhatsApp</a>` : '';
    const mail = cfg.email ? ` · <a href="mailto:${cfg.email}">${esc(cfg.email)}</a>` : '';
    bubble('bot', `<p>${esc(err.message === 'rate_limited' ? T.errBusy : T.errDown)}</p><p><a href="${cfg.phoneHref}">${esc(cfg.phone)}</a>${wa}${mail}</p>`);
  } finally {
    busy = false;
    sendBtn.disabled = false;
    input.focus({ preventScroll: true });
  }
}

// ---------- booking confirmation + calendar file ----------
function ics(b) {
  const [y, mo, d] = b.date.split('-');
  const [h, m] = b.time.split(':').map(Number);
  const end = h * 60 + m + 45;
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const icsEsc = (s) => String(s).replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RJ Welding & Wheels//Assistant//' + cfg.lang.toUpperCase(), 'BEGIN:VEVENT',
    `UID:${b.ref}@rjwheels.ca`, `DTSTAMP:${stamp}`,
    `DTSTART;TZID=America/Toronto:${y}${mo}${d}T${pad(h)}${pad(m)}00`,
    `DTEND;TZID=America/Toronto:${y}${mo}${d}T${pad(Math.floor(end / 60))}${pad(end % 60)}00`,
    `SUMMARY:${icsEsc(cfg.icsTitle + ' (' + T.pending + ')')}`, `LOCATION:${icsEsc(cfg.addressLine)}`,
    `DESCRIPTION:${icsEsc(`${b.ref} · ${b.service}${b.finish ? ' · ' + b.finish : ''}\n${cfg.phone}`)}`, 'END:VEVENT', 'END:VCALENDAR'];
  return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
}
function bookedCard(b, fresh) {
  const when = new Intl.DateTimeFormat(cfg.locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${b.date}T12:00:00Z`));
  const card = document.createElement('div');
  card.className = 'as-card as-card-done' + (fresh ? '' : ' quiet');
  card.innerHTML = `<p class="as-wa-title">${esc(T.sentTitle)} · ${esc(b.ref)}</p>
    <p class="as-sent">${esc(fill(T.sentText, { when: `${when} — ${b.time.replace(':', cfg.lang === 'fr' ? ' h ' : ':')}` }))}</p>
    <div class="as-actions">
      <a class="as-btn primary" href="${ics(b)}" download="rj-welding-wheels.ics">${esc(T.ics)}</a>
      <button type="button" class="as-btn" data-add-photos>${esc(T.addPhotos)}</button>
    </div>`;
  card.querySelector('[data-add-photos]').addEventListener('click', () => fileInput.click());
  add(card);
}

// ---------- photos: resized in the browser, emailed with the booking reference ----------
function shrink(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b ? new File([b], 'photo.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
async function onFiles() {
  const picked = [...fileInput.files].filter((f) => f.type.startsWith('image/')).slice(0, 6 - photos.length);
  fileInput.value = '';
  if (!picked.length) return;
  const files = (await Promise.all(picked.map(shrink))).filter(Boolean);
  photos.push(...files);
  bubble('me', `<div class="as-thumbs">${files.map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`).join('')}</div>`);
  if (bookingRef) uploadPhotos();
  else bubble('bot', `<p>${esc(fill(T.photosHeld, { n: photos.length }))}</p>`);
}
async function uploadPhotos() {
  const batch = photos.splice(0);
  const fd = new FormData();
  fd.append('ref', bookingRef);
  batch.forEach((f, i) => fd.append('photos', f, `photo-${i + 1}.jpg`));
  try {
    const res = await fetch('/api/booking-photos', { method: 'POST', body: fd });
    if (!res.ok) throw new Error(String(res.status));
    bubble('bot', `<p>${esc(fill(T.photosSent, { n: batch.length, ref: bookingRef }))}</p>`);
  } catch {
    bubble('bot', `<p>${esc(T.photosFailed)}</p>`);
  }
}

// ---------- open / close ----------
function greet(finish) {
  log.replaceChildren();
  bubble('bot', format(T.greet));
  setChips(finish ? [] : [T.startBook, T.startAsk]);
  if (finish) send(fill(T.finishOpener, { f: finish }));
}
function reset() {
  history = []; bookingRef = null; bookingInfo = null; photos = [];
  try { sessionStorage.removeItem(STORE); } catch {}
  greet();
}
function close() {
  root.classList.remove('open');
  document.documentElement.classList.remove('as-lock');
  setTimeout(() => { if (!root.classList.contains('open')) root.hidden = true; }, 450);
  opener?.focus?.();
}

export function open({ finish, from } = {}) {
  const first = !root;
  if (first) build();
  opener = from || document.activeElement;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  if (matchMedia('(max-width: 699px)').matches) document.documentElement.classList.add('as-lock');
  if (first && !restore()) greet(finish);
  else if (finish && !busy) send(fill(T.finishOpener, { f: finish }));
  setTimeout(() => input.focus({ preventScroll: true }), 350);
}
