// [WS1: server-api] — see docs/workstreams/01-server-api.md
// Owns this file. Implements the /api contract from docs/architecture.md
// using cineplex.js (proxy) and db.js (subscriptions).

import { Router } from 'express';
import {
  getMovies,
  getTheatres,
  getShowtimes,
  flattenSessions,
  toApiDate,
} from './cineplex.js';
import { createSubscription, deleteSubscription } from './db.js';

export const api = Router();

/** Wrap an async handler so thrown/rejected errors become 500 { error }. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'internal server error' });
  });

// --- In-memory caches (Cineplex etiquette: client traffic must never fan out
// to Cineplex more than a few times an hour). Module-level, per-process.
const MOVIES_TTL_MS = 15 * 60 * 1000; // ~15 min
const THEATRES_TTL_MS = 24 * 60 * 60 * 1000; // ~24 h
const moviesCache = { data: null, fetchedAt: 0 };
const theatresCache = { data: null, fetchedAt: 0 };

async function cached(cache, ttlMs, fetcher) {
  if (cache.data && Date.now() - cache.fetchedAt < ttlMs) return cache.data;
  const data = await fetcher();
  cache.data = data;
  cache.fetchedAt = Date.now();
  return data;
}

// GET /api/movies — full movie list (now playing + coming soon), cached ~15 min.
api.get(
  '/movies',
  asyncHandler(async (_req, res) => {
    res.json(await cached(moviesCache, MOVIES_TTL_MS, getMovies));
  })
);

// GET /api/theatres — full national theatre list, cached ~24 h.
api.get(
  '/theatres',
  asyncHandler(async (_req, res) => {
    res.json(await cached(theatresCache, THEATRES_TTL_MS, getTheatres));
  })
);

// --- GET /api/showtimes — preview of current showings for a movie at up to
// 5 theatres over the next `days` days. Cached per (movieId, theatreId, date)
// so client traffic stays polite to Cineplex; uncached fetches run
// sequentially with a ~100 ms delay between them.

const SHOWTIMES_TTL_MS = 10 * 60 * 1000; // ~10 min
const SHOWTIMES_CACHE_MAX = 500; // 500 (movie, theatre, day) entries ≈ a few MB tops
const showtimesCache = new Map(); // "movieId:theatreId:MM/DD/YYYY" → { sessions, fetchedAt }

/** Drop expired entries; if still over cap, drop oldest (Map keeps insertion order). */
function pruneShowtimesCache() {
  const now = Date.now();
  for (const [key, entry] of showtimesCache) {
    if (now - entry.fetchedAt >= SHOWTIMES_TTL_MS) showtimesCache.delete(key);
  }
  for (const key of showtimesCache.keys()) {
    if (showtimesCache.size <= SHOWTIMES_CACHE_MAX) break;
    showtimesCache.delete(key);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const INT_RE = /^\d+$/;

api.get(
  '/showtimes',
  asyncHandler(async (req, res) => {
    const { movieId: movieIdRaw, theatreIds: theatreIdsRaw, days: daysRaw } = req.query;

    if (typeof movieIdRaw !== 'string' || !INT_RE.test(movieIdRaw)) {
      return res.status(400).json({ error: 'movieId must be an integer' });
    }
    const movieId = Number(movieIdRaw);

    if (typeof theatreIdsRaw !== 'string' || theatreIdsRaw.trim() === '') {
      return res
        .status(400)
        .json({ error: 'theatreIds is required (comma-separated integers)' });
    }
    const parts = theatreIdsRaw.split(',').map((p) => p.trim());
    if (!parts.every((p) => INT_RE.test(p))) {
      return res
        .status(400)
        .json({ error: 'theatreIds must be comma-separated integers' });
    }
    const theatreIds = [...new Set(parts.map(Number))];
    if (theatreIds.length > 5) {
      return res.status(400).json({ error: 'at most 5 theatreIds are allowed' });
    }

    let days = 7;
    if (daysRaw !== undefined) {
      if (typeof daysRaw !== 'string' || !INT_RE.test(daysRaw)) {
        return res.status(400).json({ error: 'days must be an integer' });
      }
      days = Number(daysRaw);
      if (days < 1 || days > 14) {
        return res.status(400).json({ error: 'days must be between 1 and 14' });
      }
    }

    // The next `days` calendar dates starting today (theatre-local ≈ server-local).
    const today = new Date();
    const dates = Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return toApiDate(d);
    });

    // Sequential fetch, theatre by theatre, day by day. Cache hits are free;
    // real Cineplex calls are spaced ~100 ms apart. A failed day is logged and
    // skipped — a transient upstream error must not 500 the whole preview.
    const sessionsByTheatre = new Map(theatreIds.map((t) => [t, []]));
    const theatreNames = new Map(); // theatreId → name seen in fetched data
    let fetchedFromCineplex = false;

    for (const theatreId of theatreIds) {
      for (const date of dates) {
        const key = `${movieId}:${theatreId}:${date}`;
        let entry = showtimesCache.get(key);
        if (!entry || Date.now() - entry.fetchedAt >= SHOWTIMES_TTL_MS) {
          if (fetchedFromCineplex) await sleep(100);
          fetchedFromCineplex = true;
          try {
            const raw = await getShowtimes({ locationId: theatreId, date, filmId: movieId });
            const sessions = flattenSessions(raw).filter((s) => s.movieId === movieId);
            entry = { sessions, fetchedAt: Date.now() };
            showtimesCache.set(key, entry);
            pruneShowtimesCache();
          } catch (err) {
            console.error(`showtimes fetch failed for ${key}:`, err.message);
            continue; // skip this day, keep the rest of the preview
          }
        }
        sessionsByTheatre.get(theatreId).push(...entry.sessions);
        for (const s of entry.sessions) {
          if (s.theatreName) theatreNames.set(s.theatreId, s.theatreName);
        }
      }
    }

    // A theatre with zero sessions never told us its name — fall back to the
    // (cached) national theatre list, then to the bare id.
    if (theatreIds.some((t) => !theatreNames.has(t))) {
      try {
        const all = await cached(theatresCache, THEATRES_TTL_MS, getTheatres);
        for (const t of all) {
          if (!theatreNames.has(t.theatreId)) theatreNames.set(t.theatreId, t.name);
        }
      } catch (err) {
        console.error('theatre name lookup failed:', err.message);
      }
    }

    const result = theatreIds.map((theatreId) => {
      const seen = new Set();
      const sessions = sessionsByTheatre
        .get(theatreId)
        .filter((s) => !seen.has(s.sessionId) && seen.add(s.sessionId))
        .sort((a, b) => a.showStartDateTime.localeCompare(b.showStartDateTime))
        .map((s) => ({
          sessionId: s.sessionId,
          showStartDateTime: s.showStartDateTime,
          experienceTypes: s.experienceTypes,
          auditorium: s.auditorium,
          isSoldOut: s.isSoldOut,
          ticketingUrl: s.ticketingUrl,
        }));
      return {
        theatreId,
        theatreName: theatreNames.get(theatreId) ?? String(theatreId),
        sessions,
      };
    });
    res.json(result);
  })
);

// Plausibility check only — real validation is the email arriving.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 'HH:MM' 24h clock, zero-padded (e.g. '09:00', '21:30').
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const MAX_TIME_WINDOWS = 6;

/**
 * Validate + normalize the optional `timeWindows` array: up to 6 windows of
 * { start?, end? }, each bound an 'HH:MM' 24h string when present (empty
 * string = absent bound). A showtime matches if it falls in ANY window;
 * omitted/empty array = any time. Returns { value: [{ start, end }] } with
 * nulls for absent bounds, or { error }. start > end is deliberately allowed
 * (overnight wrap, e.g. 21:00–02:00); a window with neither bound is rejected.
 */
function parseTimeWindows(value) {
  if (value === undefined || value === null) return { value: [] };
  if (!Array.isArray(value)) {
    return { error: 'timeWindows must be an array of { start?, end? } windows' };
  }
  if (value.length > MAX_TIME_WINDOWS) {
    return { error: `timeWindows may contain at most ${MAX_TIME_WINDOWS} windows` };
  }
  const windows = [];
  for (const [i, w] of value.entries()) {
    if (typeof w !== 'object' || w === null || Array.isArray(w)) {
      return { error: `timeWindows[${i}] must be an object with optional start/end` };
    }
    const bounds = { start: null, end: null };
    for (const field of ['start', 'end']) {
      const v = w[field];
      if (v === undefined || v === null || v === '') continue; // absent bound
      if (typeof v !== 'string' || !TIME_RE.test(v)) {
        return {
          error: `timeWindows[${i}].${field} must be an 'HH:MM' 24-hour time (e.g. '21:30')`,
        };
      }
      bounds[field] = v;
    }
    if (bounds.start === null && bounds.end === null) {
      return { error: `timeWindows[${i}] must have at least one of start or end` };
    }
    windows.push(bounds);
  }
  return { value: windows };
}

// POST /api/subscriptions —
// { email, movieId, movieName, theatreIds, timeWindows? } → 201 { id }.
api.post(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    const { email, movieId, movieName, theatreIds, timeWindows } = req.body ?? {};

    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'a valid email is required' });
    }
    if (!Number.isInteger(movieId)) {
      return res.status(400).json({ error: 'movieId must be an integer' });
    }
    if (typeof movieName !== 'string' || movieName.trim() === '') {
      return res.status(400).json({ error: 'movieName must be a non-empty string' });
    }
    if (
      !Array.isArray(theatreIds) ||
      theatreIds.length === 0 ||
      !theatreIds.every((t) => Number.isInteger(t))
    ) {
      return res
        .status(400)
        .json({ error: 'theatreIds must be a non-empty array of integers' });
    }

    // Optional time-of-day windows (match ANY; empty = any time).
    const windows = parseTimeWindows(timeWindows);
    if (windows.error) return res.status(400).json({ error: windows.error });

    const id = await createSubscription({
      email: email.trim(),
      movieId,
      movieName: movieName.trim(),
      theatreIds: [...new Set(theatreIds)],
      timeWindows: windows.value,
    });
    res.status(201).json({ id });
  })
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const unsubscribePage = (title, body) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #222; }
    h1 { font-size: 1.4rem; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${body}</p>
</body>
</html>
`;

// GET /api/unsubscribe/:id — clicked from an email, so respond with HTML.
api.get(
  '/unsubscribe/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    // Guard the UUID shape ourselves: an invalid UUID makes Postgres throw
    // (22P02), and an unknown link should read as "not found", not an error.
    const deleted = UUID_RE.test(id) && (await deleteSubscription(id));
    if (!deleted) {
      return res
        .status(404)
        .type('html')
        .send(
          unsubscribePage(
            'Link not found',
            'This unsubscribe link is invalid or was already used. If you keep receiving emails, use the link in the most recent one.'
          )
        );
    }
    res
      .type('html')
      .send(
        unsubscribePage(
          "You're unsubscribed",
          "You won't receive any more showtime alerts for this subscription."
        )
      );
  })
);
