// [WS3: client-ui] Flying-popcorn burst for celebratory clicks (movie pick,
// subscribe). Pure DOM + CSS animation (styles.css §popcorn), no deps.
// Renders small inline-SVG popped kernels on a fixed, pointer-transparent
// overlay so there is no layout shift, and removes the overlay when the
// animation ends. Fire-and-forget: callers never wait on it, so the real
// action (step change, POST) proceeds immediately. Skipped entirely under
// prefers-reduced-motion.
//
// Why drawn SVG rather than a glyph: 🍿 (U+1F37F) renders as the whole
// popcorn BOX on every major emoji font, and Unicode has no single-kernel
// codepoint; the near misses (✽ ❀ ☁ ●) read as flowers/clouds/dots and vary
// wildly across platform fonts. Inline SVG is self-contained (no external
// assets, CSP-safe), renders identically everywhere, and lets each particle
// vary in shape/size/tint so the burst doesn't look cloned.

const KERNELS = 9;
const LIFETIME_MS = 950; // animation is 750ms + max 120ms stagger, plus slack

// Puffy popped-kernel shapes: irregular 3-4 lobe blobs built from
// overlapping circles in a 24x24 viewBox — robust at 10-14px. Palette is
// cream with a butter-yellow crease shadow and an off-white highlight.
// Colors vary slightly per variant so a handful in flight reads as popcorn,
// not confetti.
const KERNEL_SVGS = [
  // 3 lobes, highlight upper-left
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g fill="#f7eed9">
      <circle cx="8.5" cy="9" r="6"/>
      <circle cx="16" cy="10" r="5.5"/>
      <circle cx="12" cy="16" r="6"/>
    </g>
    <circle cx="12.5" cy="12" r="3.2" fill="#eccf8f"/>
    <circle cx="7.5" cy="7" r="2.1" fill="#fffdf4"/>
  </svg>`,
  // 4 lobes, squarer silhouette, crease low-centre
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g fill="#f5e9cc">
      <circle cx="8" cy="8.5" r="5.2"/>
      <circle cx="16.5" cy="8" r="5"/>
      <circle cx="16" cy="16" r="5.4"/>
      <circle cx="8.5" cy="16.5" r="5"/>
    </g>
    <circle cx="12" cy="13.5" r="3" fill="#e7c67e"/>
    <circle cx="15.5" cy="6.5" r="1.9" fill="#fffcf0"/>
  </svg>`,
  // 3 lobes, lopsided with a small fourth bump, warmer tint
  `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g fill="#f8efdc">
      <circle cx="10" cy="7.5" r="5.6"/>
      <circle cx="17" cy="12.5" r="5"/>
      <circle cx="9.5" cy="15.5" r="5.8"/>
      <circle cx="15" cy="18" r="3.4"/>
    </g>
    <circle cx="13" cy="12.5" r="3" fill="#ecd096"/>
    <circle cx="8.5" cy="6" r="2" fill="#fffdf5"/>
  </svg>`,
];

/** Burst at viewport coordinates (e.g. a click point or a button's center). */
export function popcornBurst(x, y) {
  if (typeof document === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layer = document.createElement('div');
  layer.className = 'popcorn-layer';
  layer.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < KERNELS; i += 1) {
    const k = document.createElement('span');
    k.className = 'popcorn-kernel';
    k.innerHTML = KERNEL_SVGS[Math.floor(Math.random() * KERNEL_SVGS.length)];
    const svg = k.firstElementChild;
    const size = 10 + Math.random() * 4; // ~10-14px
    svg.setAttribute('width', size.toFixed(1));
    svg.setAttribute('height', size.toFixed(1));
    // Random mirror for extra shape variety (rotation comes from --rot).
    if (Math.random() < 0.5) svg.style.transform = 'scaleX(-1)';
    // Fan upward (-160°..-20°) with a little jitter, varied throw distance.
    const deg = -160 + (140 * i) / (KERNELS - 1) + (Math.random() * 16 - 8);
    const rad = (deg * Math.PI) / 180;
    const dist = 55 + Math.random() * 85;
    k.style.left = `${x}px`;
    k.style.top = `${y}px`;
    k.style.animationDelay = `${Math.random() * 120}ms`;
    k.style.setProperty('--dx', `${Math.cos(rad) * dist}px`);
    k.style.setProperty('--dy', `${Math.sin(rad) * dist}px`);
    k.style.setProperty('--rot', `${Math.random() * 240 - 120}deg`);
    layer.appendChild(k);
  }

  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), LIFETIME_MS);
}
