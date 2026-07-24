import { useMemo, useState } from 'react';
import TimeWindowPicker from './TimeWindowPicker.jsx';
import DateRangePicker from './DateRangePicker.jsx';
import { isRangeReversed } from './dateRange.js';

export default function TheatreStep({
  theatres,
  selectedIds,
  onToggle,
  timeSelection,
  onTimeSelectionChange,
  dateRange,
  onDateRangeChange,
  onBack,
  onNext,
}) {
  const [filter, setFilter] = useState('');

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return theatres;
    return theatres.filter(
      (t) => t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q)
    );
  }, [theatres, filter]);

  const selected = theatres.filter((t) => selectedIds.includes(t.theatreId));

  return (
    <section>
      <h2>2. Pick your theatres</h2>

      {selected.length > 0 && (
        <ul className="chips" aria-label="Selected theatres">
          {selected.map((t) => (
            <li key={t.theatreId} className="chip">
              {t.name}
              <button
                type="button"
                onClick={() => onToggle(t.theatreId)}
                aria-label={`Remove ${t.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="toolbar">
        <input
          className="text-input"
          type="search"
          placeholder="Filter by theatre or city…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter theatres by name or city"
        />
      </div>

      {visible.length === 0 ? (
        <p className="empty">No theatres match your filter.</p>
      ) : (
        <div className="theatre-list">
          {visible.map((t) => (
            <label key={t.theatreId} className="theatre-row">
              <input
                type="checkbox"
                checked={selectedIds.includes(t.theatreId)}
                onChange={() => onToggle(t.theatreId)}
              />
              <span>
                <span className="theatre-name">{t.name}</span>{' '}
                <span className="theatre-city">
                  {t.city}, {t.provinceCode}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      <TimeWindowPicker value={timeSelection} onChange={onTimeSelectionChange} />

      <DateRangePicker value={dateRange} onChange={onDateRangeChange} />

      <div className="step-nav">
        <button type="button" className="btn" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNext}
          disabled={selectedIds.length === 0 || isRangeReversed(dateRange)}
        >
          Continue ({selectedIds.length} selected)
        </button>
      </div>
    </section>
  );
}
