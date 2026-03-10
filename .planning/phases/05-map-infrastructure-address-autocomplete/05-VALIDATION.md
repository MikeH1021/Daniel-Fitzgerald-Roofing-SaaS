---
phase: 5
slug: map-infrastructure-address-autocomplete
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

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
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | MAP-03 | unit | `cd packages/api && npx vitest run test/maps.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | MAP-03 | unit | `cd packages/widget && npx vitest run test/maps-loader.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | MAP-01 | unit | `cd packages/widget && npx vitest run test/autocomplete.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | MAP-01 | unit | `cd packages/widget && npx vitest run test/autocomplete.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | MAP-02 | unit | `cd packages/widget && npx vitest run test/maps-loader.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/widget/test/autocomplete.test.ts` — stubs for MAP-01 (mock `google.maps.importLibrary`, test session token lifecycle, portal rendering)
- [ ] `packages/widget/test/maps-loader.test.ts` — stubs for MAP-02, MAP-03 (mock script injection, verify lazy load guard)
- [ ] `packages/api/test/maps.test.ts` — stubs for MAP-03 API endpoint (mock env binding, test 200/503 responses)

*Existing Vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Autocomplete dropdown visually appears below input | MAP-01 | Portal positioning in real browser | Open widget, type address, verify dropdown renders below input field |
| Satellite map shows correct location at roof zoom | MAP-02 | Visual satellite imagery verification | Select address, verify satellite map centers on correct property |
| Maps API no network request until map mode activated | MAP-03 | Network tab inspection | Open widget, verify no maps.googleapis.com requests; activate map mode, verify request appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
