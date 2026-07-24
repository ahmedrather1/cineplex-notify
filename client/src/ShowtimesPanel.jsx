// [WS3: client-ui] "Current showtimes" preview for the confirm step: what is
// already on sale for the chosen movie/theatres. showStartDateTime is
// theatre-local wall-clock time, so it is formatted by string parsing —
// never through Date's timezone conversion. Sessions outside the chosen
// time-of-day window are de-emphasized (dimmed + labelled), not hidden, so
// the user can see what their window excludes.

import { useEffect, useState } from 'react';
import { fetchShowtimes } from './api.js';
import { formatTime, isInWindow } from './timeWindow.js';

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

export default function ShowtimesPanel({ movie, theatreIds, timeWindow }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

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

  const hasWindow = Boolean(timeWindow.timeStart || timeWindow.timeEnd);

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
  } else if (data.every((t) => t.sessions.length === 0)) {
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
                    {g.sessions.map((s) => {
                      const outside = hasWindow && !isInWindow(s.hhmm, timeWindow);
                      return (
                        <li key={s.sessionId}>
                          <a
                            className={`session${s.isSoldOut ? ' sold-out' : ''}${outside ? ' outside-window' : ''}`}
                            href={s.ticketingUrl}
                            target="_blank"
                            rel="noopener"
                          >
                            <span className="session-time">{formatTime(s.hhmm)}</span>
                            <span className="session-sub">
                              {[...(s.experienceTypes || []), s.auditorium]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                            {s.isSoldOut && <span className="session-flag">Sold out</span>}
                            {outside && (
                              <span className="session-flag">Outside your window</span>
                            )}
                          </a>
                        </li>
                      );
                    })}
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
    <section className="showtimes-panel" aria-label="Current showtimes">
      <h3>Current showtimes</h3>
      <p className="hint">
        Already on sale for the next 7 days. Your alert covers anything released
        after this.
      </p>
      {body}
    </section>
  );
}
