---
phase: 1
slug: api-estimate-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~3.x with @cloudflare/vitest-pool-workers |
| **Config file** | `packages/api/vitest.config.ts` (Wave 0 creation) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | EST-01 | unit | `npx vitest run test/estimates.test.ts -t "sqft"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | EST-02 | unit | `npx vitest run test/estimates.test.ts -t "pitch"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | EST-03 | unit | `npx vitest run test/estimates.test.ts -t "material"` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | EST-04 | unit | `npx vitest run test/engine.test.ts -t "range"` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | EST-05 | unit | `npx vitest run test/engine.test.ts -t "calculate"` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 1 | EST-06 | unit | `npx vitest run test/engine.test.ts -t "round"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/vitest.config.ts` — Vitest config with Workers pool
- [ ] `packages/api/test/tsconfig.json` — Test TypeScript config
- [ ] `packages/api/test/env.d.ts` — Binding type declarations
- [ ] `packages/api/test/engine.test.ts` — Pure calculation function tests (EST-04, EST-05, EST-06)
- [ ] `packages/api/test/estimates.test.ts` — API endpoint validation tests (EST-01, EST-02, EST-03)
- [ ] Framework install: `npm install -D vitest @cloudflare/vitest-pool-workers`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| API deploys to Cloudflare Workers | EST-04 | Requires CF account and wrangler deploy | `npx wrangler deploy` and verify endpoint responds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
