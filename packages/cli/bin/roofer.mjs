#!/usr/bin/env node
/**
 * roofer — CLI for managing white-labeled roofing calculator dashboards.
 *
 * Talks to the API at ROOFER_API_URL (default: http://localhost:8787) using a
 * shared CLI secret. The secret is read from (in order):
 *   1. ROOFER_CLI_SECRET env var
 *   2. CLI_SECRET in ../../api/.dev.vars (resolved from this script)
 */

import { Command } from 'commander';
import { readFileSync, statSync, createReadStream } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_URL = (process.env.ROOFER_API_URL || 'http://localhost:8787').replace(/\/$/, '');

function loadSecret() {
  if (process.env.ROOFER_CLI_SECRET) return process.env.ROOFER_CLI_SECRET;
  const devVarsPath = resolve(__dirname, '../../api/.dev.vars');
  try {
    const content = readFileSync(devVarsPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*CLI_SECRET\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return null;
}

const SECRET = loadSecret();

async function request(method, path, { json, form } = {}) {
  if (!SECRET) {
    die('No CLI secret found. Set ROOFER_CLI_SECRET or add CLI_SECRET= to packages/api/.dev.vars');
  }
  const headers = { 'X-CLI-Secret': SECRET };
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form !== undefined) {
    body = form; // FormData — fetch sets Content-Type with boundary automatically
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { method, headers, body });
  } catch (e) {
    die(`Network error hitting ${API_URL}${path}: ${e.message}`);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data.error || data.raw || `HTTP ${res.status}`;
    die(`API error (${res.status}): ${msg}`);
  }
  return data;
}

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(msg);
}

function printCompany(c) {
  const archived = c.archivedAt ? '  [ARCHIVED]' : '';
  console.log(`  ${c.slug || '(no slug)'}${archived}`);
  console.log(`    id:      ${c.id}`);
  console.log(`    name:    ${c.name}`);
  if (c.email) console.log(`    email:   ${c.email}`);
  if (c.primaryColor) console.log(`    color:   ${c.primaryColor}`);
  if (c.logoUrl) console.log(`    logo:    ${c.logoUrl}`);
  if (c.url) console.log(`    url:     ${c.url}`);
}

// ---- Commands ----

const program = new Command();
program
  .name('roofer')
  .description('Manage white-labeled roofing calculator dashboards')
  .version('0.1.0');

program
  .command('create')
  .description('Create a new white-label dashboard')
  .argument('<name>', 'company display name')
  .requiredOption('-e, --email <email>', 'company admin email')
  .option('-s, --slug <slug>', 'URL slug (auto-derived from name if omitted)')
  .option('-c, --color <hex>', 'primary hex color, e.g. #ff8800')
  .option('-l, --logo <path>', 'path to logo file (png, jpg, webp, svg, <1MB)')
  .action(async (name, opts) => {
    const payload = { name, email: opts.email };
    if (opts.slug) payload.slug = opts.slug;
    if (opts.color) payload.primaryColor = opts.color;
    const created = await request('POST', '/api/cli/companies', { json: payload });
    ok(`Created company "${created.name}"`);
    printCompany(created);

    if (opts.logo) {
      await uploadLogo(created.id, opts.logo);
      ok(`Logo uploaded.`);
    }
    console.log('');
    console.log(`Dashboard URL: ${created.url}`);
  });

program
  .command('list')
  .description('List all dashboards')
  .option('-a, --archived', 'include archived')
  .action(async (opts) => {
    const qs = opts.archived ? '?includeArchived=true' : '';
    const { data } = await request('GET', `/api/cli/companies${qs}`);
    if (data.length === 0) {
      ok('(no companies)');
      return;
    }
    ok(`${data.length} compan${data.length === 1 ? 'y' : 'ies'}:`);
    for (const c of data) {
      console.log('');
      printCompany(c);
    }
  });

program
  .command('show')
  .description('Show details for one dashboard')
  .argument('<idOrSlug>')
  .action(async (idOrSlug) => {
    const c = await request('GET', `/api/cli/companies/${encodeURIComponent(idOrSlug)}`);
    printCompany(c);
  });

program
  .command('update')
  .description('Update a dashboard')
  .argument('<idOrSlug>')
  .option('-n, --name <name>')
  .option('-s, --slug <slug>')
  .option('-e, --email <email>')
  .option('-c, --color <hex>', 'primary hex color')
  .option('-l, --logo <path>', 'path to new logo file')
  .action(async (idOrSlug, opts) => {
    const payload = {};
    if (opts.name) payload.name = opts.name;
    if (opts.slug) payload.slug = opts.slug;
    if (opts.email) payload.email = opts.email;
    if (opts.color) payload.primaryColor = opts.color;

    if (Object.keys(payload).length > 0) {
      const res = await request('PATCH', `/api/cli/companies/${encodeURIComponent(idOrSlug)}`, { json: payload });
      ok(`Updated.`);
      if (res.url) ok(`URL: ${res.url}`);
    }
    if (opts.logo) {
      // resolve id in case slug changed
      const target = payload.slug || idOrSlug;
      await uploadLogo(target, opts.logo);
      ok(`Logo uploaded.`);
    }
    if (Object.keys(payload).length === 0 && !opts.logo) {
      die('Nothing to update. Pass at least one of --name, --slug, --email, --color, --logo.');
    }
  });

program
  .command('delete')
  .alias('archive')
  .description('Archive a dashboard (soft delete — use `restore` to undo)')
  .argument('<idOrSlug>')
  .action(async (idOrSlug) => {
    await request('DELETE', `/api/cli/companies/${encodeURIComponent(idOrSlug)}`);
    ok(`Archived ${idOrSlug}.`);
  });

program
  .command('purge')
  .description('Permanently delete a dashboard and its logos (IRREVERSIBLE). Company must be archived first unless --force.')
  .argument('<idOrSlug>')
  .option('-f, --force', 'skip the archived-first safety check')
  .action(async (idOrSlug, opts) => {
    const qs = opts.force ? '?force=true' : '';
    const res = await request('DELETE', `/api/cli/companies/${encodeURIComponent(idOrSlug)}/purge${qs}`);
    ok(`Purged ${res.slug || res.id}. This cannot be undone.`);
  });

program
  .command('restore')
  .description('Restore an archived dashboard')
  .argument('<idOrSlug>')
  .action(async (idOrSlug) => {
    const res = await request('POST', `/api/cli/companies/${encodeURIComponent(idOrSlug)}/restore`);
    ok(`Restored.`);
    if (res.url) ok(`URL: ${res.url}`);
  });

program
  .command('url')
  .description('Print the public URL for a dashboard')
  .argument('<idOrSlug>')
  .action(async (idOrSlug) => {
    const c = await request('GET', `/api/cli/companies/${encodeURIComponent(idOrSlug)}`);
    if (!c.url) die('Company has no slug set.');
    console.log(c.url);
  });

program
  .command('logo')
  .description('Upload a logo for a dashboard')
  .argument('<idOrSlug>')
  .argument('<path>', 'path to logo file')
  .action(async (idOrSlug, path) => {
    await uploadLogo(idOrSlug, path);
    ok(`Logo uploaded.`);
  });

program
  .command('set-password')
  .description('Set or generate a password so the roofer can log into the admin panel')
  .argument('<idOrSlug>')
  .option('-p, --password <password>', 'use this password instead of generating one (min 8 chars)')
  .action(async (idOrSlug, opts) => {
    const payload = {};
    if (opts.password) payload.password = opts.password;
    const res = await request('POST', `/api/cli/companies/${encodeURIComponent(idOrSlug)}/set-password`, { json: payload });
    ok(res.generated ? 'Generated temporary password:' : 'Password set.');
    console.log('');
    console.log(`  login URL: ${res.loginUrl}`);
    console.log(`  email:     ${res.email}`);
    console.log(`  password:  ${res.password}`);
    console.log('');
    if (res.generated) {
      ok('This password is shown only once — copy it now. The roofer should change it after first login.');
    }
  });

// ---- Logo helper ----

const EXT_TO_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

async function uploadLogo(idOrSlug, path) {
  const abs = resolve(path);
  let stats;
  try {
    stats = statSync(abs);
  } catch {
    die(`Logo file not found: ${abs}`);
  }
  if (stats.size > 1048576) die(`Logo file too large (${stats.size} bytes, max 1048576).`);

  const ext = extname(abs).toLowerCase();
  const type = EXT_TO_MIME[ext];
  if (!type) die(`Unsupported logo extension: ${ext}. Use png, jpg, webp, or svg.`);

  const buf = readFileSync(abs);
  const blob = new Blob([buf], { type });
  const form = new FormData();
  form.append('logo', blob, basename(abs));

  await request('POST', `/api/cli/companies/${encodeURIComponent(idOrSlug)}/logo`, { form });
}

program.parseAsync(process.argv);
