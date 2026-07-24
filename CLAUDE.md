# cineplex-notify — agent guide

Email alerts for new Cineplex showtimes. React client + Express server +
Postgres + in-process poller. Read `docs/architecture.md` first; the Cineplex
API reference (reverse-engineered, verified) is `docs/cineplex-api.md`.

## Workstream rules (important for parallel worktrees)

Work is split into three workstreams with **strict file ownership** so
branches merge without conflicts:

- WS1 `ws/server-api` → owns `server/src/routes.js` only
- WS2 `ws/poller-notifier` → owns `server/src/notifier/**`
- WS3 `ws/client-ui` → owns `client/**`

Shared foundation files — `server/src/index.js`, `server/src/cineplex.js`,
`server/src/db.js`, `package.json`s, docs — must NOT be edited on workstream
branches. If a foundation change is genuinely needed, make it on `main` and
rebase the workstream branches, or flag it instead of editing.

Each workstream's spec (goal, tasks, done-criteria) lives in
`docs/workstreams/`. Stay inside your spec's scope.

## Conventions

- Plain JavaScript, ESM (`type: module`), Node ≥ 20 built-in `fetch`. No
  TypeScript, no new dependencies beyond what's in the package.json files
  unless the spec says so.
- No secrets in code or DB — env vars only (`.env.example` is the catalog).
- The Cineplex API is unofficial: keep the in-memory caches and polite polling
  intervals; never add per-request fan-out to Cineplex from client traffic.
- No user accounts/passwords/localStorage — statelessness (beyond the
  subscription rows) is a product requirement, not an accident.

## Verify

- Server: `npm run dev:server` (needs local Postgres, see README) then curl
  the routes; `/healthz` must return `{ ok: true }`.
- Client: `npm run dev:client` for the flow; `npm run build` must pass.
- Poller: run `pollOnce()` twice — second run must send nothing (idempotent).
