// [WS3: client-ui] Three-step subscribe flow — see docs/workstreams/03-client-ui.md.
// Nothing is persisted in the browser; all data comes from /api via src/api.js.

import { useEffect, useState } from 'react';
import { fetchMovies, fetchTheatres, createSubscription } from './api.js';
import MovieStep from './MovieStep.jsx';
import TheatreStep from './TheatreStep.jsx';
import EmailStep from './EmailStep.jsx';
import { buildWindows, formatWindows } from './timeWindow.js';
import { formatDateRange } from './dateRange.js';
import { popcornBurst } from './popcorn.js';

// No windows selected: presets empty, custom off — "any time".
const NO_WINDOWS = { presets: [], custom: null };

const STEPS = ['Movie', 'Theatres', 'Email'];

// Poster on the success card; hides itself when the URL is missing or the
// image fails to load (hasPosterImage can be false upstream). Keyed by
// movie id at the call site so the failure state resets per movie.
function SuccessPoster({ movie }) {
  const [failed, setFailed] = useState(false);
  if (!movie.posterUrl || failed) return null;
  return (
    <img
      className="success-poster"
      src={movie.posterUrl}
      alt={movie.name}
      onError={() => setFailed(true)}
    />
  );
}

export default function App() {
  // 0 = movie, 1 = theatres, 2 = email, 3 = success
  const [step, setStep] = useState(0);

  const [movies, setMovies] = useState(null);
  const [theatres, setTheatres] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadKey, setLoadKey] = useState(0); // bump to retry

  const [movie, setMovie] = useState(null);
  const [theatreIds, setTheatreIds] = useState([]);
  const [timeSelection, setTimeSelection] = useState(NO_WINDOWS);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [formats, setFormats] = useState([]);

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
        timeWindows,
        dateStart: dateRange.start || undefined,
        dateEnd: dateRange.end || undefined,
        formats,
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
    setTimeSelection(NO_WINDOWS);
    setDateRange({ start: '', end: '' });
    setFormats([]);
    setApiError(null);
    setConfirmedEmail(null);
  }

  const selectedTheatres = theatres
    ? theatres.filter((t) => theatreIds.includes(t.theatreId))
    : [];

  // The timeWindows payload derived from the current selection ([] = any time).
  const timeWindows = buildWindows(timeSelection);

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
        onSelect={(m, event) => {
          // Keyboard activation reports (0, 0) — burst from the card instead.
          let { clientX: x, clientY: y } = event;
          if (!x && !y) {
            const r = event.currentTarget.getBoundingClientRect();
            x = r.left + r.width / 2;
            y = r.top + r.height / 2;
          }
          popcornBurst(x, y);
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
        timeSelection={timeSelection}
        onTimeSelectionChange={setTimeSelection}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        formats={formats}
        onFormatsChange={setFormats}
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
        timeWindows={timeWindows}
        dateRange={dateRange}
        formats={formats}
        onBack={() => setStep(1)}
        onSubmit={submit}
        submitting={submitting}
        apiError={apiError}
      />
    );
  } else {
    body = (
      <section className="success">
        <div className="success-layout">
          <SuccessPoster key={movie.id} movie={movie} />
          <div className="success-body">
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
            <p>
              Showtime window: <strong>{formatWindows(timeWindows)}</strong>
              <br />
              Dates: <strong>{formatDateRange(dateRange)}</strong>
              <br />
              Formats: <strong>{formats.length ? formats.join(', ') : 'Any format'}</strong>
            </p>
            <p className="fine-print">
              Every email we send includes an unsubscribe link, so you can stop
              the alerts at any time.
            </p>
            <button type="button" className="btn btn-primary" onClick={reset}>
              Set up another alert
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Success state: the app header is hidden and the card is centered in the
  // viewport — the card carries its own context, and keeping the pinned
  // header would fight the vertical centering and leave dead space below.
  const isSuccess = step === 3;

  return (
    <>
      <main className={isSuccess ? 'app app-centered' : 'app'}>
        {!isSuccess && (
          <header className="app-header">
            <h1>Marquee</h1>
            <p>
              Pick a movie and your theatres, leave an email, and get notified when
              new showtimes are released.
            </p>
          </header>
        )}

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

      <footer className="site-disclaimer">
        Marquee is an independent service, not affiliated with, endorsed by, or
        sponsored by Cineplex Entertainment Inc. Showtime and movie data come from
        publicly available Cineplex listings; all trademarks belong to their
        respective owners.
      </footer>
    </>
  );
}
