---
phase: 43-unified-loop-graph-model-parser-validator-migration-errors
plan: 02
subsystem: graph-parser
tags: [typescript, canvas-parser, discriminated-union, unified-loop]

# Dependency graph
requires:
  - phase: 43-01
    provides: LoopNode interface + 'loop' literal in RPNodeKind + LoopContext.loopNodeId
provides:
  - canvas-parser recognises radiprotocol_nodeType='loop' and constructs LoopNode with headerText normalized to ''
  - Legacy cases 'loop-start' / 'loop-end' retained as parseable so GraphValidator can later emit MIGRATE-01
affects:
  - 43-03 (graph-validator: consumes parsed LoopNode for LOOP-04 checks + MIGRATE-01 aggregation over legacy LoopStartNode/LoopEndNode instances)
  - 43-06 (new unified-loop fixtures will be parsed via this path)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-string-payload parser case mirrors QuestionNode / TextBlockNode shape (getString + fallback '')"
    - "Legacy parseable cases kept alongside new unified kind (D-06) — defers break-compat to validator layer, not parser"

key-files:
  created: []
  modified:
    - src/graph/canvas-parser.ts — LoopNode import, 'loop' in validKinds, new case 'loop' in parseNode() switch

key-decisions:
  - "headerText fallback is '' (via getString(props, 'radiprotocol_headerText', '')) — NOT raw.text ?? '' as QuestionNode/TextBlockNode do. Reason: empty header is a legitimate authored state; no symbolic conflation with native canvas-text. Future Phase 45 may add fallback in Node Editor form layer if needed."
  - "'loop' placed at the END of validKinds (after 'snippet') — mirrors RPNodeKind union ordering (Phase 43 Plan 01 decision); signals 'loop' is the newest first-class kind while legacy 'loop-start' / 'loop-end' stay in their historical positions."
  - "Legacy cases 'loop-start' / 'loop-end' left completely untouched (bodies, helpers, @deprecated type references) — CLAUDE.md never-remove-existing-code rule + D-06 requirement that parser continues building LoopStartNode/LoopEndNode so validator can aggregate migration-error."

patterns-established:
  - "Phase-marker comments: every new block carries // Phase 43 D-05 marker (import line, validKinds entry, case body JSDoc). Existing Phase 29 / Phase 31 D-01 / Phase 31 D-04 markers untouched."

requirements-completed:
  - LOOP-01
  - LOOP-02
  - LOOP-03

# Metrics
duration: 2min
completed: 2026-04-17
---

# Phase 43 Plan 02: Unified Loop — Canvas Parser Summary

**Canvas parser now recognises `radiprotocol_nodeType = "loop"` and constructs a `LoopNode` with `headerText` normalised from `radiprotocol_headerText` (fallback `''`); legacy `loop-start` / `loop-end` cases retained so GraphValidator can emit MIGRATE-01 (D-06). Only additions — zero deletions, all pre-existing parser cases untouched.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T09:28:44Z
- **Completed:** 2026-04-17T09:29:57Z
- **Tasks:** 1 / 1
- **Files modified:** 1 (`src/graph/canvas-parser.ts`)

## Accomplishments

- Added `LoopNode` to the `import type { … } from './graph-model'` block (alongside existing `LoopStartNode` / `LoopEndNode` which remain imported for the legacy parseable path; D-06)
- Added `'loop'` literal to the `validKinds: RPNodeKind[]` list as the final entry, mirroring the Plan-01 union ordering
- Added new `case 'loop':` block in `parseNode()` switch (AFTER `case 'snippet':`) that:
  - Spreads `...base` (id/x/y/width/height/color)
  - Assigns `kind: 'loop'`
  - Reads `radiprotocol_headerText` via `getString(props, 'radiprotocol_headerText', '')` — fallback is the empty string, NOT `raw.text ?? ''`, per the plan's explicit guidance
- Preserved every other parser case (`start`, `question`, `answer`, `free-text-input`, `text-block`, `loop-start`, `loop-end`, `snippet`) exactly as-is — zero deletions, zero re-indents
- Added `// Phase 43 D-05 — unified loop (LOOP-01, LOOP-02)` phase-marker comments on the import line, the `validKinds` entry, and the new case body
- Verified `npx tsc --noEmit --skipLibCheck` emits **zero** errors referencing `canvas-parser.ts`; the 23 downstream errors (node-color-map, graph-validator, protocol-runner, session-model, session-service, runner-view) are the expected scavenger-hunt output documented in Plan 01 Summary for plans 43-03..07 to repair

## Task Commits

1. **Task 1: Add 'loop' to validKinds + case 'loop' in parseNode switch** — `c6b56d9` (feat)

## Files Created/Modified

- `src/graph/canvas-parser.ts` — three additive edits (import block, validKinds array, new `case 'loop':` in switch). `+13 insertions, 0 deletions`. All other cases, helpers (`getString`, `getNumber`), adjacency building, start-node discovery, and the `parse()` method itself were NOT touched per CLAUDE.md never-remove-existing-code rule and plan directive («НЕ ТРОГАТЬ» section).

## Decisions Made

- **`headerText` fallback is `''` (empty string), NOT `raw.text ?? ''`:** Plan 43-02 explicitly specifies `getString(props, 'radiprotocol_headerText', '')`. This symbolically distinguishes «empty authored header» from «missing field» — both normalise to the same value, but no silent fallback to the native canvas `text` property. If a future Phase 45 Node Editor form needs a richer fallback (e.g., pre-fill from `raw.text` on first author encounter), it can be added there without parser changes.
- **`'loop'` positioned at the end of `validKinds`:** Mirrors `RPNodeKind` union ordering from Plan 01 (where `'loop'` was placed after `'snippet'`). This keeps parser & model arrays visually aligned and signals «unified loop is the newest kind» while legacy loop kinds stay in their v1.0 positions.
- **Legacy `LoopStartNode` / `LoopEndNode` imports kept:** The import block continues to bring in both legacy types. `case 'loop-start':` still constructs a `LoopStartNode`, `case 'loop-end':` still constructs a `LoopEndNode` with `loopStartId` requirement — both required for D-06 (parser remains permissive; validator layer emits MIGRATE-01).

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; this is a pure additive parser extension with no runtime, security, or correctness gap.

## Issues Encountered

None. A `PreToolUse:Edit` read-before-edit reminder fired after the first Edit call even though the file had already been read in-session; the three Edit operations still applied successfully (the reminders were non-blocking), and a post-edit Read confirmed all three insertions landed correctly (import at line 18, validKinds at line 163, `case 'loop':` at lines 283-293).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `canvas-parser.ts` can now build a typed `LoopNode` from any canvas JSON carrying `radiprotocol_nodeType: "loop"` (LOOP-03 parsing contract satisfied)
- Plan 43-03 (graph-validator) will consume `graph.nodes` iteration to apply:
  - MIGRATE-01: aggregate all `LoopStartNode` / `LoopEndNode` instances into a single Russian migration-error (D-07)
  - LOOP-04: for each `LoopNode`, check ≥1 «выход» edge, no duplicate «выход» edges, ≥1 body-branch edge (D-08)
  - D-09: switch cycle-through marker from `kind === 'loop-end'` to `kind === 'loop'` in `detectUnintentionalCycles`
- Plan 43-06 (fixtures) will exercise this parser path through `unified-loop-*.canvas` test files
- No blockers: plan 43-03 can proceed

## Self-Check: PASSED

**Files verified exist:**
- FOUND: `src/graph/canvas-parser.ts`

**Commits verified:**
- FOUND: `c6b56d9` (feat(43-02): parse unified loop node kind in canvas-parser)

**Acceptance criteria verified:**
- `grep -n "LoopNode" src/graph/canvas-parser.ts` → line 18 (import) + line 287 (typed node var) → PASS
- `grep -n "case 'loop':" src/graph/canvas-parser.ts` → line 283 → PASS
- `grep -n "kind: 'loop'," src/graph/canvas-parser.ts` → line 289 → PASS
- `grep -n "headerText: getString(props, 'radiprotocol_headerText'" src/graph/canvas-parser.ts` → line 290 → PASS
- `grep -n "case 'loop-start':" src/graph/canvas-parser.ts` → line 241 (preserved) → PASS
- `grep -n "case 'loop-end':" src/graph/canvas-parser.ts` → line 251 (preserved) → PASS
- `grep -n "Phase 43 D-05" src/graph/canvas-parser.ts` → 3 matches (lines 18, 163, 284) → PASS
- `grep -q "Phase 31 D-01" src/graph/canvas-parser.ts` → line 274 → PASS (snippet never-remove marker intact)
- `grep -q "Phase 31 D-04" src/graph/canvas-parser.ts` → line 276 → PASS (snippet never-remove marker intact)
- `npx tsc --noEmit --skipLibCheck` → 0 errors referencing `canvas-parser.ts` → PASS (23 downstream errors in node-color-map / graph-validator / protocol-runner / session-* / runner-view are expected per Plan 01 Summary)
- Commit diff inspection (`git log -1 --stat`) → `+13 insertions, 0 deletions` — confirms no legacy code removed → PASS

---
*Phase: 43-unified-loop-graph-model-parser-validator-migration-errors*
*Completed: 2026-04-17*
