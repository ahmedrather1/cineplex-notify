// Server entry (shared foundation) — thin on purpose: WS1 owns routes.js,
// WS2 owns notifier/. Avoid editing this file from workstream branches.

import './env.js'; // must stay first — loads .env before db.js reads DATABASE_URL
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './db.js';
import { api } from './routes.js';
import { startPoller } from './notifier/poller.js';

const app = express();
app.use(express.json());
app.use('/api', api);
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// In production, serve the built React client (single deploy unit).
const clientDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/dist'
);
app.use(express.static(clientDist));
app.get(/^\/(?!api\/).*/, (_req, res, next) =>
  res.sendFile(path.join(clientDist, 'index.html'), (err) => err && next())
);

const port = process.env.PORT || 3001;
await migrate();
app.listen(port, () => console.log(`server listening on :${port}`));

if (process.env.ENABLE_POLLER === '1') {
  startPoller();
} else {
  console.log('poller disabled (set ENABLE_POLLER=1 to enable)');
}
