// [WS3: client-ui] Flying-popcorn burst for celebratory clicks (movie pick,
// subscribe). Pure DOM + CSS animation (styles.css §popcorn), no deps.
// Renders 🍿 glyphs on a fixed, pointer-transparent overlay so there is no
// layout shift, and removes the overlay when the animation ends. Fire-and-
// forget: callers never wait on it, so the real action (step change, POST)
// proceeds immediately. Skipped entirely under prefers-reduced-motion.

const KERNELS = 9;
const LIFETIME_MS = 950; // animation is 750ms + max 120ms stagger, plus slack

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
    k.textContent = '🍿';
    // Fan upward (-160°..-20°) with a little jitter, varied throw distance.
    const deg = -160 + (140 * i) / (KERNELS - 1) + (Math.random() * 16 - 8);
    const rad = (deg * Math.PI) / 180;
    const dist = 55 + Math.random() * 85;
    k.style.left = `${x}px`;
    k.style.top = `${y}px`;
    k.style.fontSize = `${12 + Math.random() * 10}px`;
    k.style.animationDelay = `${Math.random() * 120}ms`;
    k.style.setProperty('--dx', `${Math.cos(rad) * dist}px`);
    k.style.setProperty('--dy', `${Math.sin(rad) * dist}px`);
    k.style.setProperty('--rot', `${Math.random() * 240 - 120}deg`);
    layer.appendChild(k);
  }

  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), LIFETIME_MS);
}
