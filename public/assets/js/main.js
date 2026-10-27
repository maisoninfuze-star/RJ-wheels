// RJ Welding & Wheels — progressive enhancement. The site works without this file.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---------- opening splash (logo build) ----------
// Pattern from the BMS site: CSS owns the timeline, this only records the
// session, allows click-to-skip, and cleans up (with a failsafe).
const splash = $('#splash');
if (splash) {
  const html = document.documentElement;
  if (!html.classList.contains('intro')) splash.remove();
  else if (location.hash === '#introhold') splash.classList.add('hold');
  else {
    try { sessionStorage.setItem('rjIntro', '1'); } catch {}
    const done = () => {
      if (!splash.isConnected) return;
      splash.classList.add('done');
      html.classList.remove('intro');
      splash.remove();
      document.dispatchEvent(new Event('rj:intro-done'));
    };
    splash.addEventListener('animationend', (e) => { if (e.animationName === 'splash-leave') done(); });
    splash.addEventListener('click', done);
    setTimeout(done, 5200);
  }
}

// ---------- hero film ----------
// The <video> autoplays natively (muted, looped, inline); this only adds
// control. A pause/play button is always shown; reduced-motion and data-saver
// visitors start paused on the poster. If the browser refuses autoplay (Low
// Power Mode), playback is retried on the first interaction. Off-screen, it pauses.
const heroVideo = $('[data-hero-video]');
const heroToggle = $('[data-hero-toggle]');
if (heroVideo) {
  const conn = navigator.connection;
  let userPaused = reduced || !!conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '');
  let inView = true;
  const setUi = () => {
    if (!heroToggle) return;
    const playing = !heroVideo.paused;
    heroToggle.dataset.state = playing ? 'playing' : 'paused';
    heroToggle.setAttribute('aria-label', playing ? heroToggle.dataset.labelPause : heroToggle.dataset.labelPlay);
    heroToggle.hidden = false;
  };
  const play = () => { const p = heroVideo.play(); if (p) p.catch(() => { setUi(); retryOnGesture(); }); };
  const retryOnGesture = () => {
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    const go = () => { events.forEach((t) => removeEventListener(t, go)); if (!userPaused && inView) play(); };
    events.forEach((t) => addEventListener(t, go, { passive: true }));
  };
  if (userPaused) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }
  heroVideo.addEventListener('play', setUi);
  heroVideo.addEventListener('pause', setUi);
  heroToggle?.addEventListener('click', () => {
    if (heroVideo.paused) { userPaused = false; play(); } else { userPaused = true; heroVideo.pause(); }
  });
  // Autoplay attribute honoured? If not after the data is ready, nudge it.
  heroVideo.addEventListener('canplay', () => { if (!userPaused && inView && heroVideo.paused) play(); }, { once: true });
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (userPaused) return;
    if (inView) play(); else heroVideo.pause();
  }, { threshold: 0.05 }).observe(heroVideo);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && inView && !userPaused && heroVideo.paused) play();
  });
  setUi();
}

// ---------- header: solid after scroll, hide on scroll down ----------
const header = $('[data-header]');
const bar = $('[data-action-bar]');
// On the home page the sticky Call / Quote bar appears as soon as the hero's
// own buttons leave the screen; elsewhere, after scrolling past 60% of the view.
const heroActions = $('.hero-actions');
if (heroActions && bar) new IntersectionObserver(([e]) => bar.classList.toggle('is-on', !e.isIntersecting)).observe(heroActions);
let lastY = scrollY;
let ticking = false;
function onScroll() {
  const y = scrollY;
  header?.classList.toggle('is-solid', y > 24);
  const menuOpen = document.body.classList.contains('menu-open');
  header?.classList.toggle('is-hidden', !menuOpen && y > 400 && y > lastY + 4);
  if (y < lastY - 4 || y < 400) header?.classList.remove('is-hidden');
  if (!heroActions) bar?.classList.toggle('is-on', y > innerHeight * 0.6);
  lastY = y;
  ticking = false;
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();

// ---------- mobile menu ----------
const menuBtn = $('[data-menu-btn]');
const menu = $('[data-menu]');
function setMenu(open) {
  if (!menu) return;
  menuBtn.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('menu-open', open);
  document.documentElement.style.overflow = open ? 'hidden' : '';
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('is-open'));
    menu.querySelector('a')?.focus({ preventScroll: true });
  } else {
    menu.classList.remove('is-open');
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 700);
  }
}
menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('menu-open')) { setMenu(false); menuBtn.focus(); } });
menu?.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const items = [...$$('a', menu), menuBtn];
  const i = items.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); items.at(-1).focus(); }
  else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
});

// ---------- scroll reveals ----------
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
$$('.reveal').forEach((el) => io.observe(el));

// ---------- statement: words light up with scroll ----------
const statement = $('[data-words]');
if (statement && !reduced) {
  const words = statement.textContent.trim().split(/\s+/);
  statement.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  statement.dataset.split = '';
  const spans = $$('.w', statement);
  const update = () => {
    const r = statement.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
    const n = Math.round(p * spans.length);
    spans.forEach((s, i) => s.classList.toggle('on', i < n));
  };
  addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  update();
}

// ---------- parallax on hero / feature images ----------
const para = $$('[data-parallax]');
if (para.length && !reduced) {
  const run = () => {
    for (const img of para) {
      const box = img.closest('picture').parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) continue;
      const p = (box.top + box.height / 2 - innerHeight / 2) / innerHeight;
      img.style.translate = `0 ${(p * -6).toFixed(2)}%`;
    }
  };
  addEventListener('scroll', () => requestAnimationFrame(run), { passive: true });
  run();
}

// ---------- services: image peek follows the cursor ----------
const list = $('[data-service-list]');
const peek = $('[data-service-peek]');
if (list && peek && finePointer && !reduced) {
  let x = 0, y = 0, px = 0, py = 0, raf = 0;
  const loop = () => {
    px += (x - px) * 0.14; py += (y - py) * 0.14;
    peek.style.left = `${px}px`; peek.style.top = `${py}px`;
    raf = Math.abs(x - px) + Math.abs(y - py) > 0.3 ? requestAnimationFrame(loop) : 0;
  };
  list.addEventListener('pointermove', (e) => { x = e.clientX + 180; y = e.clientY; if (!raf) raf = requestAnimationFrame(loop); });
  for (const a of $$('a[data-img]', list)) {
    a.addEventListener('pointerenter', (e) => {
      if (!peek.classList.contains('on')) { px = x = e.clientX + 180; py = y = e.clientY; }
      peek.classList.add('on');
      const key = a.dataset.img;
      $$('[data-active]', peek).forEach((n) => n.removeAttribute('data-active'));
      const target = key ? $(`[data-peek="${key}"]`, peek)?.closest('picture') : $('.peek-wheel', peek);
      target?.setAttribute('data-active', '');
    });
  }
  list.addEventListener('pointerleave', () => peek.classList.remove('on'));
}

// ---------- work filters ----------
const grid = $('[data-work-grid]');
if (grid) {
  const chips = $$('[data-filter]');
  chips.forEach((c) => c.addEventListener('click', () => {
    chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    const f = c.dataset.filter;
    $$('.work-card', grid).forEach((card) => card.classList.toggle('is-hidden', f !== 'all' && !card.dataset.tags.split(' ').includes(f)));
  }));
}

// ---------- lightbox ----------
const lb = $('[data-lightbox]');
if (lb) {
  const data = JSON.parse($('[data-lb-data]', lb).textContent);
  const lang = document.documentElement.lang.startsWith('fr') ? 'fr-CA' : 'en-CA';
  let idx = 0, opener = null;
  const img = $('[data-lb-img]', lb);
  const show = (i) => {
    const visible = data.filter((d) => !$(`[data-work="${d.slug}"]`)?.closest('.work-card')?.classList.contains('is-hidden'));
    const list = visible.length ? visible : data;
    idx = (i + list.length) % list.length;
    const d = list[idx];
    const w = d.widths.at(-1);
    img.src = `/assets/img/work/${d.img}-${w}.jpg`;
    img.srcset = d.widths.map((x) => `/assets/img/work/${d.img}-${x}.webp ${x}w`).join(', ');
    img.sizes = '(min-width: 900px) 60vw, 100vw';
    img.width = d.w; img.height = d.h; img.alt = d.alt;
    const tEl = $('[data-lb-title]', lb);
    tEl.textContent = d.title;
    tEl.innerHTML = tEl.innerHTML.replace(/\b(\d+[a-z]+)\b/g, '<span class="nocase">$1</span>');
    $('[data-lb-service]', lb).textContent = d.service;
    $('[data-lb-caption]', lb).textContent = d.caption;
    $('[data-lb-date]', lb).textContent = new Date(d.date + 'T12:00').toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric' });
    $('[data-lb-post]', lb).href = d.post;
  };
  $$('[data-work]').forEach((b) => b.addEventListener('click', () => {
    opener = b;
    const visible = data.filter((d) => !$(`[data-work="${d.slug}"]`)?.closest('.work-card')?.classList.contains('is-hidden'));
    show(visible.findIndex((d) => d.slug === b.dataset.work));
    lb.showModal();
    document.documentElement.style.overflow = 'hidden';
  }));
  $('[data-lb-close]', lb).addEventListener('click', () => lb.close());
  $('[data-lb-prev]', lb).addEventListener('click', () => show(idx - 1));
  $('[data-lb-next]', lb).addEventListener('click', () => show(idx + 1));
  lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); });
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb-figure')) lb.close(); });
  lb.addEventListener('close', () => { document.documentElement.style.overflow = ''; opener?.focus(); });
  let sx = 0;
  lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); });
}

// ---------- hours: highlight today ----------
const today = new Date().getDay();
$$('[data-hours] [data-day]').forEach((row) => row.classList.toggle('is-today', Number(row.dataset.day) === today));
$$('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });

// ---------- map: load only on request (privacy + speed) ----------
$$('[data-map]').forEach((m) => {
  $('[data-map-btn]', m)?.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = m.dataset.src; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    f.title = 'Google Maps — RJ Welding & Wheels';
    m.replaceChildren(f);
  });
});

// ---------- quote form ----------
const form = $('[data-quote]');
if (form) {
  const D = form.dataset;
  const status = $('[data-status]', form);
  const params = new URLSearchParams(location.search);
  if (params.get('service')) form.service.value = params.get('service');

  const fieldErr = (el, msg) => {
    const err = $(`#${el.id}-err`);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
  };
  const validate = () => {
    let first = null;
    for (const el of $$('input[required], select[required], textarea[required], input[type="email"]', form)) {
      let msg = '';
      if (el.required && !el.value.trim()) msg = D.msgRequired;
      else if (el.type === 'email' && el.value && !el.checkValidity()) msg = D.msgInvalid;
      else if (el.type === 'tel' && el.value && el.value.replace(/\D/g, '').length < 10) msg = D.msgInvalid;
      fieldErr(el, msg);
      if (msg && !first) first = el;
    }
    first?.focus();
    return !first;
  };
  $$('input, select, textarea', form).forEach((el) => el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') fieldErr(el, ''); }));

  // ----- photos: resized in the browser so they share quickly -----
  const MAX_PHOTOS = 6;
  const photos = []; // { file: File, url: string }
  const input = form.photos;
  const thumbs = $('[data-thumbs]', form);
  const photoErr = $('#f-photos-err');
  const shrink = (file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
  const renderThumbs = () => {
    thumbs.replaceChildren(...photos.map((ph, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<img src="${ph.url}" alt=""><button type="button" aria-label="${D.msgRemove} ${i + 1}">×</button>`;
      li.querySelector('button').addEventListener('click', () => { URL.revokeObjectURL(ph.url); photos.splice(i, 1); photoErr.textContent = ''; renderThumbs(); });
      return li;
    }));
  };
  const addFiles = async (files) => {
    const images = [...files].filter((f) => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - photos.length;
    photoErr.textContent = images.length > room ? D.msgTooMany : '';
    for (const f of images.slice(0, Math.max(0, room))) {
      const file = await shrink(f);
      photos.push({ file, url: URL.createObjectURL(file) });
      renderThumbs();
    }
  };
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  const zone = $('[data-dropzone]', form);
  ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, () => zone.classList.remove('is-over')));
  zone.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });

  const summary = () => {
    const fr = D.lang === 'fr';
    const opt = (sel) => sel.options[sel.selectedIndex]?.text ?? '';
    const lines = [
      fr ? 'Demande de soumission — RJ Welding & Wheels' : 'Quote request — RJ Welding & Wheels',
      '',
      `${fr ? 'Nom' : 'Name'} : ${form.name.value}`,
      `${fr ? 'Téléphone' : 'Phone'} : ${form.phone.value}`,
      form.email.value ? `${fr ? 'Courriel' : 'Email'} : ${form.email.value}` : null,
      form.vehicle.value ? `${fr ? 'Véhicule' : 'Vehicle'} : ${form.vehicle.value}` : null,
      `Service : ${opt(form.service)}`,
      `${fr ? 'Roues' : 'Wheels'} : ${form.count.value}${form.size.value ? ` × ${form.size.value}"` : ''}`,
      '',
      form.message.value,
      photos.length ? `\n📷 ${(photos.length === 1 ? D.msgPhotosOne : D.msgPhotosMany).replace('{n}', photos.length)}` : null,
    ];
    return lines.filter((l) => typeof l === 'string').join('\n');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.company.value) return; // honeypot
    if (!validate()) return;
    const text = summary();
    if (D.whatsapp) {
      const url = `https://wa.me/${D.whatsapp}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener');
      showWhatsAppSteps(url);
      return;
    }
    if (D.endpoint) {
      const btn = $('button[type="submit"]', form);
      btn.disabled = true; status.textContent = D.msgSending;
      try {
        const res = await fetch(D.endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
        if (!res.ok) throw new Error(res.status);
        status.textContent = D.msgSent; form.reset();
      } catch { status.textContent = D.msgError; }
      btn.disabled = false;
      return;
    }
    if (D.email) {
      location.href = `mailto:${D.email}?subject=${encodeURIComponent(text.split('\n')[0])}&body=${encodeURIComponent(text)}`;
      return;
    }
    const ready = $('[data-ready]', form);
    $('[data-ready-text]', ready).textContent = text;
    ready.hidden = false;
    ready.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  });

  function showWhatsAppSteps(url) {
    const panel = $('[data-wa]', form);
    $('[data-wa-link]', panel).href = url;
    const step2 = $('[data-wa-photos]', panel);
    step2.hidden = !photos.length;
    if (photos.length) {
      const files = photos.map((p) => p.file);
      const canShare = !!navigator.canShare?.({ files });
      $('[data-wa-share]', panel).hidden = !canShare;
      $('[data-wa-share-hint]', panel).hidden = !canShare;
      $('[data-wa-drag]', panel).hidden = canShare;
      $('[data-wa-thumbs]', panel).replaceChildren(...photos.map((p) => {
        const li = document.createElement('li');
        li.innerHTML = `<img src="${p.url}" alt="" draggable="true">`;
        return li;
      }));
    }
    panel.hidden = false;
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }
  $('[data-wa-share]', form)?.addEventListener('click', async () => {
    try { await navigator.share({ files: photos.map((p) => p.file) }); }
    catch (err) { if (err.name !== 'AbortError') $('[data-wa-drag]', form).hidden = false; }
  });

  $('[data-copy]', form)?.addEventListener('click', async (e) => {
    const text = $('[data-ready-text]', form).textContent;
    try { await navigator.clipboard.writeText(text); e.currentTarget.textContent = D.msgCopied; }
    catch { getSelection().selectAllChildren($('[data-ready-text]', form)); }
  });
}

// ---------- AI booking assistant (demo): loaded on first use ----------
const assistantUrl = new URL('./assistant.js' + new URL(import.meta.url).search, import.meta.url).href;
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-assistant]');
  if (!a) return;
  e.preventDefault();
  const m = await import(assistantUrl);
  m.open({ finish: a.dataset.assistantFinish || undefined, from: a });
});
$$('.as-launch').forEach((b) => { b.hidden = false; });
(window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(() => {
  const l = document.createElement('link');
  l.rel = 'modulepreload';
  l.href = assistantUrl;
  document.head.append(l);
});

// ---------- finish configurator ----------
const cf = $('[data-configurator]');
if (cf) {
  const sw = $$('.cf-swatch', cf);
  const imgs = $$('[data-finish-img]', cf);
  const tag = $('[data-cf-tag]', cf);
  const note = $('[data-cf-note]', cf);
  const cta = $('[data-cf-cta]', cf);
  const select = (b, focus) => {
    sw.forEach((x) => { const on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
    imgs.forEach((p) => p.classList.toggle('on', p.dataset.finishImg === b.dataset.finish));
    tag.textContent = b.dataset.name;
    note.textContent = b.dataset.note;
    cta.dataset.assistantFinish = b.dataset.finish === 'raw' ? '' : b.dataset.name;
    if (focus) b.focus();
  };
  sw.forEach((b, i) => {
    b.addEventListener('click', () => select(b));
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      select(sw[(i + d + sw.length) % sw.length], true);
    });
  });
  select(sw.find((b) => b.getAttribute('aria-checked') === 'true') || sw[0]);

  // Subtle 3D tilt that follows the pointer (desktop only).
  const stage = $('[data-cf-stage]', cf);
  const tilt = $('[data-cf-tilt]', cf);
  if (finePointer && !reduced && stage && tilt) {
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = `rotateY(${(x * 14).toFixed(2)}deg) rotateX(${(-y * 10).toFixed(2)}deg)`;
      stage.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
      stage.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    });
    stage.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
  }
}

// ---------- premium motion: GSAP + ScrollTrigger + Lenis (skipped for reduced motion) ----------
const G = window.gsap;
const ST = window.ScrollTrigger;
if (G && ST && !reduced) {
  G.registerPlugin(ST);
  const html = document.documentElement;

  // Smooth scrolling on mouse/trackpad devices; touch keeps native scrolling.
  if (window.Lenis && finePointer) {
    const lenis = new window.Lenis({ lerp: 0.1 });
    lenis.on('scroll', ST.update);
    G.ticker.add((time) => lenis.raf(time * 1000));
    G.ticker.lagSmoothing(0);
    if (html.classList.contains('intro')) {
      lenis.stop();
      const go = () => lenis.start();
      document.addEventListener('rj:intro-done', go, { once: true });
      setTimeout(go, 6000);
    }
    const stopWhen = new MutationObserver(() => {
      const locked = html.classList.contains('as-lock') || document.body.classList.contains('menu-open') || $('[data-lightbox]')?.open;
      if (locked) lenis.stop(); else lenis.start();
    });
    stopWhen.observe(html, { attributes: true, attributeFilter: ['class'] });
    stopWhen.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      const id = a?.getAttribute('href');
      if (!id || id === '#' || id === '#main') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -90 });
    });
  }

  // Red hairline that tracks reading progress.
  G.to('[data-progress]', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // Hero: copy drifts up and the film pushes in as you leave it.
  const heroEl = $('.hero');
  if (heroEl) {
    const st = { trigger: heroEl, start: 'top top', end: 'bottom top', scrub: true };
    G.to('.hero-copy', { yPercent: -14, autoAlpha: 0.2, ease: 'none', scrollTrigger: st });
    G.to('.hero-media', { scale: 1.08, ease: 'none', scrollTrigger: { ...st } });
  }

  // Images open like a shutter as they enter.
  G.utils.toArray('.reveal-media').forEach((el) => {
    const trig = { trigger: el, start: 'top 85%' };
    G.fromTo(el, { clipPath: 'inset(14% 10% 14% 10%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'power3.out', scrollTrigger: trig });
    const img = el.querySelector('img');
    if (img) G.fromTo(img, { scale: 1.2 }, { scale: 1, duration: 1.8, ease: 'power3.out', scrollTrigger: trig });
  });

  // Service band leans with scroll speed.
  const band = $('.marquee');
  if (band) {
    const skew = G.quickTo(band, 'skewX', { duration: 0.5, ease: 'power3' });
    ST.create({ onUpdate: (s) => skew(G.utils.clamp(-6, 6, s.getVelocity() / -400)) });
  }

  // Configurator wheel floats in.
  if (cf) G.from('[data-cf-stage]', { yPercent: 8, autoAlpha: 0, duration: 1.4, ease: 'power3.out', scrollTrigger: { trigger: cf, start: 'top 75%' } });

  // Method: pinned on desktop; steps light up one by one as you scroll.
  const method = $('[data-method]');
  if (method && matchMedia('(min-width: 900px)').matches) {
    const steps = $$('.method-steps > li:not(.method-rail)', method);
    const fill = $('[data-method-fill]', method);
    method.classList.add('is-pinned');
    ST.create({
      trigger: $('.method-grid', method),
      start: 'top 16%',
      end: () => '+=' + Math.round(innerHeight * 1.2),
      pin: true,
      scrub: true,
      onUpdate: (s) => {
        const i = Math.min(steps.length - 1, Math.floor(s.progress * steps.length));
        steps.forEach((li, k) => li.classList.toggle('is-active', k === i));
        if (fill) fill.style.transform = `scaleY(${s.progress.toFixed(3)})`;
      },
    });
    steps[0]?.classList.add('is-active');
  }

  // Magnetic primary buttons.
  if (finePointer) {
    $$('.magnetic').forEach((b) => {
      const xTo = G.quickTo(b, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = G.quickTo(b, 'y', { duration: 0.6, ease: 'power3' });
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.22);
        yTo((e.clientY - r.top - r.height / 2) * 0.3);
      });
      b.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  addEventListener('load', () => ST.refresh());
  document.fonts?.ready.then(() => ST.refresh());
}
