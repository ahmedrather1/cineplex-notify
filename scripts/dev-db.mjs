// Project-local dev Postgres (no system install needed).
// Usage: node scripts/dev-db.mjs   — runs until Ctrl-C.
// Connection: postgres://postgres:postgres@localhost:5433/cineplex_notify (PGSSL=disable)

import EmbeddedPostgres from 'embedded-postgres';

const pg = new EmbeddedPostgres({
  databaseDir: new URL('../data/pg', import.meta.url).pathname,
  user: 'postgres',
  password: 'postgres',
  port: 5433,
  persistent: true,
});

const fresh = !(await import('node:fs')).existsSync(new URL('../data/pg/PG_VERSION', import.meta.url).pathname);
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('cineplex_notify');
console.log('dev postgres ready: postgres://postgres:postgres@localhost:5433/cineplex_notify');

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await pg.stop();
    process.exit(0);
  });
}
