# cineplex-notify

Get an email when new showtimes for a movie are released at your chosen
Cineplex theatres. Pick a movie, pick theatres, leave an email — no account,
no password. Every email contains a one-click unsubscribe link.

- React (Vite) client, Express server, Postgres, in-process poller, SMTP email.
- Uses the unofficial Cineplex website API — see `docs/cineplex-api.md`.
- System design and contracts: `docs/architecture.md`.

## Status / workstreams

The shared foundation (Cineplex client, DB layer, contracts, scaffolding) is on
`main`. Three independent workstreams build on it, each on its own branch with
**disjoint file ownership** so worktrees merge cleanly:

| Workstream | Branch              | Owns                       | Spec |
|------------|---------------------|----------------------------|------|
| WS1        | `ws/server-api`     | `server/src/routes.js`     | `docs/workstreams/01-server-api.md` |
| WS2        | `ws/poller-notifier`| `server/src/notifier/`     | `docs/workstreams/02-poller-notifier.md` |
| WS3        | `ws/client-ui`      | `client/`                  | `docs/workstreams/03-client-ui.md` |

Pick up a workstream in its own worktree:

```sh
git worktree add ../cxn-server-api ws/server-api
git worktree add ../cxn-poller    ws/poller-notifier
git worktree add ../cxn-client    ws/client-ui
```

Each worktree: `npm install`, copy `.env.example` → `.env`, follow the spec.
When done, merge back to `main` (order doesn't matter — no shared files).

## Local development

Requires Node ≥ 20 and a local Postgres.

```sh
npm install
cp .env.example .env          # defaults work for local dev
createdb cineplex_notify      # or: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cineplex_notify postgres:16
npm run dev:server            # Express on :3001 (auto-migrates schema)
npm run dev:client            # Vite on :5173, proxies /api → :3001
```

Local email testing: [Mailpit](https://github.com/axllent/mailpit)
(`docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit`) — matches the
`.env.example` SMTP defaults; view sent mail at http://localhost:8025.

## Deploy (Railway / Render)

One service + one Postgres addon:

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- Add the Postgres addon (injects `DATABASE_URL`; remove `PGSSL=disable`).
- Set env vars: `PUBLIC_BASE_URL` (the public app URL), `ENABLE_POLLER=1`,
  `SMTP_*`, `MAIL_FROM`.
- Run **exactly one instance** — the poller is in-process and unguarded
  against multiple replicas.

## Caveats

- Unofficial API: endpoints/key may change without notice (`docs/cineplex-api.md`
  records what's verified and when). Poll politely — default 30 min.
- Unsubscribe is by unguessable link only; anyone with the link can
  unsubscribe. That's the accepted trade-off for having no accounts.
