import { Hono } from 'hono';
import type { Bindings } from '../types';

const maps = new Hono<{ Bindings: Bindings }>();

maps.get('/key', (c) => {
  const key = c.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return c.json({ error: 'Maps not configured' }, 503);
  }
  return c.json({ key });
});

export { maps };
