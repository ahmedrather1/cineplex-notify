import { useState } from 'react';
import { formatWindows } from './timeWindow.js';
import { formatDateRange } from './dateRange.js';
import ShowtimesPanel from './ShowtimesPanel.jsx';
import { popcornBurst } from './popcorn.js';

// Trivial sanity check on top of the browser's type="email" validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailStep({
  movie,
  theatres,
  timeWindows,
  dateRange,
  onBack,
  onSubmit,
  submitting,
  apiError,
}) {
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    setLocalError(null);
    // Celebrate from the submit button; the POST is not delayed by this.
    const btn = e.currentTarget.querySelector('button[type="submit"]');
    if (btn) {
      const r = btn.getBoundingClientRect();
      popcornBurst(r.left + r.width / 2, r.top + r.height / 2);
    }
    onSubmit(trimmed);
  }

  const error = localError || apiError;

  return (
    <section>
      <h2>3. Where should we send alerts?</h2>

      <dl className="summary">
        <dt>Movie</dt>
        <dd>
          {movie.name}
          {movie.detailPageUrl && (
            <>
              {' '}
              <a
                className="out-link"
                href={movie.detailPageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Cineplex ↗
              </a>
            </>
          )}
        </dd>
        <dt>Theatres ({theatres.length})</dt>
        <dd>{theatres.map((t) => t.name).join(' · ')}</dd>
        <dt>Showtime window</dt>
        <dd>{formatWindows(timeWindows)}</dd>
        <dt>Dates</dt>
        <dd>{formatDateRange(dateRange)}</dd>
      </dl>

      <ShowtimesPanel
        movie={movie}
        theatreIds={theatres.map((t) => t.theatreId)}
        timeWindows={timeWindows}
        dateRange={dateRange}
      />

      <form className="email-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          className="text-input"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="step-nav">
          <button type="button" className="btn" onClick={onBack} disabled={submitting}>
            ← Back
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Subscribing…' : 'Subscribe to alerts'}
          </button>
        </div>
      </form>
    </section>
  );
}
