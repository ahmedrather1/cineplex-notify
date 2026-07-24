# WS1 — Server API

**Branch:** `ws/server-api` · **Owns:** `server/src/routes.js` (only)

## Goal

Implement the four `/api` routes per the contract in
`docs/architecture.md §Internal REST contract`, using the already-implemented
`server/src/cineplex.js` and `server/src/db.js`. Do not touch `index.js`,
`notifier/`, or `client/`.

## Tasks

1. `GET /api/movies` — `cineplex.getMovies()`, in-memory cache ~15 min
   (module-level `{ data, fetchedAt }` is fine; no cache library).
2. `GET /api/theatres` — `cineplex.getTheatres()`, in-memory cache ~24 h.
3. `POST /api/subscriptions` — validate: plausible email (simple regex),
   integer `movieId`, non-empty string `movieName`, non-empty array of integer
   `theatreIds` (dedupe). → `db.createSubscription` → `201 { id }`.
   Invalid input → `400 { error }`.
4. `GET /api/unsubscribe/:id` — `db.deleteSubscription(id)`. Success → small
   inline HTML page ("You're unsubscribed from <movie> alerts" is fine without
   the movie name; keep it simple). Unknown/invalid UUID → `404`. This URL is
   opened from an email client, so respond with HTML, not JSON.
5. Wrap handlers so thrown errors → `500 { error }` (tiny asyncHandler helper
   in routes.js; don't add a package for it).

## Done when

- `npm run dev:server` + `curl localhost:3001/api/movies` returns real movies.
- `curl -X POST localhost:3001/api/subscriptions` with valid/invalid bodies
  returns 201/400 as specified; row visible in Postgres.
- Unsubscribe of a created id returns HTML and deletes the row (cascade clears
  `seen_sessions`).

## Notes

- Requires a local `DATABASE_URL` (see README §Local Postgres).
- Cineplex etiquette: the caches exist so client traffic never hits Cineplex
  more than a few times an hour. Keep them.
