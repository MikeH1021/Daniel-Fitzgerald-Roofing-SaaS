---
phase: 3
slug: lead-delivery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 3 — Validation Strategy

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
| 03-01-01 | 01 | 1 | LEAD-03a | unit | `cd packages/api && npx vitest run test/lead-notification.test.ts -t "sends email"` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | LEAD-03b | unit | `cd packages/api && npx vitest run test/lead-notification.test.ts -t "email content"` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | LEAD-03c | unit | `cd packages/api && npx vitest run test/estimates.test.ts -t "honeypot"` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | LEAD-03d | unit | `cd packages/api && npx vitest run test/estimates.test.ts -t "rate limit"` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | LEAD-03e | unit | `cd packages/api && npx vitest run test/lead-notification.test.ts -t "email failure"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/test/lead-notification.test.ts` — stubs for LEAD-03a, LEAD-03b, LEAD-03e (email sending with mocked Resend API)
- [ ] Honeypot and rate limiting tests added to existing `test/estimates.test.ts` — covers LEAD-03c, LEAD-03d
- [ ] Mock/stub for Resend API fetch calls and RateLimit binding in test setup

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email lands in inbox (not spam) on Gmail/Outlook/Yahoo | LEAD-03 SC2 | Requires real email providers | Send test email to Gmail/Outlook/Yahoo accounts, verify inbox placement |
| Email delivered within 1 minute | LEAD-03 SC1 | Timing depends on Resend delivery | Submit widget, check email arrival time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
