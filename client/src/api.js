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

// Currently available showings for a movie at the given theatres over the
// next `days` days (docs/architecture.md §Internal REST contract).
export const fetchShowtimes = ({ movieId, theatreIds, days = 7 }) => {
  const params = new URLSearchParams({
    movieId: String(movieId),
    theatreIds: theatreIds.join(','),
    days: String(days),
  });
  return fetch(`/api/showtimes?${params}`).then(json);
};

// timeStart/timeEnd ('HH:MM' 24h) are each optional and only sent when set;
// omitting both means "any time of day".
export const createSubscription = ({ email, movieId, movieName, theatreIds, timeStart, timeEnd }) =>
  fetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      movieId,
      movieName,
      theatreIds,
      ...(timeStart ? { timeStart } : {}),
      ...(timeEnd ? { timeEnd } : {}),
    }),
  }).then(json);
