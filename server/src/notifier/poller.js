// [WS2: poller-notifier] — see docs/workstreams/02-poller-notifier.md
// Semantics in docs/architecture.md §Poller. Owns this file and mailer.js.

import 'dotenv/config'; // no-op when index.js already loaded it; enables standalone runs
import { getFilmShowtimes, getMovies, flattenSessions } from '../cineplex.js';
import {
  listSubscriptions,
  getSeenSessionKeys,
  markSessionsSeen,
  markSeeded,
} from '../db.js';
import { sendNewShowingsEmail } from './mailer.js';

const REQUEST_DELAY_MS = 200; // politeness gap between Cineplex requests
const MOVIES_TTL_MS = 10 * 60 * 1000; // cache the movies list ~10 min

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cache the (national) movies list so lane classification doesn't refetch it
// every tick — it changes at most daily.
let moviesCache = { at: 0, byId: null };

async function getMoviesById() {
  const now = Date.now();
  if (moviesCache.byId && now - moviesCache.at < MOVIES_TTL_MS) return moviesCache.byId;
  const byId = new Map((await getMovies()).map((m) => [m.id, m]));
  moviesCache = { at: now, byId };
  return byId;
}

/**
 * Urgency lane a movie belongs to. `isNowPlaying === true` → 'slow' (heavy
 * payloads, weekly schedule drops aren't time-critical); everything else —
 * coming-soon, or not found in getMovies() — → 'fast' (advance on-sales are
 * the latency-critical, cheap-to-fetch case).
 */
function laneForMovie(movieId, moviesById) {
  return moviesById.get(movieId)?.isNowPlaying === true ? 'slow' : 'fast';
}

/**
 * True if a session's local start time falls inside a subscription's
 * time-of-day window. `showStartDateTime` is Cineplex's zero-padded local
 * "YYYY-MM-DDTHH:MM:SS", so slicing out 'HH:MM' makes lexicographic
 * comparison safe. A null bound is unbounded on that side;
 * `timeStart > timeEnd` wraps overnight (e.g. 21:00–02:00 matches
 * t >= 21:00 OR t <= 02:00).
 */
export function inTimeWindow(showStartDateTime, timeStart, timeEnd) {
  if (!timeStart && !timeEnd) return true;
  const t = showStartDateTime.slice(11, 16);
  if (timeStart && timeEnd) {
    return timeStart <= timeEnd
      ? t >= timeStart && t <= timeEnd
      : t >= timeStart || t <= timeEnd;
  }
  return timeStart ? t >= timeStart : t <= timeEnd;
}

/**
 * True if a session's local start time falls inside ANY of the
 * subscription's time-of-day windows (`[{ start?, end? }]`; per-window
 * semantics as in inTimeWindow). Empty or missing array = any time.
 */
export function inAnyTimeWindow(showStartDateTime, timeWindows) {
  if (!timeWindows || timeWindows.length === 0) return true;
  return timeWindows.some((w) => inTimeWindow(showStartDateTime, w.start, w.end));
}

/**
 * True if a session's local date falls inside the subscription's date range.
 * Both bounds inclusive; null = unbounded on that side. 'YYYY-MM-DD' is
 * zero-padded, so lexicographic comparison is safe.
 */
export function inDateRange(showStartDateTime, dateStart, dateEnd) {
  const d = showStartDateTime.slice(0, 10);
  return (dateStart == null || d >= dateStart) && (dateEnd == null || d <= dateEnd);
}

/** Today's date in the server's local timezone as 'YYYY-MM-DD'. */
function localToday() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Fetch + flatten showtimes for every distinct movieId in one national
 * `getFilmShowtimes` call each — sequential with a polite delay. A single
 * film call spans all theatres and all dates, including advance/coming-soon
 * showings that sit months beyond any date-by-date forward window.
 * @returns {Map<number, Array>} movieId → flattened sessions across all theatres
 */
async function fetchSessionsByMovie(movieIds) {
  const sessionsByMovie = new Map();
  let first = true;

  for (const movieId of movieIds) {
    if (!first) await sleep(REQUEST_DELAY_MS);
    first = false;
    try {
      const raw = await getFilmShowtimes(movieId);
      // filmId filters server-side; keep the guard in case it's ever ignored.
      sessionsByMovie.set(
        movieId,
        flattenSessions(raw).filter((s) => s.movieId === movieId)
      );
    } catch (err) {
      // One bad film must not sink the whole poll pass — skip it this round.
      console.error(`[poller] film showtimes fetch failed (film ${movieId}): ${err.message}`);
      sessionsByMovie.set(movieId, []);
    }
  }
  return sessionsByMovie;
}

/**
 * Diff one subscription's (already theatre/date/time-filtered) sessions
 * against seen_sessions: seed silently on first pass, otherwise email one
 * digest and only then mark seen. Errors are contained to this subscription.
 */
async function processSubscription(sub, sessionsByMovie, lane) {
  // Filter the film's national sessions to this subscription's theatres,
  // deduping by (theatreId, sessionId): the API sometimes lists the same
  // session under multiple experience blocks.
  const theatreIds = new Set(sub.theatreIds);
  const byKey = new Map();
  for (const s of sessionsByMovie.get(sub.movieId) ?? []) {
    if (theatreIds.has(s.theatreId) && !byKey.has(`${s.theatreId}:${s.sessionId}`)) {
      byKey.set(`${s.theatreId}:${s.sessionId}`, s);
    }
  }
  // Drop sessions outside the subscription's date range, then outside its
  // time-of-day windows, BEFORE seeding/diffing, so both passes see the
  // same filtered universe.
  const sessions = [...byKey.values()].filter(
    (s) =>
      inDateRange(s.showStartDateTime, sub.dateStart, sub.dateEnd) &&
      inAnyTimeWindow(s.showStartDateTime, sub.timeWindows)
  );

  if (!sub.seeded) {
    // First pass: everything that already exists isn't "new" — seed silently.
    await markSessionsSeen(sub.id, sessions);
    await markSeeded(sub.id);
    console.log(`[poller:${lane}] seeded ${sub.id} with ${sessions.length} session(s), no email`);
    return;
  }

  const seen = await getSeenSessionKeys(sub.id);
  const fresh = sessions.filter((s) => !seen.has(`${s.theatreId}:${s.sessionId}`));
  if (fresh.length === 0) return;

  // Send first, mark seen only after the send resolves: at-least-once
  // delivery is acceptable; silently losing notifications is not.
  await sendNewShowingsEmail(sub, fresh);
  await markSessionsSeen(sub.id, fresh);
  console.log(`[poller:${lane}] emailed ${sub.email} about ${fresh.length} new session(s) (${sub.id})`);
}

/**
 * Run one poll pass restricted to a single urgency lane ('fast' | 'slow').
 * Recomputes the lane's movie set from current subscriptions each call (so new
 * subscriptions are picked up automatically), fetches once per distinct movie
 * in the lane, then diffs/emails each subscription.
 */
export async function pollLane(lane) {
  const allSubs = await listSubscriptions();
  const moviesById = await getMoviesById();
  const today = localToday();

  // Keep only this lane's subscriptions; drop expired ones (no fetch, no email).
  const subs = [];
  for (const sub of allSubs) {
    if (laneForMovie(sub.movieId, moviesById) !== lane) continue;
    if (sub.dateEnd != null && sub.dateEnd < today) {
      console.log(`[poller:${lane}] skipping expired subscription ${sub.id}`);
      continue;
    }
    subs.push(sub);
  }

  // One fetch per distinct movie: a national film call spans every theatre and
  // date, so N subscribers to the same film cost exactly one Cineplex request.
  const movieIds = [...new Set(subs.map((sub) => sub.movieId))];
  console.log(
    `[poller:${lane}] polling ${movieIds.length} film(s) ${JSON.stringify(movieIds)} for ${subs.length} subscription(s)`
  );
  if (subs.length === 0) return;

  const sessionsByMovie = await fetchSessionsByMovie(movieIds);
  for (const sub of subs) {
    try {
      await processSubscription(sub, sessionsByMovie, lane);
    } catch (err) {
      // One bad subscription (e.g. rejected email address) must not break the run.
      console.error(`[poller:${lane}] subscription ${sub.id} failed: ${err.message}`);
    }
  }
}

/** Run both lanes once (manual runs / tests). Idempotent on a second call. */
export async function pollOnce() {
  await pollLane('fast');
  await pollLane('slow');
}

// Per-lane overlap guards: a lane skips its tick if its previous run is still
// in flight (a full national fetch can outlast a short fast-lane interval).
const laneRunning = { fast: false, slow: false };

async function guardedLane(lane) {
  if (laneRunning[lane]) {
    console.log(`[poller:${lane}] previous run still in flight — skipping this tick`);
    return;
  }
  laneRunning[lane] = true;
  try {
    await pollLane(lane);
  } catch (err) {
    console.error(`[poller:${lane}] pass failed: ${err.message}`);
  } finally {
    laneRunning[lane] = false;
  }
}

/**
 * Start the two-tier in-process poller: an independent setInterval per lane,
 * each with its own overlap guard and a (staggered) boot kick-off. Guard the
 * whole thing with ENABLE_POLLER upstream so only one instance runs.
 */
export function startPoller() {
  const fastMs = Math.max(1, Number(process.env.FAST_POLL_SECONDS || 30)) * 1000;
  const slowMs = Math.max(1, Number(process.env.SLOW_POLL_MINUTES || 5)) * 60 * 1000;

  setInterval(() => guardedLane('fast'), fastMs);
  setInterval(() => guardedLane('slow'), slowMs);
  console.log(
    `[poller] started — fast lane every ${fastMs / 1000}s (coming-soon), slow lane every ${slowMs / 60000}m (now-playing)`
  );

  // Boot kick-off so a new deploy doesn't wait a full interval; stagger the
  // lanes so they don't both hit Cineplex at t=0.
  guardedLane('fast');
  setTimeout(() => guardedLane('slow'), 2000);
}
