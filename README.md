# Roofing Estimate Calculator

A SaaS embeddable widget that roofing companies add to their websites to generate leads. Homeowners enter roof details, receive an instant price range estimate, and the roofing company captures a qualified lead with contact info.

## Features

**Widget**
- Embeddable via single `<script>` tag with Shadow DOM isolation
- Multi-step form: roof details, contact info, instant estimate
- Satellite map with polygon drawing to measure roof area
- Address autocomplete via Google Places API
- Pitch-adjusted square footage calculation
- Responsive and mobile-friendly
- Company branding (logo + primary color)

**Admin Portal**
- RBAC: super-admin manages all companies, company-admin manages their own
- Lead management: searchable/filterable list, CSV export
- Per-company analytics: total leads, estimates, popular materials, avg sqft
- Live widget preview in branding editor
- Pricing overrides with validation
- Company archiving (soft-delete with restore)

**Security**
- CSRF protection on all state-changing endpoints
- Login rate limiting (5 attempts / 60s)
- Session expiry auto-redirect
- PBKDF2 password hashing (Workers-compatible)
- Honeypot bot detection

**Lead Delivery**
- Company notified via email within 1 minute
- Homeowner receives estimate copy via email
- TCPA-compliant consent checkbox

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | [Hono](https://hono.dev) on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) + [Drizzle ORM](https://orm.drizzle.team) |
| Storage | Cloudflare R2 (logo uploads) |
| Widget | [Preact](https://preactjs.com) + Shadow DOM, built as single IIFE |
| Admin | Preact SPA with [preact-iso](https://github.com/preactjs/preact-iso) router |
| Email | [Resend](https://resend.com) API |
| Maps | Google Maps JavaScript API + Places API |
| Build | [Vite](https://vitejs.dev) |
| Validation | [Zod](https://zod.dev) |

## Project Structure

```
packages/
  api/          Cloudflare Worker — API routes, auth, email, static serving
  admin/        Admin portal SPA (Preact)
  widget/       Embeddable calculator widget (Preact, IIFE bundle)
```

## Getting Started

### Prerequisites

- Node.js 18+
- A [Cloudflare](https://cloudflare.com) account (for deployment)
- A [Google Cloud](https://console.cloud.google.com) API key with Maps JavaScript API and Places API (New) enabled
- A [Resend](https://resend.com) API key (for email delivery)

### Local Development

```bash
# Install dependencies
cd packages/api && npm install
cd ../admin && npm install
cd ../widget && npm install
cd ../..

# Set environment variables
cat > packages/api/.dev.vars <<EOF
GOOGLE_MAPS_API_KEY=your-google-maps-key
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
EOF

# Apply database migrations
cd packages/api
npx wrangler d1 migrations apply roofing_calculator --local

# Build static assets (admin + widget)
bash build-static.sh

# Start the server (everything on one port)
npx wrangler dev --port 8787 --ip 0.0.0.0
```

Then visit:
- **http://localhost:8787/** — Demo widget
- **http://localhost:8787/admin** — Admin portal
- **http://localhost:8787/{company-slug}** — Company-specific widget page

### First Setup

1. Create a company directly in the database:
   ```bash
   npx wrangler d1 execute roofing_calculator --local \
     --command "INSERT INTO companies (id, name, email, slug) VALUES ('my-co', 'My Roofing Co', 'admin@example.com', 'my-roofing');"
   ```

2. Visit `/admin`, click "Set Up Account", enter the company email and a password.
   The first account automatically becomes super-admin.

3. Log in and start creating companies.

## Embedding the Widget

Add this script tag to any website:

```html
<script src="https://your-domain.com/widget/roofing-widget.js"
        data-company-id="COMPANY_ID"></script>
```

The widget renders in Shadow DOM — no CSS conflicts with the host site.

## Deployment

Deploy to Cloudflare Workers:

```bash
cd packages/api

# Create D1 database
npx wrangler d1 create roofing_calculator

# Create R2 bucket
npx wrangler r2 bucket create roofing-logos

# Update wrangler.toml with your database ID

# Set production secrets
npx wrangler secret put GOOGLE_MAPS_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL

# Apply migrations
npx wrangler d1 migrations apply roofing_calculator --remote

# Build and deploy
bash build-static.sh
npx wrangler deploy
```

## Testing

```bash
cd packages/api
npm test
```

120 tests covering API routes, estimate engine, lead notifications, and admin operations.

## License

MIT
