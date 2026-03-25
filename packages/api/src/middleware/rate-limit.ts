import { createMiddleware } from 'hono/factory';
import type { Bindings } from '../types';

const LOGIN_LIMIT = 5;
const LOGIN_PERIOD_MS = 60 * 1000; // 60 seconds

// In-memory fallback for local dev/test environments.
// Tracks login attempts per IP. This is keyed per-request before the handler runs.
export const inMemoryLoginStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Returns the client IP for rate limiting purposes.
 */
export function getClientIp(req: { header: (name: string) => string | undefined }): string {
  return req.header('cf-connecting-ip') || req.header('x-forwarded-for') || 'unknown';
}

/**
 * Middleware that rate-limits login attempts per IP.
 * - When Cloudflare Workers rate limiter binding is available, uses it.
 * - Otherwise, falls back to an in-memory store (for local dev/test).
 *
 * The in-memory store counts ALL login requests (not just failures) to
 * limit brute force attempts. Use unique IPs in tests to avoid interference.
 */
export const loginRateLimiter = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const ip = getClientIp(c.req);

  // Use Cloudflare Workers rate limiter binding if available
  if (c.env.LOGIN_RATE_LIMITER) {
    const { success } = await c.env.LOGIN_RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return c.json({ error: 'Too many login attempts. Try again later.' }, 429);
    }
    await next();
    return;
  }

  // Fallback: in-memory rate limiter
  const now = Date.now();
  const entry = inMemoryLoginStore.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= LOGIN_LIMIT) {
      return c.json({ error: 'Too many login attempts. Try again later.' }, 429);
    }
    entry.count++;
  } else {
    inMemoryLoginStore.set(ip, { count: 1, resetAt: now + LOGIN_PERIOD_MS });
  }

  await next();
});
