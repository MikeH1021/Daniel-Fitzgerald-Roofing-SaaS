---
phase: 02-embeddable-widget
verified: 2026-03-09T23:56:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 2: Embeddable Widget Verification Report

**Phase Goal:** Homeowners can use a branded, mobile-friendly widget on any roofing company's website to enter roof details, provide contact info with consent, and see an instant price range
**Verified:** 2026-03-09T23:56:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Widget script tag with data-company-id creates Shadow DOM host and renders Preact app inside it | VERIFIED | `packages/widget/src/index.ts` reads `data-company-id`, creates `div#roofing-widget-host`, attaches shadow DOM, injects styles, calls `render(h(App, { companyId }), root)`. 3 init tests pass. |
| 2 | Widget fetches company branding (logo, primary color) from GET /api/config/:companyId and applies it | VERIFIED | `App.tsx` calls `fetchCompanyConfig(companyId)` in `useEffect`, stores in `companyConfig` signal, sets `--rc-primary` CSS variable, renders `<img>` for logo. Test "branding" passes. |
| 3 | Widget displays multi-step flow: roof details -> contact info -> estimate display | VERIFIED | `App.tsx` conditionally renders `RoofDetails` (step 0), `ContactInfo` (step 1), `EstimateDisplay` (step 2) based on `currentStep.value`. Test "step" passes. |
| 4 | Widget CSS is fully isolated inside Shadow DOM and responsive down to 320px width | VERIFIED | `widget.css` starts with `:host { all: initial; }`, uses `max-width: 480px; width: 100%`, `font-size: 16px` (prevents iOS zoom), `min-height: 44px` tap targets. Shadow DOM attached in `index.ts`. |
| 5 | Vite builds a single IIFE JS file with all CSS inlined | VERIFIED | `vite.config.ts` sets `formats: ['iife']`, `cssCodeSplit: false`. Build produces `dist/roofing-widget.js` at 28KB (10KB gzipped). |
| 6 | Homeowner can enter first name, last name, email, and phone number in the contact step | VERIFIED | `ContactInfo.tsx` renders 4 inputs: text/First Name, text/Last Name, email/Email Address, tel/Phone Number. All bound to `formData` signal via `updateField`. Test "fields" passes. |
| 7 | Consent checkbox is unchecked by default and names the specific roofing company | VERIFIED | `ContactInfo.tsx` renders `<input type="checkbox" checked={data.consent}>` (default `false` in `form.ts`). Label includes `{companyName}` interpolation. Test "consent" passes. |
| 8 | Form submission is blocked until consent checkbox is checked | VERIFIED | `ContactInfo.tsx` `validate()` checks `if (!data.consent) errs.consent = '...'` and returns false, preventing `handleSubmit` from calling API. Test "validation" passes. |
| 9 | Submitting the form with contact info calls POST /api/estimates with lead data and stores a lead record | VERIFIED | `ContactInfo.tsx` calls `submitEstimate()` with all fields. `estimates.ts` route checks for contact fields + consent, inserts into `leads` table via drizzle. API test "stores lead" passes. |
| 10 | After submission, the estimate display shows the price range and disclaimer | VERIFIED | `EstimateDisplay.tsx` reads `estimateResult.value`, formats with `toLocaleString`, renders in `.rc-estimate-range` and `.rc-disclaimer`. Test "submit" verifies step advances to 2. |
| 11 | Widget is fully usable on mobile (no horizontal scroll, adequate tap targets) | VERIFIED (code-level) | CSS uses `width: 100%`, `max-width: 100%` on all elements, `min-height: 44px` on buttons, `font-size: 16px` on inputs, `type="tel"` for phone. Visual verification recommended. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/widget/package.json` | Widget package with preact, signals, vite | VERIFIED | Exists, correct dependencies |
| `packages/widget/src/index.ts` | Entry point with Shadow DOM init | VERIFIED | 40 lines, reads data-company-id, creates shadow, renders App |
| `packages/widget/src/App.tsx` | Root component with config fetch, branding, step routing | VERIFIED | 54 lines, fetches config, applies branding, routes steps |
| `packages/widget/src/state/form.ts` | Preact signals for form data | VERIFIED | Exports currentStep, formData, estimateResult, updateField, nextStep, prevStep, isLoading |
| `packages/widget/src/styles/widget.css` | Widget styles with CSS custom properties | VERIFIED | Contains `all: initial`, responsive layout, branding variables |
| `packages/widget/vite.config.ts` | IIFE build configuration | VERIFIED | Contains `iife` format, lib entry, cssCodeSplit false |
| `packages/widget/src/components/RoofDetails.tsx` | Roof details form step | VERIFIED | 77 lines, sqft/pitch/material inputs with validation |
| `packages/widget/src/components/ContactInfo.tsx` | Contact form with TCPA consent | VERIFIED | 132 lines, 4 inputs + consent checkbox + validation + API submission |
| `packages/widget/src/components/EstimateDisplay.tsx` | Estimate result display | VERIFIED | 64 lines, currency formatting, loading state, start over reset |
| `packages/widget/src/api/client.ts` | API client for config and estimates | VERIFIED | 56 lines, fetchCompanyConfig + submitEstimate with proper data shapes |
| `packages/api/src/db/schema.ts` | Leads table schema | VERIFIED | Contains `leads` table with all required fields |
| `packages/api/src/validation/schemas.ts` | Extended estimate schema with contact fields | VERIFIED | Contains `firstName` optional field, superRefine for conditional validation |
| `packages/api/src/routes/estimates.ts` | Extended POST handler storing leads | VERIFIED | Contains `leads` insert when contact fields + consent present |
| `packages/widget/test/contact.test.ts` | Tests for contact fields and consent | VERIFIED | 4 tests: fields, consent, submit, validation |
| `packages/api/drizzle/migrations/0001_strange_landau.sql` | Leads table migration | VERIFIED | Exists |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/widget/src/index.ts` | `packages/widget/src/App.tsx` | `render(h(App, { companyId }), root)` | WIRED | Line 31: `render(h(App, { companyId }), root)` |
| `packages/widget/src/App.tsx` | `/api/config/:companyId` | `fetchCompanyConfig` call in useEffect | WIRED | Line 22: `fetchCompanyConfig(companyId)` in useEffect |
| `packages/widget/src/App.tsx` | `packages/widget/src/state/form.ts` | `currentStep.value` drives conditional rendering | WIRED | Lines 49-51: `currentStep.value === 0/1/2` |
| `packages/widget/src/components/ContactInfo.tsx` | `packages/widget/src/api/client.ts` | `submitEstimate()` called on form submission | WIRED | Line 37: `await submitEstimate({...})` with all form data |
| `packages/api/src/routes/estimates.ts` | `packages/api/src/db/schema.ts` | Inserts into leads table when consent=true | WIRED | Line 90: `db.insert(leads).values({...})` |
| `packages/widget/src/components/ContactInfo.tsx` | `packages/widget/src/state/form.ts` | Reads/writes formData signal for contact fields | WIRED | Line 10: `formData.value`, Lines 67-100: `updateField(...)` calls |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WIDG-01 | 02-01 | Widget embeddable via single script tag with company ID attribute | SATISFIED | `index.ts` reads `data-company-id` from `document.currentScript`, auto-initializes. Init tests pass. |
| WIDG-02 | 02-01 | Widget renders inside Shadow DOM for CSS isolation | SATISFIED | `index.ts` calls `attachShadow({ mode: 'open' })`, injects styles into shadow. Init tests verify shadow root structure. |
| WIDG-03 | 02-01, 02-02 | Widget is fully responsive and usable on mobile devices | SATISFIED | CSS uses `all: initial`, `width: 100%`, `max-width: 480px`, `font-size: 16px`, `min-height: 44px`, `type="tel"`. |
| WIDG-04 | 02-01 | Widget displays company logo and primary brand color | SATISFIED | `App.tsx` fetches config, renders `<img>` for logo, sets `--rc-primary` CSS variable. Branding test passes. |
| WIDG-05 | 02-01 | Widget follows multi-step flow: roof details -> contact info -> estimate display | SATISFIED | `App.tsx` routes steps 0/1/2, `RoofDetails`/`ContactInfo`/`EstimateDisplay` components implemented. Step test passes. |
| LEAD-01 | 02-02 | Homeowner can enter first name, last name, email, and phone number | SATISFIED | `ContactInfo.tsx` has 4 inputs (text, text, email, tel) bound to formData. Fields test passes. |
| LEAD-02 | 02-02 | Homeowner must check TCPA-compliant consent checkbox (unchecked by default, names the company) | SATISFIED | Checkbox defaults to `false`, label includes `{companyName}`, validation blocks submit without consent. Consent test passes. |

No orphaned requirements found -- all 7 requirement IDs from REQUIREMENTS.md traceability table for Phase 2 are covered by plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | - |

No TODO/FIXME/PLACEHOLDER comments, no empty implementations, no stub returns found in any phase 2 files.

### Human Verification Required

### 1. Mobile Responsiveness

**Test:** Open `packages/widget/index.html` in a mobile browser or device emulator at 320px width
**Expected:** Widget fits without horizontal scroll, all inputs and buttons are usable with touch, phone input shows numeric keypad
**Why human:** CSS responsive behavior and touch interaction cannot be verified programmatically

### 2. Visual Branding

**Test:** Load widget with a company that has a logo and custom primary color
**Expected:** Logo displays at appropriate size, primary color applies to buttons and estimate range text
**Why human:** Visual appearance and color rendering require human judgment

### 3. End-to-End Flow

**Test:** Fill in roof details, proceed to contact info, check consent, submit, and view estimate
**Expected:** Smooth step transitions, no layout jumps, loading state visible during API call, formatted price range displays correctly
**Why human:** User flow timing, animation smoothness, and overall feel require human testing

### Gaps Summary

No gaps found. All 11 observable truths verified, all 15 artifacts exist and are substantive, all 6 key links are wired, all 7 requirements are satisfied, and no anti-patterns detected. All 30 tests pass (9 widget + 21 API). The IIFE bundle builds successfully at 28KB (10KB gzipped).

---

_Verified: 2026-03-09T23:56:00Z_
_Verifier: Claude (gsd-verifier)_
