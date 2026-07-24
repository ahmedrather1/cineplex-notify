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
      const { email, movieId, movieName, theatreIds } = parsed;
      if (!email || !movieId || !movieName || !Array.isArray(theatreIds) || theatreIds.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'email, movieId, movieName and non-empty theatreIds are required' }));
        return;
      }
      if (email === 'fail@example.com') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'This email address is not accepting subscriptions (mock failure)' }));
        return;
      }
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: crypto.randomUUID() }));
    });
    return;
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`[mock-api] listening on http://localhost:${PORT}`);
});
