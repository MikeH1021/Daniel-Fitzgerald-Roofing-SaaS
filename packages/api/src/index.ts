import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './types';

const app = new Hono<{ Bindings: Bindings }>();

// CORS for all API routes
app.use('/api/*', cors({ origin: '*' }));

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok' });
});

export default app;
