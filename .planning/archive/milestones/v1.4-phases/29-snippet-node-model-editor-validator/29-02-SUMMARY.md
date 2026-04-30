---
phase: 29-snippet-node-model-editor-validator
plan: 02
subsystem: editor-panel
tags: [snippet-node, editor-panel, subfolder-picker, async-iife, vault-adapter]
dependency_graph:
  requires: [29-01]
  provides: [snippet-editor-form, subfolder-picker, listSnippetSubfolders]
  affects: [src/views/editor-panel-view.ts]
tech_stack:
  added: []
  patterns: [void-async-iife, bfs-vault-traversal, dropdown-with-disabled-option]
key_files:
  created: []
  modified:
    - src/views/editor-panel-view.ts
decisions:
  - "void IIFE pattern for async population inside synchronous buildKindForm — no refactor of sync signature needed"
  - "BFS via vault.adapter.list() for recursive subfolder discovery — simple, no recursion depth limit needed for practical vault sizes"
  - "radiprotocol_subfolderPath = v || undefined — empty string becomes undefined so saveNodeEdits deletes the key (root fallback)"
  - "text mirrors subfolderPath value (D-10) — consistent with other node kinds that write both radiprotocol_* and text fields"
metrics:
  duration: "~2 min"
  completed_date: "2026-04-13"
  tasks_completed: 1
  files_modified: 1
---

# Phase 29 Plan 02: Snippet Node — EditorPanel Form Summary

**One-liner:** EditorPanel gains an 8th dropdown option 'Snippet' and a `case 'snippet'` form with async BFS subfolder picker and `listSnippetSubfolders()` private method.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add snippet dropdown + case snippet + listSnippetSubfolders | 8d16b94 | src/views/editor-panel-view.ts |

## Verification Results

- `npm run build` — OK, no TypeScript errors (exit 0)
- `npm test` — 176 passed, 3 failed (pre-existing TDD RED stubs in runner-extensions.test.ts, unchanged from 29-01)
- Acceptance criteria all satisfied:
  - `addOption('snippet', 'Snippet')` present in dropdown
  - `case 'snippet':` present in buildKindForm switch
  - `listSnippetSubfolders` — 2 occurrences (call + definition)
  - `radiprotocol_subfolderPath` present in onChange handler
  - `pendingEdits['text'] = v` present (D-10 mirror)
  - `grep -c "case '"` → 8 (was 7, +1 snippet)

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| void IIFE for async inside sync buildKindForm | Preserves synchronous signature throughout; consistent with existing `loadNode` → `renderNodeForm` pattern |
| BFS for subfolder traversal | Simple and correct; vault filesystem bounded by vault size; no stack overflow risk for practical use |
| `v \|\| undefined` in onChange | Empty string (root selected) must not persist as a key in canvas JSON — `saveNodeEdits` deletes `undefined` values |
| `text` mirrors subfolderPath | Consistent with other node kinds (question writes both `radiprotocol_questionText` + `text`); Canvas node label reflects the path |

## Known Stubs

None introduced in this plan. The pre-existing stub in `src/runner/protocol-runner.ts` (case 'snippet' halts at-node) is tracked in 29-01-SUMMARY.md and resolved in Phase 30.

## Threat Surface Scan

T-29-02-01 mitigated as planned: subfolder values are restricted to results returned by `vault.adapter.list(basePath)` — no free-form user path input. No new trust boundaries introduced beyond the plan's threat model.

## Self-Check: PASSED

Files exist:
- FOUND: src/views/editor-panel-view.ts (contains `case 'snippet'`, `listSnippetSubfolders`, `addOption('snippet'`)

Commits exist:
- FOUND: 8d16b94 — feat(29-02): add snippet case to EditorPanel — dropdown option, subfolder picker, listSnippetSubfolders
