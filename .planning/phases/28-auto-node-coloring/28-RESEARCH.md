# Phase 28: Auto Node Coloring — Research

**Researched:** 2026-04-13
**Domain:** Canvas write-back + EditorPanel save path
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Color injection is centralized inside `saveNodeEdits` — callers do NOT pass `color` explicitly.
- **D-02:** `saveNodeEdits` resolves the node type internally and injects the correct color into the write payload before committing. Callers remain unchanged.
- **D-03:** The existing test at `canvas-write-back.test.ts:57` (old contract: "color cannot be written by callers") must be updated to reflect the new contract: "color is always written correctly for known types."
- **D-04:** Type is resolved with priority: `edits['radiprotocol_nodeType']` (if present and non-empty) → existing node's `radiprotocol_nodeType` from the canvas (live `getData()` for Pattern B, parsed JSON for Strategy A).
- **D-05:** If the resolved type is absent or not in `NODE_COLOR_MAP`, no color is written (node remains as-is). Unknown/custom types are not touched.
- **D-06:** On unmark path (`radiprotocol_nodeType === ''` or `undefined`), color is deleted — existing behavior is preserved and correct.
- **D-07:** A shared test helper `makeCanvasNode(type, overrides?)` is created (in a test utils file) that automatically derives `color` from `NODE_COLOR_MAP[type]`. All new and existing fixtures that need a typed node use this helper.
- **D-08:** The helper is the canonical source for colored node fixtures — prevents manual sync drift when `NODE_COLOR_MAP` changes in the future.

### Claude's Discretion

None specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NODE-COLOR-01 | Saving a node type via EditorPanel always writes the corresponding color to the canvas node (Pattern B path when canvas is open, Strategy A path when canvas is closed) | Color injection in `saveNodeEdits` before the Pattern B / Strategy A fork covers both paths |
| NODE-COLOR-02 | Color is always overwritten on every save, regardless of whether a color was previously set on the node | `saveNodeEdits` unconditionally sets `edits['color']` from `NODE_COLOR_MAP` before writing — no "already has a color" check |
| NODE-COLOR-03 | Programmatically created test canvases include the correct `color` field for each node based on its `radiprotocol_nodeType` | `makeCanvasNode(type, overrides?)` test helper derives color from `NODE_COLOR_MAP` at construction time |
</phase_requirements>

---

## Summary

Phase 28 is a focused data-write correctness fix. Currently, color is only written when the user changes the node type dropdown (via `onTypeDropdownChange`). When the user saves other fields (e.g., question text) via `scheduleAutoSave`, the color is NOT re-injected. This means a node whose color was manually cleared can survive a save without regaining its semantic color.

The fix is surgical: inside `saveNodeEdits`, before the call forks into Pattern B (`saveLive`) or Strategy A (`vault.modify`), resolve the node type and unconditionally set `edits['color']` from `NODE_COLOR_MAP`. If the type is unknown or absent, skip silently. The unmark path (type set to `''`) already deletes `color` in both paths — that behavior is preserved.

The second concern is test fixtures. Existing `.canvas` fixtures in `src/__tests__/fixtures/` do not include `color` fields. Node-COLOR-03 requires that programmatically created typed nodes carry the correct color. The solution is a `makeCanvasNode(type, overrides?)` helper in a new test utils file that generates a correctly-colored node record from `NODE_COLOR_MAP` automatically.

**Primary recommendation:** Add ~10 lines to `saveNodeEdits` in `editor-panel-view.ts` (before the `saveLive` call), update one existing test assertion in `canvas-write-back.test.ts`, and add a test utils file plus new tests.

---

## Standard Stack

No new dependencies. This phase uses only the existing project stack:

| Asset | Location | Purpose |
|-------|----------|---------|
| `NODE_COLOR_MAP` | `src/canvas/node-color-map.ts` | Maps `RPNodeKind` → palette string `"1"`–`"6"` |
| `saveNodeEdits` | `src/views/editor-panel-view.ts:146` | Single entry point for all node writes |
| `saveLive` | `src/canvas/canvas-live-editor.ts:75` | Pattern B write (canvas open) |
| `vault.modify` | `editor-panel-view.ts:222` | Strategy A write (canvas closed) |
| Vitest | `vitest.config.ts` | Test runner — `npm test` = `vitest run` |

**Installation:** None required. [VERIFIED: codebase inspection]

---

## Architecture Patterns

### Current Save Flow (before Phase 28)

```
saveNodeEdits(filePath, nodeId, edits)
  ├── saveLive(filePath, nodeId, edits)   ← Pattern B (canvas open)
  │     applies edits as-is to getData() snapshot
  │     color only present IF onTypeDropdownChange put it in edits
  └── vault.modify(...)                   ← Strategy A (canvas closed)
        applies edits as-is to parsed JSON
        color only present IF onTypeDropdownChange put it in edits
```

### Target Save Flow (after Phase 28)

```
saveNodeEdits(filePath, nodeId, edits)
  ├── [NEW] resolve node type from edits OR existing canvas data
  ├── [NEW] if type found in NODE_COLOR_MAP → edits['color'] = mapped value
  ├── [NEW] if type is '' or absent → leave edits['color'] unset (unmark handled elsewhere)
  ├── saveLive(filePath, nodeId, edits)   ← Pattern B — now includes color
  └── vault.modify(...)                   ← Strategy A — now includes color
```

### Type Resolution Pattern (D-04)

Priority order for resolving node type inside `saveNodeEdits`:

1. `edits['radiprotocol_nodeType']` — caller is changing the type right now
2. Existing node data from canvas (for Strategy A: parsed JSON; for Pattern B: already resolved before `saveLive`)

**Key insight for Strategy A:** The canvas JSON is already parsed inside `saveNodeEdits` (lines 181–193 of `editor-panel-view.ts`) to find `nodeIndex`. The existing node object is available at that point. For the type resolution, the same parsed `canvasData.nodes[nodeIndex]` can be read before writing.

**Key insight for Pattern B:** `saveLive` receives `edits` and applies them. Since color injection happens in `saveNodeEdits` before calling `saveLive`, `edits` already contains `color` by the time `saveLive` runs. No change to `canvas-live-editor.ts` is required. [VERIFIED: code inspection]

### Injection Placement

The injection must happen in `saveNodeEdits` BEFORE the `saveLive` call — not inside `saveLive` or `vault.modify`. This is the only way to serve both paths with a single code change. [VERIFIED: code inspection of `editor-panel-view.ts:146-227`]

```typescript
// VERIFIED pattern (src/views/editor-panel-view.ts — to be added before line 154)
// [CITED: CONTEXT.md D-01, D-02, D-04]

// Resolve effective type: from edits (type change) or passed as-is (other field edit)
const effectiveType =
  (edits['radiprotocol_nodeType'] as string | undefined) ||
  undefined; // Phase 28 only uses edits-first; canvas fallback resolved below

// For Strategy A path we need the canvas JSON anyway — type fallback resolved there
const isUnmarking =
  edits['radiprotocol_nodeType'] === '' ||
  (edits['radiprotocol_nodeType'] === undefined && /* unmark condition */ false);
```

**Note:** The full implementation requires a two-step approach because the canvas data is not yet parsed at the top of `saveNodeEdits` (it is parsed only inside the Strategy A branch). The recommended pattern is:

1. Check `edits['radiprotocol_nodeType']` first.
2. If not present in edits, do NOT attempt a live canvas read — instead, read the type from the parsed JSON that Strategy A already fetches, or from `saveLive`'s own `getData()` snapshot.
3. The simplest correct implementation: read the type from the canvas data inside each branch, but share a helper `resolveColorForEdits(edits, existingNodeRecord)` that encapsulates the lookup.

### Alternative: Inline injection per branch

The simplest approach (avoiding a helper) is to inline the color injection in two places:
- At the top of `saveNodeEdits`, resolve type from `edits` only (covers the type-change case)
- Inside Strategy A branch, after parsing node, patch `edits` with the fallback type from the existing node

Both approaches are correct; the inline approach avoids introducing a new private method.

### `onTypeDropdownChange` — existing pattern to replicate

`onTypeDropdownChange` (lines 560-587 of `editor-panel-view.ts`) already performs the correct color lookup:

```typescript
// VERIFIED: src/views/editor-panel-view.ts:570-576
const mappedColor = (NODE_COLOR_MAP as Record<string, string | undefined>)[selectedType];
if (mappedColor !== undefined) {
  edits['color'] = mappedColor;
}
```

Phase 28 moves this same logic inside `saveNodeEdits` so it runs on EVERY save, not just type-change saves. [VERIFIED: code inspection]

After Phase 28, `onTypeDropdownChange` no longer needs to inject color into `edits` because `saveNodeEdits` will do it. However, for minimal-diff safety, leaving the color injection in `onTypeDropdownChange` as well is harmless (it will be overwritten by `saveNodeEdits` with the same value). The decision of whether to remove it from `onTypeDropdownChange` is left to the planner.

### Unmark path — already correct, must be preserved

Both `saveLive` (line 107: `delete node['color']`) and Strategy A (line 209: `delete node['color']`) already delete `color` on the unmark path. [VERIFIED: code inspection]

Phase 28 must NOT break this. The color injection in `saveNodeEdits` must only run on the non-unmark path — which is guaranteed by checking `isUnmarking` before injecting.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Color lookup | Custom map inside `saveNodeEdits` | `NODE_COLOR_MAP` from `node-color-map.ts` — already exists |
| Test node factory | Inline literals in each test | `makeCanvasNode(type, overrides?)` helper (D-07, D-08) |

**Key insight:** `NODE_COLOR_MAP` is already the authoritative single source of truth. The bug is not a missing map — it is a missing call site.

---

## Common Pitfalls

### Pitfall 1: Type resolution reads stale data for Strategy A

**What goes wrong:** The `saveNodeEdits` function parses canvas JSON inside the Strategy A branch (after the `saveLive` call). Attempting to resolve the fallback type BEFORE parsing means the existing node's type is not yet available.

**Why it happens:** The function structure puts JSON parsing inside the Strategy A block (lines 173-193). A naive "resolve type at top of function" pattern cannot reach canvas data without a second vault read.

**How to avoid:** Resolve the type in two stages — first from `edits['radiprotocol_nodeType']`, then (inside Strategy A) from the already-parsed `canvasData.nodes[nodeIndex]['radiprotocol_nodeType']`. The color injection happens in both locations: once at the top (if type is in edits) and once inside Strategy A (if type comes from existing node).

**Warning signs:** Tests pass for type-change saves but fail for other-field saves on already-typed nodes.

### Pitfall 2: Injecting color for Pattern B before `saveLive` call

Pattern B (`saveLive`) receives `edits` directly and applies them to the `getData()` snapshot. If `edits['color']` is set before `saveLive` is called, `saveLive` will write it — this is the DESIRED behavior. The `PROTECTED_FIELDS` set in `canvas-live-editor.ts` does NOT include `'color'` (confirmed by regression test `TS regression: canvas/canvas-live-editor.ts — color not protected`). [VERIFIED: regression.test.ts:122-138, canvas-live-editor.ts:14]

**How to avoid:** Inject color into `edits` BEFORE calling `saveLive`. This is guaranteed by the D-01 injection-before-fork approach.

### Pitfall 3: Mutating the `edits` parameter directly

`saveNodeEdits` receives `edits` from callers (snapshots taken by `scheduleAutoSave` and `onTypeDropdownChange`). Mutating the parameter directly is safe (it's already a spread copy at call site), but creating a local copy is cleaner.

**How to avoid:** Use `const enrichedEdits = { ...edits }` at the top of `saveNodeEdits` and inject color into `enrichedEdits`, or inline the injection into the existing `edits` variable (which is already a copy by the time it reaches `saveNodeEdits`).

### Pitfall 4: Removing the color injection from `onTypeDropdownChange`

If the planner removes the color injection from `onTypeDropdownChange` as part of cleanup, the type-change save path still works (because `saveNodeEdits` now handles it). However, care is required to ensure no test explicitly verifies that `onTypeDropdownChange` injects color — such a test would break unnecessarily.

**How to avoid:** Either leave `onTypeDropdownChange` unchanged, or update any tests that depend on it injecting color into `edits` before `saveNodeEdits` is called.

### Pitfall 5: Forgetting to run `npm run build` after editing TypeScript

CLAUDE.md requires: "After any CSS change, always run the build." The same applies to TypeScript changes — the `main.js` output is generated by esbuild and is what Obsidian loads.

**How to avoid:** Include `npm run build` as a verification step after each TypeScript edit task.

---

## Test Contract Changes

### Test to UPDATE: `canvas-write-back.test.ts:57`

**Current contract (line 57):** `'PROTECTED_FIELDS: id, x, y, width, height, type, color are never written'`

This test asserts that if a caller explicitly passes `color` in `edits`, it is stripped. After Phase 28, `saveNodeEdits` itself writes color — so the test must change. [VERIFIED: canvas-write-back.test.ts:57-80]

**New contract:** "color is always written correctly for known types — saveNodeEdits injects it regardless of caller input."

The test rewrite should:
1. Call `saveNodeEdits` with `radiprotocol_nodeType: 'question'` and no `color` in edits
2. Assert that the written JSON contains `color: '5'` (cyan = question type)
3. Optionally: call with an unknown type and assert no `color` field is written

### Test to ADD: color-injection behavior in `canvas-write-back.test.ts`

New tests (all in Strategy A path — `mockSaveLive` returns `false`):

| Test | Edits input | Expected color in written JSON |
|------|-------------|-------------------------------|
| TYPE-CHANGE: known type | `{ radiprotocol_nodeType: 'start' }` | `color: '4'` (green) |
| FIELD-ONLY: already typed node | `{ radiprotocol_questionText: 'new text' }` on node with `radiprotocol_nodeType: 'question'` | `color: '5'` (cyan) |
| UNKNOWN TYPE: not in map | `{ radiprotocol_nodeType: 'custom' }` | no `color` field written |
| OVERWRITE: node had wrong color | node JSON has `color: '6'`, edits `{ radiprotocol_questionText: 'x' }` | `color: '5'` (overwrites) |
| UNMARK: type cleared | `{ radiprotocol_nodeType: '' }` | no `color` field (deleted) |

### New test utility: `makeCanvasNode` helper (NODE-COLOR-03)

Create `src/__tests__/test-utils/make-canvas-node.ts` (or similar location):

```typescript
// [CITED: CONTEXT.md D-07, D-08]
import { NODE_COLOR_MAP } from '../../canvas/node-color-map';
import type { RPNodeKind } from '../../graph/graph-model';

export function makeCanvasNode(
  type: RPNodeKind,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `node-${Math.random().toString(36).slice(2)}`,
    type: 'text',
    x: 0, y: 0, width: 200, height: 60,
    radiprotocol_nodeType: type,
    color: NODE_COLOR_MAP[type],
    ...overrides,
  };
}
```

This helper is used in new tests and can replace manual node literals in existing fixtures over time.

---

## Code Examples

### Color injection inside `saveNodeEdits` (VERIFIED pattern)

The injection point is at the top of `saveNodeEdits`, creating an `enrichedEdits` object:

```typescript
// Source: CONTEXT.md D-01 through D-06; editor-panel-view.ts inspection
async saveNodeEdits(
  filePath: string,
  nodeId: string,
  edits: Record<string, unknown>
): Promise<void> {
  // Phase 28: resolve and inject color before forking into Pattern B / Strategy A
  const enrichedEdits = { ...edits };
  const editedType = enrichedEdits['radiprotocol_nodeType'] as string | undefined;
  const isUnmarking = editedType === '' || ('radiprotocol_nodeType' in edits && editedType === undefined);

  if (!isUnmarking && editedType) {
    const mapped = (NODE_COLOR_MAP as Record<string, string | undefined>)[editedType];
    if (mapped !== undefined) {
      enrichedEdits['color'] = mapped;
    }
  }
  // For FIELD-ONLY saves (type not in edits), the fallback to existing node type
  // is handled inside Strategy A after JSON parse (see below)

  // ... rest of saveNodeEdits uses enrichedEdits instead of edits
```

**For FIELD-ONLY saves** (edits does not contain `radiprotocol_nodeType`), the type must be read from the existing canvas node. This applies only to Strategy A (canvas closed), since Pattern B — if the canvas is open — only receives the edits object and does not separately read the type. To cover this case in Strategy A:

```typescript
// Inside Strategy A, after nodeIndex is found and node is retrieved:
// [CITED: CONTEXT.md D-04]
if (!('radiprotocol_nodeType' in enrichedEdits)) {
  // No type in edits — read from existing node to get color
  const existingType = node['radiprotocol_nodeType'] as string | undefined;
  if (existingType) {
    const mapped = (NODE_COLOR_MAP as Record<string, string | undefined>)[existingType];
    if (mapped !== undefined) {
      enrichedEdits['color'] = mapped;
    }
  }
}
```

**Note on Pattern B field-only saves:** When `saveLive` is called, it receives `enrichedEdits`. If `enrichedEdits['color']` is not set (field-only save, type not in edits), the live save will NOT write a color — which is acceptable since Pattern B can only reach this case if the canvas is open, and any node visible in the open canvas already had its color set when the type was originally assigned. If robustness is desired, `saveLive` would need to call `getData()` to read the existing type — but CONTEXT.md D-01/D-02 say `saveNodeEdits` handles this, not `saveLive`. The planner should address this edge case.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Color only written on type-change | Color written on every save for known types | Phase 28 | Prevents color drift after manual canvas edits |
| Test fixtures without `color` field | `makeCanvasNode` helper auto-derives color | Phase 28 | Single source of truth for fixture generation |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | For Pattern B field-only saves (canvas open, type not in edits), the node already has the correct color from prior type assignment, so not injecting color is acceptable | Code Examples | If wrong, nodes edited while canvas is open could have stale colors; mitigation is to add a `getData()` lookup in `saveLive` |

**All other claims verified via direct code inspection of canonical source files.**

---

## Open Questions

1. **Pattern B field-only save — color injection robustness**
   - What we know: `saveNodeEdits` injects color from `edits['radiprotocol_nodeType']` (type-change) and from `canvasData.nodes[nodeIndex]` (Strategy A fallback). For Pattern B without type-in-edits, neither mechanism triggers.
   - What's unclear: Should Pattern B also inject color from the live `getData()` snapshot when type is not in edits?
   - Recommendation: The planner should decide — either accept the minor gap (A1 above) or add a `getCanvasView(filePath).canvas.getData()` lookup inside `saveNodeEdits` before calling `saveLive`. CONTEXT.md does not explicitly address this sub-case.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 28 is a code-only change with no external dependencies beyond the existing project toolchain (Node.js, npm, vitest — all previously verified as available).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NODE-COLOR-01 | `saveNodeEdits` writes `color` on Pattern B path | unit (mock saveLive=true) | `npm test -- canvas-write-back` | Partially — test file exists, new tests needed |
| NODE-COLOR-01 | `saveNodeEdits` writes `color` on Strategy A path | unit (mock saveLive=false) | `npm test -- canvas-write-back` | Partially — test file exists, new tests needed |
| NODE-COLOR-02 | Color is overwritten even if node had a different color | unit | `npm test -- canvas-write-back` | No — Wave 0 gap |
| NODE-COLOR-03 | `makeCanvasNode` helper produces correct color field | unit | `npm test -- canvas-write-back` | No — Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/test-utils/make-canvas-node.ts` — implements `makeCanvasNode` helper for NODE-COLOR-03
- [ ] Updated test in `canvas-write-back.test.ts:57` — replaces old "color never written" contract with "color always written for known types"
- [ ] New tests in `canvas-write-back.test.ts` — covers NODE-COLOR-01 (both paths), NODE-COLOR-02 (overwrite), and the unmark path preservation

---

## Security Domain

This phase involves no authentication, session management, access control, cryptography, or external input surfaces. The sole operation is writing a palette color string (`"1"`–`"6"`) derived from an in-memory constant map to a local `.canvas` JSON file already owned by the vault. No ASVS categories apply.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 28 |
|-----------|---------------------|
| Source TypeScript in `src/`, compiled by esbuild to `main.js` | Yes — edit `editor-panel-view.ts`, not `main.js` |
| CSS output `styles.css` is generated — do NOT edit directly | N/A — Phase 28 has no CSS changes |
| When adding CSS for a new feature, create a new file in `src/styles/` | N/A — no CSS |
| ONLY add or modify code relevant to the current phase | Yes — only modify `saveNodeEdits` and test files |
| NEVER delete rules, functions, or event listeners not added in this phase | Yes — `onTypeDropdownChange`, `saveLive`, existing tests must not be deleted |
| CSS files: append-only per phase | N/A |
| After any CSS change, run `npm run build` | N/A — but `npm run build` must still pass after TS changes |
| No `innerHTML` | Not applicable — no DOM manipulation |
| No `require('fs')` | Not applicable |
| `console.log` forbidden in production | Yes — use `console.error` only in catch blocks (already the pattern) |

---

## Sources

### Primary (HIGH confidence)
- `src/views/editor-panel-view.ts` — `saveNodeEdits` full implementation (lines 146-227), `onTypeDropdownChange` color pattern (lines 560-587)
- `src/canvas/canvas-live-editor.ts` — `saveLive` implementation, `PROTECTED_FIELDS` definition, unmark path
- `src/canvas/node-color-map.ts` — `NODE_COLOR_MAP` full mapping, 7 node types
- `src/__tests__/canvas-write-back.test.ts` — existing test contract, line 57 to be updated
- `src/__tests__/regression.test.ts` — regression assertions including "color not in PROTECTED_FIELDS"
- `src/__tests__/fixtures/linear.canvas` — fixture structure (no color fields currently)
- `.planning/phases/28-auto-node-coloring/28-CONTEXT.md` — all locked decisions D-01 through D-08
- `CLAUDE.md` — project constraints, CSS architecture, regression prevention rules

### Secondary (MEDIUM confidence)
- None required — all findings came from direct codebase inspection

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Core change (injection point): HIGH — code fully read, exact location identified
- Test contract update: HIGH — exact line and assertion identified
- `makeCanvasNode` helper: HIGH — pattern is straightforward, no external dependencies
- Pattern B field-only edge case: MEDIUM — behavior is correct but the exact handling is an open question for the planner

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable domain — no external library changes possible)
