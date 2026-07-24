import { useMemo, useState } from 'react';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'now-playing', label: 'Now playing' },
  { key: 'coming-soon', label: 'Coming soon' },
];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MovieStep({ movies, onSelect }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movies.filter((m) => {
      if (filter === 'now-playing' && !m.isNowPlaying) return false;
      if (filter === 'coming-soon' && !m.isComingSoon) return false;
      if (q && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [movies, search, filter]);

  return (
    <section>
      <h2>1. Pick a movie</h2>
      <div className="toolbar">
        <input
          className="text-input"
          type="search"
          placeholder="Search movies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search movies"
        />
        <div className="filter-tabs" role="group" aria-label="Filter movies">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`btn chip-btn ${filter === f.key ? 'selected' : ''}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty">No movies match your search.</p>
      ) : (
        <div className="movie-grid">
          {visible.map((m) => (
            <button
              key={m.id}
              type="button"
              className="movie-card"
              onClick={() => onSelect(m)}
            >
              <img src={m.posterUrl} alt="" loading="lazy" />
              <span className="movie-meta">
                <span className="movie-name">{m.name}</span>
                <span className="movie-sub">
                  {formatDate(m.releaseDate)}
                  {m.genres?.length ? ` · ${m.genres.join(', ')}` : ''}
                </span>
                {m.isNowPlaying && <span className="badge now-playing">Now playing</span>}
                {m.isComingSoon && <span className="badge coming-soon">Coming soon</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
