// RJ Welding & Wheels logo, rebuilt as SVG from the client's mark
// (research/logo-client.jpg) so it stays sharp and can be animated.
// Colours sampled from the original: red #FB0102, grey #E1E1E1, black.
// Text uses textLength so the lockup keeps its proportions even before the
// webfont loads. Replace with the owner's vector file when available.

const RED = '#fb0102';
const GREY = '#e1e1e1';
const INK = '#010101';

const rad = (d) => (d * Math.PI) / 180;
const pt = (cx, cy, r, a) => `${(cx + Math.cos(rad(a)) * r).toFixed(1)} ${(cy + Math.sin(rad(a)) * r).toFixed(1)}`;

// Wheel: outer rim, a grey face with six dark windows (leaving six thick
// spokes, like the original), and a hub.
function wheel(cx = 96, cy = 124) {
  const windows = Array.from({ length: 6 }, (_, i) => {
    const a = i * 60, h = 23, r1 = 33, r2 = 79;
    return `<path class="lg-win" style="--i:${i}" d="M${pt(cx, cy, r1, a - h + 6)} L${pt(cx, cy, r2, a - h)} A${r2} ${r2} 0 0 1 ${pt(cx, cy, r2, a + h)} L${pt(cx, cy, r1, a + h - 6)} Z"/>`;
  }).join('');
  return `<g class="lg-wheel" style="transform-origin:${cx}px ${cy}px">
    <circle class="lg-rim" cx="${cx}" cy="${cy}" r="95" fill="none" stroke="${GREY}" stroke-width="7" pathLength="1"/>
    <circle class="lg-face" cx="${cx}" cy="${cy}" r="83" fill="${GREY}"/>
    <g class="lg-windows" fill="${INK}">${windows}</g>
    <circle class="lg-hub" cx="${cx}" cy="${cy}" r="25" fill="${INK}" stroke="${GREY}" stroke-width="3"/>
    <circle class="lg-cap" cx="${cx}" cy="${cy}" r="9" fill="${GREY}"/>
  </g>`;
}

// The plaque has a slanted left edge, as in the original.
const PLAQUE = 'M152 22 H380 Q392 22 392 34 V214 Q392 226 380 226 H137 Q124 226 126 213 L140 34 Q141 22 152 22 Z';

export function rjLogo({ cls = '', title = 'RJ Welding & Wheels', decorative = false } = {}) {
  const a11y = decorative ? 'aria-hidden="true" focusable="false"' : `role="img" aria-label="${title}"`;
  return `<svg class="rj-logo ${cls}" viewBox="0 0 400 248" ${a11y}>
  ${wheel()}
  <path class="lg-plaque-fill" d="${PLAQUE}" fill="${INK}"/>
  <path class="lg-plaque" d="${PLAQUE}" fill="none" stroke="${GREY}" stroke-width="4.5" stroke-linejoin="round" pathLength="1"/>
  <g font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-style="italic" font-weight="800">
    <text class="lg-rj" x="150" y="84" font-size="66" fill="${RED}" textLength="56" lengthAdjust="spacingAndGlyphs">RJ</text>
    <rect class="lg-bar" x="214" y="42" width="164" height="38" fill="${RED}"/>
    <text class="lg-t1" x="146" y="152" font-size="78" fill="${GREY}" textLength="232" lengthAdjust="spacingAndGlyphs">WELDING</text>
    <text class="lg-t2" x="136" y="214" font-size="78" fill="${GREY}" textLength="242" lengthAdjust="spacingAndGlyphs">&amp; WHEELS</text>
  </g>
  <circle class="lg-spark" cx="378" cy="61" r="3" fill="#fff"/>
</svg>`;
}
