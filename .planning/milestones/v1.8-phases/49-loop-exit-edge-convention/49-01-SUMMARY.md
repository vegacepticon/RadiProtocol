---
phase: 49
plan: 01
subsystem: graph
tags: [phase-49, loop-exit-edge-convention, graph, shared-util, tdd]
requires:
  - src/graph/graph-model.ts (RPNode, RPEdge type shapes)
  - src/graph/graph-validator.ts (nodeLabel() reference implementation at :238-249)
provides:
  - src/graph/node-label.ts — shared nodeLabel() + isLabeledEdge() + isExitEdge() exports
  - Contract for Plans 49-02 (validator rewire) and 49-03 (runtime + view rewire)
affects:
  - None this plan — zero existing call-sites rewired
tech-stack:
  added: []
  patterns:
    - "Pure module (NFR-01, PARSE-07) — zero Obsidian API imports"
    - "Named alias via `export const` (D-07: isExitEdge = isLabeledEdge)"
    - "D-05 trim-based labeled-edge predicate"
key-files:
  created:
    - src/graph/node-label.ts
    - src/__tests__/graph/node-label.test.ts
  modified: []
decisions:
  - "D-13 shared util lives at src/graph/node-label.ts (Claude's Discretion, matches graph-model.ts/graph-validator.ts neighbours)"
  - "D-07 isExitEdge is a named re-export alias (`export const isExitEdge = isLabeledEdge`) — same function reference, not a wrapper"
  - "nodeLabel body lifted verbatim — all 8 RPNodeKind arms including @deprecated loop-start/loop-end preserved for Migration Check surface"
metrics:
  duration: ~2 minutes (wall clock 09:05Z → 09:07Z)
  completed: 2026-04-19
  tasks: 2/2
  files_created: 2
  files_modified: 0
  commits: 2
  tests_added: 23
---

# Phase 49 Plan 01: Shared node-label Module Summary

**One-liner:** New pure module `src/graph/node-label.ts` exports `nodeLabel()`, `isLabeledEdge()`, and `isExitEdge` (alias) with D-05 trim semantics and D-07 alias identity — establishes the interface contract that Plans 49-02 and 49-03 consume; no existing call-sites touched.

---

## What Changed

### Created
- **`src/graph/node-label.ts`** (51 lines) — pure module with three exports:
  - `nodeLabel(node: RPNode): string` — body lifted verbatim from `GraphValidator.nodeLabel()` (graph-validator.ts:238-249), all 8 `RPNodeKind` arms preserved including `@deprecated` `loop-start`/`loop-end` for Migration Check enumeration.
  - `isLabeledEdge(edge: RPEdge): boolean` — D-05 trim predicate: `edge.label != null && edge.label.trim() !== ''`. Whitespace-only labels evaluate to `false`.
  - `isExitEdge` — D-07 named alias: `export const isExitEdge = isLabeledEdge`. Same function reference.
  - Zero Obsidian imports; only `import type { RPNode, RPEdge } from './graph-model'`.

- **`src/__tests__/graph/node-label.test.ts`** (104 lines, 23 tests) — new test subdirectory `src/__tests__/graph/` mirrors existing `src/__tests__/runner/` convention.
  - 8 `nodeLabel` kind arms with id-fallback paths where relevant.
  - 11 `it.each` parametric cases for `isLabeledEdge` (6 falsy: `undefined`, `''`, `' '`, `'\t'`, `'\n'`, `'  \t  '`; 5 truthy: `'выход'`, `'exit'`, `'a'`, `'проверка'`, `' x '`) + 1 defensive-null case.
  - 3 `isExitEdge` cases proving alias identity (`toBe(isLabeledEdge)`) and behavioural parity on labeled and unlabeled edges.

### Unchanged (by design)
- `src/graph/graph-validator.ts` — NOT touched. Private `nodeLabel()` method remains in place; Plan 49-02 will delegate it to the shared util.
- `src/runner/protocol-runner.ts` — NOT touched. Plan 49-03 will swap line 194's literal `'выход'` check for `isExitEdge(edge)`.
- `src/views/runner-view.ts` — NOT touched. Plan 49-03 will rewire caption + CSS-class selection.
- No CSS changes (per D-19, Phase 49 ships zero CSS edits to `loop-support.css`).

---

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Unit tests (new) | `npx vitest run src/__tests__/graph/node-label.test.ts` | **23/23 passed** |
| Full test suite | `npx vitest run` | **463 passed / 1 skipped** (34 files; +23 from baseline 440) |
| TypeScript | `npx tsc --noEmit --skipLibCheck` | **exit 0** (clean) |
| Pure-module invariant | `grep -c "from 'obsidian'" src/graph/node-label.ts` | **0** ✓ |
| Alias identity | `grep -c "isExitEdge.*toBe(isLabeledEdge)" src/__tests__/graph/node-label.test.ts` | **1** ✓ |
| All 8 kind arms | `grep -Ec "case '(start\|question\|answer\|text-block\|loop-start\|loop-end\|snippet\|loop)':" src/graph/node-label.ts` | **8** ✓ |
| No `.skip`/`.todo` | `grep -Ec "it\.skip\|it\.todo\|describe\.skip" src/__tests__/graph/node-label.test.ts` | **0** ✓ |

---

## Commits

| Task | Commit | Type | Message |
|------|--------|------|---------|
| 1 | `4fce768` | feat | feat(49-01): add shared node-label module with isLabeledEdge/isExitEdge |
| 2 | `c39876f` | test | test(49-01): unit tests for node-label module (23 tests) |

---

## Decisions Made

1. **Plan's `<action>` block followed verbatim** — no paraphrasing of the switch body, no reordering of arms, `@deprecated` Phase 43 comments preserved on `loop-start`/`loop-end` cases. Ensures Plan 49-02's delegating wrapper is a byte-identical swap.

2. **`isExitEdge` implemented as `export const isExitEdge = isLabeledEdge`** (not a wrapper function like `export function isExitEdge(e) { return isLabeledEdge(e); }`). Same function reference means `isExitEdge === isLabeledEdge` at runtime — asserted by the test suite. Keeps call-sites symmetric and makes it obvious in code review that they cannot diverge.

3. **Test directory layout `src/__tests__/graph/`** chosen over flat `src/__tests__/node-label.test.ts` — mirrors the existing `src/__tests__/runner/` subdir convention. New directory is the only added structural change.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `it.each` callback required a 3rd parameter for TypeScript strict-mode tuple inference**
- **Found during:** Task 2 acceptance verification (`npx tsc --noEmit`).
- **Issue:** `it.each([[undef, false, 'desc'], ...])` passes 3-tuple rows; the callback `(label, expected) => { ... }` only declared 2 parameters. TypeScript 5.x strict-mode resolver rejects the tuple width mismatch with TS2345.
- **Fix:** Added a third `_description` parameter (underscore-prefixed to signal intentionally unused) to the `it.each` callback on line 74.
- **Files modified:** `src/__tests__/graph/node-label.test.ts` (1-line change, still within Task 2 commit `c39876f`).
- **Commit:** `c39876f` (fix included in the same test commit — the test file's initial write had the bug; fix was applied before commit).
- **Rule:** Rule 3 (auto-fix blocking issue — cannot complete Task 2 acceptance without tsc green).

No other deviations. Tasks 1 and 2 executed exactly as the plan's `<action>` blocks specified.

---

## Deferred Issues

None. No out-of-scope findings were logged.

---

## Known Stubs

None. The module is complete end-to-end per Plan 49-01's scope (create + test). The downstream consumers (validator, runner, view) intentionally still use the literal `'выход'` check — Plans 49-02 and 49-03 will wire them to the new module.

---

## Threat Model Coverage

Both STRIDE threats from the plan's `<threat_model>` are addressed:

- **T-49-01 (Tampering, `isLabeledEdge`):** Predicate is pure — reads only `edge.label`, no side effects. Whitespace-only labels are defensively normalised via `.trim()` per D-05 — prevents the "looks-empty but string-equal" bypass of LOOP-04 uniqueness.
- **T-49-02 (Information Disclosure, `nodeLabel`):** Returns only fields already visible in the user-authored canvas; no PII, no secrets. `text-block` arm caps at 30 chars (`content.slice(0, 30)`) limiting accidental over-disclosure in error messages.

No new threat flags surfaced during implementation — no new trust boundaries, no new network/auth/file-access surface.

---

## Contract for Downstream Plans

A downstream consumer (Plans 49-02, 49-03) can now:

```typescript
// From src/graph/*.ts
import { nodeLabel, isLabeledEdge, isExitEdge } from './node-label';

// From src/runner/*.ts or src/views/*.ts
import { nodeLabel, isLabeledEdge, isExitEdge } from '../graph/node-label';

// From src/__tests__/**/*.ts
import { ... } from '../../graph/node-label';  // or '../graph/node-label' for flat layout
```

Semantics (invariant across future changes):
- `nodeLabel(node)` is total (returns a string for every `RPNodeKind`).
- `isLabeledEdge(edge) === (edge.label != null && edge.label.trim() !== '')`.
- `isExitEdge === isLabeledEdge` (same function reference).

---

## Self-Check: PASSED

- `src/graph/node-label.ts` — FOUND
- `src/__tests__/graph/node-label.test.ts` — FOUND
- Commit `4fce768` — FOUND (git log)
- Commit `c39876f` — FOUND (git log)
- 23/23 tests green
- tsc --noEmit exit 0
