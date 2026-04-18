---
phase: 43-unified-loop-graph-model-parser-validator-migration-errors
reviewed: 2026-04-17T13:30:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/__tests__/fixtures/unified-loop-duplicate-exit.canvas
  - src/__tests__/fixtures/unified-loop-missing-exit.canvas
  - src/__tests__/fixtures/unified-loop-no-body.canvas
  - src/__tests__/fixtures/unified-loop-valid.canvas
  - src/__tests__/graph-validator.test.ts
  - src/__tests__/runner/protocol-runner-session.test.ts
  - src/__tests__/runner/protocol-runner.test.ts
  - src/__tests__/session-service.test.ts
  - src/canvas/node-color-map.ts
  - src/graph/canvas-parser.ts
  - src/graph/graph-model.ts
  - src/graph/graph-validator.ts
  - src/runner/protocol-runner.ts
  - src/runner/runner-state.ts
  - src/sessions/session-model.ts
  - src/sessions/session-service.ts
  - src/views/runner-view.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-04-17T13:30:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 43 implements the graph-model / parser / validator half of the unified loop
migration: a new `LoopNode` kind replaces the `loop-start`/`loop-end` pair, legacy
kinds are kept parseable so the validator can emit `MIGRATE-01`, three LOOP-04
sub-checks gate unified loops, cycle detection now keys off the unified loop
marker, and `LoopContext.loopNodeId` is renamed from `loopStartId` end-to-end.
The runner receives a soft `transitionToError` stub for the `'loop'` kind and a
merged stub for legacy kinds, with the Phase 44 scope explicitly delineated via
`.skip` on the legacy-runtime test blocks.

The design is coherent and the migration boundaries are correctly drawn
(migration check early-returns before LOOP-04 / cycle detection, legacy fixtures
produce a single summary error, unified loop cycles are no longer flagged). No
critical issues found. The warnings below all relate to **test effectiveness**
and **dead code** that slipped through the scope cut, not to correctness of the
production paths.

Three session-test cases that still reference `loop-body.canvas` were **not**
marked `.skip` and now degrade to vacuous passes (runner enters `error`,
`getSerializableState()` returns `null`, early-return `if (savedState === null)
return;` makes the assertions unreachable). A `private edgeByLabel()` helper in
the runner has no remaining callers. Stale JSDoc in `session-service.ts` still
references the old `loopStartId` field name. The rest is documentation
tightening.

## Warnings

### WR-01: Three session tests silently pass — runner enters error before `chooseAnswer`

**File:** `src/__tests__/runner/protocol-runner-session.test.ts:110-127, 129-146, 152-179`

**Issue:** These three `it(...)` blocks (NOT marked `.skip`) still call
`loadGraph('loop-body.canvas')` and then `runner.start(graph); runner.chooseAnswer('n-a1')`.
After Phase 43 D-14, `loop-body.canvas` auto-advances from `start` → `loop-start`
(legacy kind), which now hits the merged stub in
`protocol-runner.ts:564-572` and calls `transitionToError(...)`. Consequences:
1. `runner.getState().status === 'error'` after `start()`.
2. `runner.chooseAnswer('n-a1')` early-returns at `protocol-runner.ts:74`
   (`if (this.runnerStatus !== 'at-node') return;`) — no-op.
3. `runner.getSerializableState()` returns `null` (error state not serialisable,
   see `protocol-runner.ts:381-386`).
4. Each test body has `if (savedState === null) return;` — the remaining
   `expect(...)` calls never run, so the tests pass vacuously.

The three tests are:
- `'restores accumulatedText correctly (SESSION-05)'` (line 110)
- `'canStepBack is true when undoStack was non-empty in saved state'` (line 129)
- `'getSerializableState() → JSON.stringify → JSON.parse → restoreFrom() produces identical getState()'` (line 152)

The neighbouring tests that DO exercise legacy loop behaviour (lines 50, 66, 88,
329) are correctly marked `.skip` with Phase 44 TODO comments — the three tests
above were overlooked, presumably because their early-return guards made them
still appear to pass.

**Fix:** Mark these three tests `.skip` with the same Phase 44 rewrite note
used elsewhere in the file:

```ts
// TODO Phase 44: rewrite for unified loop — использует legacy loop-body.canvas
// который теперь падает в transitionToError через merged loop-start/loop-end
// stub (Phase 43 D-14). Phase 44 перепишет через unified-loop-valid.canvas
// после реализации runtime picker'а.
it.skip('restores accumulatedText correctly (SESSION-05)', () => { ... });
it.skip('canStepBack is true when undoStack was non-empty in saved state', () => { ... });
it.skip('getSerializableState() → JSON.stringify → JSON.parse → restoreFrom() produces identical getState()', () => { ... });
```

Alternatively, change the early-return guards to `expect(savedState).not.toBeNull();`
so the tests fail loudly when the premise breaks — this would have surfaced the
regression at authoring time. Either fix is acceptable, but the `.skip` is
consistent with how the rest of the file handles Phase 44 deferrals.

---

### WR-02: `private edgeByLabel()` is now dead code

**File:** `src/runner/protocol-runner.ts:598-607`

**Issue:** The `edgeByLabel` helper was introduced for the legacy `loop-start`
runtime that looked up `'continue'` / `'exit'`-labelled outgoing edges. Phase 43
D-14 removed the `loop-start` / `loop-end` runtime cases (they are now merged
into a single `transitionToError` stub at lines 564-572), so no caller in
`src/` invokes `edgeByLabel`. Grep confirms the only match is the definition
itself.

Leaving dead private helpers confuses future readers (they look live) and the
JSDoc still says "Edge count per loop-start node is ≤ 2" — a loop-start
concept that is no longer reachable at runtime.

**Fix:** Delete the method outright — Phase 44's unified picker will read edges
via `graph.edges.filter(...)` the same way the validator already does (see
`graph-validator.ts:98-100`), and a fresh helper can be added if needed. If
the preference is to keep it for Phase 44, at minimum rewrite the JSDoc so it
does not reference loop-start:

```ts
// Delete entirely:
private edgeByLabel(nodeId: string, label: string): string | undefined { ... }
```

---

### WR-03: Stale JSDoc in `validateSessionNodeIds` still says `loopStartIds`

**File:** `src/sessions/session-service.ts:112-114`

**Issue:** Phase 43 D-04 / D-13 renamed `PersistedLoopContext.loopStartId` →
`loopNodeId` (session-model.ts:14), and the function body was updated to read
`frame.loopNodeId` (lines 137, 145). The function-header JSDoc still says:

```
Checks: currentNodeId, all nodeIds in undoStack, all loopStartIds in undoStack
loopContextStacks, and all loopStartIds in the top-level loopContextStack.
```

The two `loopStartIds` references are now field names that no longer exist. A
future maintainer grepping for `loopStartId` to understand the graceful-reject
flow (D-20) will hit these comments and be misled about the schema.

**Fix:** Update the JSDoc to match the renamed field:

```ts
/**
 * ...
 * Checks: currentNodeId, all nodeIds in undoStack, all loopNodeIds in undoStack
 * loopContextStacks, and all loopNodeIds in the top-level loopContextStack.
 * Does NOT check snippetNodeId because it always equals currentNodeId when set.
 */
```

## Info

### IN-01: Legacy runtime-only fields `loopIterationLabel` / `isAtLoopEnd` remain on `AtNodeState`

**File:** `src/runner/runner-state.ts:27, 32` and `src/runner/protocol-runner.ts:315-322`

**Issue:** `AtNodeState.loopIterationLabel` and `isAtLoopEnd` are now always
populated with `undefined` in `getState()`, and both are documented
`@deprecated Phase 43 D-14`. That is the correct scope cut for this phase, but
the field-keep introduces two small costs:

1. `const loopIterationLabel: string | undefined = undefined;` (line 315) is a
   no-op local that only exists to feed the returned object. A comment
   `// will be populated in Phase 44` would make the intent clearer than a
   dead binding.
2. The non-`.skip` Phase 31 tests (`protocol-runner.test.ts:484-520` are inside
   a `.skip` block, fine) do not exercise these fields, so the `isAtLoopEnd:
   undefined` path is untested. Low risk because runtime always emits
   `undefined`, but the type contract still permits `boolean`.

**Fix:** Either inline `loopIterationLabel: undefined` at the object literal
(drops the dead binding) or add a `// Phase 44 will wire this from
LoopNode.headerText + loopContextStack top-frame.iteration` comment. Fields
themselves should stay per the scope cut.

---

### IN-02: `canvas-parser.ts` has no exhaustiveness check on `parseNode` switch

**File:** `src/graph/canvas-parser.ts:183-294`

**Issue:** The `switch (rpKind)` inside `parseNode` handles all nine kinds and
returns in every branch, so the function implicitly returns `RPNode` via the
switch. Unlike `runner.advanceThrough` (see
`protocol-runner.ts:581-585`) and `getState()`
(`protocol-runner.ts:352-357`), `parseNode` has no `const _exhaustive: never
= rpKind; void _exhaustive;` tail. If Phase 44 adds a new RPNodeKind and
forgets to update the parser switch, the function will fall off the end and
TypeScript will complain about the implicit `undefined` return — but only if
strict null checks flag that particular code path, which they may not in all
tsconfig modes.

This is not a Phase 43 regression (the pattern predates this phase), but
Phase 43 is the phase that added `'loop'` and would have benefited from the
guard catching the required downstream change.

**Fix:** Add an exhaustiveness guard at the bottom of `parseNode` after the
switch, matching the pattern already in `protocol-runner.ts`:

```ts
      case 'loop': {
        const node: LoopNode = { ...base, kind: 'loop', headerText: getString(props, 'radiprotocol_headerText', '') };
        return node;
      }
    }
    // Exhaustiveness check — TS error here means a new RPNodeKind was added without a parser case.
    const _exhaustive: never = rpKind;
    void _exhaustive;
    return { parseError: `Node "${raw.id}" has unhandled kind: "${_exhaustive}"` };
  }
```

---

### IN-03: LOOP-04 error messages are partly English / partly Russian

**File:** `src/graph/graph-validator.ts:104-122`

**Issue:** LOOP-04 errors start with `Loop node "${label}"` (English) and
continue in Russian (`не имеет ребра «выход»`). This mixed language is a
deliberate choice per the author-facing русский contract (matches the
migration error at line 46-49 which is fully Russian), but the leading
`Loop node` literal is user-facing English. The existing reachability / cycle /
dead-end errors are fully English; the LOOP-04 errors are the only mixed ones.

Tests key off the Russian substrings (`не имеет ребра «выход»`, `несколько
рёбер «выход»`, etc.) so this works, but a reader scanning the validator for a
language convention will see three competing styles: English (reachability,
cycle, dead-end), Mixed (LOOP-04), Russian (migration).

**Fix:** Either translate the leading `Loop node "${label}"` to Russian for
consistency with the rest of the LOOP-04 family and the migration error, or
document the mixed style with a one-line comment (`// LOOP-04 error
prefix is English for grep-ability; body is Russian to match MIGRATE-01
author contract`). No behaviour change required.

---

### IN-04: JSDoc on `LoopNode.headerText` could state the Phase 44 binding

**File:** `src/graph/graph-model.ts:67-70`

**Issue:** The JSDoc says "headerText — текст заголовка над picker'ом,
рендерится runtime в Phase 44" but does not link to the plan decision that
fixes empty-string vs undefined normalisation (D-05). Future readers diffing
canvas JSON may wonder why `getString(props, 'radiprotocol_headerText', '')`
coerces missing/null to empty rather than leaving it undefined (like
`SnippetNode.subfolderPath`). The parser comment at `canvas-parser.ts:285-286`
does explain the symmetry with `TextBlockNode.content`, but the type file is
the first place a reader looks.

**Fix:** Extend the JSDoc one line:

```ts
/**
 * Phase 43 D-02 — unified loop node (LOOP-01, LOOP-02).
 * headerText — текст заголовка над picker'ом, рендерится runtime в Phase 44.
 * Отсутствие / undefined / null в canvas JSON нормализуется парсером в
 * пустую строку (D-05) — симметрия с TextBlockNode.content, НЕ с
 * SnippetNode.subfolderPath (там undefined = "root").
 */
```

---

### IN-05: `NODE_COLOR_MAP` keeps red for legacy kinds — worth a forward-looking comment

**File:** `src/canvas/node-color-map.ts:18-21`

**Issue:** The map assigns `'1'` (red) to `loop-start`, `loop-end`, AND `loop`
(lines 18, 19, 21). This is correct — all three represent loop semantics — but
a canvas still containing a legacy `loop-start` node now shows the same red
colour as a valid unified `loop` node. An author who opens a legacy canvas sees
three red "loop" nodes and no visual cue that two of them will be rejected by
the validator. The migration error text is the authoritative signal, but a
color cue (e.g. keeping legacy as red and moving `loop` to a different shade) is
worth a mention.

This is a UX/info item, not a bug. Out of scope for Phase 43 (the scope
explicitly keeps red-for-loop), but calling it out as a Phase 44 decision.

**Fix:** Add a note to the file header:

```ts
// Phase 43 D-CL-05: legacy loop-start/loop-end share red ('1') with the
// unified 'loop' kind — authors rely on the validator's migration error,
// not colour, to distinguish valid vs legacy loops. Phase 44 may split the
// palette (e.g. legacy = dim red) if user feedback warrants.
```

---

_Reviewed: 2026-04-17T13:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
