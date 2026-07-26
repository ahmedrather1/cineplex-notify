// Quick read-only snapshot of the subscriptions DB.
//
// Usage (against production): grab the Postgres PUBLIC connection string from
// Railway (Postgres service → Variables → DATABASE_PUBLIC_URL), then:
//   DATABASE_URL='postgres://…public…' PGSSL=require node scripts/db-inspect.mjs
//
// Read-only: it never writes. Theatre ids are resolved to names via the
// Cineplex API for readability.

import { pool } from '../server/src/db.js';
import { getTheatres } from '../server/src/cineplex.js';

const theatreName = new Map((await getTheatres()).map((t) => [t.theatreId, t.name]));
const name = (id) => theatreName.get(id) || `#${id}`;

const { rows: subs } = await pool.query('SELECT * FROM subscriptions');
const { rows: seen } = await pool.query(
  'SELECT count(*)::int n, count(DISTINCT subscription_id)::int subs FROM seen_sessions'
);

const since = (ms) => subs.filter((s) => Date.now() - new Date(s.created_at) < ms).length;
const tally = (fn) => {
  const m = new Map();
  for (const s of subs) for (const k of [].concat(fn(s))) m.set(k, (m.get(k) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

console.log(`\n=== Marquee subscriptions: ${subs.length} total ===`);
console.log(`new: ${since(24 * 3600e3)} in last 24h, ${since(7 * 24 * 3600e3)} in last 7d`);
console.log(`unique emails: ${new Set(subs.map((s) => s.email.toLowerCase())).size}`);
console.log(`tracked showtimes (seen_sessions): ${seen[0].n} across ${seen[0].subs} subs`);

console.log('\n-- by movie --');
for (const [movie, n] of tally((s) => s.movie_name)) console.log(`  ${n}\t${movie}`);

console.log('\n-- by theatre (top 10) --');
for (const [id, n] of tally((s) => s.theatre_ids).slice(0, 10)) console.log(`  ${n}\t${name(id)}`);

const withTime = subs.filter((s) => (s.time_windows || []).length).length;
const withDate = subs.filter((s) => s.date_start || s.date_end).length;
const withFmt = subs.filter((s) => (s.formats || []).length).length;
console.log('\n-- filter usage --');
console.log(`  time-of-day: ${withTime}   date-range: ${withDate}   format: ${withFmt}   (of ${subs.length})`);

await pool.end();
