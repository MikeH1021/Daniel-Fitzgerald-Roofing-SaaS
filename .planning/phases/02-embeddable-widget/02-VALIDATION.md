---
phase: 2
slug: embeddable-widget
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~2.1.x (matching API package) |
| **Config file** | `packages/widget/vitest.config.ts` (Wave 0) |
| **Quick run command** | `cd packages/widget && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/widget && npx vitest run && cd ../api && npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/widget && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/widget && npx vitest run && cd ../api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | WIDG-01 | unit | `npx vitest run test/init.test.ts -t "company-id"` | ❌ W0 | ⬜ pending |
| 02-01-01 | 01 | 1 | WIDG-02 | unit | `npx vitest run test/init.test.ts -t "shadow"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | WIDG-04 | unit | `npx vitest run test/app.test.ts -t "branding"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | WIDG-05 | unit | `npx vitest run test/app.test.ts -t "step"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | LEAD-01 | unit | `npx vitest run test/contact.test.ts -t "fields"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | LEAD-02 | unit | `npx vitest run test/contact.test.ts -t "consent"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | LEAD-01 | integration | `cd packages/api && npx vitest run test/estimates.test.ts -t "lead"` | ❌ extend | ⬜ pending |
| 02-02-01 | 02 | 2 | LEAD-02 | unit | `cd packages/api && npx vitest run test/estimates.test.ts -t "consent"` | ❌ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/widget/package.json` — dependencies: preact, @preact/signals
- [ ] `packages/widget/vite.config.ts` — IIFE build config
- [ ] `packages/widget/tsconfig.json` — TypeScript config
- [ ] `packages/widget/vitest.config.ts` — test config (jsdom environment for Shadow DOM testing)
- [ ] `packages/widget/test/init.test.ts` — stubs for WIDG-01, WIDG-02
- [ ] `packages/widget/test/app.test.ts` — stubs for WIDG-04, WIDG-05
- [ ] `packages/widget/test/contact.test.ts` — stubs for LEAD-01, LEAD-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mobile responsiveness — all inputs reachable, tap targets >= 44px, no horizontal scroll | WIDG-03 | Visual usability requires actual viewport inspection | Open dev harness `index.html` in Chrome DevTools mobile emulation (iPhone SE, Pixel 5). Verify all inputs reachable, no horizontal scroll, tap targets adequate. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
