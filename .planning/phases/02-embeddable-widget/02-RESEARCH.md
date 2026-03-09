# Phase 2: Embeddable Widget - Research

**Researched:** 2026-03-09
**Domain:** Preact widget in Shadow DOM, multi-step form, embeddable via script tag
**Confidence:** HIGH

## Summary

Phase 2 builds a standalone JavaScript widget that roofing companies embed on their websites via a single `<script>` tag. The widget renders inside Shadow DOM for CSS isolation, walks homeowners through a multi-step flow (roof details, contact info with TCPA consent, estimate display), and fetches company branding from the Phase 1 API.

The standard approach is Preact (4KB gzipped) with Vite building an IIFE bundle. Preact provides React-compatible component patterns at a fraction of the bundle size -- critical for a widget loading on third-party sites. Shadow DOM provides style encapsulation so the widget neither inherits host page styles nor leaks its own styles onto the host. CSS is imported as a string via Vite's `?inline` suffix and injected into the Shadow DOM as a `<style>` element.

The widget package lives at `packages/widget/` alongside the existing `packages/api/`. It consumes two existing API endpoints: `GET /api/config/:companyId` (company branding) and `POST /api/estimates` (price calculation). Phase 2 also adds lead capture fields (LEAD-01, LEAD-02) to the estimate submission, which requires extending the API's estimate request schema to include contact info and consent.

**Primary recommendation:** Build a Preact widget with Vite (IIFE output), render into Shadow DOM with inline styles, use Preact Signals for form state across steps, and extend the existing API to accept and store lead data alongside estimate requests.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WIDG-01 | Widget embeddable via single script tag with company ID attribute | IIFE bundle via Vite; `document.currentScript.getAttribute('data-company-id')` reads config; auto-initializes on load |
| WIDG-02 | Widget renders inside Shadow DOM for CSS isolation | `element.attachShadow({ mode: 'open' })` with Preact `render()` targeting shadow root; CSS injected via `<style>` element inside shadow DOM |
| WIDG-03 | Widget is fully responsive and usable on mobile | CSS-only responsive layout with `max-width`, percentage-based widths, adequate tap targets (min 44px); no framework needed |
| WIDG-04 | Widget displays company logo and primary brand color | Fetched from existing `GET /api/config/:companyId` endpoint; `primaryColor` applied via CSS custom property; `logoUrl` rendered as `<img>` |
| WIDG-05 | Widget follows multi-step flow: roof details, contact info, estimate display | Step state managed via Preact Signal; three components rendered conditionally; form data accumulated across steps |
| LEAD-01 | Homeowner can enter first name, last name, email, phone | Contact info step with validated inputs; data included in `POST /api/estimates` request body |
| LEAD-02 | Consent checkbox unchecked by default, names the company | Checkbox `checked={false}` default; label text includes `companyName` from config API; form submission blocked until checked |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Preact | 10.x | UI rendering | 4KB gzipped, React-compatible API, ideal for embedded widgets. Used by Sentry, CompanyCam for their embeddable widgets. |
| @preact/signals | 1.x | Form state management | Lightweight reactive state (1KB), no boilerplate, auto-updates components on .value change. Built by Preact team. |
| Vite | 6.x | Build tool | IIFE output via Rollup, `?inline` CSS imports, HMR in dev. Preact team recommends Vite. |
| @preact/preset-vite | 2.x | Vite plugin for Preact | Official preset: JSX transform, devtools, HMR. Drop-in configuration. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5.x | Type safety | All widget source code, matches API package |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Preact | Lit/Web Components | Lit is 5.7KB, good fit, but Preact gives React-like component model and hooks; team already knows React patterns from API Zod schemas |
| Preact | Svelte | Slightly smaller output (~1KB hello world) but different mental model; Preact's React compatibility is valuable for maintainability |
| Preact Signals | useState hooks | Signals avoid re-render cascades and work naturally across components without prop drilling or context |
| Vite IIFE | Rollup standalone | Vite uses Rollup internally but provides dev server, HMR, and simpler config |

**Installation:**
```bash
# From project root
mkdir -p packages/widget
cd packages/widget
npm init -y
npm install preact @preact/signals
npm install -D vite @preact/preset-vite typescript
```

## Architecture Patterns

### Recommended Project Structure
```
packages/widget/
  src/
    index.ts              # Entry: find script tag, create shadow DOM, render App
    App.tsx               # Root component: fetches config, manages step state
    components/
      RoofDetails.tsx     # Step 1: sqft, pitch, material inputs
      ContactInfo.tsx     # Step 2: name, email, phone, consent checkbox
      EstimateDisplay.tsx # Step 3: shows price range and disclaimer
    state/
      form.ts             # Preact signals for form data and step
    api/
      client.ts           # fetch() calls to config and estimate endpoints
    styles/
      widget.css          # All widget styles (imported as ?inline string)
  index.html              # Dev-only: test harness page
  vite.config.ts          # Build config: IIFE output, inline CSS
  tsconfig.json
  package.json
```

### Pattern 1: Script Tag Initialization
**What:** The widget script reads `data-company-id` from its own script tag, creates a container element, attaches Shadow DOM, and renders the Preact app into it.
**When to use:** Entry point of the widget bundle.
**Example:**
```typescript
// src/index.ts
import { render, h } from 'preact';
import { App } from './App';
import widgetStyles from './styles/widget.css?inline';

(function () {
  const script = document.currentScript as HTMLScriptElement;
  if (!script) return;

  const companyId = script.getAttribute('data-company-id');
  if (!companyId) {
    console.error('Roofing widget: missing data-company-id attribute');
    return;
  }

  // Create host element next to script tag
  const host = document.createElement('div');
  host.id = 'roofing-widget-host';
  script.parentElement!.insertBefore(host, script);

  // Attach Shadow DOM
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles into shadow DOM
  const style = document.createElement('style');
  style.textContent = widgetStyles;
  shadow.appendChild(style);

  // Create render target inside shadow DOM
  const root = document.createElement('div');
  root.id = 'roofing-widget-root';
  shadow.appendChild(root);

  // Render Preact app
  render(h(App, { companyId }), root);
})();
```
Source: [CompanyCam Preact Shadow DOM article](https://dev.to/companycam/build-an-embeddable-widget-using-preact-and-the-shadow-dom-33lm), [MakerKit widget guide](https://makerkit.dev/blog/tutorials/embeddable-widgets-react)

### Pattern 2: Multi-Step Form with Signals
**What:** A single set of Preact signals holds all form data and the current step index. Each step component reads/writes signals directly -- no prop drilling.
**When to use:** The multi-step form flow (WIDG-05).
**Example:**
```typescript
// src/state/form.ts
import { signal, computed } from '@preact/signals';

export const currentStep = signal(0); // 0=roof, 1=contact, 2=estimate

export const formData = signal({
  sqft: '',
  pitch: '',
  material: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  consent: false,
});

export const estimateResult = signal<{
  estimateLow: number;
  estimateHigh: number;
  disclaimer: string;
} | null>(null);

export const isLoading = signal(false);

export function updateField(field: string, value: string | boolean) {
  formData.value = { ...formData.value, [field]: value };
}

export function nextStep() {
  currentStep.value = Math.min(currentStep.value + 1, 2);
}

export function prevStep() {
  currentStep.value = Math.max(currentStep.value - 1, 0);
}
```
Source: [Preact Signals docs](https://preactjs.com/guide/v10/signals/)

### Pattern 3: Vite IIFE Build Configuration
**What:** Vite config that outputs a single IIFE JavaScript file with all CSS inlined. No code splitting, no external dependencies.
**When to use:** Production build of the widget.
**Example:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'RoofingWidget',
      fileName: () => 'roofing-widget.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false }, // keep console.error for debugging on host sites
    },
  },
});
```
Source: [Vite build options](https://vite.dev/config/build-options), [Vite library mode](https://vite.dev/guide/build#library-mode)

### Pattern 4: Company Branding via CSS Custom Properties
**What:** After fetching company config, set CSS custom properties on the widget root. CSS references these variables for colors.
**When to use:** Applying company `primaryColor` (WIDG-04).
**Example:**
```typescript
// In App.tsx after config fetch
root.style.setProperty('--rc-primary', config.primaryColor);
root.style.setProperty('--rc-primary-hover', adjustColor(config.primaryColor, -15));
```
```css
/* In widget.css */
.rc-btn-primary {
  background-color: var(--rc-primary, #2563eb);
  color: white;
}
.rc-btn-primary:hover {
  background-color: var(--rc-primary-hover, #1d4ed8);
}
```

### Pattern 5: API Client
**What:** Simple fetch wrapper that calls the existing Phase 1 API. The API base URL is determined from the script tag's `src` attribute or a data attribute.
**When to use:** Config fetch and estimate submission.
**Example:**
```typescript
// src/api/client.ts
const API_BASE = 'https://roofing-api.your-domain.workers.dev';

export async function fetchCompanyConfig(companyId: string) {
  const res = await fetch(`${API_BASE}/api/config/${companyId}`);
  if (!res.ok) throw new Error('Failed to load company config');
  return res.json();
}

export async function submitEstimate(data: {
  sqft: number;
  pitch: string;
  material: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
}) {
  const res = await fetch(`${API_BASE}/api/estimates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to submit estimate');
  return res.json();
}
```

### Anti-Patterns to Avoid
- **Loading external CSS via `<link>` inside Shadow DOM:** Causes FOUC (flash of unstyled content) while the stylesheet loads. Inline styles via `<style>` element avoid this entirely.
- **Using React instead of Preact:** React 18+ is 40KB+ gzipped. Preact is 4KB. For an embedded widget on third-party sites, bundle size is critical.
- **Using CSS-in-JS (styled-components, emotion):** Adds bundle weight and complexity for Shadow DOM injection. Plain CSS imported as `?inline` is simpler and lighter.
- **Mounting widget to `document.body`:** The widget should mount next to its script tag so the host page controls placement. Use `script.parentElement.insertBefore()`.
- **Using `mode: 'closed'` for Shadow DOM:** Makes debugging nearly impossible for both widget developers and host site developers. Use `mode: 'open'`.
- **Building a custom form validation library:** Use HTML5 constraint validation (`required`, `type="email"`, `pattern`) plus minimal JS validation before submission. Keep it simple.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS isolation | Custom iframe or style prefixing | Shadow DOM (`attachShadow`) | Native browser API, zero dependencies, bidirectional style isolation |
| Reactive state | Custom event system or stores | @preact/signals | 1KB, built for Preact, auto-batches updates, zero boilerplate |
| IIFE bundling | Custom webpack config | Vite `build.lib` with `formats: ['iife']` | One config option, uses Rollup internally, handles tree-shaking |
| Mobile responsiveness | CSS framework (Tailwind/Bootstrap) | Plain CSS with media queries | Widget is ~3 screens. A CSS framework adds weight for no benefit. |
| Form validation | Validation library (Zod in browser) | HTML5 constraint validation + small JS checks | Browser-native, no bundle cost, covers email/phone/required patterns |
| Color manipulation | Color library | Simple hex-to-HSL darken function (~10 lines) | Only need "darken for hover state", not a full color library |

**Key insight:** The widget is a small, self-contained UI (3 steps, ~10 inputs, 1 API call). Every dependency added to the widget increases load time on the host site. Keep the bundle under 20KB gzipped.

## Common Pitfalls

### Pitfall 1: CSS Inheritance Leaks into Shadow DOM
**What goes wrong:** While Shadow DOM blocks CSS selectors from crossing the boundary, CSS *inherited properties* (color, font-family, font-size, line-height) still cascade in from the host page.
**Why it happens:** The CSS spec defines inheritance as separate from selector matching. Shadow DOM blocks selectors, not inheritance.
**How to avoid:** Set `all: initial` on the widget's root container inside Shadow DOM, then explicitly set your desired font-family, font-size, color, line-height. This resets all inherited properties.
**Warning signs:** Widget text looks different on different host sites (wrong font, wrong color).

### Pitfall 2: Event Retargeting in Shadow DOM
**What goes wrong:** Click events that bubble out of Shadow DOM get *retargeted* -- the `event.target` becomes the shadow host element, not the actual clicked element. Any JavaScript on the host page that inspects click targets will see the widget's host div, not internal elements.
**Why it happens:** Shadow DOM spec retargets events to maintain encapsulation.
**How to avoid:** This is usually fine (events inside the shadow tree work normally). But if using portals or menus that listen on `window` for "click outside" behavior, they will break. For this widget, avoid window-level click listeners.
**Warning signs:** Dropdown menus or modals that won't close.

### Pitfall 3: FOUC When Loading External Stylesheets in Shadow DOM
**What goes wrong:** If you use `<link rel="stylesheet">` inside Shadow DOM, the widget renders unstyled until the CSS file loads.
**Why it happens:** External stylesheets load asynchronously. The browser renders the DOM immediately.
**How to avoid:** Inline all CSS via Vite's `?inline` import suffix. The CSS string is baked into the JavaScript bundle and injected synchronously as a `<style>` element.
**Warning signs:** Widget briefly appears unstyled, then snaps into place.

### Pitfall 4: Widget Breaks Host Page Event Handlers
**What goes wrong:** Form submission inside the widget causes the host page to navigate or reload if the widget form doesn't call `e.preventDefault()`.
**Why it happens:** Form submit events bubble out of Shadow DOM (submit is not retargeted like click).
**How to avoid:** Always call `e.preventDefault()` on form submit handlers. Better yet, don't use `<form>` elements at all -- use `<div>` with button click handlers.
**Warning signs:** Page reloads when user clicks "Next" or "Get Estimate".

### Pitfall 5: Phone Number Input on Mobile
**What goes wrong:** Phone number input shows a full QWERTY keyboard instead of the numeric dial pad on mobile.
**Why it happens:** Default `<input type="text">` shows the alpha keyboard.
**How to avoid:** Use `<input type="tel">` for phone number fields. This shows the telephone keypad on mobile devices. Do NOT use `type="number"` (which is for numeric quantities, not phone numbers).
**Warning signs:** Users struggle to enter phone numbers on mobile, error rates increase.

### Pitfall 6: Consent Text Missing Company Name
**What goes wrong:** Generic consent checkbox text like "I consent to be contacted" doesn't meet TCPA one-to-one consent requirements. The specific company must be named.
**Why it happens:** Developer uses static text instead of dynamically inserting the company name.
**How to avoid:** Fetch company name from `GET /api/config/:companyId` and template it into the consent text: "I consent to receive communications from {companyName} regarding my roofing estimate."
**Warning signs:** Consent checkbox shows a placeholder or generic text.

## Code Examples

### Embed Snippet (What Roofing Companies Paste)
```html
<script
  src="https://roofing-api.your-domain.workers.dev/widget/roofing-widget.js"
  data-company-id="abc123"
  defer
></script>
```

### Root App Component
```tsx
// src/App.tsx
import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { currentStep, isLoading } from './state/form';
import { RoofDetails } from './components/RoofDetails';
import { ContactInfo } from './components/ContactInfo';
import { EstimateDisplay } from './components/EstimateDisplay';
import { fetchCompanyConfig } from './api/client';
import { signal } from '@preact/signals';

const companyConfig = signal<{
  name: string;
  logoUrl: string | null;
  primaryColor: string;
} | null>(null);

export function App({ companyId }: { companyId: string }) {
  useEffect(() => {
    fetchCompanyConfig(companyId).then((config) => {
      companyConfig.value = config;
    });
  }, [companyId]);

  if (!companyConfig.value) {
    return <div class="rc-loading">Loading...</div>;
  }

  const config = companyConfig.value;

  return (
    <div
      class="rc-widget"
      style={{ '--rc-primary': config.primaryColor } as any}
    >
      {config.logoUrl && (
        <img class="rc-logo" src={config.logoUrl} alt={config.name} />
      )}
      {currentStep.value === 0 && <RoofDetails />}
      {currentStep.value === 1 && (
        <ContactInfo companyName={config.name} />
      )}
      {currentStep.value === 2 && <EstimateDisplay />}
    </div>
  );
}
```

### TCPA-Compliant Consent Checkbox
```tsx
// Inside ContactInfo.tsx
<label class="rc-consent-label">
  <input
    type="checkbox"
    checked={formData.value.consent}
    onChange={(e) => updateField('consent', (e.target as HTMLInputElement).checked)}
  />
  <span class="rc-consent-text">
    I consent to receive communications from <strong>{companyName}</strong> regarding
    my roofing estimate. I understand that consent is not a condition of purchase.
  </span>
</label>
```

### Responsive CSS Foundation
```css
/* widget.css */
:host {
  all: initial;
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #1f2937;
}

.rc-widget {
  max-width: 480px;
  width: 100%;
  box-sizing: border-box;
  padding: 24px;
}

.rc-input {
  width: 100%;
  padding: 12px;
  font-size: 16px; /* prevents iOS zoom on focus */
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-sizing: border-box;
}

.rc-btn-primary {
  background-color: var(--rc-primary, #2563eb);
  color: white;
  border: none;
  padding: 14px 24px;
  font-size: 16px;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;
  min-height: 44px; /* adequate tap target */
}

/* Mobile: already responsive via max-width: 480px and width: 100% */
/* Ensure no horizontal scroll */
.rc-widget * {
  box-sizing: border-box;
  max-width: 100%;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| iframe embeds | Shadow DOM isolation | 2020+ | No cross-origin restrictions, native DOM access, smaller footprint |
| React for widgets | Preact for widgets | 2021+ | 10x smaller bundle, same API, critical for third-party embeds |
| Webpack IIFE bundles | Vite lib mode IIFE | 2023+ | Simpler config, faster builds, native ESM dev server |
| CSS-in-JS for Shadow DOM | CSS `?inline` imports | 2023+ | No runtime cost, simpler injection, smaller bundle |
| useState for forms | Preact Signals | 2022+ | No re-render cascades, simpler multi-component state sharing |

**Deprecated/outdated:**
- `preact-compat` package: replaced by `preact/compat` (built into Preact 10+)
- Constructable Stylesheets (`new CSSStyleSheet()`) with `adoptedStyleSheets`: Good API but Safari only added support recently. `<style>` element injection is more reliable across all browsers.

## API Changes Needed for Phase 2

The widget submits contact info alongside the estimate request. The existing `POST /api/estimates` endpoint needs extension:

### Schema Extension
```typescript
// Extended estimate request schema (in packages/api/src/validation/schemas.ts)
export const estimateRequestSchema = z.object({
  sqft: z.number().min(100).max(10000),
  pitch: z.enum(['flat', 'low', 'medium', 'steep']),
  material: z.enum(['3-tab', 'architectural', 'standing-seam-metal']),
  companyId: z.string().min(1),
  // New fields for lead capture (Phase 2)
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  consent: z.boolean().optional(),
});
```

### Database: Leads Table
```typescript
// New table in packages/api/src/db/schema.ts
export const leads = sqliteTable('leads', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => companies.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  consentGiven: integer('consent_given', { mode: 'boolean' }).notNull(),
  consentText: text('consent_text').notNull(), // exact text shown to user
  sqft: real('sqft').notNull(),
  pitch: text('pitch').notNull(),
  material: text('material').notNull(),
  estimateLow: real('estimate_low').notNull(),
  estimateHigh: real('estimate_high').notNull(),
  createdAt: text('created_at').default("(datetime('now'))"),
});
```

**Key decision:** Make the contact fields optional on the API so the estimate endpoint still works without them (backward compatible with Phase 1 usage). The widget always sends them, but the API doesn't break if called without them.

## Open Questions

1. **API base URL in widget bundle**
   - What we know: The widget needs to know where the API lives to make fetch calls.
   - What's unclear: Should the URL be hardcoded at build time, derived from the script `src` attribute, or passed as a data attribute?
   - Recommendation: Derive from the script tag's `src` attribute (same origin). If the widget JS is served from `https://roofing-api.workers.dev/widget/roofing-widget.js`, the API is at `https://roofing-api.workers.dev/api/`. This avoids extra configuration and keeps the embed snippet simple (just company ID).

2. **Widget JS serving strategy**
   - What we know: The widget JS file needs to be served from a URL the host page can load.
   - What's unclear: Serve from the same Cloudflare Worker (as a static asset), or from a separate CDN?
   - Recommendation: Serve from the same Worker using Hono's static file serving or Cloudflare Workers Sites. Keeps deployment simple and CORS trivial (same origin). The built widget file is small (<20KB gzipped).

3. **Lead storage timing**
   - What we know: LEAD-01 requires capturing contact info. The API needs to store leads.
   - What's unclear: Store lead when estimate is requested (combining contact + estimate in one API call) or separate endpoints?
   - Recommendation: Single API call. Extend `POST /api/estimates` to optionally accept contact fields. When present with consent=true, store a lead record alongside returning the estimate. This matches the widget flow (user fills everything, clicks "Get Estimate", sees result).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ~2.1.x (matching API package) |
| Config file | `packages/widget/vitest.config.ts` (Wave 0) |
| Quick run command | `cd packages/widget && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/widget && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIDG-01 | Script tag reads data-company-id, creates shadow DOM host | unit | `npx vitest run test/init.test.ts -t "company-id"` | No -- Wave 0 |
| WIDG-02 | Widget renders inside Shadow DOM, styles injected | unit | `npx vitest run test/init.test.ts -t "shadow"` | No -- Wave 0 |
| WIDG-03 | All inputs reachable, tap targets >= 44px, no horizontal overflow | manual-only | Visual inspection on mobile viewport | N/A -- manual |
| WIDG-04 | Company logo and primary color rendered from API config | unit | `npx vitest run test/app.test.ts -t "branding"` | No -- Wave 0 |
| WIDG-05 | Multi-step flow: roof details -> contact -> estimate | unit | `npx vitest run test/app.test.ts -t "step"` | No -- Wave 0 |
| LEAD-01 | Contact fields (name, email, phone) captured and sent to API | unit | `npx vitest run test/contact.test.ts -t "fields"` | No -- Wave 0 |
| LEAD-02 | Consent checkbox unchecked by default, names company, blocks submit | unit | `npx vitest run test/contact.test.ts -t "consent"` | No -- Wave 0 |

**WIDG-03 manual-only justification:** Mobile responsiveness requires visual verification on actual viewports. Automated tests can check CSS property values but cannot verify visual usability (reachability, scroll behavior, tap target adequacy). Verify by opening the dev harness `index.html` in Chrome DevTools mobile emulation (iPhone SE, Pixel 5).

### API-Side Tests (for schema extension)
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEAD-01 | API accepts and stores contact fields with estimate | integration | `cd packages/api && npx vitest run test/estimates.test.ts -t "lead"` | No -- extend existing |
| LEAD-02 | API rejects submission when consent=false with contact info | unit | `cd packages/api && npx vitest run test/estimates.test.ts -t "consent"` | No -- extend existing |

### Sampling Rate
- **Per task commit:** `cd packages/widget && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/widget && npx vitest run && cd ../api && npx vitest run`
- **Phase gate:** Full suite green in both packages before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/widget/` -- entire package directory (new)
- [ ] `packages/widget/package.json` -- dependencies: preact, @preact/signals
- [ ] `packages/widget/vite.config.ts` -- IIFE build config
- [ ] `packages/widget/tsconfig.json` -- TypeScript config
- [ ] `packages/widget/vitest.config.ts` -- test config (jsdom environment for Shadow DOM testing)
- [ ] `packages/widget/test/init.test.ts` -- WIDG-01, WIDG-02
- [ ] `packages/widget/test/app.test.ts` -- WIDG-04, WIDG-05
- [ ] `packages/widget/test/contact.test.ts` -- LEAD-01, LEAD-02
- [ ] `packages/api/drizzle/migrations/0001_*.sql` -- leads table migration
- [ ] Framework install: `npm install preact @preact/signals && npm install -D vite @preact/preset-vite vitest jsdom`

## Sources

### Primary (HIGH confidence)
- [Preact Signals docs](https://preactjs.com/guide/v10/signals/) -- signal API, component integration, computed values
- [Preact Getting Started](https://preactjs.com/guide/v10/getting-started/) -- Vite setup, @preact/preset-vite usage
- [Vite build options](https://vite.dev/config/build-options) -- `build.lib`, IIFE format, `cssCodeSplit`, CSS inline imports
- [Vite library mode](https://vite.dev/guide/build#library-mode) -- lib entry configuration, output naming
- [MDN Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) -- attachShadow API, mode options, style encapsulation

### Secondary (MEDIUM confidence)
- [CompanyCam: Preact + Shadow DOM widget](https://dev.to/companycam/build-an-embeddable-widget-using-preact-and-the-shadow-dom-33lm) -- practical widget architecture, CSS injection approach, portal pattern for z-index
- [Preact in the Shadow DOM](https://dev.to/tryeladd/preact-in-the-shadow-dom-ao8) -- event retargeting gotcha, styled-components caveat, render target setup
- [MakerKit: Embeddable React Widgets guide](https://makerkit.dev/blog/tutorials/embeddable-widgets-react) -- Rollup IIFE config, Shadow DOM setup, data attribute reading, bundle size targets
- [TCPA consent compliance checklist](https://leadcapture.io/blog/tcpa-compliance-checklist/) -- unchecked default requirement, company naming requirement, consent language examples
- [Sentry: Preact vs Svelte for widgets](https://sentry.engineering/blog/preact-or-svelte-an-embedded-widget-use-case/) -- bundle size comparison, Preact 8.14KB final build

### Tertiary (LOW confidence)
- None -- all findings verified against official documentation or multiple community sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Preact + Vite is the officially recommended toolchain; Shadow DOM is a browser standard; approach validated by multiple production widgets (Sentry, CompanyCam, Intercom)
- Architecture: HIGH -- IIFE + Shadow DOM + inline CSS pattern is well-documented across multiple independent sources; multi-step form is straightforward Preact component composition
- Pitfalls: HIGH -- CSS inheritance, event retargeting, and FOUC are well-documented Shadow DOM behaviors; TCPA consent requirements verified against compliance-focused sources
- API extension: HIGH -- straightforward schema extension following established Drizzle/Zod patterns from Phase 1

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable technologies, 30-day validity)
