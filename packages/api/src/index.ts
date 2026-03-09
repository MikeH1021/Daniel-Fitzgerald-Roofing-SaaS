import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './types';
import { estimates } from './routes/estimates';
import { config } from './routes/config';

const app = new Hono<{ Bindings: Bindings }>();

// CORS for all API routes
app.use('/api/*', cors({ origin: '*' }));

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok' });
});

// Mount routes
app.route('/api/estimates', estimates);
app.route('/api/config', config);

export default app;
