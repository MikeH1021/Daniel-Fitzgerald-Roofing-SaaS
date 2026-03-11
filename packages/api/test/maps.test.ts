import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

describe('GET /api/maps/key', () => {
  it('returns 200 with key when GOOGLE_MAPS_API_KEY is bound', async () => {
    const res = await app.request('/api/maps/key', { method: 'GET' }, {
      ...env,
      GOOGLE_MAPS_API_KEY: 'test-maps-key-123',
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { key: string };
    expect(body.key).toBe('test-maps-key-123');
  });

  it('returns 503 with error when GOOGLE_MAPS_API_KEY is not set', async () => {
    const res = await app.request('/api/maps/key', { method: 'GET' }, {
      ...env,
    });
    expect(res.status).toBe(503);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Maps not configured');
  });
});
