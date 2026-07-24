// Cineplex API client (shared foundation — see docs/cineplex-api.md).
// Endpoints verified 2026-07-23. Pure fetch, no dependencies.

const BASE = 'https://apis.cineplex.com/prod/cpx/theatrical/api/v1';
const KEY = process.env.CINEPLEX_API_KEY || 'dcdac5601d864addbc2675a2e96cb1f8';

async function cx(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: {
      'Ocp-Apim-Subscription-Key': KEY,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Cineplex API ${path} responded ${res.status}`);
  }
  return res.json();
}

/** All movies (now playing + coming soon), normalized. */
export async function getMovies() {
  const data = await cx('/movies', { language: 'en' });
  return (data.items || []).map((m) => ({
    id: m.id,
    name: m.name,
    releaseDate: m.releaseDate,
    runtimeInMinutes: m.runtimeInMinutes,
    posterUrl: m.mediumPosterImageUrl,
    genres: m.genres || [],
    detailPageUrl: m.detailPageUrl,
    isNowPlaying: m.isNowPlaying,
    isComingSoon: m.isComingSoon,
    hasShowtimes: m.hasShowtimes,
  }));
}

/** Full national theatre list (nearby + other, relative to default origin), normalized. */
export async function getTheatres() {
  const data = await cx('/theatres', {
    language: 'en',
    range: 100000,
    skip: 0,
    take: 200,
  });
  const all = [...(data.nearbyTheatres || []), ...(data.otherTheatres || [])];
  return all.map((t) => ({
    theatreId: t.theatreId,
    name: t.theatreName,
    city: t.location?.city ?? '',
    provinceCode: t.location?.provinceCode ?? '',
  }));
}

/**
 * Raw showtimes for one theatre + date (+ optional film).
 * @param {{locationId: number, date: Date|string, filmId?: number}} opts
 *   date: Date or 'MM/DD/YYYY' string (Cineplex's required format).
 */
export async function getShowtimes({ locationId, date, filmId }) {
  return cx('/showtimes', {
    language: 'en',
    locationId,
    date: date instanceof Date ? toApiDate(date) : date,
    filmId,
  });
}

/** Format a Date as the MM/DD/YYYY string the showtimes endpoint requires. */
export function toApiDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/**
 * Flatten the nested showtimes response (theatre → dates → movies →
 * experiences → sessions) into one session per row. `vistaSessionId` is the
 * unique showtime id used for new-showing diffing.
 */
export function flattenSessions(showtimesResponse) {
  const out = [];
  for (const theatre of showtimesResponse || []) {
    for (const day of theatre.dates || []) {
      for (const movie of day.movies || []) {
        for (const exp of movie.experiences || []) {
          for (const s of exp.sessions || []) {
            out.push({
              sessionId: s.vistaSessionId,
              theatreId: theatre.theatreId,
              theatreName: theatre.theatre,
              movieId: movie.id,
              movieName: movie.name,
              experienceTypes: exp.experienceTypes || [],
              showStartDateTime: s.showStartDateTime, // local theatre time
              showStartDateTimeUtc: s.showStartDateTimeUtc,
              auditorium: s.auditorium,
              isSoldOut: s.isSoldOut,
              // deeplinkUrl is Cineplex's public share link (302 → movie page with
              // the session selected). s.ticketingUrl is their internal redirect and
              // 401s ("user session token not set") without a cineplex.com session,
              // so it's only a last-resort fallback.
              ticketingUrl: s.deeplinkUrl || s.ticketingUrl,
            });
          }
        }
      }
    }
  }
  return out;
}
