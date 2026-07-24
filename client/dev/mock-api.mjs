// [WS3: client-ui] Dev-only mock of the internal REST contract
// (docs/architecture.md §Internal REST contract), for building the client
// while WS1 is unfinished. Not used by the committed app code — the app
// always talks to /api via src/api.js; point Vite here with:
//
//   node client/dev/mock-api.mjs            # listens on :3021
//   VITE_API_PROXY=http://localhost:3021 npm run dev -w client
//
// POSTing { email: "fail@example.com", ... } returns 400 so the inline
// error path can be exercised.

import http from 'node:http';
import crypto from 'node:crypto';

const PORT = process.env.PORT || 3021;

const poster = (id) =>
  `https://mediafiles.cineplex.com/Central/Film/Posters/${id}_320_470.jpg`;

const slugify = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const movies = [
  { id: 37617, name: 'Dune: Part Three', releaseDate: '2026-12-18', posterUrl: poster(37617), genres: ['Science Fiction', 'Adventure'], isNowPlaying: false, isComingSoon: true },
  { id: 36981, name: 'The Batman: Shadows of Gotham', releaseDate: '2026-10-02', posterUrl: poster(36981), genres: ['Action', 'Crime'], isNowPlaying: false, isComingSoon: true },
  { id: 36754, name: 'Avatar: Fire and Ash', releaseDate: '2025-12-19', posterUrl: poster(36754), genres: ['Science Fiction', 'Adventure'], isNowPlaying: true, isComingSoon: false },
  { id: 37102, name: 'Wicked: For Good', releaseDate: '2025-11-21', posterUrl: poster(37102), genres: ['Musical', 'Fantasy'], isNowPlaying: true, isComingSoon: false },
  { id: 37340, name: 'Mission: Impossible — Reckoning', releaseDate: '2026-05-22', posterUrl: poster(37340), genres: ['Action', 'Thriller'], isNowPlaying: true, isComingSoon: false },
  { id: 37455, name: 'Toy Story 5', releaseDate: '2026-06-19', posterUrl: poster(37455), genres: ['Animation', 'Family'], isNowPlaying: false, isComingSoon: true },
  { id: 36899, name: 'The Odyssey', releaseDate: '2026-07-17', posterUrl: poster(36899), genres: ['Drama', 'Adventure'], isNowPlaying: true, isComingSoon: false },
  { id: 37201, name: 'Supergirl: Woman of Tomorrow', releaseDate: '2026-06-26', posterUrl: poster(37201), genres: ['Action', 'Science Fiction'], isNowPlaying: true, isComingSoon: false },
  { id: 37518, name: 'Shrek 5', releaseDate: '2026-12-23', posterUrl: poster(37518), genres: ['Animation', 'Comedy'], isNowPlaying: false, isComingSoon: true },
  { id: 37044, name: 'F1: The Movie', releaseDate: '2025-06-27', posterUrl: poster(37044), genres: ['Drama', 'Sports'], isNowPlaying: true, isComingSoon: false },
  { id: 37299, name: 'The Bride!', releaseDate: '2026-03-06', posterUrl: poster(37299), genres: ['Horror', 'Romance'], isNowPlaying: true, isComingSoon: false },
  { id: 37633, name: 'Spider-Man: Brand New Day', releaseDate: '2026-07-31', posterUrl: poster(37633), genres: ['Action', 'Adventure'], isNowPlaying: false, isComingSoon: true },
  { id: 36820, name: 'Knives Out: Wake Up Dead Man', releaseDate: '2025-12-12', posterUrl: poster(36820), genres: ['Mystery', 'Comedy'], isNowPlaying: true, isComingSoon: false },
  { id: 37710, name: 'Moana (Live Action)', releaseDate: '2026-07-10', posterUrl: poster(37710), genres: ['Family', 'Adventure'], isNowPlaying: false, isComingSoon: true },
];

// Same shape as the real server (server/src/cineplex.js#getMovies).
for (const m of movies) {
  m.detailPageUrl = `https://www.cineplex.com/movie/${slugify(m.name)}`;
}

const theatres = [
  { theatreId: 1412, name: 'Cineplex Cinemas Yonge-Dundas and VIP', city: 'Toronto', provinceCode: 'ON' },
  { theatreId: 1408, name: 'Cineplex Cinemas Varsity and VIP', city: 'Toronto', provinceCode: 'ON' },
  { theatreId: 1416, name: 'Scotiabank Theatre Toronto', city: 'Toronto', provinceCode: 'ON' },
  { theatreId: 1421, name: 'Cineplex Cinemas Scarborough', city: 'Scarborough', provinceCode: 'ON' },
  { theatreId: 1433, name: 'Cineplex Cinemas Queensway and VIP', city: 'Etobicoke', provinceCode: 'ON' },
  { theatreId: 1445, name: 'Cineplex Cinemas Vaughan', city: 'Vaughan', provinceCode: 'ON' },
  { theatreId: 1290, name: 'Cineplex Cinemas Mississauga', city: 'Mississauga', provinceCode: 'ON' },
  { theatreId: 1305, name: 'SilverCity Burlington Cinemas', city: 'Burlington', provinceCode: 'ON' },
  { theatreId: 1178, name: 'Cineplex Cinemas Ottawa', city: 'Ottawa', provinceCode: 'ON' },
  { theatreId: 1183, name: 'SilverCity Gloucester Cinemas', city: 'Gloucester', provinceCode: 'ON' },
  { theatreId: 8115, name: 'Cinéma Cineplex Forum et VIP', city: 'Montréal', provinceCode: 'QC' },
  { theatreId: 8129, name: 'Cinéma Banque Scotia Montréal', city: 'Montréal', provinceCode: 'QC' },
  { theatreId: 8143, name: 'Cinéma Cineplex Odeon Beauport', city: 'Québec', provinceCode: 'QC' },
  { theatreId: 3517, name: 'Scotiabank Theatre Vancouver', city: 'Vancouver', provinceCode: 'BC' },
  { theatreId: 3522, name: 'Cineplex Cinemas Marine Gateway and VIP', city: 'Vancouver', provinceCode: 'BC' },
  { theatreId: 3534, name: 'Cineplex Cinemas Metropolis', city: 'Burnaby', provinceCode: 'BC' },
  { theatreId: 3548, name: 'SilverCity Riverport Cinemas', city: 'Richmond', provinceCode: 'BC' },
  { theatreId: 2612, name: 'Scotiabank Theatre Chinook', city: 'Calgary', provinceCode: 'AB' },
  { theatreId: 2627, name: 'Cineplex Odeon South Edmonton Cinemas', city: 'Edmonton', provinceCode: 'AB' },
  { theatreId: 4210, name: 'Scotiabank Theatre Winnipeg', city: 'Winnipeg', provinceCode: 'MB' },
  { theatreId: 5308, name: 'Cineplex Cinemas Park Lane', city: 'Halifax', provinceCode: 'NS' },
];

// --- GET /api/showtimes fixtures --------------------------------------
// Returns ALL upcoming sessions for the movie (no `days` param): near-term
// for now-playing films, and far-future advance dates for coming-soon films
// so the client's Advance badge + far-date headers are exercisable. Theatre
// 1416 (Scotiabank Theatre Toronto) always returns empty sessions so the
// empty state is exercisable.
const EMPTY_SESSIONS_THEATRE = 1416;

const pad2 = (n) => String(n).padStart(2, '0');

function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Now-playing plan: day 1 mixes several viewing formats (with multi-tag
// sessions) so the format grouping is visible; day 2 is single-format
// (Regular only) to confirm a one-format day still reads fine. Times are
// intentionally out of order to prove per-format time sorting on the client.
const NOW_PLAYING_PLAN = [
  // [dayOffset, 'HH:MM', experienceTypes, auditorium, isSoldOut]
  [1, '20:10', ['Regular'], 'Auditorium 3', false],
  [1, '12:00', ['Regular'], 'Auditorium 3', false],
  [1, '18:45', ['IMAX', '70mm'], 'Auditorium 1', true],
  [1, '13:30', ['IMAX', '70mm'], 'Auditorium 1', false],
  [1, '15:20', ['Regular'], 'Auditorium 4', false],
  [1, '19:30', ['UltraAVX', 'D-BOX', 'Laser Projection'], 'Auditorium 7', false],
  [1, '14:00', ['UltraAVX'], 'Auditorium 7', false],
  [1, '16:40', ['D-BOX'], 'Auditorium 6', false],
  [1, '22:15', ['IMAX'], 'Auditorium 1', false],
  [2, '16:10', ['Regular'], 'Auditorium 5', false],
  [2, '13:00', ['Regular'], 'Auditorium 5', false],
  [2, '23:50', ['Regular'], 'Auditorium 5', false],
];

// Coming-soon plan: only far-future advance dates (all > 30 days out; the
// last crosses into next year to exercise the year-in-header path).
const ADVANCE_PLAN = [
  [146, '18:30', ['IMAX'], 'Auditorium 1', false],
  [146, '21:45', ['70mm'], 'Auditorium 2', false],
  [147, '19:00', ['UltraAVX'], 'Auditorium 1', false],
  [250, '20:00', ['IMAX'], 'Auditorium 1', false],
];

function sessionsFor(movieId, theatreId) {
  if (theatreId === EMPTY_SESSIONS_THEATRE) return [];
  const movie = movies.find((m) => m.id === movieId);
  const plan = movie && movie.isComingSoon ? ADVANCE_PLAN : NOW_PLAYING_PLAN;
  return plan.map(([offset, hhmm, experienceTypes, auditorium, isSoldOut], i) => {
    const sessionId = theatreId * 1000 + i;
    return {
      sessionId,
      showStartDateTime: `${dateStr(offset)}T${hhmm}:00`,
      experienceTypes,
      auditorium,
      isSoldOut,
      ticketingUrl: `https://tickets.cineplex.com/?sessionId=${sessionId}`,
    };
  });
}

function handleShowtimes(url, res) {
  const params = new URL(url, 'http://localhost').searchParams;
  const movieId = Number(params.get('movieId'));
  const rawIds = params.get('theatreIds') || '';
  const theatreIds = rawIds === '' ? [] : rawIds.split(',').map((s) => Number(s.trim()));

  // No `days` param anymore — the film call spans the whole window.
  const bad =
    !Number.isInteger(movieId) ||
    movieId <= 0 ||
    theatreIds.length === 0 ||
    theatreIds.length > 5 ||
    theatreIds.some((n) => !Number.isInteger(n) || n <= 0);
  if (bad) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'movieId and theatreIds (1-5 comma-separated ints) are required' }));
    return;
  }

  const body = theatreIds.map((theatreId) => ({
    theatreId,
    theatreName:
      theatres.find((t) => t.theatreId === theatreId)?.name || `Theatre ${theatreId}`,
    sessions: sessionsFor(movieId, theatreId),
  }));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

const server = http.createServer((req, res) => {
  const { method, url } = req;

  if (method === 'GET' && url === '/api/movies') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(movies));
    return;
  }

  if (method === 'GET' && url === '/api/theatres') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(theatres));
    return;
  }

  if (method === 'GET' && url.startsWith('/api/showtimes')) {
    handleShowtimes(url, res);
    return;
  }

  if (method === 'POST' && url === '/api/subscriptions') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body || '{}');
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }
      // Old flat timeStart/timeEnd keys are gone from the contract; if a
      // stale client sends them they are simply ignored, not validated.
      const { email, movieId, movieName, theatreIds, timeWindows, dateStart, dateEnd, formats } = parsed;
      if (!email || !movieId || !movieName || !Array.isArray(theatreIds) || theatreIds.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'email, movieId, movieName and non-empty theatreIds are required' }));
        return;
      }
      // Optional timeWindows: array (max 6) of { start?, end? }; each entry
      // must be an object with at least one bound and every present bound a
      // valid 'HH:MM' 24h string (docs/architecture.md §Internal REST contract).
      const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (timeWindows !== undefined) {
        const badWindows =
          !Array.isArray(timeWindows) ||
          timeWindows.length > 6 ||
          timeWindows.some(
            (w) =>
              typeof w !== 'object' ||
              w === null ||
              Array.isArray(w) ||
              (w.start === undefined && w.end === undefined) ||
              (w.start !== undefined && (typeof w.start !== 'string' || !HHMM_RE.test(w.start))) ||
              (w.end !== undefined && (typeof w.end !== 'string' || !HHMM_RE.test(w.end)))
          );
        if (badWindows) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: "timeWindows must be an array (max 6) of { start?, end? } objects with at least one 'HH:MM' 24h bound each",
          }));
          return;
        }
      }
      // Optional dateStart/dateEnd: 'YYYY-MM-DD', each independently
      // optional, both inclusive; dateStart <= dateEnd, dateEnd not in the
      // past (docs/architecture.md §Internal REST contract).
      const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
      for (const [field, val] of [['dateStart', dateStart], ['dateEnd', dateEnd]]) {
        if (val !== undefined && (typeof val !== 'string' || !DATE_RE.test(val))) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `${field} must be a 'YYYY-MM-DD' date` }));
          return;
        }
      }
      if (dateStart !== undefined && dateEnd !== undefined && dateStart > dateEnd) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'dateStart must be on or before dateEnd' }));
        return;
      }
      if (dateEnd !== undefined) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        if (dateEnd < today) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'dateEnd must not be in the past' }));
          return;
        }
      }
      // Optional formats: array of canonical values from SELECTABLE_FORMATS
      // (mirrors server/src/cineplex.js). A value outside the set or a
      // non-array → 400 (docs/architecture.md §Internal REST contract).
      const SELECTABLE_FORMATS = ['Regular', 'IMAX', 'UltraAVX', 'VIP', 'D-BOX', 'ScreenX', '4DX', '3D'];
      if (formats !== undefined) {
        const badFormats =
          !Array.isArray(formats) ||
          formats.some((f) => !SELECTABLE_FORMATS.includes(f));
        if (badFormats) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: `formats must be an array of ${SELECTABLE_FORMATS.join(', ')}`,
          }));
          return;
        }
      }
      if (email === 'fail@example.com') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'This email address is not accepting subscriptions (mock failure)' }));
        return;
      }
      // Echo the windows/dates/formats back so dev payloads are verifiable.
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: crypto.randomUUID(),
        ...(timeWindows !== undefined ? { timeWindows } : {}),
        ...(dateStart !== undefined ? { dateStart } : {}),
        ...(dateEnd !== undefined ? { dateEnd } : {}),
        ...(formats !== undefined ? { formats } : {}),
      }));
    });
    return;
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`[mock-api] listening on http://localhost:${PORT}`);
});
