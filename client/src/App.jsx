// [WS3: client-ui] Three-step subscribe flow — see docs/workstreams/03-client-ui.md.
// Nothing is persisted in the browser; all data comes from /api via src/api.js.

import { useEffect, useState } from 'react';
import { fetchMovies, fetchTheatres, createSubscription } from './api.js';
import MovieStep from './MovieStep.jsx';
import TheatreStep from './TheatreStep.jsx';
import EmailStep from './EmailStep.jsx';

const STEPS = ['Movie', 'Theatres', 'Email'];

export default function App() {
  // 0 = movie, 1 = theatres, 2 = email, 3 = success
  const [step, setStep] = useState(0);

  const [movies, setMovies] = useState(null);
  const [theatres, setTheatres] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadKey, setLoadKey] = useState(0); // bump to retry

  const [movie, setMovie] = useState(null);
  const [theatreIds, setTheatreIds] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [confirmedEmail, setConfirmedEmail] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    Promise.all([fetchMovies(), fetchTheatres()])
      .then(([m, t]) => {
        if (cancelled) return;
        setMovies(m);
        setTheatres(t);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [loadKey]);

  function toggleTheatre(id) {
    setTheatreIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  async function submit(email) {
    setSubmitting(true);
    setApiError(null);
    try {
      await createSubscription({
        email,
        movieId: movie.id,
        movieName: movie.name,
        theatreIds,
      });
      setConfirmedEmail(email);
      setStep(3);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(0);
    setMovie(null);
    setTheatreIds([]);
    setApiError(null);
    setConfirmedEmail(null);
  }

  const selectedTheatres = theatres
    ? theatres.filter((t) => theatreIds.includes(t.theatreId))
    : [];

  let body;
  if (loadError) {
    body = (
      <div>
        <p className="error" role="alert">
          Couldn&rsquo;t load data: {loadError}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setLoadKey((k) => k + 1)}>
          Try again
        </button>
      </div>
    );
  } else if (!movies || !theatres) {
    body = <p className="state-msg">Loading movies and theatres…</p>;
  } else if (step === 0) {
    body = (
      <MovieStep
        movies={movies}
        onSelect={(m) => {
          setMovie(m);
          setStep(1);
        }}
      />
    );
  } else if (step === 1) {
    body = (
      <TheatreStep
        theatres={theatres}
        selectedIds={theatreIds}
        onToggle={toggleTheatre}
        onBack={() => setStep(0)}
        onNext={() => {
          setApiError(null);
          setStep(2);
        }}
      />
    );
  } else if (step === 2) {
    body = (
      <EmailStep
        movie={movie}
        theatres={selectedTheatres}
        onBack={() => setStep(1)}
        onSubmit={submit}
        submitting={submitting}
        apiError={apiError}
      />
    );
  } else {
    body = (
      <section className="success">
        <h2>You&rsquo;re subscribed!</h2>
        <p>
          We&rsquo;ll email <strong>{confirmedEmail}</strong> when new showtimes for{' '}
          <strong>{movie.name}</strong> are released at:
        </p>
        <ul>
          {selectedTheatres.map((t) => (
            <li key={t.theatreId}>
              {t.name} — {t.city}, {t.provinceCode}
            </li>
          ))}
        </ul>
        <p className="fine-print">
          Every email we send includes an unsubscribe link, so you can stop the
          alerts at any time.
        </p>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Set up another alert
        </button>
      </section>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Cineplex Showtime Alerts</h1>
        <p>
          Pick a movie and your theatres, leave an email, and get notified when
          new showtimes are released.
        </p>
      </header>

      {step < 3 && (
        <ol className="steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i === step ? 'active' : i < step ? 'done' : ''}>
              {i + 1}. {label}
            </li>
          ))}
        </ol>
      )}

      {body}
    </main>
  );
}
