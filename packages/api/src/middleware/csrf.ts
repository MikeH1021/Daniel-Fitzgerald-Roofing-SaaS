import { createMiddleware } from 'hono/factory';
import type { Bindings } from '../types';
import type { AdminVars } from './auth';

const EXEMPT_PATHS = ['/api/admin/login', '/api/admin/setup'];
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: AdminVars;
}>(async (c, next) => {
  const method = c.req.method.toUpperCase();

  // Safe methods are exempt from CSRF check
  if (SAFE_METHODS.has(method)) {
    await next();
    return;
  }

  // Exempt specific paths (login/setup - no session yet)
  const path = new URL(c.req.url).pathname;
  if (EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    await next();
    return;
  }

  // Check Origin header matches request host
  const origin = c.req.header('origin');
  if (origin) {
    const requestUrl = new URL(c.req.url);
    const originUrl = new URL(origin);
    if (originUrl.host === requestUrl.host) {
      await next();
      return;
    }
  }

  // Check X-CSRF-Token header matches first 16 chars of session token
  const csrfToken = c.req.header('x-csrf-token');
  const sessionToken = c.get('sessionToken');
  if (csrfToken && sessionToken && csrfToken === sessionToken.slice(0, 16)) {
    await next();
    return;
  }

  return c.json({ error: 'CSRF validation failed' }, 403);
});
