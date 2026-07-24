// [WS3: client-ui] Time-of-day window presets + formatting.
//
// A window is { timeStart, timeEnd } of 'HH:MM' 24h strings; either side may
// be null/'' meaning unbounded. Both unset = any time (the fields are omitted
// from the POST entirely). timeStart > timeEnd means an overnight wrap
// (docs/architecture.md §Internal REST contract).

export const PRESETS = [
  { key: 'any', label: 'Any time', timeStart: '', timeEnd: '' },
  { key: 'morning', label: 'Morning', timeStart: '', timeEnd: '12:00' },
  { key: 'afternoon', label: 'Afternoon', timeStart: '12:00', timeEnd: '17:00' },
  { key: 'evening', label: 'Evening', timeStart: '17:00', timeEnd: '21:00' },
  { key: 'late', label: 'Late night', timeStart: '21:00', timeEnd: '02:00' },
  { key: 'custom', label: 'Custom' },
];

/** '17:00' → '5:00 p.m.' */
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'a.m.' : 'p.m.';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Is an 'HH:MM' time inside the window? Empty bounds are unbounded;
 * start > end wraps overnight (t >= start || t <= end).
 */
export function isInWindow(hhmm, { timeStart, timeEnd }) {
  if (!timeStart && !timeEnd) return true;
  if (timeStart && !timeEnd) return hhmm >= timeStart;
  if (!timeStart && timeEnd) return hhmm <= timeEnd;
  return timeStart <= timeEnd
    ? hhmm >= timeStart && hhmm <= timeEnd
    : hhmm >= timeStart || hhmm <= timeEnd;
}

/** Human-readable description of a window, e.g. "5:00 p.m. – 9:00 p.m.". */
export function formatWindow({ timeStart, timeEnd }) {
  if (!timeStart && !timeEnd) return 'Any time';
  if (timeStart && !timeEnd) return `After ${formatTime(timeStart)}`;
  if (!timeStart && timeEnd) return `Before ${formatTime(timeEnd)}`;
  const wrap = timeStart > timeEnd ? ' (overnight)' : '';
  return `${formatTime(timeStart)} – ${formatTime(timeEnd)}${wrap}`;
}
