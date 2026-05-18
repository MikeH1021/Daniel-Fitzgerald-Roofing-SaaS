import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './types';
import { estimates } from './routes/estimates';
import { config } from './routes/config';
import { admin } from './routes/admin';
import { cli } from './routes/cli';
import { maps } from './routes/maps';
import { companiesRoute } from './routes/companies';

const app = new Hono<{ Bindings: Bindings }>();

// CORS for all API routes
app.use('/api/*', cors({ origin: '*' }));

// Root serves the demo page
app.get('/', async (c) => {
  const res = await serveStaticAsset(c.env.__STATIC_CONTENT, 'demo/index.html');
  return res || c.text('Demo not built. Run: bash packages/api/build-static.sh', 404);
});

// Mount API routes
app.route('/api/estimates', estimates);
app.route('/api/config', config);
app.route('/api/admin', admin);
app.route('/api/cli', cli);
app.route('/api/maps', maps);
app.route('/api/companies', companiesRoute);

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

// --- Static file serving (Workers Sites KV) ---

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

function contentType(path: string): string {
  const ext = path.match(/\.[^.]+$/)?.[0] || '';
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

async function serveStaticAsset(kv: KVNamespace, key: string): Promise<Response | null> {
  const value = await kv.get(key, { type: 'arrayBuffer' });
  if (!value) return null;
  return new Response(value, {
    headers: {
      'Content-Type': contentType(key),
      'Cache-Control': key.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=60',
    },
  });
}

// Widget bundle
app.get('/widget/*', async (c) => {
  const key = c.req.path.slice(1); // strip leading /
  const res = await serveStaticAsset(c.env.__STATIC_CONTENT, key);
  return res || c.text('Not found', 404);
});

// Admin static assets (CSS, JS bundles)
app.get('/admin/assets/*', async (c) => {
  const key = c.req.path.slice(1);
  const res = await serveStaticAsset(c.env.__STATIC_CONTENT, key);
  return res || c.text('Not found', 404);
});

// Admin SPA — all /admin routes serve index.html
const serveAdminIndex = async (c: any) => {
  const res = await serveStaticAsset(c.env.__STATIC_CONTENT, 'admin/index.html');
  return res || c.text('Admin not built. Run: bash packages/api/build-static.sh', 404);
};
app.get('/admin', serveAdminIndex);
app.get('/admin/', serveAdminIndex);
app.get('/admin/*', async (c) => {
  // Try exact file first
  const key = c.req.path.slice(1);
  const exact = await serveStaticAsset(c.env.__STATIC_CONTENT, key);
  if (exact) return exact;
  // SPA fallback
  return serveAdminIndex(c);
});

// Company slug pages — serves widget embedded for that company
app.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  // Look up company by slug
  const { createDb } = await import('./db');
  const { companies } = await import('./db/schema');
  const { eq, and, isNull } = await import('drizzle-orm');
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ id: companies.id, name: companies.name, primaryColor: companies.primaryColor })
    .from(companies)
    .where(and(eq(companies.slug, slug), isNull(companies.archivedAt)))
    .limit(1);

  if (rows.length === 0) {
    return c.text('Company not found', 404);
  }

  const company = rows[0];
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${company.name} - Roofing Estimate</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px;
    }
    .widget-wrapper { width: 100%; max-width: 460px; }
  </style>
</head>
<body>
  <div class="widget-wrapper">
    <script src="/widget/roofing-widget.js" data-company-id="${company.id}"></script>
  </div>
</body>
</html>`);
});

export default app;
