---
phase: 10-admin-widget-polish
plan: "03"
subsystem: widget
tags: [ux, error-handling, navigation, state-management]
dependency_graph:
  requires: []
  provides: [WID-01, WID-02]
  affects: [packages/widget/src/state/form.ts, packages/widget/src/components/EstimateDisplay.tsx, packages/widget/src/api/client.ts, packages/widget/src/components/ContactInfo.tsx]
tech_stack:
  added: []
  patterns: [preact-signals state navigation, specific error message propagation]
key_files:
  created: []
  modified:
    - packages/widget/src/state/form.ts
    - packages/widget/src/components/EstimateDisplay.tsx
    - packages/widget/src/api/client.ts
    - packages/widget/src/components/ContactInfo.tsx
decisions:
  - "goToStep() sets currentStep without touching formData so contact info survives roof detail edits"
  - "estimateResult cleared on Edit Roof Details to force re-submission after edits"
  - "Get Another Estimate demoted to text link to distinguish soft-back vs full-reset flows"
  - "Error body parsed before status-based fallback so API-provided messages take precedence"
metrics:
  duration: "< 2 minutes"
  completed: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 10 Plan 03: Widget UX - Back Navigation and Specific Error Messages Summary

Widget UX improvements: non-destructive "Edit Roof Details" back navigation from estimate screen preserving contact info, and specific error message extraction from API responses (rate limit, validation, server errors).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add back-to-edit navigation from estimate screen | b1b4e18 | form.ts, EstimateDisplay.tsx |
| 2 | Show specific API error messages in widget | ea60ea7 | client.ts, ContactInfo.tsx |

## What Was Built

### Task 1: Back Navigation Without Losing Contact Info (WID-01)

Added `goToStep(step: number)` to `form.ts` — sets `currentStep.value` directly without touching `formData`. In `EstimateDisplay.tsx`, a new "Edit Roof Details" secondary button calls `handleEditRoof()` which clears `estimateResult` and calls `goToStep(0)`. The user's `firstName`, `lastName`, `email`, `phone`, and `consent` remain in the signal and are still populated when they reach step 1 (ContactInfo) again. The existing full-reset flow is preserved as a text link ("Get Another Estimate") below the button.

### Task 2: Specific API Error Messages (WID-02)

Updated `submitEstimate` in `client.ts` to parse the response body before throwing. Priority:
1. If `body.details` is an array, join field messages: e.g. "Square footage is required. Material is required."
2. If `body.error` exists, use it directly: e.g. "Too many requests. Please try again later."
3. If body is not JSON, fall back to status-based messages (429 → rate limit, 500+ → server error)
4. Default: "Something went wrong. Please try again."

Also updated `fetchCompanyConfig` to parse `body.error` for specific config failure messages.

`ContactInfo.tsx` already rendered `submitError.value` in `rc-error` div — added `marginBottom: '8px'` for consistent spacing above the button row.

## Decisions Made

- `goToStep()` is a new primitive separate from `nextStep()`/`prevStep()` because it allows arbitrary step navigation without increment/decrement semantics — required for jumping back to step 0 from step 2.
- `estimateResult` is cleared when editing roof details so the ContactInfo submit flow re-runs the API call (otherwise the user would skip to step 2 without re-submitting).
- Error body parsing tries `body.details` first (more specific) before `body.error` (general), matching the API's 400 response shape.

## Deviations from Plan

None - plan executed exactly as written. ContactInfo.tsx was modified with the `marginBottom` spacing as specified (already had `marginTop: '8px'`, added `marginBottom: '8px'`).

## Verification

Widget builds with no TypeScript errors: `vite build` succeeds at 51.57 kB (gzip: 17.82 kB).

## Self-Check: PASSED

All created/modified files exist on disk. All task commits (b1b4e18, ea60ea7) verified in git log.
