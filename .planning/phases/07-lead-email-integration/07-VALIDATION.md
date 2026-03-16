---
phase: 7
slug: lead-email-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ~2.1.x with @cloudflare/vitest-pool-workers |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `cd packages/api && npx vitest run` |
| **Full suite command** | `cd packages/api && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/api && npx vitest run`
- **After every plan wave:** Run `cd packages/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | LEAD-01a,b,c,d | unit | `cd packages/api && npx vitest run` | No — Wave 0 creates | ⬜ pending |
| 07-01-02 | 01 | 1 | LEAD-01 | unit | `cd packages/api && npx vitest run` | Wave 0 stubs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add `stores address` and `stores null address` tests to `packages/api/test/estimates.test.ts` — covers LEAD-01a, LEAD-01b
- [ ] Add `includes property address` and `omits property address` tests to `packages/api/test/lead-notification.test.ts` — covers LEAD-01c, LEAD-01d
- [ ] Update test setup SQL in `estimates.test.ts` `beforeAll` to include `address text` column

*Wave 0 creates RED stubs; Wave 1 implementation turns them GREEN.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email renders address row visually correct | LEAD-01 | HTML visual layout | Send test lead with address, inspect received email |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
