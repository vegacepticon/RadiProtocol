---
phase: 43-unified-loop-graph-model-parser-validator-migration-errors
fixed_at: 2026-04-17T13:45:00Z
review_path: .planning/phases/43-unified-loop-graph-model-parser-validator-migration-errors/43-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 43: Code Review Fix Report

**Fixed at:** 2026-04-17T13:45:00Z
**Source review:** .planning/phases/43-unified-loop-graph-model-parser-validator-migration-errors/43-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (Critical + Warning)
- Fixed: 3
- Skipped: 0

Scope filter: `critical_warning` — 0 Critical + 3 Warning = 3 in-scope findings.
The 5 Info items (IN-01..IN-05) are out of scope for this iteration.

## Fixed Issues

### WR-01: Three session tests silently pass — runner enters error before `chooseAnswer`

**Files modified:** `src/__tests__/runner/protocol-runner-session.test.ts`
**Commit:** 66ed95d
**Applied fix:** Marked the three vacuously-passing tests as `it.skip(...)` and added
Phase 44 TODO comments consistent with the surrounding `.skip` pattern:
- `restores accumulatedText correctly (SESSION-05)` (line 113)
- `canStepBack is true when undoStack was non-empty in saved state` (line 133)
- `getSerializableState() → JSON.stringify → JSON.parse → restoreFrom() produces
  identical getState()` (line 159)

All three tests load `loop-body.canvas` which now triggers `transitionToError`
via the merged legacy-loop stub; the existing `if (savedState === null) return;`
guards made their assertions unreachable. Skipping with a Phase 44 rewrite note
matches how the neighbouring legacy-loop tests in the same file already handle
the D-14 scope cut.

### WR-02: `private edgeByLabel()` is now dead code

**Files modified:** `src/runner/protocol-runner.ts`
**Commit:** cb2c15a
**Applied fix:** Deleted the `edgeByLabel` method outright (previously
lines 598-607). Grep confirmed the only remaining reference in `src/` was the
definition itself — no callers. Phase 44's unified picker can use
`graph.edges.filter(...)` directly (matching the validator pattern in
`graph-validator.ts:98-100`) or reintroduce a fresh helper if warranted.

### WR-03: Stale JSDoc in `validateSessionNodeIds` still says `loopStartIds`

**Files modified:** `src/sessions/session-service.ts`
**Commit:** ec77770
**Applied fix:** Renamed both `loopStartIds` references in the JSDoc header at
lines 112-113 to `loopNodeIds`, matching the Phase 43 D-04 / D-13 schema rename
(`PersistedLoopContext.loopStartId` → `loopNodeId`). The function body already
reads `frame.loopNodeId`; only the docstring was out of date.

---

_Fixed: 2026-04-17T13:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
