# WS3 — Client UI

**Branch:** `ws/client-ui` · **Owns:** everything under `client/`

## Goal

Build the subscribe flow in React (Vite scaffold is in place;
`client/src/api.js` already wraps the REST contract). Do not touch `server/`.

## Flow

1. **Movie picker** — `fetchMovies()`; searchable list or poster grid
   (`posterUrl`, `name`, `releaseDate`, `genres`). Show "Now playing" /
   "Coming soon" sections or a filter. Single select.
2. **Theatre picker** — `fetchTheatres()`; text filter matching name or city;
   multi-select with selected theatres shown as removable chips. ~150 entries,
   so plain client-side filtering — no virtualization or dependencies needed.
3. **Email + submit** — email input (HTML validation + trivial regex),
   `createSubscription(...)`, then a success screen: what was subscribed,
   "you'll get an email when new showtimes are released", and that every email
   contains an unsubscribe link. Errors from the API render inline.

## Constraints

- No state persisted in the browser (no localStorage) — the app is stateless
  for the user; the subscription lives server-side keyed by email.
- No component/CSS libraries; plain CSS (one stylesheet is fine). Keep it
  responsive down to ~360 px.
- While WS1 is unfinished the API returns 501 — develop against it by
  temporarily running Vite with mock data, but commit code that talks to the
  real endpoints only.

## Done when

- `npm run dev` (both) → full flow works end-to-end against a real WS1 server:
  pick movie, pick 2 theatres, submit, success screen; row appears in DB.
- `npm run build` in `client/` succeeds and the built app works when served by
  the Express server (`npm start` at repo root).
