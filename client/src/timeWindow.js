// [WS3: client-ui] Time-of-day windows: presets, building the timeWindows
// payload, matching, and formatting.
//
// A window is { start?, end? } of 'HH:MM' 24h strings; an absent side is
// unbounded. start > end means an overnight wrap. A subscription carries an
// optional array of windows (max 6) matched ANY; omitted/empty = any time
// (docs/architecture.md §Internal REST contract).

export const PRESETS = [
  { key: 'morning', label: 'Morning', window: { end: '12:00' } },
  { key: 'afternoon', label: 'Afternoon', window: { start: '12:00', end: '17:00' } },
  { key: 'evening', label: 'Evening', window: { start: '17:00', end: '21:00' } },
  { key: 'late', label: 'Late night', window: { start: '21:00', end: '02:00' } },
];

/**
 * Selection state ({ presets: string[], custom: null | { start, end } }) →
 * timeWindows payload: every toggled preset plus the custom window when it
 * has at least one bound, deduped. An empty result means "any time" and the
 * field is omitted from the POST entirely.
 */
export function buildWindows({ presets, custom }) {
  const windows = [];
  for (const p of PRESETS) {
    if (presets.includes(p.key)) windows.push(p.window);
  }
  if (custom && (custom.start || custom.end)) {
    const w = {};
    if (custom.start) w.start = custom.start;
    if (custom.end) w.end = custom.end;
    windows.push(w);
  }
  const seen = new Set();
  return windows.filter((w) => {
    const key = `${w.start || ''}|${w.end || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** '17:00' → '5:00 p.m.' */
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'a.m.' : 'p.m.';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Is an 'HH:MM' time inside one window? Absent bounds are unbounded;
 * start > end wraps overnight (t >= start || t <= end).
 */
export function isInWindow(hhmm, { start, end }) {
  if (!start && !end) return true;
  if (start && !end) return hhmm >= start;
  if (!start && end) return hhmm <= end;
  return start <= end
    ? hhmm >= start && hhmm <= end
    : hhmm >= start || hhmm <= end;
}

/** Does the time fall in ANY window? An empty list means no restriction. */
export function matchesAny(hhmm, windows) {
  if (windows.length === 0) return true;
  return windows.some((w) => isInWindow(hhmm, w));
}

/** One window, e.g. "5:00 p.m. – 9:00 p.m." */
export function formatWindow({ start, end }) {
  if (!start && !end) return 'Any time';
  if (start && !end) return `After ${formatTime(start)}`;
  if (!start && end) return `Before ${formatTime(end)}`;
  const wrap = start > end ? ' (overnight)' : '';
  return `${formatTime(start)} – ${formatTime(end)}${wrap}`;
}

/**
 * A whole selection, e.g. "12:00 p.m. – 5:00 p.m., or 9:00 p.m. – 2:00 a.m.
 * (overnight)"; "Any time" when the list is empty.
 */
export function formatWindows(windows) {
  if (windows.length === 0) return 'Any time';
  return windows.map(formatWindow).join(', or ');
}
