import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './types';
import { estimates } from './routes/estimates';
import { config } from './routes/config';
import { admin } from './routes/admin';

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
app.route('/api/admin', admin);

// Public logo serving route
app.get('/api/logos/:companyId', async (c) => {
  const companyId = c.req.param('companyId');
  const listed = await c.env.LOGOS_BUCKET.list({ prefix: `${companyId}/logo` });

  if (listed.objects.length === 0) {
    return c.json({ error: 'Logo not found' }, 404);
  }

  const obj = await c.env.LOGOS_BUCKET.get(listed.objects[0].key);
  if (!obj) {
    return c.json({ error: 'Logo not found' }, 404);
  }

  const contentType = obj.httpMetadata?.contentType || 'image/png';
  const body = await obj.arrayBuffer();
  return new Response(body, {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' },
  });
});

export default app;
