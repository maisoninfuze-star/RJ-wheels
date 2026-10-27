// RJ booking assistant — DEMO. Loaded on first open (see main.js).
// Guided booking + FAQ answers drawn only from verified site facts.
// Nothing leaves the browser: `adapter.submit` is where the production
// integration plugs in (e.g. POST /api/booking → GoHighLevel contact +
// calendar appointment, whose workflow sends the WhatsApp/SMS confirmation).

const cfg = JSON.parse(document.getElementById('assistant-config').textContent);
const T = cfg.t;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 120) : ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const adapter = {
  async submit(booking) {
    // DEMO: simulate the round trip. Production: POST to the booking endpoint.
    await sleep(1400);
    return { ok: true, ref: 'RJ-' + Math.random().toString(36).slice(2, 7).toUpperCase(), booking };
  },
};

// ---------- DOM ----------
let root, log, chips, form, input, fileInput, opener;
let pendingInput = null; // resolver for the current question
let started = false;
let booking = {};
let photos = [];

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
      <div class="as-id"><b>${esc(T.title)}</b><small><i></i>${esc(T.status)} <em>${esc(T.demo)}</em></small></div>
      <button type="button" class="as-icon" data-as-restart aria-label="${esc(T.restart)}">${icon.restart}</button>
      <button type="button" class="as-icon" data-as-close aria-label="${esc(T.close)}">${icon.close}</button>
    </header>
    <div class="as-log" aria-live="polite" aria-relevant="additions"></div>
    <div class="as-chips"></div>
    <form class="as-form" autocomplete="off">
      <button type="button" class="as-icon as-attach" aria-label="${esc(T.attach)}">${icon.attach}</button>
      <input type="file" accept="image/*" multiple hidden>
      <input class="as-text" type="text" enterkeyhint="send" placeholder="${esc(T.placeholder)}" aria-label="${esc(T.placeholder)}">
      <button type="submit" class="as-send" aria-label="${esc(T.send)}">${icon.send}</button>
    </form>
    <p class="as-note">${esc(T.demoNote)}</p>
  </section>`;
  document.body.append(root);
  log = root.querySelector('.as-log');
  chips = root.querySelector('.as-chips');
  form = root.querySelector('.as-form');
  input = root.querySelector('.as-text');
  fileInput = root.querySelector('input[type=file]');

  root.querySelectorAll('[data-as-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelector('[data-as-restart]').addEventListener('click', () => restart());
  root.querySelector('.as-attach').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', onFiles);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    me(v);
    resolve({ type: 'text', value: v });
  });
  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// ---------- messages ----------
function scroll() { log.scrollTo({ top: log.scrollHeight, behavior: reduced ? 'auto' : 'smooth' }); }
function add(el) { log.append(el); scroll(); return el; }
function me(text, html) {
  const d = document.createElement('div');
  d.className = 'as-msg me';
  d.innerHTML = `<div class="as-bubble">${html ?? esc(text)}</div>`;
  return add(d);
}
async function bot(text, { html = false, delay } = {}) {
  const typing = add(Object.assign(document.createElement('div'), { className: 'as-msg bot as-typing', innerHTML: '<div class="as-bubble"><i></i><i></i><i></i></div>' }));
  await sleep(delay ?? Math.min(1100, 350 + text.length * 9));
  typing.remove();
  const d = document.createElement('div');
  d.className = 'as-msg bot';
  d.innerHTML = `<div class="as-bubble">${html ? text : esc(text)}</div>`;
  return add(d);
}
function card(html, cls = '') {
  const d = document.createElement('div');
  d.className = `as-card ${cls}`;
  d.innerHTML = html;
  return add(d);
}

// ---------- input plumbing ----------
function resolve(v) { const r = pendingInput; pendingInput = null; setChips([]); r?.(v); }
function setChips(list) {
  chips.replaceChildren(...list.map((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'as-chip' + (c.primary ? ' primary' : '');
    b.textContent = c.label;
    b.addEventListener('click', () => {
      if (!c.silent) me(c.label);
      resolve({ type: 'chip', value: c.value ?? c.label });
    });
    return b;
  }));
}
function wait(list = []) {
  setChips(list);
  return new Promise((r) => { pendingInput = r; });
}

// ---------- FAQ ----------
const QWORDS = /^(comment|combien|quel|quelle|quels|quelles|quand|ou |est-ce|avez|faites|pouvez|acceptez|how|what|when|where|do you|can you|is |are |does )/;
const isQuestion = (s) => s.includes('?') || QWORDS.test(norm(s));
function hoursText() {
  const fmt = (h) => (cfg.lang === 'fr' ? h.replace(':', ' h ').replace(' h 00', ' h') : h);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const lines = order.map((d) => {
    const h = cfg.hours.find((x) => x.day === d);
    return `${cfg.days[d]} : ${h.closed ? T.closed : `${fmt(h.open)} – ${fmt(h.close)}`}`;
  });
  return lines.join('<br>') + `<br><small>${esc(cfg.hoursNote)}</small>`;
}
async function answer(text) {
  const n = norm(text);
  // Keywords match at the start of a word ("ou" must not match "vous");
  // off-limits topics (a: null) are checked first so they never get a wrong answer.
  const reEsc = (k) => norm(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const has = (k) => new RegExp(`(^|[^a-z0-9])${reEsc(k)}`).test(n);
  // The most specific match wins ("combien de temps" beats "combien").
  const best = (list) => list.map((f) => ({ f, len: Math.max(0, ...f.k.filter(has).map((k) => k.length)) })).filter((x) => x.len).sort((a, b) => b.len - a.len)[0]?.f;
  const hit = best(T.faq.filter((f) => f.a === null)) || best(T.faq.filter((f) => f.a !== null));
  if (!hit || hit.a === null) return bot(T.fallback);
  if (hit.a === 'hours') return bot(hoursText(), { html: true });
  return bot(hit.a);
}

// Ask one booking question; questions typed in between are answered, then the step resumes.
async function step(prompt, list, { html = false, freeText = true } = {}) {
  await bot(prompt, { html });
  for (;;) {
    const r = await wait(list);
    const typedChip = r.type === 'text' && list.find((c) => norm(c.label) === norm(r.value));
    if (typedChip) return { type: 'chip', value: typedChip.value ?? typedChip.label };
    if (r.type === 'text' && (isQuestion(r.value) || !freeText)) {
      await answer(r.value);
      await bot(T.resume);
      continue;
    }
    return r;
  }
}

// ---------- calendar ----------
const tz = 'America/Toronto';
const dayKey = (d) => d.toISOString().slice(0, 10);
const seeded = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };
function hoursFor(date) { return cfg.hours.find((h) => h.day === date.getDay()); }
function slotsFor(date) {
  const h = hoursFor(date);
  if (!h || h.closed) return [];
  const [oh, om] = h.open.split(':').map(Number);
  const [ch, cm] = h.close.split(':').map(Number);
  const out = [];
  for (let m = oh * 60 + om; m <= ch * 60 + cm - 60; m += 30) {
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    out.push({ t, taken: seeded(dayKey(date) + t) < 0.38 });
  }
  return out;
}
const fmtDay = (d, o) => new Intl.DateTimeFormat(cfg.locale, { timeZone: tz, ...o }).format(d);
const fmtTime = (t) => {
  const [h, m] = t.split(':').map(Number);
  if (cfg.lang === 'fr') return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  const ap = h >= 12 ? 'p.m.' : 'a.m.';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ap}`;
};

function pickDate() {
  return new Promise((done) => {
    const days = [];
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    for (let i = 1; days.length < 14; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const h = hoursFor(d);
      const closed = !h || h.closed;
      const full = !closed && (seeded(dayKey(d)) < 0.18 || slotsFor(d).every((s) => s.taken));
      days.push({ d, closed, full });
    }
    const el = card(`<div class="as-cal">${days.map((x, i) => `
      <button type="button" data-i="${i}" ${x.closed || x.full ? 'disabled' : ''}
        aria-label="${esc(fmtDay(x.d, { weekday: 'long', day: 'numeric', month: 'long' }))}${x.closed ? ' — ' + esc(T.closed) : x.full ? ' — ' + esc(T.full) : ''}">
        <small>${esc(fmtDay(x.d, { weekday: 'short' }).replace('.', ''))}</small>
        <b>${x.d.getDate()}</b>
        <small>${x.closed ? esc(T.closed) : x.full ? esc(T.full) : esc(fmtDay(x.d, { month: 'short' }).replace('.', ''))}</small>
      </button>`).join('')}</div>`, 'as-card-cal');
    el.querySelectorAll('button:not([disabled])').forEach((b) => b.addEventListener('click', () => {
      const x = days[Number(b.dataset.i)];
      el.querySelectorAll('button').forEach((o) => { o.disabled = true; });
      b.classList.add('on');
      me(fmtDay(x.d, { weekday: 'long', day: 'numeric', month: 'long' }));
      done(x.d);
    }));
  });
}
function pickTime(date) {
  return new Promise((done) => {
    const slots = slotsFor(date);
    const el = card(`<div class="as-slots">${slots.map((s) => `<button type="button" data-t="${s.t}" ${s.taken ? 'disabled' : ''}>${esc(fmtTime(s.t))}</button>`).join('')}</div>`);
    el.querySelectorAll('button:not([disabled])').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('button').forEach((o) => { o.disabled = true; });
      b.classList.add('on');
      me(fmtTime(b.dataset.t));
      done(b.dataset.t);
    }));
  });
}

// ---------- photos ----------
let photoWaiter = null;
function onFiles() {
  const files = [...fileInput.files].filter((f) => f.type.startsWith('image/')).slice(0, 6 - photos.length);
  fileInput.value = '';
  if (!files.length) return;
  const urls = files.map((f) => URL.createObjectURL(f));
  photos.push(...urls);
  me('', `<div class="as-thumbs">${urls.map((u) => `<img src="${u}" alt="">`).join('')}</div>`);
  if (photoWaiter) { const w = photoWaiter; photoWaiter = null; resolve({ type: 'photos' }); w(); }
  else bot(fill(photos.length === 1 ? T.photosGot1 : T.photosGotN, { n: photos.length }));
}

// ---------- calendar file ----------
function ics(b) {
  const [y, mo, d] = b.dateKey.split('-');
  const [h, m] = b.time.split(':').map(Number);
  const end = h * 60 + m + 45;
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const icsEsc = (s) => s.replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RJ Welding & Wheels//Assistant demo//' + cfg.lang.toUpperCase(), 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${b.ref}@rjweldingandwheels.com`, `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${tz}:${y}${mo}${d}T${pad(h)}${pad(m)}00`,
    `DTEND;TZID=${tz}:${y}${mo}${d}T${pad(Math.floor(end / 60))}${pad(end % 60)}00`,
    `SUMMARY:${icsEsc(cfg.icsTitle)}`, `LOCATION:${icsEsc(cfg.addressLine)}`,
    `DESCRIPTION:${icsEsc(`${b.serviceLabel}${b.finish ? ' · ' + b.finish : ''}\n${cfg.phone}`)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
}

// ---------- flows ----------
async function qa() {
  await bot(T.askPrompt);
  for (;;) {
    const r = await wait([{ label: T.startBook, value: 'book', primary: true }]);
    if (r.type === 'chip') return book();
    await answer(r.value);
  }
}

async function book(preset = {}) {
  booking = { finish: preset.finish || null, service: preset.finish ? 'powder' : null };
  photos = [];

  if (!booking.service) {
    const r = await step(T.service, [...cfg.services.map((s) => ({ label: s.name, value: s.id })), { label: T.notSure, value: 'other' }]);
    booking.service = r.type === 'chip' ? r.value : 'other';
    if (r.type === 'text') booking.serviceNote = r.value;
  }
  booking.serviceLabel = cfg.services.find((s) => s.id === booking.service)?.name || T.notSure;

  const v = await step(T.vehicle, [{ label: T.skip, value: '' }]);
  booking.vehicle = v.value;

  const w = await step(T.wheels, ['1', '2', '3', '4', '5+'].map((n) => ({ label: n })), { freeText: false });
  booking.wheels = w.value;

  await bot(T.photos);
  for (;;) {
    const r = await wait([{ label: T.addPhotos, value: 'add', primary: true, silent: true }, { label: T.later, value: 'later' }]);
    if (r.type === 'chip' && r.value === 'add') {
      fileInput.click();
      await new Promise((ok) => { photoWaiter = ok; setChips([{ label: T.later, value: 'later' }]); pendingInput = () => { photoWaiter = null; ok(); }; });
      if (photos.length) await bot(fill(photos.length === 1 ? T.photosGot1 : T.photosGotN, { n: photos.length }));
      break;
    }
    if (r.type === 'chip') break;
    await answer(r.value);
    await bot(T.resume);
  }

  await bot(T.date);
  const date = await pickDate();
  booking.dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
  booking.dateLabel = fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long' });
  await bot(fill(T.time, { d: booking.dateLabel }));
  booking.time = await pickTime(date);
  booking.when = cfg.lang === 'fr' ? `${booking.dateLabel} à ${fmtTime(booking.time)}` : `${booking.dateLabel} at ${fmtTime(booking.time)}`;

  for (;;) {
    const r = await step(T.name, []);
    if (r.value.trim().length >= 2) { booking.name = r.value.trim().split(/\s+/)[0]; booking.fullName = r.value.trim(); break; }
  }
  for (let prompt = T.phone; ;) {
    const r = await step(prompt, []);
    const digits = r.value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (digits.length === 10) { booking.phone = `${digits.slice(0, 3)} ${digits.slice(3, 6)}-${digits.slice(6)}`; break; }
    prompt = T.phoneInvalid;
  }
  const c = await step(T.consent, [{ label: T.consentYes, value: 'whatsapp', primary: true }, { label: T.consentNo, value: 'sms' }], { freeText: false });
  booking.channel = c.value;

  const L = T.labels;
  const rows = [
    [L.service, booking.serviceLabel], booking.finish && [L.finish, booking.finish], booking.vehicle && [L.vehicle, booking.vehicle],
    [L.wheels, booking.wheels], photos.length && [L.photos, String(photos.length)], [L.when, booking.when],
    [L.name, booking.fullName], [L.phone, booking.phone], [L.channel, booking.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'],
  ].filter(Boolean);
  await bot(T.summary);
  card(`<dl class="as-summary">${rows.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>`);
  const ok = await wait([{ label: T.confirm, value: 'yes', primary: true }, { label: T.edit, value: 'edit' }]);
  if (ok.value === 'edit') return book(preset);

  await bot(T.sending, { delay: 300 });
  const res = await adapter.submit({ ...booking, photos: photos.length });
  booking.ref = res.ref;
  await bot(fill(T.done, { n: booking.name }));

  const wa = fill(T.waMsg, { name: booking.name, when: booking.when, address: cfg.addressShort });
  const now = new Intl.DateTimeFormat(cfg.locale, { hour: 'numeric', minute: '2-digit' }).format(new Date());
  card(`<p class="as-wa-title">${esc(booking.channel === 'whatsapp' ? T.waTitle : T.waTitle.replace('WhatsApp', 'SMS'))}</p>
    <div class="as-wa${booking.channel === 'sms' ? ' sms' : ''}">
      <div class="as-wa-head"><span>${cfg.mark}</span><b>RJ Welding &amp; Wheels</b></div>
      <div class="as-wa-msg">${esc(wa)}<time>${esc(now)}</time></div>
    </div>
    <div class="as-actions">
      <a class="as-btn primary" href="${ics(booking)}" download="rj-welding-wheels.ics">${esc(T.ics)}</a>
      <a class="as-btn" href="${cfg.phoneHref}">${esc(T.call)}</a>
    </div>`, 'as-card-done');

  await bot(T.more);
  for (;;) { const r = await wait([]); if (r.type === 'text') await answer(r.value); }
}

async function run(preset = {}) {
  started = true;
  log.replaceChildren();
  if (preset.finish) { await bot(fill(T.greetFinish, { f: preset.finish })); return book(preset); }
  await bot(T.greet);
  for (;;) {
    const r = await wait([{ label: T.startBook, value: 'book', primary: true }, { label: T.startAsk, value: 'ask' }]);
    if (r.type === 'chip') return r.value === 'book' ? book() : qa();
    await answer(r.value);
  }
}

function restart(preset = {}) {
  pendingInput = null;
  photoWaiter = null;
  setChips([]);
  run(preset);
}

function close() {
  root.classList.remove('open');
  document.documentElement.classList.remove('as-lock');
  setTimeout(() => { if (!root.classList.contains('open')) root.hidden = true; }, 450);
  opener?.focus?.();
}

export function open({ finish, from } = {}) {
  if (!root) build();
  opener = from || document.activeElement;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  if (matchMedia('(max-width: 699px)').matches) document.documentElement.classList.add('as-lock');
  if (!started || finish) restart({ finish });
  setTimeout(() => input.focus({ preventScroll: true }), 350);
}
