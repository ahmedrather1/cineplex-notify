// [WS3: client-ui] Time-of-day window picker: preset chips plus a custom
// mode exposing raw <input type="time"> bounds (either may stay empty).

import { PRESETS, formatWindow } from './timeWindow.js';

export default function TimeWindowPicker({ value, onChange }) {
  const { preset, timeStart, timeEnd } = value;

  function pickPreset(p) {
    if (p.key === 'custom') {
      // Carry the current bounds into custom mode so switching is not lossy.
      onChange({ preset: 'custom', timeStart, timeEnd });
    } else {
      onChange({ preset: p.key, timeStart: p.timeStart, timeEnd: p.timeEnd });
    }
  }

  return (
    <fieldset className="time-window">
      <legend>Only alert me about showtimes…</legend>
      <div className="preset-chips" role="group" aria-label="Showtime window presets">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`btn chip-btn ${preset === p.key ? 'selected' : ''}`}
            aria-pressed={preset === p.key}
            onClick={() => pickPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="custom-times">
          <label>
            <span>No earlier than</span>
            <input
              className="text-input"
              type="time"
              value={timeStart}
              onChange={(e) => onChange({ ...value, timeStart: e.target.value })}
            />
          </label>
          <label>
            <span>No later than</span>
            <input
              className="text-input"
              type="time"
              value={timeEnd}
              onChange={(e) => onChange({ ...value, timeEnd: e.target.value })}
            />
          </label>
          <p className="hint">
            Leave either empty for no limit. A start later than the end wraps
            past midnight (e.g. 9:00 p.m. – 2:00 a.m.).
          </p>
        </div>
      )}

      <p className="time-window-readout" aria-live="polite">
        Alerts for showtimes: <strong>{formatWindow(value)}</strong>
      </p>
    </fieldset>
  );
}
