// [WS3: client-ui] — thin client for the internal REST contract
// (docs/architecture.md §Internal REST contract).

async function json(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const fetchMovies = () => fetch('/api/movies').then(json);
export const fetchTheatres = () => fetch('/api/theatres').then(json);

// All upcoming showings for a movie at the given theatres — today onward,
// including advance/coming-soon dates months out (docs/architecture.md
// §Internal REST contract). No `days` param: the film call spans the whole
// window.
export const fetchShowtimes = ({ movieId, theatreIds }) => {
  const params = new URLSearchParams({
    movieId: String(movieId),
    theatreIds: theatreIds.join(','),
  });
  return fetch(`/api/showtimes?${params}`).then(json);
};

// timeWindows: optional array (max 6) of { start?, end? } 'HH:MM' windows
// matched ANY; only sent when non-empty — omitted means "any time of day".
// dateStart/dateEnd: optional inclusive 'YYYY-MM-DD' bounds, each sent only
// when set — omitted means "any date".
// formats: optional array of canonical viewing formats; only sent when
// non-empty — omitted means "any format".
export const createSubscription = ({
  email,
  movieId,
  movieName,
  theatreIds,
  timeWindows,
  dateStart,
  dateEnd,
  formats,
}) =>
  fetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      movieId,
      movieName,
      theatreIds,
      ...(timeWindows && timeWindows.length > 0 ? { timeWindows } : {}),
      ...(dateStart ? { dateStart } : {}),
      ...(dateEnd ? { dateEnd } : {}),
      ...(formats && formats.length > 0 ? { formats } : {}),
    }),
  }).then(json);
