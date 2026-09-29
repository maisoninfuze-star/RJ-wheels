// Static site generator: renders FR + EN pages from src/content.mjs into dist/.
// Usage: node build.mjs
import { mkdir, writeFile, cp, rm, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { business as B, projects, routes, t } from './src/content.mjs';
import { rjLogo } from './src/logo.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'dist');
const images = JSON.parse(await readFile(join(ROOT, 'src/images.json'), 'utf8'));
const VERSION = Date.now().toString(36);

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Keep model names like "650i" from being uppercased by display type.
const caseSafe = (s) => esc(s).replace(/\b(\d+[a-z]+)\b/g, '<span class="nocase">$1</span>');
const abs = (p) => B.siteUrl + p;
const ig = (handle) => `https://www.instagram.com/${handle}/`;

// ---------- shared fragments ----------

function picture(slug, { sizes = '100vw', cls = '', alt = '', eager = false, attrs = '' } = {}) {
  const im = images[slug];
  const set = (ext) => im.widths.map((w) => `/assets/img/work/${slug}-${w}.${ext} ${w}w`).join(', ');
  const fallback = `/assets/img/work/${slug}-${im.widths.at(-1)}.jpg`;
  return `<picture class="${cls}">
    <source type="image/avif" srcset="${set('avif')}" sizes="${sizes}">
    <source type="image/webp" srcset="${set('webp')}" sizes="${sizes}">
    <img src="${fallback}" srcset="${set('jpg')}" sizes="${sizes}" width="${im.w}" height="${im.h}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" ${attrs}>
  </picture>`;
}

// Original technical wheel drawing (brand graphic, not a photo of work).
function wheelDrawing(cls = '') {
  const spokes = Array.from({ length: 10 }, (_, i) => {
    const a = (i * 36 * Math.PI) / 180;
    const x1 = (200 + Math.cos(a) * 58).toFixed(1), y1 = (200 + Math.sin(a) * 58).toFixed(1);
    const x2 = (200 + Math.cos(a) * 150).toFixed(1), y2 = (200 + Math.sin(a) * 150).toFixed(1);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i * 5 * Math.PI) / 180, r2 = i % 6 === 0 ? 186 : 191;
    return `<line x1="${(200 + Math.cos(a) * 196).toFixed(1)}" y1="${(200 + Math.sin(a) * 196).toFixed(1)}" x2="${(200 + Math.cos(a) * r2).toFixed(1)}" y2="${(200 + Math.sin(a) * r2).toFixed(1)}"/>`;
  }).join('');
  const lugs = Array.from({ length: 5 }, (_, i) => {
    const a = ((i * 72 - 90) * Math.PI) / 180;
    return `<circle cx="${(200 + Math.cos(a) * 34).toFixed(1)}" cy="${(200 + Math.sin(a) * 34).toFixed(1)}" r="5"/>`;
  }).join('');
  return `<svg class="wheel-drawing ${cls}" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
    <g class="wd-ticks">${ticks}</g>
    <circle class="wd-rim" cx="200" cy="200" r="176"/>
    <circle class="wd-rim wd-thin" cx="200" cy="200" r="164"/>
    <circle class="wd-rim wd-thin" cx="200" cy="200" r="150"/>
    <g class="wd-spokes">${spokes}</g>
    <circle class="wd-rim" cx="200" cy="200" r="58"/>
    <circle class="wd-rim wd-thin" cx="200" cy="200" r="18"/>
    <g class="wd-lugs">${lugs}</g>
    <path class="wd-dim" d="M24 200H4M396 200h-20M200 24V4"/>
  </svg>`;
}

const logo = (lang) => `<a class="brand" href="${routes.home[lang]}" aria-label="RJ Welding & Wheels — ${t[lang].nav.home}">
  ${rjLogo({ decorative: true, cls: 'brand-logo' })}
</a>`;

function hoursList(lang, cls = 'hours') {
  const L = t[lang];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const fmt = (h) => (lang === 'fr' ? h.replace(':', ' h ').replace(' h 00', ' h') : h);
  return `<dl class="${cls}" data-hours>
    ${order.map((d) => { const h = B.hours.find((x) => x.day === d); return `<div data-day="${d}"><dt>${L.days[d]}</dt><dd>${h.closed ? L.closed : `${fmt(h.open)} – ${fmt(h.close)}`}</dd></div>`; }).join('')}
  </dl>
  <p class="fine">${L.hoursNote}</p>`;
}

const addressLines = (lang) => `${lang === 'fr' ? B.address.street : B.address.streetEn}<br>${B.address.city} (${B.address.region}) ${B.address.postal}`;

const arrow = '<svg class="i-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const ext = '<svg class="i-ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';
const waI = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8Z"/><path d="M9 8.5c0 3 2.5 6.5 6.5 6.5l1-1.5-2-1-1 .8a4.6 4.6 0 0 1-2.8-2.8l.8-1-1-2Z"/></svg>';
const cameraI = '<svg class="i i-cam" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const phoneI = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3h3l1.5 4.5-2.2 1.4a11 11 0 0 0 6.2 6.2l1.4-2.2L21 14.4v3A2.6 2.6 0 0 1 18.4 20 15.4 15.4 0 0 1 4 5.6 2.6 2.6 0 0 1 6.6 3Z"/></svg>';

function header(lang, key) {
  const L = t[lang];
  const links = ['services', 'work', 'contact'].map((k) => `<a href="${routes[k][lang]}"${k === key ? ' aria-current="page"' : ''}>${L.nav[k]}</a>`).join('');
  return `<a class="skip" href="#main">${L.skip}</a>
<header class="site-header" data-header>
  ${logo(lang)}
  <nav class="nav" aria-label="${lang === 'fr' ? 'Principale' : 'Main'}">${links}</nav>
  <div class="header-actions">
    <a class="lang" href="${routes[key][L.other]}" hreflang="${t[L.other].lang}" lang="${t[L.other].lang}" aria-label="${L.otherName}"><span aria-hidden="true">${lang.toUpperCase()}</span><i aria-hidden="true">/</i><span aria-hidden="true" class="lang-other">${L.otherLabel}</span></a>
    <a class="btn btn-ghost btn-sm header-call" href="${B.phoneHref}">${phoneI}<span>${B.phone}</span></a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu" data-menu-btn><span class="sr">${L.menu}</span><i></i><i></i></button>
  </div>
</header>
<div class="menu" id="menu" data-menu hidden>
  <nav class="menu-nav" aria-label="${L.menu}">
    ${['home', 'services', 'work', 'contact'].map((k, i) => `<a href="${routes[k][lang]}" style="--i:${i}"${k === key ? ' aria-current="page"' : ''}><small>0${i + 1}</small>${L.nav[k]}</a>`).join('')}
  </nav>
  <div class="menu-foot">
    <a href="${B.phoneHref}">${B.phone}</a>
    <a href="${routes[key][L.other]}" hreflang="${t[L.other].lang}">${L.otherName}</a>
    <a href="${B.instagramUrl}" rel="noopener" target="_blank">@${B.instagram}</a>
  </div>
</div>`;
}

function footer(lang) {
  const L = t[lang];
  return `<footer class="site-footer">
  <div class="wrap footer-top">
    <div class="finale reveal" aria-hidden="true">${rjLogo({ decorative: true, cls: 'build' })}</div>
  </div>
  <div class="wrap footer-grid">
    <div><h2 class="kicker">${L.footer.visit}</h2><p>${addressLines(lang)}</p><p><a class="link" href="${B.mapsUrl}" target="_blank" rel="noopener">${L.cta.directions} ${ext}</a></p></div>
    <div><h2 class="kicker">${L.footer.talk}</h2><p><a class="link" href="${B.phoneHref}">${B.phone}</a></p><p><a class="link" href="${routes.contact[lang]}">${L.cta.quote}</a></p></div>
    <div><h2 class="kicker">${L.footer.hours}</h2>${hoursList(lang, 'hours hours-compact')}</div>
    <div><h2 class="kicker">${L.footer.follow}</h2><p><a class="link" href="${B.instagramUrl}" target="_blank" rel="noopener">Instagram @${B.instagram} ${ext}</a></p><p><a class="link" href="${B.mapsUrl}" target="_blank" rel="noopener">${L.rating(B.rating)} ${ext}</a><br><span class="fine">${L.ratingSeen}</span></p></div>
  </div>
  <div class="wrap footer-base">
    <p>© <span data-year>2026</span> ${B.name}. ${L.footer.rights}</p>
    <p>${L.footer.photos}</p>
    <p><a href="${routes.home[L.other]}" hreflang="${t[L.other].lang}">${L.otherName}</a></p>
  </div>
</footer>
<div class="action-bar" data-action-bar>
  <a class="btn btn-ghost" href="${B.phoneHref}">${phoneI}<span>${L.cta.call}</span></a>
  <a class="btn btn-red" href="${routes.contact[lang]}"><span>${L.cta.quoteShort}</span>${arrow}</a>
</div>`;
}

function jsonLd(lang) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    '@id': B.siteUrl + '/#business',
    name: B.name,
    url: abs(routes.home[lang]),
    telephone: '+1-514-466-9693',
    image: abs('/assets/img/og.jpg'),
    address: { '@type': 'PostalAddress', streetAddress: B.address.streetEn, addressLocality: B.address.city, addressRegion: B.address.region, postalCode: B.address.postal, addressCountry: B.address.country },
    geo: { '@type': 'GeoCoordinates', latitude: 45.4936602, longitude: -73.7465089 },
    hasMap: B.mapsUrl,
    sameAs: [B.instagramUrl],
    areaServed: 'Montréal',
    knowsLanguage: ['fr', 'en'],
    openingHoursSpecification: B.hours.filter((h) => !h.closed).map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: dayNames[h.day], opens: h.open, closes: h.close })),
    makesOffer: t[lang].services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name } })),
  };
}

// Opening splash: the logo assembles (see .splash in main.css). Ships in the
// HTML so it owns the first paint; the timeline starts once the logo font is
// ready (capped at 700 ms) so the lettering never animates in a fallback face.
function splash() {
  return `<div class="splash" id="splash" aria-hidden="true">
  <div class="splash-logo">${rjLogo({ decorative: true, cls: 'build' })}</div>
</div>
<script>
(function () {
  var el = document.getElementById('splash'), go = function () { el.classList.add('go'); };
  if (!document.documentElement.classList.contains('intro')) return;
  setTimeout(go, 700);
  if (document.fonts && document.fonts.load) document.fonts.load('italic 800 64px "Barlow Condensed"').then(go, go);
})();
</script>`;
}

function layout({ lang, key, title, desc, body, bodyClass = '' }) {
  const L = t[lang];
  const path = routes[key]?.[lang] ?? '/404.html';
  const alt = routes[key]?.[L.other];
  return `<!doctype html>
<html lang="${L.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0b0b0c">
<meta name="color-scheme" content="dark">
${key ? `<link rel="canonical" href="${abs(path)}">
<link rel="alternate" hreflang="${L.lang}" href="${abs(path)}">
<link rel="alternate" hreflang="${t[L.other].lang}" href="${abs(alt)}">
<link rel="alternate" hreflang="x-default" href="${abs(routes[key].fr)}">` : '<meta name="robots" content="noindex">'}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${B.name}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(path)}">
<meta property="og:image" content="${abs('/assets/img/og.jpg')}">
<meta property="og:locale" content="${L.ogLocale}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
${key === 'home' ? `<link rel="preload" as="image" href="/assets/video/cabine-poster-1920.jpg" media="(min-aspect-ratio: 1001/1000)" fetchpriority="high">
<link rel="preload" as="image" href="/assets/video/cabine-poster-portrait.jpg" media="(max-aspect-ratio: 1/1)" fetchpriority="high">
` : ''}<link rel="preload" href="/assets/fonts/barlowcondensed-800-italic-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/barlowcondensed-600-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/fonts.css?v=${VERSION}">
<link rel="stylesheet" href="/assets/css/main.css?v=${VERSION}">
<script>
document.documentElement.classList.add('js');
${key === 'home' ? `/* Opening logo build: once per session, never for reduced motion.
   #intro replays it, #introhold freezes it for review. Runs before first paint. */
try {
  var replay = /^#intro(hold)?$/.test(location.hash);
  if (replay || !(sessionStorage.getItem('rjIntro') || matchMedia('(prefers-reduced-motion: reduce)').matches)) document.documentElement.classList.add('intro');
} catch (e) {}` : ''}
</script>
<script type="module" src="/assets/js/main.js?v=${VERSION}"></script>
<script type="application/ld+json">${JSON.stringify(jsonLd(lang))}</script>
</head>
<body class="${bodyClass}">
${key === 'home' ? splash() : ''}
${header(lang, key ?? 'home')}
<main id="main">
${body}
</main>
${footer(lang)}
</body>
</html>
`;
}

// ---------- pages ----------

function ctaBand(lang) {
  const L = t[lang];
  return `<section class="cta-band" aria-labelledby="cta-${lang}">
  <div class="wrap cta-inner">
    ${wheelDrawing('cta-wheel')}
    <p class="kicker reveal">${L.footer.talk}</p>
    <h2 id="cta-${lang}" class="display cta-title reveal"><span>${L.home.ctaTitle[0]}</span><span>${L.home.ctaTitle[1]}</span></h2>
    <p class="cta-text reveal">${L.home.ctaText}</p>
    <div class="cta-actions reveal">
      <a class="btn btn-red btn-lg" href="${routes.contact[lang]}"><span>${L.cta.quote}</span>${arrow}</a>
      <a class="btn btn-ghost btn-lg" href="${B.phoneHref}">${phoneI}<span>${B.phone}</span></a>
    </div>
  </div>
</section>`;
}

function workCard(p, lang, { sizes = '(min-width: 900px) 33vw, 80vw', i = 0 } = {}) {
  const c = p[lang];
  return `<article class="work-card reveal" data-tags="${p.tags.join(' ')}" style="--d:${(i % 3) * 80}ms">
  <button class="work-open" type="button" data-work="${p.slug}" aria-label="${esc(c.title)} — ${esc(c.service)}">
    ${picture(p.img, { sizes, alt: c.alt, cls: 'work-img' })}
  </button>
  <div class="work-meta">
    <h3>${caseSafe(c.title)}</h3>
    <p>${esc(c.service)}</p>
  </div>
</article>`;
}

function workDialog(lang) {
  const L = t[lang];
  const data = projects.map((p) => ({ slug: p.slug, img: p.img, post: p.post, date: p.date, ...p[lang], widths: images[p.img].widths, w: images[p.img].w, h: images[p.img].h }));
  return `<dialog class="lightbox" data-lightbox aria-labelledby="lb-title">
  <div class="lb-inner">
    <figure class="lb-figure"><img alt="" data-lb-img></figure>
    <div class="lb-info">
      <p class="kicker" data-lb-service></p>
      <h2 id="lb-title" class="display" data-lb-title></h2>
      <p class="lb-caption" data-lb-caption></p>
      <p class="fine" data-lb-date></p>
      <a class="link" data-lb-post target="_blank" rel="noopener">${L.cta.viewPost} ${ext}</a>
      <div class="lb-nav">
        <button type="button" class="btn btn-ghost btn-sm" data-lb-prev aria-label="${lang === 'fr' ? 'Précédente' : 'Previous'}">←</button>
        <button type="button" class="btn btn-ghost btn-sm" data-lb-next aria-label="${lang === 'fr' ? 'Suivante' : 'Next'}">→</button>
      </div>
    </div>
    <button class="lb-close" type="button" data-lb-close><span class="sr">${L.close}</span><i></i><i></i></button>
  </div>
  <script type="application/json" data-lb-data>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</dialog>`;
}

function home(lang) {
  const L = t[lang], H = L.home;
  const feature = projects.find((p) => p.slug === 'bmw-650i');
  const body = `
<section class="hero" aria-labelledby="h1">
  <div class="hero-media">
    <video class="hero-video" data-hero-video autoplay muted loop playsinline preload="auto" disablepictureinpicture aria-hidden="true"
      data-poster="/assets/video/cabine-poster-1920.jpg" data-poster-portrait="/assets/video/cabine-poster-portrait.jpg">
      <source src="/assets/video/cabine-portrait.mp4" type="video/mp4" media="(max-aspect-ratio: 1/1)">
      <source src="/assets/video/cabine-1920.mp4" type="video/mp4">
    </video>
    <script>(function(v){if(v)v.poster=matchMedia('(max-aspect-ratio: 1/1)').matches?v.dataset.posterPortrait:v.dataset.poster;})(document.currentScript.previousElementSibling)</script>
  </div>
  <button class="hero-toggle" type="button" data-hero-toggle data-state="paused" hidden
    data-label-pause="${lang === 'fr' ? 'Mettre la vidéo en pause' : 'Pause the video'}"
    data-label-play="${lang === 'fr' ? 'Lire la vidéo' : 'Play the video'}"
    aria-label="${lang === 'fr' ? 'Lire la vidéo' : 'Play the video'}">
    <svg class="ht-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>
    <svg class="ht-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5Z"/></svg>
  </button>
  <div class="wrap hero-copy">
    <p class="eyebrow hero-in" style="--d:100ms">${H.eyebrow}</p>
    <h1 id="h1" class="display hero-title">${H.h1.map((w, i) => `<span class="hero-line" style="--d:${200 + i * 110}ms"><span>${w}</span></span>`).join('')}</h1>
    <p class="lead hero-in" style="--d:560ms">${H.lead}</p>
    <div class="hero-actions hero-in" style="--d:660ms">
      <a class="btn btn-red btn-lg" href="${routes.contact[lang]}"><span>${L.cta.quote}</span>${arrow}</a>
      <a class="btn btn-ghost btn-lg" href="${B.phoneHref}">${phoneI}<span>${B.phone}</span></a>
    </div>
  </div>
  <div class="wrap hero-foot hero-in" style="--d:800ms">
    <a class="rating" href="${B.mapsUrl}" target="_blank" rel="noopener"><span class="stars" aria-hidden="true">★★★★★</span>${L.rating(B.rating)}<small>${L.ratingSeen}</small></a>
    <p>${L.tagline}</p>
    <span class="scroll-cue" aria-hidden="true"></span>
  </div>
</section>

<section class="statement" aria-label="${lang === 'fr' ? 'Notre approche' : 'Our approach'}">
  <div class="wrap">
    <p class="statement-text" data-words>${H.statement}</p>
  </div>
</section>

<section class="services" aria-labelledby="services-title">
  <div class="wrap">
    <div class="section-head">
      <p class="kicker reveal">${H.servicesKicker}</p>
      <h2 id="services-title" class="display section-title reveal">${H.servicesTitle}</h2>
    </div>
    <ol class="service-list" data-service-list>
      ${L.services.map((s, i) => `<li class="service-row reveal" style="--d:${i * 60}ms">
        <a href="${routes.services[lang]}#${s.id}" data-img="${s.img ?? ''}">
          <span class="service-n">${s.n}</span>
          <span class="service-name">${s.name}</span>
          <span class="service-short">${s.short}</span>
          <span class="service-go">${arrow}</span>
        </a>
      </li>`).join('')}
    </ol>
  </div>
  <div class="service-peek" aria-hidden="true" data-service-peek>
    ${['lip', 'black-spoke', 'booth'].map((s) => picture(s, { sizes: '28vw', cls: 'peek-img', attrs: `data-peek="${s}"` })).join('')}
    ${wheelDrawing('peek-wheel')}
  </div>
</section>

<section class="feature" aria-labelledby="feature-title">
  <div class="feature-media">
    ${picture('bmw-650i', { sizes: '(min-width: 900px) 50vw, 100vw', alt: feature[lang].alt, cls: 'feature-img', attrs: 'data-parallax' })}
  </div>
  <div class="feature-copy">
    <p class="kicker reveal">${H.featureKicker} · 2025</p>
    <h2 id="feature-title" class="display feature-title reveal">BMW<br><span class="nocase">650i</span></h2>
    <p class="feature-service reveal">${feature[lang].service}</p>
    <p class="feature-note reveal">${H.featureNote}</p>
    <a class="link reveal" href="${feature.post}" target="_blank" rel="noopener">${L.cta.ig} ${ext}</a>
  </div>
</section>

<section class="method" aria-labelledby="method-title">
  <div class="wrap">
    <div class="section-head">
      <p class="kicker reveal">${H.methodKicker}</p>
      <h2 id="method-title" class="display section-title reveal">${H.methodTitle}</h2>
    </div>
    <div class="method-grid">
      <figure class="method-media reveal">
        ${picture('booth', { sizes: '(min-width: 900px) 34vw, 100vw', alt: projects.find((p) => p.slug === 'booth')[lang].alt })}
        <figcaption>${projects.find((p) => p.slug === 'booth')[lang].caption}</figcaption>
      </figure>
      <ol class="method-steps">
        ${H.method.map((m, i) => `<li class="reveal" style="--d:${i * 80}ms"><span class="step-n">${m.n}</span><h3>${m.t}</h3><p>${m.d}</p></li>`).join('')}
      </ol>
    </div>
  </div>
</section>

<section class="work-rail" aria-labelledby="work-title">
  <div class="wrap section-head section-head-row">
    <div>
      <p class="kicker reveal">${H.workKicker}</p>
      <h2 id="work-title" class="display section-title reveal">${H.workTitle}</h2>
      <p class="fine reveal">${H.workNote}</p>
    </div>
    <a class="btn btn-ghost reveal" href="${routes.work[lang]}"><span>${L.cta.allWork}</span>${arrow}</a>
  </div>
  <div class="rail" data-rail tabindex="0" aria-label="${H.workTitle}">
    ${projects.filter((p) => p.slug !== 'bmw-650i').slice(0, 6).map((p, i) => workCard(p, lang, { sizes: '(min-width: 900px) 28vw, 78vw', i })).join('')}
  </div>
</section>

${ctaBand(lang)}
${workDialog(lang)}`;
  return layout({ lang, key: 'home', title: H.title, desc: H.desc, body, bodyClass: 'page-home' });
}

function pageHead(lang, P, extra = '') {
  return `<section class="page-head">
  ${wheelDrawing('page-wheel')}
  <div class="wrap">
    <p class="eyebrow hero-in" style="--d:80ms">${P.kicker}</p>
    <h1 class="display page-title">${P.h1.map((w, i) => `<span class="hero-line" style="--d:${160 + i * 110}ms"><span>${w}</span></span>`).join('')}</h1>
    <p class="lead hero-in" style="--d:420ms">${P.lead}</p>
    ${extra}
  </div>
</section>`;
}

function servicesPage(lang) {
  const L = t[lang], P = L.servicesPage;
  const body = `${pageHead(lang, P)}
<nav class="wrap service-index hero-in" style="--d:520ms" aria-label="${P.kicker}">
  ${L.services.map((s) => `<a href="#${s.id}"><span>${s.n}</span>${s.name}</a>`).join('')}
</nav>
<div class="service-blocks">
  ${L.services.map((s, i) => `<section class="service-block${i % 2 ? ' flip' : ''}" id="${s.id}" aria-labelledby="${s.id}-t">
    <div class="sb-media reveal">
      ${s.img ? picture(s.img, { sizes: '(min-width: 900px) 45vw, 100vw', alt: projects.find((p) => p.img === s.img)[lang].alt }) : `<div class="sb-drawing">${wheelDrawing()}</div>`}
    </div>
    <div class="sb-copy">
      <span class="sb-n reveal">${s.n}</span>
      <h2 id="${s.id}-t" class="display sb-title reveal">${s.name}</h2>
      <p class="sb-short reveal">${s.short}</p>
      <p class="reveal">${s.long}</p>
      <a class="link reveal" href="${routes.contact[lang]}?service=${s.id}">${L.cta.quote} ${arrow}</a>
    </div>
  </section>`).join('')}
</div>
<section class="faq wrap" aria-labelledby="faq-title">
  <h2 id="faq-title" class="display section-title reveal">${P.faqTitle}</h2>
  <div class="faq-list">
    ${P.faq.map((f) => `<details class="reveal"><summary><span>${f.q}</span><i aria-hidden="true"></i></summary><p>${f.a}</p></details>`).join('')}
  </div>
</section>
${ctaBand(lang)}`;
  return layout({ lang, key: 'services', title: P.title, desc: P.desc, body, bodyClass: 'page-services' });
}

function workPage(lang) {
  const L = t[lang], P = L.workPage;
  const filters = `<div class="filters hero-in" style="--d:520ms" role="group" aria-label="Filtres">
    ${Object.entries(P.filters).map(([k, v], i) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${i === 0}">${v}</button>`).join('')}
  </div>`;
  const body = `${pageHead(lang, P, filters)}
<section class="wrap work-grid" data-work-grid aria-label="${P.kicker}">
  ${projects.map((p, i) => workCard(p, lang, { i })).join('')}
</section>
<div class="wrap work-more">
  <a class="btn btn-ghost btn-lg" href="${B.instagramUrl}" target="_blank" rel="noopener"><span>${P.more}</span>${ext}</a>
</div>
${ctaBand(lang)}
${workDialog(lang)}`;
  return layout({ lang, key: 'work', title: P.title, desc: P.desc, body, bodyClass: 'page-work' });
}

function contactPage(lang) {
  const L = t[lang], P = L.contactPage, F = P.form;
  const field = (id, label, input, hint = '', optional = false) => `<div class="field">
    <label for="${id}">${label}${optional ? ` <small>(${F.optional})</small>` : ''}</label>
    ${input}
    ${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}
    <p class="err" id="${id}-err" aria-live="polite"></p>
  </div>`;
  const form = `<form class="quote-form" data-quote novalidate
      data-endpoint="${B.formEndpoint ?? ''}" data-email="${B.email ?? ''}" data-whatsapp="${B.whatsapp ?? ''}"
      data-msg-too-many="${esc(F.tooMany)}" data-msg-remove="${esc(F.removePhoto)}"
      data-msg-photos-one="${esc(F.photosCount(1))}" data-msg-photos-many="${esc(F.photosCount(2).replace('2', '{n}'))}"
      data-msg-required="${esc(F.required)}" data-msg-invalid="${esc(F.invalid)}"
      data-msg-sending="${esc(F.sending)}" data-msg-sent="${esc(F.sent)}" data-msg-error="${esc(F.error)}"
      data-msg-copied="${esc(F.copied)}" data-lang="${lang}">
    <div class="field-row">
      ${field('f-name', F.name, '<input id="f-name" name="name" autocomplete="name" required aria-describedby="f-name-err">')}
      ${field('f-phone', F.phone, '<input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required aria-describedby="f-phone-err">')}
    </div>
    ${field('f-email', F.email, '<input id="f-email" name="email" type="email" autocomplete="email" aria-describedby="f-email-err">', '', true)}
    <div class="field-row">
      ${field('f-vehicle', F.vehicle, `<input id="f-vehicle" name="vehicle" placeholder="${esc(F.vehicleHint)}" aria-describedby="f-vehicle-err">`, '', true)}
      ${field('f-service', F.service, `<select id="f-service" name="service" required aria-describedby="f-service-err"><option value="">${F.choose}</option>${L.services.map((s) => `<option value="${s.id}">${s.name}</option>`).join('')}<option value="other">${F.other}</option></select>`)}
    </div>
    <div class="field-row">
      ${field('f-count', F.count, '<select id="f-count" name="count"><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>', '', true)}
      ${field('f-size', F.size, '<input id="f-size" name="size" inputmode="numeric" placeholder="18">', '', true)}
    </div>
    ${field('f-message', F.message, `<textarea id="f-message" name="message" rows="5" required placeholder="${esc(F.messageHint)}" aria-describedby="f-message-err"></textarea>`)}
    <div class="field photos-field">
      <span class="label" id="f-photos-label">${F.photos} <small>(${F.optional})</small></span>
      <label class="dropzone" for="f-photos" data-dropzone>
        ${cameraI}
        <span><b>${F.addPhotos}</b><small>${F.takePhoto}</small></span>
        <input id="f-photos" name="photos" type="file" accept="image/*" multiple aria-labelledby="f-photos-label" aria-describedby="f-photos-hint f-photos-err">
      </label>
      <p class="hint" id="f-photos-hint">${F.photosHint}</p>
      <ul class="thumbs" data-thumbs aria-live="polite"></ul>
      <p class="err" id="f-photos-err" aria-live="polite"></p>
    </div>
    <input type="text" name="company" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn btn-red btn-lg" type="submit">${B.whatsapp ? waI : ''}<span>${B.whatsapp ? F.submit : F.readyTitle}</span>${arrow}</button>
    <p class="form-status" role="status" aria-live="polite" data-status></p>
    <div class="ready wa-steps" data-wa hidden tabindex="-1">
      <h3 class="display">${F.waTitle}</h3>
      <ol>
        <li><p>${F.waStep1}</p><a class="btn btn-ghost btn-sm" data-wa-link target="_blank" rel="noopener">${waI}<span>${F.waReopen}</span></a></li>
        <li data-wa-photos hidden>
          <p>${F.waStep2}</p>
          <button class="btn btn-red" type="button" data-wa-share hidden>${waI}<span>${F.waShare}</span></button>
          <p class="hint" data-wa-share-hint hidden>${F.waShareHint}</p>
          <p class="hint" data-wa-drag hidden>${F.waDrag}</p>
          <ul class="thumbs thumbs-drag" data-wa-thumbs></ul>
        </li>
      </ol>
      <p class="fine">${F.waNote}</p>
    </div>
    <div class="ready" data-ready hidden>
      <h3 class="display">${F.readyTitle}</h3>
      <p>${F.ready}</p>
      <pre data-ready-text></pre>
      <div class="ready-actions">
        <button class="btn btn-ghost" type="button" data-copy>${F.copy}</button>
        <a class="btn btn-red" href="${B.phoneHref}">${phoneI}<span>${B.phone}</span></a>
        <a class="btn btn-ghost" href="https://ig.me/m/${B.instagram}" target="_blank" rel="noopener"><span>Instagram</span>${ext}</a>
      </div>
    </div>
  </form>`;
  const body = `${pageHead(lang, P)}
<section class="wrap contact-grid">
  <div class="contact-form reveal">${form}</div>
  <aside class="contact-card reveal" aria-label="${L.footer.visit}">
    <a class="contact-phone" href="${B.phoneHref}"><small>${L.cta.callFull}</small><span>${B.phone}</span></a>
    <div class="cc-block"><h2 class="kicker">${L.footer.visit}</h2><address>${B.name}<br>${addressLines(lang)}</address>
      <a class="link" href="${B.mapsUrl}" target="_blank" rel="noopener">${L.cta.directions} ${ext}</a></div>
    <div class="cc-block"><h2 class="kicker">${L.footer.hours}</h2>${hoursList(lang)}</div>
    <div class="cc-block"><h2 class="kicker">Instagram</h2><a class="link" href="${B.instagramUrl}" target="_blank" rel="noopener">@${B.instagram} ${ext}</a></div>
    <div class="map" data-map data-src="${B.mapsEmbed}">
      <button class="btn btn-ghost" type="button" data-map-btn>${P.mapLabel}</button>
      <p class="fine">${P.mapNote}</p>
    </div>
  </aside>
</section>`;
  return layout({ lang, key: 'contact', title: P.title, desc: P.desc, body, bodyClass: 'page-contact' });
}

function notFound(lang) {
  const L = t[lang], N = L.notFound;
  const body = `<section class="page-head page-404">
  ${wheelDrawing('page-wheel')}
  <div class="wrap">
    <p class="eyebrow">404</p>
    <h1 class="display page-title">${N.h1.map((w, i) => `<span class="hero-line" style="--d:${120 + i * 110}ms"><span>${w}</span></span>`).join('')}</h1>
    <p class="lead">${N.text}</p>
    <p><a class="btn btn-red btn-lg" href="${routes.home[lang]}"><span>${N.back}</span>${arrow}</a></p>
  </div>
</section>`;
  return layout({ lang, key: null, title: N.title, desc: N.text, body, bodyClass: 'page-404' });
}

// ---------- write ----------

async function page(path, html) {
  const file = join(OUT, path.endsWith('.html') ? path : join(path, 'index.html'));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

await rm(OUT, { recursive: true, force: true });
await cp(join(ROOT, 'public'), OUT, { recursive: true });
for (const lang of ['fr', 'en']) {
  await page(routes.home[lang], home(lang));
  await page(routes.services[lang], servicesPage(lang));
  await page(routes.work[lang], workPage(lang));
  await page(routes.contact[lang], contactPage(lang));
}
await page('/404.html', notFound('fr'));
await page('/en/404.html', notFound('en'));

const today = new Date().toISOString().slice(0, 10);
await writeFile(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${Object.values(routes).flatMap((r) => ['fr', 'en'].map((l) => `  <url><loc>${abs(r[l])}</loc><lastmod>${today}</lastmod>
    <xhtml:link rel="alternate" hreflang="fr-CA" href="${abs(r.fr)}"/><xhtml:link rel="alternate" hreflang="en-CA" href="${abs(r.en)}"/><xhtml:link rel="alternate" hreflang="x-default" href="${abs(r.fr)}"/></url>`)).join('\n')}
</urlset>
`);
await writeFile(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
console.log('Built', OUT);
