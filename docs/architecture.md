# Architecture

Users pick a movie + one or more theatres + enter an email. The server polls the
Cineplex API and emails them when new showtimes appear. **No accounts, no
passwords.** The only persistent state is the subscription itself (email ↔ movie
↔ theatres) plus which showtimes we've already seen — everything else is derived
from the Cineplex API on demand.

**Deploy target: Railway or Render** — one long-running Node service + managed
Postgres. The React client is built to static files and served by Express, so
there is exactly one deploy unit.

```
                   ┌──────────────────────────────────────────┐
 browser ──HTTP──▶ │ Express server                           │
   (React SPA,     │  ├── /api routes + Cineplex proxy  [WS1] │──▶ apis.cineplex.com
    served static) │  ├── notifier/ poller + mailer     [WS2] │──▶ SMTP provider
                   │  ├── cineplex.js   (shared, done)        │
                   │  └── db.js         (shared, done)        │
                   └───────────────┬──────────────────────────┘
                                   ▼
                          Postgres (DATABASE_URL)
```

Why a server at all? Two hard requirements force it: emails must go out while
the user is offline (something must poll), and the browser can't call
apis.cineplex.com (CORS). The server stays as stateless as possible: no
sessions, no auth, no user records beyond the subscription rows.

## Internal REST contract (client ⇄ server)

All under `/api`. In dev, the Vite server proxies `/api` → `http://localhost:3001`.

| Method & path              | Request                                               | Response |
|----------------------------|-------------------------------------------------------|----------|
| `GET /api/movies`          | —                                                     | `Movie[]`: `{ id, name, releaseDate, posterUrl, genres, isNowPlaying, isComingSoon }` |
| `GET /api/theatres`        | —                                                     | `Theatre[]`: `{ theatreId, name, city, provinceCode }` — full national list, flattened |
| `POST /api/subscriptions`  | `{ email, movieId, movieName, theatreIds: number[], timeWindows?: [{ start?, end? }], dateStart?, dateEnd? }` | `201 { id }` — validate email format, movieId present, theatreIds non-empty. `timeWindows` is an optional array (max 6) of time-of-day windows; a showtime matches if it falls in **any** window. Each window's `start`/`end` is an optional `'HH:MM'` 24h string (absent = unbounded on that side); `start > end` means an overnight wrap (e.g. `21:00`–`02:00`). Omitted/empty array = any time. A window with neither bound, a non-object entry, or a malformed time → 400. `dateStart`/`dateEnd` are optional `'YYYY-MM-DD'` strings (each independently optional; empty string = absent) restricting which showtime **dates** trigger alerts, both bounds inclusive. Malformed date, `dateStart > dateEnd`, or `dateEnd` before today → 400. |
| `GET /api/showtimes`       | query: `movieId` (int), `theatreIds` (comma-separated ints, max 5), `days` (optional, default 7, max 14) | `[{ theatreId, theatreName, sessions: [{ sessionId, showStartDateTime, experienceTypes, auditorium, isSoldOut, ticketingUrl }] }]` — currently available showings for a movie at the given theatres over the next `days` days, sessions sorted by start time, deduped by sessionId. One entry per requested theatre (empty `sessions` if none). Invalid params → 400. Cache ~10 min per (movieId, theatreId, date); fetch sequentially with a ~100 ms polite delay. |
| `GET /api/unsubscribe/:id` | — (linked from every email)                           | `200` small human-readable confirmation page; `404` if unknown id |

Errors: JSON `{ error: "message" }` with 4xx/5xx status. No other endpoints —
there is deliberately no "list my subscriptions" (no auth to protect it).

## Database (db.js — already implemented)

Postgres via `pg`. `migrate()` runs idempotent DDL on boot — no migration
tooling needed at this size.

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- unguessable; doubles as unsubscribe token
  email       TEXT NOT NULL,
  movie_id    INTEGER NOT NULL,
  movie_name  TEXT NOT NULL,            -- denormalized for email copy
  theatre_ids INTEGER[] NOT NULL,
  time_windows JSONB NOT NULL DEFAULT '[]',    -- [{ start?, end? }] 'HH:MM' each; [] = any time; match ANY
  date_start  TEXT,                            -- 'YYYY-MM-DD' or NULL (no lower bound), inclusive
  date_end    TEXT,                            -- 'YYYY-MM-DD' or NULL (no upper bound), inclusive
  seeded      BOOLEAN NOT NULL DEFAULT FALSE, -- first poll seeds seen_sessions WITHOUT emailing
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seen_sessions (
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  theatre_id      INTEGER NOT NULL,
  session_id      INTEGER NOT NULL,     -- Cineplex vistaSessionId
  PRIMARY KEY (subscription_id, theatre_id, session_id)
);
```

## Poller semantics (WS2)

1. Every `POLL_INTERVAL_MINUTES` (default 30), fetch showtimes for each distinct
   `(movieId, theatreId)` across all subscriptions for the next
   `POLL_LOOKAHEAD_DAYS` (default 30) days — grouped so N subscribers to the
   same movie/theatre cost one Cineplex request. Flatten with
   `cineplex.js#flattenSessions()`.
2. Per subscription, first drop sessions outside its date range — the
   session's date is `showStartDateTime.slice(0, 10)`, compared inclusively
   against `date_start`/`date_end` (null = unbounded; lexicographic compare
   is safe for `YYYY-MM-DD`) — then drop sessions outside its time-of-day
   windows: a session passes if `time_windows` is empty OR its `HH:MM`
   matches **any** window (per window: absent bound = unbounded on that
   side; `start > end` wraps overnight: match `t >= start || t <= end`).
   Then diff the remainder against `seen_sessions`. Subscriptions whose
   `date_end` is already in the past are skipped entirely (no fetch, no
   email) and logged. If `seeded` is false, insert everything (post-
   filter) and **do not email** — showtimes that existed before subscribing
   aren't "new".
3. New sessions → **one digest email per subscription per poll** (never one per
   showtime), grouped by theatre, with local showtimes, ticketing links, and
   the unsubscribe link `${PUBLIC_BASE_URL}/api/unsubscribe/{id}`.
4. Insert into `seen_sessions` only after a successful send — at-least-once
   delivery is acceptable; silently losing notifications is not.
5. Poller runs in-process (`node-cron`), started from `index.js`. Guard with
   `ENABLE_POLLER` so extra instances / local dev don't double-send.

## Config

All via env (`.env` locally, dashboard vars on Railway/Render) — see
`.env.example`. Email goes through plain SMTP (nodemailer) so any provider
works (Resend, Mailgun, SES, Gmail app password). No secrets in repo or DB.

## Deploy (Railway / Render)

- Build: `npm install && npm run build` (builds client into `client/dist`)
- Start: `npm start` (Express serves `/api` + static client)
- Provision Postgres addon → set `DATABASE_URL` (Render/Railway inject it)
- Set SMTP vars + `PUBLIC_BASE_URL` + `ENABLE_POLLER=1`
