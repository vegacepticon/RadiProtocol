---
phase: 32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync
plan: "03"
subsystem: snippets
tags: [refactor, callsites, build-green, append-only]
requires:
  - "SnippetService path-based API (Plan 32-01)"
  - "Snippet discriminated union (Plan 32-00)"
provides:
  - "Green full build against new SnippetService API"
  - "Legacy snippet-manager-view delete path-shim (Phase 33 will replace whole view)"
  - "snippet-fill-in-modal typed on JsonSnippet"
affects:
  - src/views/runner-view.ts
  - src/views/snippet-fill-in-modal.ts
  - src/views/snippet-manager-view.ts
tech_stack:
  added: []
  patterns:
    - "Path-from-id shim: `${snippetFolderPath}/${id}.json` at legacy callsites"
    - "draft.path synced before save() to match possibly-renamed id"
key_files:
  created: []
  modified:
    - src/views/snippet-fill-in-modal.ts
    - src/views/snippet-manager-view.ts
decisions:
  - "runner-view.ts required no edits in Plan 32-03: Plan 32-01 already landed the Rule-3 blocking shim (JSON filter, load(path), kind narrowing). Acceptance criteria for Task 1 verified in-place."
  - "snippet-fill-in-modal constructor retyped from SnippetFile to JsonSnippet; SnippetFile import removed to avoid dead symbol (alias still valid elsewhere)."
  - "snippet-manager-view save path: mutate draft.path to ${root}/${id}.json before save(), so that when handleSave renames id from UUID to slug the new file is written at the slugged path under the new path-based API."
  - "snippet-manager-view delete shims: both handleSave (old-file cleanup) and handleDelete now construct ${root}/${id}.json explicitly — bare id would silently fail assertInsideRoot and no-op."
  - "Full tree-UI replacement of snippet-manager-view stays deferred to Phase 33 per plan scope."
metrics:
  duration: "~10 min"
  tasks: 2
  completed: 2026-04-15
requirements: []
---

# Phase 32 Plan 03: Snippet Callsite Compatibility Shims Summary

Minimal surgical updates to the three snippet callsites so the full project compiles and runs under the path-based SnippetService API introduced in Plan 32-01, without touching unrelated UI, render, event-listener, or helper code (CLAUDE.md append-only enforcement).

## Deliverables

- `src/views/runner-view.ts`: already compliant from Plan 32-01 (Rule-3 blocking shim). Verified post-hoc:
  - Line 629: `if (snippet.kind !== 'json') continue;` — MD snippets skipped in legacy picker
  - Line 703: `load(\`${this.plugin.settings.snippetFolderPath}/${snippetId}.json\`)` — legacy id resolved to path
  - Line 706: `snippet.kind !== 'json'` narrowing before passing to `SnippetFillInModal`

- `src/views/snippet-fill-in-modal.ts`:
  - Import updated: `JsonSnippet` replaces `SnippetFile` in the type-only import list
  - `private readonly snippet: JsonSnippet`
  - `constructor(app: App, snippet: JsonSnippet)`
  - All body logic untouched (5 fields × 250 lines left exactly as-is)

- `src/views/snippet-manager-view.ts`:
  - `loadAndRender` (line 62): already uses `listFolder(root) + filter kind==='json'` from Plan 32-01 — no change
  - `handleSave` (line 660s): delete-old path now `${snippetFolderPath}/${oldId}.json`; draft.path synced before `save(draft)` so save writes the correctly-named file after id rename
  - `handleDelete` (line 687): path now `${snippetFolderPath}/${(draft.id ?? draft.name)}.json`
  - Six helper methods, one autoSaveAfterDrop, full placeholder-chip UI, drag-drop, and orphan-badge logic all left untouched — git diff is +14/−5 lines across both files combined

## Acceptance Verification

| Criterion | Result |
|-----------|--------|
| `runner-view.ts` contains `s.kind === 'json'` (picker filter equivalent) | PASS (line 629) |
| `runner-view.ts` calls `snippetService.load(` with a path expression | PASS (legacyPath @ line 704) |
| `runner-view.ts` contains `loaded.kind !== 'json'` narrowing equivalent | PASS (line 706: `snippet.kind !== 'json'`) |
| `npx tsc --noEmit -skipLibCheck` reports zero `src/` errors | PASS |
| `npm run build` exits 0 | PASS |
| `snippet-manager-view.ts` does NOT contain `snippetService.list()` | PASS (0 hits) |
| `snippet-manager-view.ts` contains `snippetService.listFolder(` | PASS (line 66) |
| `snippet-manager-view.ts` contains `kind: 'json'` | PASS (line 638 `handleNewSnippet`, Plan-01 shim) |
| `snippet-manager-view.ts` contains `snippetService.delete(` with path-like expression containing `snippetFolderPath` | PASS (lines 667 and 696) |
| `snippet-fill-in-modal.ts` imports `JsonSnippet` | PASS |
| Git diff shows NO removed helper methods, render functions, or event listeners | PASS (+14 / −5 across 2 files; diff is insertion-dominated targeted edits only) |

## Deviations from Plan

### Task 1 — no code changes required

- **Found during:** initial runner-view.ts inspection
- **Issue:** Plan 32-03 Task 1 prescribes adding the `kind === 'json'` filter, path-based `load` call, and `kind !== 'json'` narrowing to `runner-view.ts`. Reading the file revealed that Plan 32-01 had already landed all three edits as a Rule-3 blocking shim (documented in 32-01-SUMMARY.md under "Minimal callsite shims").
- **Decision:** No edit made. All acceptance criteria for Task 1 are already satisfied in the committed file. No empty commit was created (would have failed hooks and polluted history).
- **Impact:** None — the plan's output (a compile-green shim) is already in place. Task 1 is structurally complete.

### Task 2 — `draft.path` sync addition (Rule 2 correctness)

- **Found during:** Task 2 execution
- **Issue:** Plan 32-03 Task 2 specifies building a local `draftWithPath` shim and passing it to `save()`. Inspection showed `draft: SnippetFile` already carries `kind` and `path` (set in Plan 32-01's `handleNewSnippet` fix), so a separate shim is redundant. HOWEVER: `handleSave` renames `draft.id` from a UUID to a name-slug *after* the old-file delete but *before* `save()` — without updating `draft.path`, `save()` would write to the ORIGINAL UUID path while the in-memory id had moved to the slug, leaking a stale file on every first-save of a new snippet.
- **Fix:** Added one line `draft.path = \`${root}/${(draft.id ?? draft.name)}.json\`;` immediately before `save(draft)`. This is a single-line correctness addition — no helper methods or render logic touched.
- **Rule:** Rule 2 (Auto-add missing critical functionality) — without this sync, the new path-based API silently loses new-snippet saves.
- **Files modified:** `src/views/snippet-manager-view.ts`
- **Commit:** `e97af5b`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | (no-op — already landed in 32-01 commit `bba70bf`) | runner-view Rule-3 shim pre-existed |
| 2 | `e97af5b` | Path-based delete shims + JsonSnippet typing in fill-in modal + draft.path sync |

## Known Stubs

None. The MD-branch skip in both runner-view and snippet-manager-view is not a stub — MD rendering is explicitly Phase 35 scope per REQUIREMENTS §MD-05, and the legacy snippet-manager-view is scheduled for full replacement in Phase 33.

## Threat Flags

None. Plan's threat-register entries T-32-03-01 (Tampering via id containing `..`) and T-32-03-02 (Accidental code deletion) are both mitigated:

- **T-32-03-01:** All path construction goes through `${snippetFolderPath}/${id}.json`; SnippetService's `assertInsideRoot` rejects any resulting unsafe path at service entry. The id values used in Phase 32 flow come from filesystem basenames or slugified names, not fresh user-typed strings, so no new injection surface.
- **T-32-03-02:** Verified via `git diff --stat HEAD~1 HEAD`: 2 files changed, +14 / −5. No helper method, render function, event listener, or chip-drag handler removed. Append-only rule upheld.

## Self-Check: PASSED

- FOUND: `src/views/snippet-fill-in-modal.ts` (JsonSnippet typing applied)
- FOUND: `src/views/snippet-manager-view.ts` (delete shims + draft.path sync applied)
- VERIFIED: `runner-view.ts` lines 629/704/706 contain the required Task 1 shims (pre-existing from Plan 01)
- FOUND: commit `e97af5b` in `git log`
- VERIFIED: `npm run build` exits 0
- VERIFIED: `git diff --diff-filter=D --name-only HEAD~1 HEAD` is empty (no file deletions)
- VERIFIED: git diff is +14 / −5 across 2 files — all insertions are targeted, no unrelated removals
