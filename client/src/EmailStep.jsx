import { useState } from 'react';
import { formatWindow } from './timeWindow.js';
import ShowtimesPanel from './ShowtimesPanel.jsx';

// Trivial sanity check on top of the browser's type="email" validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailStep({ movie, theatres, timeWindow, onBack, onSubmit, submitting, apiError }) {
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
                rel="noopener"
              >
                View on Cineplex ↗
              </a>
            </>
          )}
        </dd>
        <dt>Theatres ({theatres.length})</dt>
        <dd>{theatres.map((t) => t.name).join(' · ')}</dd>
        <dt>Showtime window</dt>
        <dd>{formatWindow(timeWindow)}</dd>
      </dl>

      <ShowtimesPanel
        movie={movie}
        theatreIds={theatres.map((t) => t.theatreId)}
        timeWindow={timeWindow}
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
