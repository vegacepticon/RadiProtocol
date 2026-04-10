---
phase: 1
slug: project-scaffold-and-canvas-parsing-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (Wave 0 gap — does not exist yet) |
| **Quick run command** | `npx vitest run src/__tests__` |
| **Full suite command** | `npx vitest run && npm run lint` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__`
- **After every plan wave:** Run `npx vitest run && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green + `npm run lint` zero errors
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-W0-01 | W0 | 0 | DEV-04 | — | N/A | infra | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-W0-02 | W0 | 0 | DEV-01, DEV-02 | — | N/A | infra | `npm run lint` | ❌ W0 | ⬜ pending |
| 1-W0-03 | W0 | 0 | DEV-05 | — | N/A | fixture | `npx vitest run src/__tests__/canvas-parser.test.ts` | ❌ W0 | ⬜ pending |
| 1-W0-04 | W0 | 0 | PARSE-07, PARSE-08 | — | N/A | unit stub | `npx vitest run src/__tests__/graph-validator.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-01 | 01 | 1 | PARSE-01, PARSE-02 | — | N/A | unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | PARSE-03 | — | N/A | unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | PARSE-06, NFR-01 | — | No Obsidian import in graph module | unit (import check) | `npx vitest run` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | PARSE-07 | T-1-01 | Malformed JSON returned as error, not thrown | unit | `npx vitest run src/__tests__/graph-validator.test.ts` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | PARSE-08 | — | Error messages are plain strings | unit | `npx vitest run src/__tests__/graph-validator.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | DEV-02, DEV-03, NFR-04 | — | N/A | lint | `npm run lint` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | DEV-01, NFR-05 | — | N/A | manual smoke | N/A — manual | manual | ⬜ pending |
| 1-04-02 | 04 | 2 | NFR-08 | — | N/A | code review | N/A — manual | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest config for `src/__tests__/`, node environment (DEV-04)
- [ ] `src/__tests__/canvas-parser.test.ts` — stubs for PARSE-01, PARSE-02, PARSE-03, PARSE-06
- [ ] `src/__tests__/graph-validator.test.ts` — stubs for PARSE-07, PARSE-08
- [ ] `src/__tests__/fixtures/linear.canvas` — valid linear protocol fixture
- [ ] `src/__tests__/fixtures/branching.canvas` — valid branching protocol fixture
- [ ] `src/__tests__/fixtures/dead-end.canvas` — dead-end question error fixture
- [ ] `src/__tests__/fixtures/cycle.canvas` — unintentional cycle error fixture
- [ ] `package.json` `"test"` script: `"vitest run"` — CI integration

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npm run dev` builds and copies to dev vault | DEV-01 | Requires live Obsidian install and dev vault configured via `.env` | Run `npm run dev`, confirm `main.js` appears in `${OBSIDIAN_DEV_VAULT_PATH}/.obsidian/plugins/radiprotocol/`, reload Obsidian, verify ribbon icon and command palette entries appear |
| Settings load uses `Object.assign({}, DEFAULT_SETTINGS, ...)` | NFR-08 | Code pattern review — not testable as unit test without full plugin context | Inspect `src/settings.ts` — confirm `loadSettings()` uses `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` pattern |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
