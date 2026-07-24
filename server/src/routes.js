// [WS1: server-api] — see docs/workstreams/01-server-api.md
// Owns this file. Implements the /api contract from docs/architecture.md
// using cineplex.js (proxy) and db.js (subscriptions).

import { Router } from 'express';
import { getMovies, getTheatres } from './cineplex.js';
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

// Plausibility check only — real validation is the email arriving.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/subscriptions — { email, movieId, movieName, theatreIds } → 201 { id }.
api.post(
  '/subscriptions',
  asyncHandler(async (req, res) => {
    const { email, movieId, movieName, theatreIds } = req.body ?? {};

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

    const id = await createSubscription({
      email: email.trim(),
      movieId,
      movieName: movieName.trim(),
      theatreIds: [...new Set(theatreIds)],
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
