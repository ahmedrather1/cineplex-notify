// [WS3: client-ui] Date-range picker: one From/Until pair of optional
// <input type="date"> bounds. Unlike the multi-window time chips, the
// presets here just fill that same single pair ("Any date" clears it), so a
// chip reads as selected only while the inputs exactly match its dates.

import {
  todayISO,
  comingWeekend,
  nextTwoWeeks,
  formatDateRange,
  isRangeReversed,
} from './dateRange.js';

export default function DateRangePicker({ value, onChange }) {
  const today = todayISO();
  const presets = [
    { key: 'any', label: 'Any date', range: { start: '', end: '' } },
    { key: 'weekend', label: 'This weekend', range: comingWeekend() },
    { key: 'twoweeks', label: 'Next 2 weeks', range: nextTwoWeeks() },
  ];
  const reversed = isRangeReversed(value);

  return (
    <fieldset className="time-window">
      <legend>When do you want to go?</legend>
      <div className="preset-chips" role="group" aria-label="Date range presets">
        {presets.map((p) => {
          const selected = value.start === p.range.start && value.end === p.range.end;
          return (
            <button
              key={p.key}
              type="button"
              className={`btn chip-btn ${selected ? 'selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onChange({ ...p.range })}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="custom-times">
        <label>
          <span>From</span>
          <input
            className="text-input"
            type="date"
            min={today}
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
        </label>
        <label>
          <span>Until</span>
          <input
            className="text-input"
            type="date"
            min={today}
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </label>
        <p className="hint">Leave either empty for no limit. Both dates are included.</p>
      </div>

      {reversed && (
        <p className="error" role="alert">
          The From date is after the Until date — swap them to continue.
        </p>
      )}

      <p className="time-window-readout" aria-live="polite">
        Alerts for dates: <strong>{formatDateRange(value)}</strong>
      </p>
    </fieldset>
  );
}
