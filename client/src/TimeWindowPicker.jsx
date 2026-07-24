// [WS3: client-ui] Multi-select time-of-day picker: Morning / Afternoon /
// Evening / Late night toggle independently (a showtime matches ANY selected
// window); Custom contributes one extra window with optional bounds. "Any
// time" clears everything and reads as active when nothing is selected.

import { PRESETS, buildWindows, formatWindows } from './timeWindow.js';

export default function TimeWindowPicker({ value, onChange }) {
  const { presets, custom } = value;
  const customOn = custom !== null;
  const anyTime = presets.length === 0 && !customOn;

  function togglePreset(key) {
    onChange({
      ...value,
      presets: presets.includes(key)
        ? presets.filter((k) => k !== key)
        : [...presets, key],
    });
  }

  function toggleCustom() {
    onChange({ ...value, custom: customOn ? null : { start: '', end: '' } });
  }

  return (
    <fieldset className="time-window">
      <legend>Only alert me about showtimes…</legend>
      <div className="preset-chips" role="group" aria-label="Showtime windows (pick any)">
        <button
          type="button"
          className={`btn chip-btn ${anyTime ? 'selected' : ''}`}
          aria-pressed={anyTime}
          onClick={() => onChange({ presets: [], custom: null })}
        >
          Any time
        </button>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`btn chip-btn ${presets.includes(p.key) ? 'selected' : ''}`}
            aria-pressed={presets.includes(p.key)}
            onClick={() => togglePreset(p.key)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className={`btn chip-btn ${customOn ? 'selected' : ''}`}
          aria-pressed={customOn}
          onClick={toggleCustom}
        >
          Custom
        </button>
      </div>

      {customOn && (
        <div className="custom-times">
          <label>
            <span>No earlier than</span>
            <input
              className="text-input"
              type="time"
              value={custom.start}
              onChange={(e) => onChange({ ...value, custom: { ...custom, start: e.target.value } })}
            />
          </label>
          <label>
            <span>No later than</span>
            <input
              className="text-input"
              type="time"
              value={custom.end}
              onChange={(e) => onChange({ ...value, custom: { ...custom, end: e.target.value } })}
            />
          </label>
          <p className="hint">
            Leave either empty for no limit. A start later than the end wraps
            past midnight (e.g. 9:00 p.m. – 2:00 a.m.). Combines with any
            presets picked above.
          </p>
        </div>
      )}

      <p className="time-window-readout" aria-live="polite">
        Alerts for showtimes: <strong>{formatWindows(buildWindows(value))}</strong>
      </p>
    </fieldset>
  );
}
