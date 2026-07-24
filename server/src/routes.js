// [WS1: server-api] — see docs/workstreams/01-server-api.md
// Owns this file. Implement the /api contract from docs/architecture.md
// using cineplex.js (proxy) and db.js (subscriptions).

import { Router } from 'express';

export const api = Router();

// TODO(WS1): GET /movies — proxy cineplex.getMovies(), cache ~15 min in memory.
api.get('/movies', (_req, res) => res.status(501).json({ error: 'not implemented (WS1)' }));

// TODO(WS1): GET /theatres — proxy cineplex.getTheatres(), cache ~24 h in memory.
api.get('/theatres', (_req, res) => res.status(501).json({ error: 'not implemented (WS1)' }));

// TODO(WS1): POST /subscriptions — validate { email, movieId, movieName, theatreIds },
// db.createSubscription, respond 201 { id }.
api.post('/subscriptions', (_req, res) => res.status(501).json({ error: 'not implemented (WS1)' }));

// TODO(WS1): GET /unsubscribe/:id — db.deleteSubscription; respond with a tiny
// human-readable HTML confirmation (this URL is clicked from an email), 404 if unknown.
api.get('/unsubscribe/:id', (_req, res) => res.status(501).json({ error: 'not implemented (WS1)' }));
