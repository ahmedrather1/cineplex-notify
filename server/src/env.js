// Loads the repo-root .env regardless of cwd (npm -w runs with cwd server/).
// Must be the FIRST import of the entry point so env vars exist before other
// modules (db.js reads DATABASE_URL at import time) are evaluated.
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });
