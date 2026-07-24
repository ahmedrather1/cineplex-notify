// [WS2: poller-notifier] — see docs/workstreams/02-poller-notifier.md
// Semantics in docs/architecture.md §Poller. Owns this file and mailer.js.

import 'dotenv/config'; // no-op when index.js already loaded it; enables standalone runs
import cron from 'node-cron';
import { getShowtimes, flattenSessions, toApiDate } from '../cineplex.js';
import {
  listSubscriptions,
  getSeenSessionKeys,
  markSessionsSeen,
  markSeeded,
} from '../db.js';
import { sendNewShowingsEmail } from './mailer.js';

const REQUEST_DELAY_MS = 200; // politeness gap between Cineplex requests

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pairKey = (movieId, theatreId) => `${movieId}:${theatreId}`;

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
 * Fetch + flatten showtimes for every distinct (movieId, theatreId) pair,
 * one request per day for `lookaheadDays`, sequential with a polite delay.
 * @returns {Map<string, Array>} pairKey → flattened sessions for that pair
 */
async function fetchSessionsByPair(pairs, lookaheadDays) {
  const sessionsByPair = new Map();
  const today = new Date();
  let first = true;

  for (const { movieId, theatreId } of pairs) {
    const key = pairKey(movieId, theatreId);
    const sessions = [];
    for (let offset = 0; offset < lookaheadDays; offset++) {
      if (!first) await sleep(REQUEST_DELAY_MS);
      first = false;
      const date = new Date(today);
      date.setDate(date.getDate() + offset);
      try {
        const raw = await getShowtimes({
          locationId: theatreId,
          date: toApiDate(date),
          filmId: movieId,
        });
        // filmId already filters server-side; keep the guard in case it's ignored.
        sessions.push(
          ...flattenSessions(raw).filter((s) => s.movieId === movieId)
        );
      } catch (err) {
        // One bad day/pair must not sink the whole poll pass.
        console.error(
          `[poller] showtimes fetch failed (theatre ${theatreId}, film ${movieId}, ${toApiDate(date)}): ${err.message}`
        );
      }
    }
    sessionsByPair.set(key, sessions);
  }
  return sessionsByPair;
}

/**
 * Single poll pass: fetch showtimes grouped by distinct (movieId, theatreId),
 * diff per subscription against seen_sessions, seed silently on first pass,
 * otherwise email one digest per subscription and only then mark seen.
 */
export async function pollOnce() {
  const lookaheadDays = Number(process.env.POLL_LOOKAHEAD_DAYS || 30);
  const subs = await listSubscriptions();
  if (subs.length === 0) {
    console.log('[poller] no subscriptions — nothing to poll');
    return;
  }

  // Distinct (movieId, theatreId) pairs so N subscribers to the same
  // movie/theatre cost one set of Cineplex requests.
  const pairs = new Map();
  for (const sub of subs) {
    for (const theatreId of sub.theatreIds) {
      pairs.set(pairKey(sub.movieId, theatreId), { movieId: sub.movieId, theatreId });
    }
  }

  console.log(
    `[poller] polling ${pairs.size} (movie, theatre) pair(s) for ${subs.length} subscription(s), ${lookaheadDays} day(s) ahead`
  );
  const sessionsByPair = await fetchSessionsByPair(pairs.values(), lookaheadDays);

  for (const sub of subs) {
    try {
      // Dedupe by (theatreId, sessionId): the API sometimes lists the same
      // session under multiple experience blocks.
      const byKey = new Map();
      for (const theatreId of sub.theatreIds) {
        for (const s of sessionsByPair.get(pairKey(sub.movieId, theatreId)) ?? []) {
          if (!byKey.has(`${s.theatreId}:${s.sessionId}`)) {
            byKey.set(`${s.theatreId}:${s.sessionId}`, s);
          }
        }
      }
      // Drop sessions outside the subscription's time-of-day windows BEFORE
      // seeding/diffing, so both passes see the same filtered universe.
      const sessions = [...byKey.values()].filter((s) =>
        inAnyTimeWindow(s.showStartDateTime, sub.timeWindows)
      );

      if (!sub.seeded) {
        // First pass: everything that already exists isn't "new" — seed silently.
        await markSessionsSeen(sub.id, sessions);
        await markSeeded(sub.id);
        console.log(`[poller] seeded ${sub.id} with ${sessions.length} session(s), no email`);
        continue;
      }

      const seen = await getSeenSessionKeys(sub.id);
      const fresh = sessions.filter((s) => !seen.has(`${s.theatreId}:${s.sessionId}`));
      if (fresh.length === 0) continue;

      // Send first, mark seen only after the send resolves: at-least-once
      // delivery is acceptable; silently losing notifications is not.
      await sendNewShowingsEmail(sub, fresh);
      await markSessionsSeen(sub.id, fresh);
      console.log(`[poller] emailed ${sub.email} about ${fresh.length} new session(s) (${sub.id})`);
    } catch (err) {
      // One bad subscription (e.g. rejected email address) must not break the run.
      console.error(`[poller] subscription ${sub.id} failed: ${err.message}`);
    }
  }
}

let isRunning = false;

async function guardedPoll() {
  if (isRunning) {
    console.log('[poller] previous pass still running — skipping this tick');
    return;
  }
  isRunning = true;
  try {
    await pollOnce();
  } catch (err) {
    console.error(`[poller] pass failed: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

/** Start the in-process cron poller (every POLL_INTERVAL_MINUTES) with a boot kick-off. */
export function startPoller() {
  const minutes = Math.min(59, Math.max(1, Number(process.env.POLL_INTERVAL_MINUTES || 30)));
  cron.schedule(`*/${minutes} * * * *`, guardedPoll);
  console.log(`[poller] started — every ${minutes} minute(s)`);
  guardedPoll(); // run once at boot so new deploys don't wait a full interval
}
