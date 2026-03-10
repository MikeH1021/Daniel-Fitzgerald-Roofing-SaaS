---
phase: 4
slug: admin-settings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ~2.1.x with @cloudflare/vitest-pool-workers |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `cd packages/api && npx vitest run` |
| **Full suite command** | `cd packages/api && npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/api && npx vitest run`
- **After every plan wave:** Run `cd packages/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | AUTH | integration | `cd packages/api && npx vitest run test/admin.test.ts -t "auth"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | ADMN-02 | integration | `cd packages/api && npx vitest run test/admin.test.ts -t "color"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | ADMN-03 | integration | `cd packages/api && npx vitest run test/admin.test.ts -t "pricing"` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | ADMN-04 | unit | `cd packages/api && npx vitest run test/admin.test.ts -t "embed"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | ADMN-01 | integration | `cd packages/api && npx vitest run test/admin.test.ts -t "logo"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/test/admin.test.ts` — stubs for AUTH, ADMN-01 through ADMN-04
- [ ] R2 bucket mock setup in test config (vitest-pool-workers supports R2 bindings in miniflare)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Logo visible in widget after upload | ADMN-01 SC | Requires rendered widget | Upload logo via admin, load widget, verify logo displays |
| Brand color reflected in widget | ADMN-02 SC | Requires rendered widget | Set color via admin, load widget, verify color applied |
| Pricing overrides affect estimate | ADMN-03 SC | End-to-end flow | Set override, request estimate, verify changed values |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
