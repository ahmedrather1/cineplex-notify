// [WS3: client-ui] Multi-select viewing-format filter. Options are the
// canonical SELECTABLE_FORMATS (mirrors server/src/cineplex.js). A showtime
// matches if its primaryFormat is in the selected set; "Any format" clears
// all and reads active when nothing is selected.

import { SELECTABLE_FORMATS } from './formats.js';

export default function FormatPicker({ value, onChange }) {
  const anyFormat = value.length === 0;

  function toggle(fmt) {
    onChange(value.includes(fmt) ? value.filter((f) => f !== fmt) : [...value, fmt]);
  }

  return (
    <fieldset className="time-window">
      <legend>Which viewing formats?</legend>
      <div className="preset-chips" role="group" aria-label="Viewing formats (pick any)">
        <button
          type="button"
          className={`btn chip-btn ${anyFormat ? 'selected' : ''}`}
          aria-pressed={anyFormat}
          onClick={() => onChange([])}
        >
          Any format
        </button>
        {SELECTABLE_FORMATS.map((fmt) => (
          <button
            key={fmt}
            type="button"
            className={`btn chip-btn ${value.includes(fmt) ? 'selected' : ''}`}
            aria-pressed={value.includes(fmt)}
            onClick={() => toggle(fmt)}
          >
            {fmt}
          </button>
        ))}
      </div>

      <p className="time-window-readout" aria-live="polite">
        Alerts for formats: <strong>{anyFormat ? 'Any format' : value.join(', ')}</strong>
      </p>
    </fieldset>
  );
}
