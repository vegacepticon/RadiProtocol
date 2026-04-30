---
phase: 30-snippet-node-runner-integration
plan: 01
subsystem: snippets
tags: [snippet-service, path-safety, vault-adapter, tdd, vitest]

requires:
  - phase: 27-snippets-core
    provides: SnippetService.list / SnippetFile model / .json storage under snippetFolderPath
  - phase: 29-snippet-node-canvas-parser
    provides: canvas parser reads radiprotocol_subfolderPath on snippet nodes
provides:
  - SnippetService.listFolder(folderPath) single-level listing (folders as basenames, parsed snippets)
  - Path-safety gate (T-30-01) rejecting ".." segments, absolute paths, and sibling-prefix matches before any disk I/O
  - Alphabetically sorted output so the runner picker stays dumb (D-03)
affects: [30-02-plan-runner-extensions, 30-03-plan-runner-picker]

tech-stack:
  added: []
  patterns:
    - "Path-safety gate before disk I/O for attacker-influenced paths"
    - "Append-only service extension (list() left byte-identical per D-21)"

key-files:
  created: []
  modified:
    - src/snippets/snippet-service.ts
    - src/__tests__/snippet-service.test.ts

key-decisions:
  - "Path-safety gate rejects any raw '..' or '.' segment (stricter than normalize-then-compare) so '.radiprotocol/snippets/../../etc' is rejected rather than silently collapsed to '.radiprotocol/snippets/etc'"
  - "Folders returned as basenames, sorted alphabetically inside the service so the runner picker needs no post-processing"
  - "Corrupt JSON mirrors list() — skipped silently, not surfaced"

patterns-established:
  - "Pre-I/O path normalization + containment check for every attacker-influenced vault path"
  - "Append-only growth of SnippetService — new method added after list() without touching existing methods"

requirements-completed: [SNIPPET-NODE-03, SNIPPET-NODE-04]

duration: 6min
completed: 2026-04-14
---

# Phase 30 Plan 01: SnippetService.listFolder Summary

**Single-level snippet-tree listing with pre-I/O path-traversal gate for the runner snippet picker**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2
- **Tests added:** 9 (all green after Task 2)

## Accomplishments
- `SnippetService.listFolder(folderPath)` returns `{ folders: string[]; snippets: SnippetFile[] }` — direct children only, no recursion
- Path-safety gate rejects `..`, absolute paths, and sibling-prefix matches before any `adapter.exists` call (T-30-01)
- Corrupt `.json` files skipped silently; non-`.json` filtered; results sorted alphabetically
- Existing `list()` untouched per D-21

## Task Commits

1. **Task 1: Add failing listFolder tests** — `4669072` (test)
2. **Task 2: Implement SnippetService.listFolder** — `146d740` (feat)

## Files Created/Modified
- `src/snippets/snippet-service.ts` — appended `listFolder` method (70 lines) after `list()`; no existing code touched
- `src/__tests__/snippet-service.test.ts` — appended `describe('listFolder (D-18..D-21, T-30-01)')` block with 9 test cases and a local `makeListFolderMock` helper

## Decisions Made
- **Stricter traversal check:** The plan's pseudocode normalized `..` away (`segments.filter(s => s !== '..')`) then did a containment check. During Task 2 I discovered this silently collapses `.radiprotocol/snippets/../../etc` to `.radiprotocol/snippets/etc`, which would PASS the containment check — the opposite of what the test asserts. Changed to reject any path containing raw `..` or `.` segments, and any absolute path (`startsWith('/')`), before the containment check. Result: same rejection semantics as the tests demand, and a stricter security posture than the plan sketch.
- Folders and snippets sorted inside the service (`localeCompare`) so the Plan 30-03 picker stays dumb.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed path-traversal normalization to reject (not collapse) `..` segments**
- **Found during:** Task 2 (Implement listFolder)
- **Issue:** The plan's suggested implementation filtered out `..` segments during normalization, which meant `.radiprotocol/snippets/../../etc` normalized to `.radiprotocol/snippets/etc` and passed the inside-root check. Test case 6 (`rejects path with '..' segments before any disk I/O`) correctly failed because `adapter.exists` was called once.
- **Fix:** Reject when `rawSegments.some(s => s === '..' || s === '.')` or `folderPath.startsWith('/')`. This is a stricter and more correct interpretation of T-30-01: untrusted paths containing traversal tokens should be rejected outright, not silently rewritten.
- **Files modified:** `src/snippets/snippet-service.ts`
- **Verification:** All 9 listFolder tests green; full snippet-service suite 14/14 green
- **Committed in:** `146d740` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's path-normalization sketch)
**Impact on plan:** No scope creep. The deviation yields stricter security than the original sketch and preserves the test contract exactly as Task 1 defined it.

## Issues Encountered
- Full `npm test` shows 3 pre-existing failing tests in `src/__tests__/runner-extensions.test.ts` explicitly labeled "RED until Plan 02". Out of scope for Plan 01 — these are Plan 30-02's intentional RED baseline.
- `npx tsc --noEmit` surfaces pre-existing vitest/vite module-resolution errors in `node_modules` (moduleResolution setting mismatch). Out of scope — affects no project source files and is unchanged from before this plan.

## Threat Flags

None — Plan 01 only extends `SnippetService`, which remains inside the trust boundary the plan's threat model already covers. The new path-safety gate is the mitigation for T-30-01.

## Next Phase Readiness
- `SnippetService.listFolder` is ready for Plan 30-03 (runner snippet picker) to consume
- Plan 30-02 (runner extensions: `setAccumulatedText`, `startNodeId` param) is unblocked and has its RED baseline already committed

---
*Phase: 30-snippet-node-runner-integration*
*Completed: 2026-04-14*
