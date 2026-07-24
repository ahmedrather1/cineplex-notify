# Cineplex API reference (reverse-engineered, verified 2026-07-23)

Unofficial API used by www.cineplex.com. All endpoints verified working with `curl`.

**Base URL:** `https://apis.cineplex.com/prod/cpx/theatrical/api/v1`

**Required header:** `Ocp-Apim-Subscription-Key: dcdac5601d864addbc2675a2e96cb1f8`
(public key embedded in the Cineplex website JS; overridable via `CINEPLEX_API_KEY`)

Responses are gzip-compressed — any sane HTTP client (Node `fetch`, `curl --compressed`)
handles this transparently.

## GET /movies

`?language=en`

Returns `{ items: Movie[], totalCount: number }`.

```jsonc
// Movie (fields we care about)
{
  "id": 37617,                     // filmId used by /showtimes
  "name": "The Odyssey",
  "releaseDate": "2026-07-17T00:00:00",
  "runtimeInMinutes": 172,
  "mediumPosterImageUrl": "https://mediafiles.cineplex.com/Central/Film/Posters/37617_320_470.jpg",
  "genres": ["Action"],
  "detailPageUrl": "https://www.cineplex.com/Movie/the-odyssey",
  "isNowPlaying": true,
  "isComingSoon": false,
  "hasShowtimes": true
}
```

## GET /theatres

`?language=en&range=100000&skip=0&take=200`

Returns `{ favouriteTheatres: [], nearbyTheatres: Theatre[], otherTheatres: Theatre[] }`.
`nearbyTheatres` is relative to a default origin (Toronto); **the full national list is
`nearbyTheatres` concat `otherTheatres`** (~152 theatres). The `location=<city>` text
param does NOT work — filter client-side.

```jsonc
// Theatre
{
  "theatreId": 7406,               // locationId used by /showtimes
  "theatreName": "Cineplex Cinemas Yorkdale",
  "theatreUrl": "cineplex-cinemas-yorkdale",
  "location": {
    "address": "Yorkdale Shopping Centre, 3401 Dufferin Street",
    "city": "Toronto",
    "provinceCode": "ON",
    "postalCode": "M6A 2T9",
    "geoLocation": { "latitude": 43.724762, "longitude": -79.45703 }
  }
}
```

## GET /showtimes

`?language=en&locationId=7406&date=07/24/2026&filmId=37617`

- `date` is **MM/DD/YYYY**, one date per request (the website calls it per-day).
- `filmId` is optional; omit to get all movies at that theatre/date.
- Returns `[]`-style structure nested: **theatre → dates → movies → experiences → sessions**.

```jsonc
[
  {
    "theatre": "Cineplex Cinemas Yorkdale",
    "theatreId": 7406,
    "dates": [
      {
        "startDate": "2026-07-24T00:00:00",
        "movies": [
          {
            "id": 37617,
            "name": "The Odyssey",
            "experiences": [
              {
                "experienceTypes": ["UltraAVX", "D-BOX", "Laser Projection"],
                "sessions": [
                  {
                    "vistaSessionId": 310160,        // UNIQUE showtime id — use for diffing
                    "showStartDateTime": "2026-07-24T11:00:00",   // local theatre time
                    "showStartDateTimeUtc": "2026-07-24T15:00:00Z",
                    "auditorium": "AVX #9",
                    "seatsRemaining": 366,
                    "isSoldOut": false,
                    "ticketingUrl": "https://apis.cineplex.com/prod/ticketing/api/v1/routing/redirect-to-ticketing?VistaSessionId=310160&...",
                    "seatMapUrl": "https://www.cineplex.com/en-Mobile/ticketing/preview?theatreId=7406&showtimeId=310160&dbox=True"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]
```

### Advance / coming-soon showings (filmId-only query)

`GET /showtimes?language=en&filmId=<id>` with **no `date` and no `locationId`**
returns every showing for the film across all theatres and dates in one call
(same nested shape). This is the only way to see **advance showings** for
coming-soon films — they sit months beyond any date-by-date forward window
(e.g. Dune: Part 3, a December release, has advance IMAX showings visible in
July). `getFilmShowtimes(filmId)` wraps it.

Caveats:
- **National scope, large payload** — ~15 MB for a wide now-playing film (150
  theatres). Fetch server-side, filter by theatre, and cache (~10 min).
- `filmId + locationId` **without** a date returns an empty body. The API
  supports `filmId` alone, or `filmId + locationId + date` — not
  `filmId + locationId`.

### No conditional requests / caching (verified 2026-07-24)

The showtimes endpoints return `Cache-Control: no-store, must-revalidate,
no-cache` and **no `ETag` or `Last-Modified`**, so `If-None-Match` /
`If-Modified-Since` can't cheaply detect "unchanged" — every poll is a full
fetch. No rate-limit headers (`X-RateLimit-*`, `Retry-After`) are exposed
either, so poll conservatively and tier by need (see architecture §Poller).

### Linking users to a showtime

Use `deeplinkUrl` (public share link; 302-redirects to the movie page with the
session selected). `ticketingUrl` is the website's internal redirect and
returns **401 "user session token not set"** when opened without an active
cineplex.com session (e.g. from an email) — `flattenSessions()` therefore maps
its `ticketingUrl` field to the session's `deeplinkUrl`.

### Diffing "new showings"

`vistaSessionId` is unique per showtime per theatre. A new showing = a
`(theatreId, vistaSessionId)` pair not previously seen for a subscription.
`server/src/cineplex.js#flattenSessions()` produces the flat session list used for this.

## Etiquette

This is an unofficial API. Be a polite client: poll at most every ~30 min,
request only the dates/theatres subscribed to, and send a normal browser-like
`User-Agent`. Don't hammer it.
