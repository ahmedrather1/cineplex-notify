import { useState } from 'react';

// Trivial sanity check on top of the browser's type="email" validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailStep({ movie, theatres, onBack, onSubmit, submitting, apiError }) {
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
        <dd>{movie.name}</dd>
        <dt>Theatres ({theatres.length})</dt>
        <dd>{theatres.map((t) => t.name).join(' · ')}</dd>
      </dl>

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
