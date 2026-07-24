// [WS3: client-ui] Viewing-format normalization — a verbatim mirror of
// server/src/cineplex.js (the single source of truth). It MUST stay in sync
// with that file: the same classification drives the ShowtimesPanel section
// headers, the alert-filter picker options, and the server-side match, so
// the section a session shows under and whether the filter keeps it always
// agree. If the server copy changes, update this one identically.

/** Premium formats in headline priority; the first present wins. */
export const FORMAT_PRIORITY = ['IMAX', 'UltraAVX', 'VIP', 'D-BOX', 'ScreenX', '4DX', '3D'];

/** Non-format experience tags (accessibility / generic) that fall back to "Regular". */
const GENERIC_TYPES = new Set([
  'regular', 'digital', '2d', 'standard', 'laser projection',
  'cc', 'ad', 'dvs', 'descriptive video', 'closed caption', 'open captions', 'subtitles',
]);

/** Canonical formats a user can pick in the alert filter (Regular + premium). */
export const SELECTABLE_FORMATS = ['Regular', ...FORMAT_PRIORITY];

/**
 * The one headline format for a session, from its experienceTypes. Highest
 * priority premium tag present, else the first non-generic tag, else "Regular".
 * A subscription's format filter matches a session iff this value is in its set.
 */
export function primaryFormat(experienceTypes = []) {
  const types = experienceTypes || [];
  for (const p of FORMAT_PRIORITY) {
    if (types.some((t) => String(t).toLowerCase() === p.toLowerCase())) return p;
  }
  const premium = types.find((t) => !GENERIC_TYPES.has(String(t).toLowerCase()));
  return premium || 'Regular';
}
