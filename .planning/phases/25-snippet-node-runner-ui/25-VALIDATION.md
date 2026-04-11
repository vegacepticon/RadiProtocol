---
phase: 25
slug: snippet-node-runner-ui
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-11
audited: 2026-04-11
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — Obsidian plugin (no automated test runner; manual verification via Obsidian dev environment) |
| **Config file** | none |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | SNIPPET-02 | — | N/A | type-check + unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | ✅ | ✅ green |
| 25-01-02 | 01 | 1 | SNIPPET-02 | — | N/A | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts` | ✅ | ✅ green |
| 25-02-01 | 02 | 2 | SNIPPET-03 | — | N/A | manual | Launch Obsidian, open Protocol Runner at snippet node | ❌ W0 | ⬜ pending |
| 25-02-02 | 02 | 2 | SNIPPET-04 | — | N/A | manual | Select .md file, verify content inserted in textarea | ❌ W0 | ⬜ pending |
| 25-02-03 | 02 | 2 | SNIPPET-05 | — | N/A | manual | Select .json file, verify SnippetFillInModal opens | ❌ W0 | ⬜ pending |
| 25-02-04 | 02 | 2 | SNIPPET-07 | — | N/A | manual | Set per-node folder, verify it overrides global setting | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing TypeScript compilation covers type-check verification.
- Manual Obsidian environment required for UI behavior testing.

*Automated coverage: type-checking only. Functional behaviors require manual verification (Obsidian plugin environment).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Snippet button appears in Protocol Runner | SNIPPET-02 | Obsidian plugin UI — no test runner | Open Protocol Runner at a snippet node; verify button styled like answer button |
| Fuzzy file picker opens scoped to folder | SNIPPET-03 | Obsidian modal — no test runner | Press snippet button; verify modal lists only files in configured folder |
| .md file inserts content into textarea | SNIPPET-04 | Obsidian file API — no test runner | Select .md file; verify plain-text content appended to report textarea; runner advances |
| .json file opens SnippetFillInModal | SNIPPET-05 | Obsidian modal chain — no test runner | Select .json snippet; fill placeholders; confirm; verify filled text appended; runner advances |
| Per-node folder override respected | SNIPPET-07 | Runtime config check — no test runner | Set per-node folder in Node Editor; verify it overrides global setting in file picker |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-04-11

---

## Validation Audit 2026-04-11

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

**Tests added:**
- `src/__tests__/fixtures/snippet-node.canvas` — new fixture (start → q → a → snippet node)
- `src/__tests__/canvas-parser.test.ts` — 2 new tests: snippet node with folderPath/buttonLabel; minimal snippet node (undefined optionals)
- `src/__tests__/runner/protocol-runner.test.ts` — 3 new tests: halt at snippet node with `isAtSnippetNode: true`; `completeSnippetFile()` appends + advances; `completeSnippetFile()` no-op outside at-node state
