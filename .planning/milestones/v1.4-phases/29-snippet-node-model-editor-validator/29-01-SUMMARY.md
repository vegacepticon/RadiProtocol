---
phase: 29-snippet-node-model-editor-validator
plan: 01
subsystem: graph-model, canvas-parser, graph-validator, runner
tags: [snippet-node, graph-model, canvas-parser, graph-validator, typescript]
dependency_graph:
  requires: [29-00]
  provides: [snippet-node-model, snippet-parsing, snippet-validation]
  affects: [runner/protocol-runner, graph/graph-model, canvas/node-color-map, graph/canvas-parser, graph/graph-validator]
tech_stack:
  added: []
  patterns: [discriminated-union, exhaustive-switch, record-exhaustive-check]
key_files:
  created: []
  modified:
    - src/graph/graph-model.ts
    - src/canvas/node-color-map.ts
    - src/graph/canvas-parser.ts
    - src/graph/graph-validator.ts
    - src/runner/protocol-runner.ts
decisions:
  - "SnippetNode subfolderPath is optional string — absence means root .radiprotocol/snippets (D-02, D-03)"
  - "NODE_COLOR_MAP snippet = '6' (purple) — semantic color per D-11"
  - "ProtocolRunner case 'snippet' halts at-node in Phase 29 — full Runner integration deferred to Phase 30"
metrics:
  duration: "~15 min"
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_modified: 5
---

# Phase 29 Plan 01: Snippet Node — Graph Model, Parser, Validator, Color Map Summary

**One-liner:** 8th node kind 'snippet' wired into RPNodeKind union, SnippetNode interface, NODE_COLOR_MAP, CanvasParser parseNode() switch, and GraphValidator nodeLabel() — TDD RED tests from Plan 00 turn GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend graph-model.ts — SnippetNode + RPNodeKind + RPNode | 1d5a2fc | src/graph/graph-model.ts |
| 2 | Update node-color-map, canvas-parser, graph-validator | 87747dc | src/canvas/node-color-map.ts, src/graph/canvas-parser.ts, src/graph/graph-validator.ts, src/runner/protocol-runner.ts |

## Verification Results

- `npm run build` — OK, no TypeScript errors
- `npm test` — 176 passed, 3 failed (pre-existing TDD RED stubs in runner-extensions.test.ts, marked "RED until Plan 02")
- Phase 29 specific tests all GREEN:
  - `CanvasParser — snippet node (Phase 29) > parses snippet-node.canvas — returns SnippetNode with kind "snippet" and subfolderPath "CT/adrenal"`
  - `CanvasParser — snippet node (Phase 29) > parses snippet-node-no-path.canvas — returns SnippetNode with subfolderPath undefined`
  - `GraphValidator — snippet node (Phase 29, D-12) > returns no errors for snippet-node-no-path.canvas`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ProtocolRunner exhaustive switch broke TypeScript build after RPNodeKind gained 'snippet'**
- **Found during:** Task 2 (build verification)
- **Issue:** `protocol-runner.ts` line 515 — `default: const _exhaustive: never = node` — TypeScript TS2322 error: `Type 'SnippetNode' is not assignable to type 'never'` because the switch had no `case 'snippet'`
- **Fix:** Added `case 'snippet'` that halts the runner at `at-node` state (same pattern as `loop-end`). Full Runner integration is Phase 30's responsibility.
- **Files modified:** `src/runner/protocol-runner.ts`
- **Commit:** 87747dc

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `subfolderPath` optional string | Absence = root `.radiprotocol/snippets/`; consistent with D-02, D-03 in CONTEXT.md |
| `snippet: '6'` (purple) | Semantic color per D-11; purple distinguishes snippet nodes from all other kinds |
| Phase 29 ProtocolRunner stub halts at-node | Prevents TS exhaustive check error; Phase 30 adds full snippet-node Runner flow |

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `case 'snippet'` halts at `at-node` in `advanceThrough()` | `src/runner/protocol-runner.ts` | Phase 30 wires full snippet-node Runner integration (picker, SnippetFillInModal, subfolder navigation) |

## Threat Surface Scan

Threat T-29-01-02 (Tampering — subfolderPath via canvas JSON) is mitigated: `getString()` helper accepts only `string` values for `radiprotocol_subfolderPath`; non-string values resolve to `undefined` via the `props['radiprotocol_subfolderPath'] !== undefined ? getString(...) : undefined` pattern.

No new trust boundaries introduced beyond those in the plan's threat model.

## Self-Check: PASSED

Files exist:
- FOUND: src/graph/graph-model.ts (contains `SnippetNode`, `| 'snippet'`)
- FOUND: src/canvas/node-color-map.ts (contains `'snippet': '6'`)
- FOUND: src/graph/canvas-parser.ts (contains `case 'snippet'`)
- FOUND: src/graph/graph-validator.ts (contains `case 'snippet': return`)
- FOUND: src/runner/protocol-runner.ts (contains `case 'snippet'` in advanceThrough)

Commits exist:
- FOUND: 1d5a2fc — feat(29-01): add SnippetNode interface + 'snippet' to RPNodeKind and RPNode union
- FOUND: 87747dc — feat(29-01): extend color-map, parser, validator + runner stub for snippet node
