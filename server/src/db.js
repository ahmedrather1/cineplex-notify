// Postgres access layer (shared foundation — schema in docs/architecture.md).
// Connection via DATABASE_URL. migrate() is idempotent and runs on boot.

import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway/Render managed Postgres requires SSL from outside the private network.
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT NOT NULL,
      movie_id    INTEGER NOT NULL,
      movie_name  TEXT NOT NULL,
      theatre_ids INTEGER[] NOT NULL,
      seeded      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS time_start TEXT;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS time_end TEXT;
    CREATE TABLE IF NOT EXISTS seen_sessions (
      subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      theatre_id      INTEGER NOT NULL,
      session_id      INTEGER NOT NULL,
      PRIMARY KEY (subscription_id, theatre_id, session_id)
    );
  `);
}

export async function createSubscription({
  email,
  movieId,
  movieName,
  theatreIds,
  timeStart = null, // 'HH:MM' 24h, or null for any time
  timeEnd = null,
}) {
  const { rows } = await pool.query(
    `INSERT INTO subscriptions (email, movie_id, movie_name, theatre_ids, time_start, time_end)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [email, movieId, movieName, theatreIds, timeStart, timeEnd]
  );
  return rows[0].id;
}

export async function deleteSubscription(id) {
  const { rowCount } = await pool.query('DELETE FROM subscriptions WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function listSubscriptions() {
  const { rows } = await pool.query('SELECT * FROM subscriptions ORDER BY created_at');
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    movieId: r.movie_id,
    movieName: r.movie_name,
    theatreIds: r.theatre_ids,
    timeStart: r.time_start,
    timeEnd: r.time_end,
    seeded: r.seeded,
    createdAt: r.created_at,
  }));
}

/** vistaSessionIds already seen for one subscription, as a Set of "theatreId:sessionId". */
export async function getSeenSessionKeys(subscriptionId) {
  const { rows } = await pool.query(
    'SELECT theatre_id, session_id FROM seen_sessions WHERE subscription_id = $1',
    [subscriptionId]
  );
  return new Set(rows.map((r) => `${r.theatre_id}:${r.session_id}`));
}

/** Record sessions as seen and (on first pass) mark the subscription seeded. */
export async function markSessionsSeen(subscriptionId, sessions) {
  if (sessions.length === 0) return;
  const values = [];
  const params = [subscriptionId];
  sessions.forEach((s, i) => {
    params.push(s.theatreId, s.sessionId);
    values.push(`($1, $${i * 2 + 2}, $${i * 2 + 3})`);
  });
  await pool.query(
    `INSERT INTO seen_sessions (subscription_id, theatre_id, session_id)
     VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
    params
  );
}

export async function markSeeded(subscriptionId) {
  await pool.query('UPDATE subscriptions SET seeded = TRUE WHERE id = $1', [subscriptionId]);
}
