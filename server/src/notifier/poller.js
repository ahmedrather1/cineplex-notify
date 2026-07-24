// [WS2: poller-notifier] — see docs/workstreams/02-poller-notifier.md
// Owns this file and mailer.js. Semantics in docs/architecture.md §Poller.

/**
 * TODO(WS2): implement.
 * - node-cron every POLL_INTERVAL_MINUTES (default 30)
 * - group fetches by distinct (movieId, theatreId) across subscriptions;
 *   cineplex.getShowtimes per day for POLL_LOOKAHEAD_DAYS (default 30), flattenSessions()
 * - per subscription: diff vs db.getSeenSessionKeys(); if !seeded, seed silently
 * - new sessions → one digest email via mailer.js, then markSessionsSeen
 * - overlap guard: skip a tick if the previous one is still running
 */
export function startPoller() {
  console.log('[poller] not implemented yet (WS2) — no polling will occur');
}

/** TODO(WS2): single poll pass, exported separately so it can be run manually/tested. */
export async function pollOnce() {
  throw new Error('not implemented (WS2)');
}
