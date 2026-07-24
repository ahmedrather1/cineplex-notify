# WS2 — Poller + email notifier

**Branch:** `ws/poller-notifier` · **Owns:** `server/src/notifier/` (poller.js, mailer.js; add files here freely)

## Goal

Implement the polling/diffing/emailing loop per
`docs/architecture.md §Poller semantics`, using `cineplex.js`
(`getShowtimes`, `flattenSessions`, `toApiDate`) and the `db.js` helpers
(`listSubscriptions`, `getSeenSessionKeys`, `markSessionsSeen`, `markSeeded`).
Do not touch `routes.js`, `index.js`, or `client/`.

## Tasks

1. **poller.js `pollOnce()`**
   - Load all subscriptions; build the distinct set of `(movieId, theatreId)`.
   - For each pair, fetch `POLL_LOOKAHEAD_DAYS` (default 30) days of showtimes
     (one request per day — that's the API's granularity), flatten, and index
     by pair. Sequential with a ~200 ms delay between requests; this is a
     politeness constraint, not a perf problem.
   - Per subscription: gather its sessions, diff against
     `getSeenSessionKeys()` using `theatreId:sessionId` keys.
   - `seeded === false` → `markSessionsSeen` + `markSeeded`, **no email**.
   - Else if new sessions: `sendNewShowingsEmail(sub, newSessions)` first,
     `markSessionsSeen` only after the send resolves.
   - Per-subscription try/catch: one bad email address must not break the run.
2. **poller.js `startPoller()`** — node-cron every `POLL_INTERVAL_MINUTES`
   (default 30) calling `pollOnce()`, with an `isRunning` overlap guard and a
   run-once-at-boot kick-off.
3. **mailer.js `sendNewShowingsEmail(subscription, sessions)`** — nodemailer
   SMTP transport from env (`SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`).
   - Subject: `N new showtime(s) for <movieName>`.
   - HTML + plain-text: grouped by theatre; each session shows local date/time
     (`showStartDateTime`), experience types, auditorium, "Get tickets" link
     (`ticketingUrl`).
   - Footer: unsubscribe link `${PUBLIC_BASE_URL}/api/unsubscribe/${subscription.id}`.

## Done when

- With a subscription in the DB (insert via psql or WS1 endpoint), running
  `node -e "import('./server/src/notifier/poller.js').then(m => m.pollOnce())"`
  seeds it silently; deleting a few `seen_sessions` rows and re-running sends
  exactly one digest email (test against Mailtrap/Mailpit or a personal SMTP).
- Second consecutive run sends nothing (idempotent).

## Notes

- Requires `DATABASE_URL` + SMTP vars locally (see `.env.example`; Mailpit
  via Docker is the easiest local SMTP sink).
- Never email on the seeding pass — that's the difference between "alerts"
  and "spam on signup".
