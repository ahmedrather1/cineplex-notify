// [WS3: client-ui] Date-range helpers for the subscription's optional
// dateStart/dateEnd ('YYYY-MM-DD', each independently optional, inclusive;
// docs/architecture.md §Internal REST contract).
//
// All parsing/formatting is by string manipulation or local component-wise
// Date construction — never new Date('YYYY-MM-DD'), which UTC-parses and can
// shift the displayed day in western timezones.

function toISO(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local date as 'YYYY-MM-DD' (for input min= and past checks). */
export function todayISO() {
  return toISO(new Date());
}

/** The coming Sat–Sun as { start, end } (today if today is Saturday). */
export function comingWeekend() {
  const now = new Date();
  const sat = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((6 - now.getDay()) % 7));
  const sun = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 1);
  return { start: toISO(sat), end: toISO(sun) };
}

/** Today through today+14 as { start, end }. */
export function nextTwoWeeks() {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
  return { start: toISO(now), end: toISO(end) };
}

/** '2026-08-01' → 'Aug 1' (year appended only when it isn't this year). */
export function formatDateISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const opts = { month: 'short', day: 'numeric' };
  if (y !== new Date().getFullYear()) opts.year = 'numeric';
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

/** "Aug 1 – Aug 15" / "from Aug 1" / "until Aug 15" / "Any date". */
export function formatDateRange({ start, end }) {
  if (!start && !end) return 'Any date';
  if (start && !end) return `from ${formatDateISO(start)}`;
  if (!start && end) return `until ${formatDateISO(end)}`;
  return `${formatDateISO(start)} – ${formatDateISO(end)}`;
}

/** Both bounds set and reversed — the only client-invalid state. */
export function isRangeReversed({ start, end }) {
  return Boolean(start && end && start > end);
}

/**
 * Is a 'YYYY-MM-DD' date inside the (inclusive) range? Empty bounds are
 * unbounded; ISO strings compare lexicographically.
 */
export function isDateInRange(iso, { start, end }) {
  if (start && iso < start) return false;
  if (end && iso > end) return false;
  return true;
}
