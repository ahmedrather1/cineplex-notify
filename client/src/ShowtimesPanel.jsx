// [WS3: client-ui] Collapsible "Current showtimes" preview for the confirm
// step. Closed by default; data is fetched eagerly on mount so the collapsed
// header can advertise what is inside (count of showings/theatres) without a
// click. showStartDateTime is theatre-local wall-clock time, so it is
// formatted by string parsing — never through Date's timezone conversion.
// Sessions outside every selected time window are de-emphasized (dimmed +
// labelled), not hidden. All cards are uniform in size; ticket links always
// open in a new tab.

import { useEffect, useState } from 'react';
import { fetchShowtimes } from './api.js';
import { formatTime, matchesAny } from './timeWindow.js';
import { isDateInRange } from './dateRange.js';

/** '2026-07-24T18:45:00' → { dateLabel: 'Fri, Jul 24', hhmm: '18:45' } */
function splitLocal(showStartDateTime) {
  const [date, time = ''] = showStartDateTime.split('T');
  const [y, mo, d] = date.split('-').map(Number);
  // Construct from components (local, no TZ shift) purely to name the weekday.
  const label = new Date(y, mo - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return { dateLabel: label, hhmm: time.slice(0, 5) };
}

function groupByDate(sessions) {
  const groups = [];
  for (const s of sessions) {
    const { dateLabel, hhmm } = splitLocal(s.showStartDateTime);
    let g = groups[groups.length - 1];
    if (!g || g.dateLabel !== dateLabel) {
      g = { dateLabel, sessions: [] };
      groups.push(g);
    }
    g.sessions.push({ ...s, hhmm });
  }
  return groups;
}

function SessionCard({ session, outsideTime, outsideDates }) {
  const sub = [...(session.experienceTypes || []), session.auditorium]
    .filter(Boolean)
    .join(' · ');
  // One fixed-height flag row on every card so in-window and out-of-window
  // cards keep identical dimensions. Priority when several apply:
  // sold-out > outside dates > outside time window.
  const outside = outsideTime || outsideDates;
  const flag = session.isSoldOut
    ? 'Sold out'
    : outsideDates
      ? 'Outside your dates'
      : outsideTime
        ? 'Outside your window'
        : null;
  const className = `session${session.isSoldOut ? ' sold-out' : ''}${outside ? ' outside-window' : ''}`;

  const inner = (
    <>
      <span className="session-time">{formatTime(session.hhmm)}</span>
      <span className="session-sub" title={sub}>
        {sub || ' '}
      </span>
      <span className="session-flag-row">
        {flag && <span className="session-flag">{flag}</span>}
      </span>
    </>
  );

  // The whole card is the anchor (no dead zones); sessions without a
  // ticketing link render as plain, non-clickable cards.
  if (!session.ticketingUrl) {
    return <span className={`${className} no-link`}>{inner}</span>;
  }
  return (
    <a className={className} href={session.ticketingUrl} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  );
}

export default function ShowtimesPanel({ movie, theatreIds, timeWindows, dateRange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const [open, setOpen] = useState(false);

  const idsKey = theatreIds.join(',');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetchShowtimes({ movieId: movie.id, theatreIds })
      .then((rows) => {
        if (!cancelled) setData(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie.id, idsKey, retryKey]);

  const totalSessions = data ? data.reduce((n, t) => n + t.sessions.length, 0) : 0;

  let headerSummary;
  if (error) headerSummary = 'unavailable';
  else if (!data) headerSummary = 'loading…';
  else if (totalSessions === 0) headerSummary = 'none released yet';
  else {
    headerSummary = `${totalSessions} across ${data.length} theatre${data.length === 1 ? '' : 's'}`;
  }

  let body;
  if (error) {
    body = (
      <div>
        <p className="error" role="alert">
          Couldn&rsquo;t load showtimes: {error}
        </p>
        <button type="button" className="btn chip-btn" onClick={() => setRetryKey((k) => k + 1)}>
          Try again
        </button>
      </div>
    );
  } else if (!data) {
    body = <p className="state-msg">Loading showtimes…</p>;
  } else if (totalSessions === 0) {
    body = (
      <p className="empty">
        No showtimes released yet — that&rsquo;s what the alert is for.
      </p>
    );
  } else {
    body = (
      <div className="showtimes-scroll">
        {data.map((t) => (
          <div key={t.theatreId} className="showtimes-theatre">
            <h4>{t.theatreName}</h4>
            {t.sessions.length === 0 ? (
              <p className="empty">No showtimes released yet at this theatre.</p>
            ) : (
              groupByDate(t.sessions).map((g) => (
                <div key={g.dateLabel} className="showtimes-day">
                  <span className="showtimes-date">{g.dateLabel}</span>
                  <ul className="session-list">
                    {g.sessions.map((s) => (
                      <li key={s.sessionId}>
                        <SessionCard
                          session={s}
                          outsideTime={
                            timeWindows.length > 0 && !matchesAny(s.hhmm, timeWindows)
                          }
                          outsideDates={
                            Boolean(dateRange.start || dateRange.end) &&
                            !isDateInRange(s.showStartDateTime.split('T')[0], dateRange)
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="showtimes-panel">
      <h3>
        <button
          type="button"
          className="disclosure"
          aria-expanded={open}
          aria-controls="showtimes-body"
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`chevron${open ? ' open' : ''}`} aria-hidden="true">
            ▸
          </span>
          Current showtimes
          <span className="disclosure-summary">({headerSummary})</span>
        </button>
      </h3>
      {open && (
        <div id="showtimes-body" className="showtimes-body">
          <p className="hint">
            Already on sale for the next 7 days. Your alert covers anything
            released after this.
          </p>
          {body}
        </div>
      )}
    </section>
  );
}
