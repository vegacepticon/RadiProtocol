---
phase: 36-dead-code-audit-and-cleanup
plan: 01
subsystem: codebase-hygiene
tags: [knip, dead-code, css, testing, async-mutex]

# Dependency graph
requires:
  - phase: 35-markdown-snippets-in-protocol-runner
    provides: "Phase 35 GREEN tests in runner-extensions.test.ts"
provides:
  - "Clean codebase with zero unused TypeScript exports"
  - "Runner CSS without dead legend rules"
  - "Test suite with only passing tests (356/356)"
  - "Knip devDependency for ongoing dead code analysis"
affects: [36-02, all-future-phases]

# Tech tracking
tech-stack:
  added: [knip]
  patterns: [dead-code-audit-with-knip, export-minimization]

key-files:
  created: []
  modified:
    - src/styles/runner-view.css
    - src/__tests__/runner-extensions.test.ts
    - src/runner/protocol-runner.ts
    - src/runner/runner-state.ts
    - src/snippets/canvas-ref-sync.ts
    - src/views/confirm-modal.ts
    - src/views/resume-session-modal.ts
    - src/views/snippet-chip-editor.ts
    - src/views/snippet-editor-modal.ts
    - src/views/snippet-manager-view.ts
    - package.json

key-decisions:
  - "Remove export keyword rather than delete types — all 8 types are used internally"
  - "Delete node-switch-guard-modal.ts entirely — replaced by confirm-modal.ts in Phase 33"
  - "Delete make-canvas-node.ts test utility — zero imports across codebase"
  - "Restore async-mutex to package.json dependencies — was dropped at some point, build was broken without skipLibCheck"

patterns-established:
  - "Knip audit: run npx knip --reporter compact to detect unused exports"
  - "Export minimization: only export types consumed by other modules"

requirements-completed: [CLEAN-01]

# Metrics
duration: 9min
completed: 2026-04-16
---

# Phase 36 Plan 01: Dead Code Audit and Cleanup Summary

**Knip-driven dead code removal: 8 unused type exports internalized, 2 dead files deleted, 3 legend CSS rules removed, 3 RED test stubs removed, async-mutex dependency restored**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-16T06:57:59Z
- **Completed:** 2026-04-16T07:06:58Z
- **Tasks:** 2
- **Files modified:** 14 (including 2 deleted)

## Accomplishments
- Ran Knip analysis identifying 2 dead files, 8 unused exported types, and dependency issues
- Removed export keyword from 8 type declarations used only within their defining modules
- Deleted dead file `node-switch-guard-modal.ts` (superseded by `confirm-modal.ts`)
- Deleted dead test utility `make-canvas-node.ts` (zero imports)
- Removed 3 dead CSS rules (`.rp-legend`, `.rp-legend-row`, `.rp-legend-swatch`) with zero TS references
- Removed 3 Phase 26 RED test stubs for features never implemented (setAccumulatedText, undo stack clear, startNodeId)
- Test suite: 356 passed / 0 failed (was 356 passed / 3 failed before cleanup)

## Task Commits

Each task was committed atomically:

1. **Task 1: Run dead code analysis and remove unused TypeScript exports** - `5ea7a3f` (refactor)
2. **Task 2: Remove dead CSS rules and stale RED test stubs** - `1c49859` (fix)

## Files Created/Modified
- `package.json` - Added knip devDependency, restored async-mutex dependency
- `src/runner/protocol-runner.ts` - Internalized ProtocolRunnerOptions type
- `src/runner/runner-state.ts` - Internalized RunnerStatus type
- `src/snippets/canvas-ref-sync.ts` - Internalized CanvasSyncResult interface
- `src/views/confirm-modal.ts` - Internalized ConfirmResult and ConfirmModalOptions types
- `src/views/resume-session-modal.ts` - Internalized ResumeChoice type
- `src/views/snippet-chip-editor.ts` - Internalized MountChipEditorOptions interface
- `src/views/snippet-editor-modal.ts` - Internalized SnippetEditorResult and SnippetEditorOptions
- `src/views/snippet-manager-view.ts` - Removed TreeNode/TreeNodeFolder/TreeNodeFile re-export
- `src/views/node-switch-guard-modal.ts` - DELETED (dead file)
- `src/__tests__/test-utils/make-canvas-node.ts` - DELETED (dead test utility)
- `src/styles/runner-view.css` - Removed 3 dead legend CSS rules
- `src/__tests__/runner-extensions.test.ts` - Removed 3 RED test stubs, 7 Phase 35 tests preserved

## Decisions Made
- Used export removal (not deletion) for type declarations — all 8 types are used internally within their files, just not consumed externally
- Restored `async-mutex` to `dependencies` in package.json — it was previously dropped, causing `tsc -noEmit` to fail without `skipLibCheck`
- Left `jiti` devDependency in place — likely a peer dependency of typescript-eslint, not actionable
- Left `eslint` unlisted binary — Knip false positive (eslint installed via @eslint/js)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored async-mutex dependency in package.json**
- **Found during:** Task 1 (build verification after export cleanup)
- **Issue:** `async-mutex` was used by `src/utils/write-mutex.ts` but missing from package.json dependencies, causing `tsc -noEmit` to fail with TS2307
- **Fix:** Ran `npm install async-mutex` to restore it to dependencies
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm run build` exits 0
- **Committed in:** 5ea7a3f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix — build was broken without it. No scope creep.

## Issues Encountered
None beyond the async-mutex dependency restoration noted above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - no stubs found in modified files.

## Next Phase Readiness
- Codebase is clean: zero unused exports, zero dead CSS, zero failing tests
- Knip available for future dead code audits via `npx knip --reporter compact`
- Ready for Plan 02 (if additional cleanup tasks exist)

---
*Phase: 36-dead-code-audit-and-cleanup*
*Completed: 2026-04-16*
