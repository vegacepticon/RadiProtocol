---
phase: 22-snippet-node-graph-and-runner-layer
plan: "02"
subsystem: graph-layer
tags: [graph-model, canvas-parser, graph-validator, node-color-map, snippet-node, tdd]
dependency_graph:
  requires:
    - 22-01-PLAN.md  # Wave 0 dead-code removal; clean RPNodeKind union
  provides:
    - SnippetNode in RPNodeKind, RPNode union, graph-model interfaces
    - canvas-parser snippet case (folderPath, buttonLabel)
    - graph-validator snippet label + dead-end exemption
    - node-color-map Record<RPNodeKind> type safety
  affects:
    - 22-03-PLAN.md  # Runner advanceThrough() will need case 'snippet'
    - Phase 25      # UI file-picker layer depends on SnippetNode interface
tech_stack:
  added: []
  patterns:
    - Discriminated union extension — add new member to RPNodeKind + interface + RPNode union
    - TDD — tests written alongside (Task 2) after implementation (Task 1)
key_files:
  created:
    - src/__tests__/fixtures/snippet-node.canvas
  modified:
    - src/graph/graph-model.ts
    - src/graph/canvas-parser.ts
    - src/graph/graph-validator.ts
    - src/canvas/node-color-map.ts
    - src/__tests__/canvas-parser.test.ts
    - src/__tests__/graph-validator.test.ts
decisions:
  - SnippetNode uses optional folderPath/buttonLabel fields (undefined = use global setting)
  - graph-validator Check 5 (dead-end) remains question-only; snippet terminal is valid by design (D-04)
  - node-color-map annotated Record<RPNodeKind,string> — TypeScript exhaustiveness enforced at compile time
metrics:
  duration: "~10 minutes"
  completed: "2026-04-11"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 6
---

# Phase 22 Plan 02: Snippet Node Graph Layer Summary

**One-liner:** SnippetNode added to discriminated union (graph-model + parser + validator + color-map) with folderPath/buttonLabel fields and dead-end exemption in validator.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add SnippetNode to graph-model, canvas-parser, graph-validator, node-color-map | ce9613f | graph-model.ts, canvas-parser.ts, graph-validator.ts, node-color-map.ts |
| 2 | Fixture and tests for snippet parser + validator | 811f8ff | snippet-node.canvas, canvas-parser.test.ts, graph-validator.test.ts |

## What Was Built

**graph-model.ts:**
- `RPNodeKind` union extended: `'snippet'` added as 7th member (after `'loop-end'`)
- `SnippetNode` interface added: `kind: 'snippet'`, `folderPath?: string`, `buttonLabel?: string`
- `RPNode` union updated: `| SnippetNode` appended

**canvas-parser.ts:**
- `SnippetNode` added to import list
- `'snippet'` added to `validKinds[]`
- `case 'snippet':` added in `parseNode()` switch — reads `radiprotocol_snippetFolderPath` → `folderPath`, `radiprotocol_buttonLabel` → `buttonLabel`; both optional (undefined if absent)

**graph-validator.ts:**
- `SnippetNode` added to import list
- `nodeLabel()` switch extended with `case 'snippet':` returning `buttonLabel || node.id`
- Check 5 (dead-end questions) unchanged — still only checks `node.kind === 'question'`; snippet terminal nodes produce no errors (D-04)

**node-color-map.ts:**
- `import type { RPNodeKind }` added from `'../graph/graph-model'`
- `Record<string, string>` annotation replaced with `Record<RPNodeKind, string>` — TypeScript now enforces exhaustiveness; `'snippet'` key was already present

**Test fixture & tests:**
- `snippet-node.canvas`: 4-node graph (start → question → answer → snippet terminal) with `radiprotocol_buttonLabel: "Select template"` and `radiprotocol_snippetFolderPath: "Templates"`
- 5 canvas-parser tests: parse succeeds, `kind === 'snippet'`, `folderPath` mapping, `buttonLabel` mapping, undefined optionals
- 1 graph-validator test: snippet terminal with no outgoing edges → `errors.length === 0`

## Test Results

- **Before plan:** 133 passed, 3 pre-existing RED (runner-extensions.test.ts)
- **After plan:** 139 passed (+6 new), 3 pre-existing RED unchanged
- All new tests GREEN

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — graph layer is fully wired. `folderPath` and `buttonLabel` are optional by design (Phase 24/25 will use them).

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. `folderPath` is stored only in memory (`ProtocolGraph`) and not serialized in this plan — T-22-04 disposition remains `accept` per threat register.

## Self-Check

- [x] `src/graph/graph-model.ts` — SnippetNode interface + RPNodeKind 'snippet' present
- [x] `src/graph/canvas-parser.ts` — case 'snippet' present, 'snippet' in validKinds
- [x] `src/graph/graph-validator.ts` — case 'snippet' in nodeLabel()
- [x] `src/canvas/node-color-map.ts` — Record<RPNodeKind, string> annotation present
- [x] `src/__tests__/fixtures/snippet-node.canvas` — fixture file exists
- [x] Commits ce9613f and 811f8ff present in git log
- [x] 139 tests passing, 3 pre-existing RED in runner-extensions.test.ts

## Self-Check: PASSED
