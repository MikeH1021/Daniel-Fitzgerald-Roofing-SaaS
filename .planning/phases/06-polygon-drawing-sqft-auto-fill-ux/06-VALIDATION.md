---
phase: 6
slug: polygon-drawing-sqft-auto-fill-ux
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~2.1 |
| **Config file** | `packages/widget/vitest.config.ts` |
| **Quick run command** | `cd packages/widget && npx vitest run` |
| **Full suite command** | `cd packages/widget && npx vitest run && cd ../api && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/widget && npx vitest run`
- **After every plan wave:** Run `cd packages/widget && npx vitest run && cd ../api && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | MEAS-02 | unit | `cd packages/widget && npx vitest run test/area.test.ts` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | MEAS-01, MEAS-03, MEAS-04, MEAS-05 | unit | `cd packages/widget && npx vitest run test/draw.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | UX-01, UX-02 | unit | `cd packages/widget && npx vitest run test/app.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/widget/test/area.test.ts` — stubs for MEAS-02 (mock `window.google.maps.geometry.spherical.computeArea`, test coordinate swap `[lng,lat]→{lat,lng}`, pitch multipliers flat=1.00/low=1.05/medium=1.12/steep=1.25, edge case < 3 coords returns 0)
- [ ] `packages/widget/test/draw.test.ts` — stubs for MEAS-01, MEAS-03, MEAS-04, MEAS-05 (mock `window.terraDraw` + `window.terraDrawGoogleMapsAdapter`, test Terra Draw lifecycle with `ready` event gate, `change` event → live sqft, `finish` event → auto-fill, "Clear" removes features)
- [ ] Extend `packages/widget/test/app.test.ts` — covers UX-01 (drawing controls visible when `mapMode=true`), UX-02 (`mapError=true` hides map toggle, fetch error sets `mapError`)

*Existing Vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Polygon vertices render visually on satellite map | MEAS-01 | Requires Google Maps API key + real browser rendering | Open widget, activate map mode, click vertices on roof, verify polygon appears |
| "Done Drawing" closes polygon and fills sqft field | MEAS-03, MEAS-04 | Requires live Maps + Terra Draw in browser | Trace roof, tap "Done Drawing", verify sqft field auto-fills |
| Undo last vertex works on mobile touch | MEAS-05 | Touch events need real device/browser | Test on iOS Safari / Android Chrome |
| CSP fallback hides map toggle cleanly | UX-02 | Requires CSP-blocked environment simulation | Block maps.googleapis.com via browser DevTools request blocking, reload widget |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
