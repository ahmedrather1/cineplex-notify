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

export const createSubscription = ({ email, movieId, movieName, theatreIds }) =>
  fetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, movieId, movieName, theatreIds }),
  }).then(json);
