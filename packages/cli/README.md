# roofer CLI

Command-line tool for managing white-labeled roofing calculator dashboards. Create, edit, archive, and manage per-company branding without opening the admin panel.

## Table of contents

- [How it works](#how-it-works)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commands](#commands)
  - [create](#create)
  - [list](#list)
  - [show](#show)
  - [update](#update)
  - [logo](#logo)
  - [url](#url)
  - [delete / archive](#delete--archive)
  - [restore](#restore)
  - [set-password](#set-password)
- [Roofer self-service workflow](#roofer-self-service-workflow)
- [Security model](#security-model)
- [Moving to production (domain + deploy)](#moving-to-production-domain--deploy)
- [Troubleshooting](#troubleshooting)
- [File reference](#file-reference)

---

## How it works

The CLI is a thin HTTP client that talks to a dedicated route group on the API (`/api/cli/*`). Those routes bypass the admin panel's session/CSRF/RBAC stack and are gated instead by a single shared secret in the `X-CLI-Secret` header. The secret lives in `packages/api/.dev.vars` (local dev) or as a Wrangler secret (production). The CLI reads it automatically, so there's no login prompt — you just run commands.

All business logic (slug validation, uniqueness checks, logo upload to R2, password hashing) is implemented in `packages/api/src/routes/cli.ts` and runs inside the same Worker as the admin panel. The CLI itself is a plain Node.js ESM script with no build step.

## Installation

The CLI is already installed in this workspace. A symlink exists at `~/.local/bin/roofer` pointing at the script. Because `~/.local/bin` is on your `PATH`, you can run `roofer` from anywhere.

If the symlink is ever lost, recreate it:

```bash
mkdir -p ~/.local/bin
ln -sf /home/mike/roofing_calculator/packages/cli/bin/roofer.mjs ~/.local/bin/roofer
```

Dependencies: a single small package (`commander`). Installed via `npm install` in `packages/cli/`.

Requirements: Node 18+ (for built-in `fetch`, `FormData`, `Blob`).

## Configuration

Two env vars, both optional:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ROOFER_API_URL` | `http://localhost:8787` | Base URL of the roofing API. |
| `ROOFER_CLI_SECRET` | auto-loaded from `packages/api/.dev.vars` | Shared secret. Set this to override the on-disk value (useful for pointing at a deployed environment). |

The CLI resolves `CLI_SECRET` in this order:

1. `ROOFER_CLI_SECRET` env var
2. `CLI_SECRET=...` line in `packages/api/.dev.vars`

If neither is found, the CLI exits with an error before sending any request.

Example: run against a deployed server instead of localhost:

```bash
ROOFER_API_URL=https://api.example.com \
ROOFER_CLI_SECRET=<your-prod-secret> \
roofer list
```

## Commands

All commands accept a company by either **slug** or **id** anywhere the argument is called `<idOrSlug>`.

### create

Create a new white-label dashboard.

```
roofer create <name> -e <email> [-s <slug>] [-c <hex>] [-l <logo-path>]
```

| Option | Description |
| --- | --- |
| `<name>` (positional) | Company display name. |
| `-e, --email <email>` | **Required.** Company admin email (used for their eventual login). |
| `-s, --slug <slug>` | URL slug. Auto-derived from `name` if omitted. Must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. |
| `-c, --color <hex>` | Primary brand color, 6-digit hex (e.g. `#ff8800`). Defaults to `#2563eb`. |
| `-l, --logo <path>` | Optional logo file to upload immediately after creation. |

**Output:** creates the company, prints its details, uploads the logo if provided, and ends with the public dashboard URL.

**Example:**

```bash
roofer create "Acme Roofing Co" -e owner@acme.com -c "#ff8800" -l ./acme-logo.png
```

### list

List all dashboards.

```
roofer list [-a]
```

| Option | Description |
| --- | --- |
| `-a, --archived` | Include archived (soft-deleted) companies. By default only active companies are shown. |

### show

Show all details for one dashboard.

```
roofer show <idOrSlug>
```

### update

Update any combination of name, slug, email, color, or logo on an existing dashboard.

```
roofer update <idOrSlug> [-n <name>] [-s <slug>] [-e <email>] [-c <hex>] [-l <logo-path>]
```

At least one of `--name`, `--slug`, `--email`, `--color`, `--logo` must be supplied. Slug changes are checked for conflicts; if the target slug is taken, the command fails with `409`.

**Example:**

```bash
roofer update acme-roofing-co -s acme -c "#112233"
```

### logo

Replace (or set) just the logo for a dashboard.

```
roofer logo <idOrSlug> <path>
```

**Constraints:** file must be ≤1 MB and have extension `.png`, `.jpg`, `.jpeg`, `.webp`, or `.svg`. Uploaded to R2 under `${companyId}/logo${ext}` and exposed via `/api/logos/<companyId>`.

### url

Print only the public URL for a dashboard — useful in scripts.

```
roofer url <idOrSlug>
```

**Example:**

```bash
echo "Share this with the client: $(roofer url acme)"
```

### delete / archive

Soft-archive a dashboard. The row stays in the database but is hidden from the public widget (the `/:slug` route returns 404). Reversible with `restore`.

```
roofer delete <idOrSlug>
roofer archive <idOrSlug>     # alias
```

> This is a soft delete — it sets `archivedAt` to the current timestamp. There is no hard-delete command; purging a company requires a manual D1 query.

### restore

Unarchive a previously archived dashboard.

```
roofer restore <idOrSlug>
```

### set-password

Set a password on the company row so the roofer can log into `/admin` themselves and manage their own branding, pricing, and leads.

```
roofer set-password <idOrSlug> [-p <password>]
```

| Option | Description |
| --- | --- |
| `-p, --password <pw>` | Use a specific password (min 8 chars). If omitted, a 16-character random password is generated server-side. |

**Output:** prints the login URL, the company's email, and the password **once**. Generated passwords are not recoverable — copy immediately.

**Example:**

```
$ roofer set-password acme
Generated temporary password:

  login URL: http://127.0.0.1:8788/admin
  email:     owner@acme.com
  password:  Q6sZiqA5jg57YKJv

This password is shown only once — copy it now. The roofer should change it after first login.
```

## Roofer self-service workflow

Typical flow when onboarding a new customer:

1. **Create** the dashboard with their name, email, and brand color:
   ```bash
   roofer create "Acme Roofing" -e owner@acme.com -c "#ff8800" -l ./acme-logo.png
   ```
2. **Generate a temp password** for them:
   ```bash
   roofer set-password acme-roofing
   ```
3. **Send them** the login URL, email, and temp password (e.g. via your preferred secure channel).
4. They log in at `/admin`, change their password, and can now self-serve further edits (colors, pricing overrides, logo, etc.) through the admin panel.

Anything they can do in the admin panel, you can still do via this CLI — the CLI is a superset since it bypasses per-company RBAC.

## Security model

- **The shared secret is the only thing protecting `/api/cli/*`.** Anyone who can read `.dev.vars` or the Worker secret store can fully control every tenant. Treat it like a root password.
- `.dev.vars` is gitignored — do **not** commit it. Use `wrangler secret put CLI_SECRET` for production.
- The CLI itself has no interactive auth because only the VM operator (Mike) has shell access. If that changes, either rotate the secret on every personnel change or switch to a per-user auth mechanism.
- The API is currently exposed on the VM's public IP:8787. The shared-secret gate is what prevents random internet scanners from creating rogue tenants. Do not remove it.

## Moving to production (domain + deploy)

When a real domain is connected:

1. **Set a production `CLI_SECRET`** (distinct from the dev one):
   ```bash
   cd packages/api
   npx wrangler secret put CLI_SECRET
   # paste a fresh: openssl rand -hex 32
   ```
2. **Set `API_BASE_URL`** in production so printed URLs use the domain, not the Worker's default hostname. In `wrangler.toml`:
   ```toml
   [vars]
   API_BASE_URL = "https://api.example.com"
   ```
3. **Point the CLI at prod** by exporting env vars (e.g. in your shell profile):
   ```bash
   export ROOFER_API_URL=https://api.example.com
   export ROOFER_CLI_SECRET=<prod-secret>
   ```
4. Rotate the secret any time it could have leaked: `wrangler secret put CLI_SECRET` again and update `ROOFER_CLI_SECRET` locally.

## Troubleshooting

**`error: No CLI secret found.`**
Set `ROOFER_CLI_SECRET` or ensure `packages/api/.dev.vars` has a `CLI_SECRET=...` line. Regenerate one:
```bash
openssl rand -hex 32
```

**`error: API error (401): Unauthorized`**
The secret you're sending doesn't match the one the server expects. If you recently changed `.dev.vars`, restart `wrangler dev` so it reloads. In production, check the deployed secret with `wrangler secret list`.

**`error: API error (503): CLI not configured (CLI_SECRET missing)`**
The server doesn't have `CLI_SECRET` set at all. Add it to `.dev.vars` (dev) or run `wrangler secret put CLI_SECRET` (prod).

**`error: Network error hitting http://localhost:8787/...`**
The API isn't running. Start it with `cd packages/api && npx wrangler dev`, or set `ROOFER_API_URL` to the correct host.

**`error: API error (409): Slug already taken`**
Pick a different slug with `-s`, or `roofer show <existing>` to see who's using it.

**`error: Invalid file type`** (during logo upload)
Logo must be PNG, JPEG, WebP, or SVG. Other formats are rejected server-side.

**Logo uploads show an ExperimentalWarning about `buffer.File`.**
Harmless — it's a Node.js notice about a stable-but-flagged API used by `FormData`. Can be silenced with `NODE_NO_WARNINGS=1 roofer logo ...`.

## File reference

| File | Role |
| --- | --- |
| [packages/cli/bin/roofer.mjs](bin/roofer.mjs) | The CLI itself (commander + fetch). |
| [packages/cli/package.json](package.json) | Declares the `roofer` bin and the `commander` dependency. |
| [packages/api/src/routes/cli.ts](../api/src/routes/cli.ts) | Server routes at `/api/cli/*` — secret middleware + all CRUD logic. |
| [packages/api/src/index.ts](../api/src/index.ts) | Mounts the `cli` route group alongside `admin`, `estimates`, etc. |
| [packages/api/src/types.ts](../api/src/types.ts) | Declares `CLI_SECRET` on the Worker `Bindings` type. |
| [packages/api/.dev.vars](../api/.dev.vars) | Local dev secret store. Not committed. |
| `~/.local/bin/roofer` | Symlink making `roofer` a global command for the current user. |
