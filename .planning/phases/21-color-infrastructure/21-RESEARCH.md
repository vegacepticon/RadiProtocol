# Phase 21: Color Infrastructure - Research

**Researched:** 2026-04-11
**Domain:** Obsidian Canvas internal API — node color writes via CanvasLiveEditor; TypeScript constant file; PROTECTED_FIELDS mutation; Vitest unit tests
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fixed palette assignments (Obsidian color strings `"1"`–`"6"`):
  - `start` → `"4"` (green)
  - `question` → `"5"` (cyan)
  - `answer` → `"2"` (orange)
  - `text-block` → `"3"` (yellow)
  - `snippet` → `"6"` (purple)
  - `loop-start` → `"1"` (red)
  - `loop-end` → `"1"` (red) — loop pair shares red; intentional
- **D-02:** `node-color-map.ts` defines all 7 types including `snippet` immediately; Phase 22 does not touch this file.
- **D-03:** Remove `'color'` from **both** `PROTECTED_FIELDS` instances:
  - `src/canvas/canvas-live-editor.ts:14`
  - `src/views/editor-panel-view.ts:181`
- **D-04:** No separate `writeColor()` method — color is written through standard `saveLive()` / Strategy A path once removed from `PROTECTED_FIELDS`.
- **D-05:** Color is written **only via the live path** (`saveLive()`). If canvas is closed, color write is silently skipped. Other fields still save via Strategy A.
- **D-06:** The unmark path in `saveLive()` must also delete the `color` field (set to `undefined`).

### Claude's Discretion

- Test structure for `node-color-map.ts` (what tests to write, how many assertions per type)
- Whether to export `NODE_COLOR_MAP` as a `const` record or a `Map<RPNodeKind, string>`
- Integration point details in `editor-panel-view.ts` (which existing save call gets the color append)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLOR-01 | Assigning a node type automatically sets the canvas node's colour to the type's fixed palette string ("1"–"6") | Covered by: D-01 mapping + integration in `editor-panel-view.ts` save method appending `color` to edits |
| COLOR-02 | Removing a node type clears the canvas node's colour field | Covered by: D-06 unmark path in `saveLive()` must delete `color`; also unmark path in Strategy A (vault.modify) must do same |
| COLOR-03 | Colours are fixed per type — all 7 types have a distinct palette colour | Covered by: `node-color-map.ts` constant; loop pair shares `"1"` (intentional, not a violation per D-01) |
| COLOR-04 | Colour coding applies in real-time via CanvasLiveEditor (no canvas close required) | Covered by: D-05 live-only path; `isLiveAvailable()` gate; silent skip on canvas closed |

</phase_requirements>

---

## Summary

Phase 21 is a narrowly scoped, low-risk phase. The entire implementation is three targeted edits to existing files plus one new constant file. No new UI components, no new APIs, no new patterns — the hard infrastructure work (CanvasLiveEditor, Strategy A, Pattern B) was completed in prior phases.

The core insight is that `color` is already a valid field on `CanvasNodeData` (typed as `color?: string` in `src/types/canvas-internal.d.ts`) and on `RPNodeBase` in `graph-model.ts`. The only reason color writes are currently blocked is the presence of `'color'` in `PROTECTED_FIELDS` — a set that exists independently in two files. Removing it from both is the unlock.

The integration in `editor-panel-view.ts` is a two-line append: look up `NODE_COLOR_MAP[selectedType]` and add `color: paletteString` to the `edits` object before calling `saveNodeEdits()`. The unmark path requires one additional `delete node.color` in both the live path (`saveLive()`) and the Strategy A path (`saveNodeEdits()`).

**Primary recommendation:** Implement in four small, sequential tasks — (1) create `node-color-map.ts` with tests, (2) remove `color` from both PROTECTED_FIELDS, (3) add color to the assign-type edits in `editor-panel-view.ts`, (4) add color deletion to both unmark paths.

---

## Standard Stack

### Core (no new dependencies required)

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| `CanvasLiveEditor.saveLive()` | `src/canvas/canvas-live-editor.ts` | Live canvas write via Pattern B | Existing — no changes to method signature |
| `CanvasNodeData.color?: string` | `src/types/canvas-internal.d.ts` | Canvas node color field type | Existing — already typed correctly |
| `RPNodeBase.color?: string` | `src/graph/graph-model.ts` | Graph model color field | Existing — reference only, not modified |
| `RPNodeKind` | `src/graph/graph-model.ts` | 6-type union (start, question, answer, text-block, loop-start, loop-end) | Existing — NOT modified in Phase 21 |
| Vitest | `vitest.config.ts`, `package.json` | Test framework | Existing — `vitest ^4.1.2` installed |

**No npm installs required.** [VERIFIED: read package.json directly]

### New File

| File | Purpose |
|------|---------|
| `src/canvas/node-color-map.ts` | Exports `NODE_COLOR_MAP` constant — type→palette string mapping for all 7 node types |

---

## Architecture Patterns

### Recommended Project Structure (existing — no changes)

```
src/
├── canvas/
│   ├── canvas-live-editor.ts   # MODIFIED: remove 'color' from PROTECTED_FIELDS
│   └── node-color-map.ts       # NEW: type→palette constant
├── views/
│   └── editor-panel-view.ts    # MODIFIED: remove 'color' from PROTECTED_FIELDS; append color to edits
├── graph/
│   └── graph-model.ts          # REFERENCE ONLY — not modified
└── __tests__/
    ├── canvas-live-editor.test.ts   # MODIFIED: invert color PROTECTED_FIELDS assertion
    ├── canvas-write-back.test.ts    # MODIFIED: update PROTECTED_FIELDS test + add unmark-clears-color
    └── node-color-map.test.ts       # NEW: map coverage + unmark-clears-color path
```

### Pattern 1: `NODE_COLOR_MAP` Constant (new)

**What:** A typed `const` record mapping every `RPNodeKind` plus `'snippet'` to a palette string.

**Recommendation (Claude's Discretion):** Use a plain `const` record typed as `Record<string, string>` or `Partial<Record<RPNodeKind | 'snippet', string>>`. A `Map` would work but adds unnecessary overhead for a static 7-entry lookup and makes `Object.entries()` iteration in tests less ergonomic.

**Example:**
```typescript
// Source: direct design from CONTEXT.md D-01 + D-02
// src/canvas/node-color-map.ts

export const NODE_COLOR_MAP: Record<string, string> = {
  'start':      '4',
  'question':   '5',
  'answer':     '2',
  'text-block': '3',
  'snippet':    '6',
  'loop-start': '1',
  'loop-end':   '1',
} as const;
```

**Note on `snippet`:** `RPNodeKind` does not include `'snippet'` yet (Phase 22 adds it). Using `Record<string, string>` avoids a TypeScript error. Alternatively, cast or use a union type `RPNodeKind | 'snippet'`. The simplest approach that compiles cleanly is `Record<string, string>`.

### Pattern 2: Color Append in `editor-panel-view.ts` Save Path

**What:** Before passing `edits` to `saveNodeEdits()`, look up the color for the selected type and append it.

**Where:** The save button's `onClick` handler at ~line 295 in `editor-panel-view.ts`.

**Current code:**
```typescript
// Current (line ~295-304)
.onClick(() => {
  if (this.currentFilePath && this.currentNodeId) {
    void this.saveNodeEdits(
      this.currentFilePath,
      this.currentNodeId,
      { ...this.pendingEdits }
    );
  }
});
```

**After change:**
```typescript
.onClick(() => {
  if (this.currentFilePath && this.currentNodeId) {
    const edits = { ...this.pendingEdits };
    const selectedType = edits['radiprotocol_nodeType'] as string | undefined;
    if (selectedType && selectedType !== '') {
      edits['color'] = NODE_COLOR_MAP[selectedType] ?? undefined;
    } else if ('radiprotocol_nodeType' in edits && !selectedType) {
      edits['color'] = undefined; // unmark path — clear color
    }
    void this.saveNodeEdits(
      this.currentFilePath,
      this.currentNodeId,
      edits
    );
  }
});
```

**Important subtlety (D-05):** The color append happens unconditionally in `editor-panel-view.ts`. Whether it actually reaches the canvas depends on `saveLive()` returning true. If the canvas is closed (`saveLive()` returns false), the Strategy A path in `saveNodeEdits()` currently has `'color'` in its local `PROTECTED_FIELDS` — removing it from that set means Strategy A will also write color. But D-05 says color write is skipped when canvas is closed. **Resolution:** After removing `'color'` from Strategy A's `PROTECTED_FIELDS`, the Strategy A path will write color to the file. D-05 says the *live* path is preferred, but does NOT explicitly say Strategy A must skip color. The planner should decide: either keep color in Strategy A's PROTECTED_FIELDS (silent skip when canvas closed) or also write it via Strategy A (color persists on disk but not visible until canvas reopens). Given D-05 says "color will appear on next canvas open," writing via Strategy A is actually the correct behavior for the fallback. [ASSUMED — this interpretation is consistent with D-05 wording but needs planner confirmation]

### Pattern 3: Unmark Path Color Deletion

**What:** Both unmark paths must delete the `color` key.

**Path A — `saveLive()` live path** (`canvas-live-editor.ts:99–105`):
```typescript
// Current unmark path (lines 99-105):
if (isUnmarking) {
  for (const key of Object.keys(node)) {
    if (key.startsWith('radiprotocol_')) {
      delete node[key as keyof CanvasNodeData];
    }
  }
}
// ADD after the loop:
// delete (node as Record<string, unknown>)['color'];
```

**Path B — Strategy A path** (`editor-panel-view.ts:188–193`):
```typescript
// Current unmark path (lines 188-193):
if (isUnmarking && 'radiprotocol_nodeType' in edits) {
  for (const key of Object.keys(node)) {
    if (key.startsWith('radiprotocol_')) {
      delete node[key];
    }
  }
}
// ADD: also delete node['color']
```

### Anti-Patterns to Avoid

- **Don't add a `writeColor()` method** (D-04 explicitly forbids it — color travels through the existing `edits` path).
- **Don't read `currentKind` for the color lookup** — the save handler already has `pendingEdits['radiprotocol_nodeType']`; use that. Reading `currentKind` would miss in-flight dropdown changes before save.
- **Don't modify `graph-model.ts`** — `RPNodeKind` does not get `'snippet'` in Phase 21.
- **Don't add `snippet` to the node type dropdown** in `editor-panel-view.ts` — Phase 22 owns that change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas node color writes | Custom canvas mutation code | `CanvasLiveEditor.saveLive()` already handles getData/setData/requestSave cycle | Already debounced, has rollback, handles API absence |
| Palette string lookup | Inline switch/if-else per type | `NODE_COLOR_MAP[type]` | Single source of truth, testable in isolation |
| Test mocking of canvas API | Custom canvas fake per test | Existing `makeLeafWithData()` helper in `canvas-live-editor.test.ts` | Already tested and stable |

---

## Common Pitfalls

### Pitfall 1: Two Independent PROTECTED_FIELDS — Easy to Miss the Second

**What goes wrong:** Developer removes `'color'` from `canvas-live-editor.ts:14` but forgets `editor-panel-view.ts:181`. Color writes work via live path (saveLive) but silently fail in the Strategy A fallback.

**Why it happens:** The two sets are not imported from a shared module — they were intentionally duplicated. There is no single source of truth.

**How to avoid:** Task checklist must explicitly name both files and both line numbers (14 and 181).

**Warning signs:** COLOR-01 tests pass, but COLOR-01 manual test fails when canvas is closed (color not written). Search for `PROTECTED_FIELDS` in the codebase and count: there must be exactly two hits after Phase 21 (neither containing `'color'`).

### Pitfall 2: Test at Line 57 Asserts color IS Protected — Will Fail After Change

**What goes wrong:** `canvas-write-back.test.ts:57` has a test titled "PROTECTED_FIELDS: id, x, y, width, height, type, color are never written". After removing `color` from PROTECTED_FIELDS, this test's intent is partially inverted — `color` should now be writable.

**Current test behavior:** The test passes `color: '#ff0000'` in edits and asserts the written JSON does NOT contain the changed color value. After Phase 21, passing `color` in edits should result in the color being written.

**How to avoid:** The test must be updated to reflect the new contract. The assertion about structural fields (id, x, y, width, height, type) still stands — only the `color` assertion is removed/inverted.

**Warning signs:** Tests pass on main branch but fail after both PROTECTED_FIELDS removals.

### Pitfall 3: `pendingEdits` Only Contains User-Changed Fields

**What goes wrong:** `pendingEdits` is populated only by `onChange` handlers (dropdown, text inputs). If the user loads a node with an existing type but doesn't change it, `pendingEdits['radiprotocol_nodeType']` is not set — color lookup returns undefined.

**Why it happens:** The color append logic in the save handler reads from `pendingEdits`, which is empty unless the user interacted with the type dropdown.

**How to avoid:** The color lookup must fall back to the currently-loaded type. Either:
  1. Read `pendingEdits['radiprotocol_nodeType'] ?? currentKind` when building the color edit, OR
  2. Initialize `pendingEdits` with the current type when the form loads (simpler — guarantees color is always set on save).

**Recommendation (Claude's Discretion):** Option 2 is cleaner — initialize `pendingEdits['radiprotocol_nodeType']` to `currentKind ?? ''` at form render time. This way the save path always has a type to look up.

### Pitfall 4: `snippet` Is Not in `RPNodeKind` Yet

**What goes wrong:** Typing `NODE_COLOR_MAP` as `Record<RPNodeKind, string>` causes a TypeScript compile error because `'snippet'` is not in the union.

**How to avoid:** Use `Record<string, string>` for now, or `Record<RPNodeKind | 'snippet', string>`. The latter is more explicit and self-documents Phase 22's dependency but requires a type cast. Either compiles cleanly with the right choice.

### Pitfall 5: Unmark Path Must Delete `color` in BOTH Live and Strategy A Paths

**What goes wrong:** Developer adds `delete node.color` only to `saveLive()` unmark path. When the canvas is closed, unmark via Strategy A leaves the `color` field on the canvas JSON, so the node keeps its color after type is removed.

**How to avoid:** Both unmark paths (in `canvas-live-editor.ts` and `editor-panel-view.ts`) must delete color.

---

## Code Examples

### New file: `node-color-map.ts`
```typescript
// Source: CONTEXT.md D-01, D-02; UI-SPEC Semantic Color Contract
// src/canvas/node-color-map.ts

/** Maps every RadiProtocol node type (including snippet, pre-declared for Phase 22) to
 *  its Obsidian canvas palette string. */
export const NODE_COLOR_MAP: Record<string, string> = {
  'start':      '4',  // green  — entry point
  'question':   '5',  // cyan   — information gathering
  'answer':     '2',  // orange — action / selection
  'text-block': '3',  // yellow — passive content
  'snippet':    '6',  // purple — code / file insertion (Phase 22)
  'loop-start': '1',  // red    — loop boundary
  'loop-end':   '1',  // red    — loop boundary (intentional share, see D-01)
};
```

### Test: `node-color-map.test.ts` (new)
```typescript
// Source: CONTEXT.md Claude's Discretion — test structure
// src/__tests__/node-color-map.test.ts
import { describe, it, expect } from 'vitest';
import { NODE_COLOR_MAP } from '../canvas/node-color-map';

describe('NODE_COLOR_MAP', () => {
  it('maps all 7 node types to palette strings', () => {
    const types = ['start', 'question', 'answer', 'text-block', 'snippet', 'loop-start', 'loop-end'];
    for (const type of types) {
      expect(NODE_COLOR_MAP[type]).toMatch(/^[1-6]$/);
    }
  });

  it('each of the 6 active types maps to the correct palette string (D-01)', () => {
    expect(NODE_COLOR_MAP['start']).toBe('4');
    expect(NODE_COLOR_MAP['question']).toBe('5');
    expect(NODE_COLOR_MAP['answer']).toBe('2');
    expect(NODE_COLOR_MAP['text-block']).toBe('3');
    expect(NODE_COLOR_MAP['snippet']).toBe('6');
    expect(NODE_COLOR_MAP['loop-start']).toBe('1');
    expect(NODE_COLOR_MAP['loop-end']).toBe('1');
  });

  it('loop-start and loop-end intentionally share "1" (red)', () => {
    expect(NODE_COLOR_MAP['loop-start']).toBe(NODE_COLOR_MAP['loop-end']);
  });

  it('unknown / empty type returns undefined (unmark path results in no color)', () => {
    expect(NODE_COLOR_MAP['']).toBeUndefined();
    expect(NODE_COLOR_MAP['free-text']).toBeUndefined();
  });
});
```

### Test: `canvas-write-back.test.ts` additions
```typescript
// Add to existing describe block — unmark-clears-color
it('unmark path: color is deleted from canvas JSON when nodeType cleared', async () => {
  mockVaultRead.mockResolvedValue(
    makeCanvasJson({ radiprotocol_nodeType: 'question', color: '5' })
  );
  await view.saveNodeEdits('test.canvas', 'node-1', {
    radiprotocol_nodeType: '',
    color: undefined,
  });
  expect(mockVaultModify).toHaveBeenCalled();
  const written = JSON.parse(mockVaultModify.mock.calls[0]![1] as string) as {
    nodes: Array<Record<string, unknown>>;
  };
  const node = written.nodes[0];
  expect(node).not.toHaveProperty('color');
});
```

---

## State of the Art

| Old State | New State After Phase 21 | Impact |
|-----------|--------------------------|--------|
| `'color'` in PROTECTED_FIELDS (both copies) | `'color'` removed from both | Enables color writes via existing edit path |
| No type→color mapping exists | `NODE_COLOR_MAP` constant in `node-color-map.ts` | All 7 types mapped; Phase 22 requires no color file changes |
| Unmark path only removes `radiprotocol_*` fields | Unmark path also deletes `color` | Canvas nodes return to default unstyled color on type clear |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Strategy A fallback path should also write color (not skip it), so color persists on disk even when canvas is closed; it will appear on next canvas open | Architecture Patterns — Pattern 2 | If user intended Strategy A to skip color, removing color from Strategy A's PROTECTED_FIELDS would be wrong. Planner should confirm D-05 interpretation. |
| A2 | `pendingEdits` should be initialized with `currentKind` at form render time so the save path always has a type for color lookup | Common Pitfalls — Pitfall 3 | If not initialized, saving without changing the type dropdown would not write color for existing typed nodes |

---

## Open Questions (RESOLVED)

1. **Strategy A color write behavior (A1 above)**
   - What we know: D-05 says color is written "only via the live path" and "color will appear on next canvas open" when canvas is closed
   - What's unclear: Does D-05 prohibit Strategy A from writing color, or does it merely describe the fallback behavior (color will be there on next open because Strategy A wrote it to disk)?
   - Recommendation: Interpret D-05 as "live is preferred, Strategy A also writes color to disk." Remove `'color'` from both PROTECTED_FIELDS copies. This is consistent with the goal of color persistence. If the user wants explicit skip, they can re-add color to Strategy A's set only.
   - **RESOLVED (21-02 Task 1):** Remove `'color'` from both PROTECTED_FIELDS copies — Strategy A also writes color to disk. Consistent with D-05 goal of color persistence on next canvas open.

2. **`pendingEdits` initialization for existing typed nodes (A2 above)**
   - What we know: `pendingEdits` starts empty; only user interactions populate it
   - What's unclear: Should `renderForm()` pre-populate `pendingEdits['radiprotocol_nodeType']` with `currentKind`?
   - Recommendation: Yes — initialize at form render time. This also fixes a subtle bug: if a user opens a typed node and clicks Save without changing anything, the save currently sends empty edits. Initializing the type ensures color is always written on any save.
   - **RESOLVED (21-02 Task 2 Change 2):** `renderForm()` pre-populates `this.pendingEdits['radiprotocol_nodeType'] = currentKind ?? ''` to ensure color is written on any save.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 21 is code-only changes to an existing TypeScript project. All required tools (TypeScript, Vitest, esbuild) are already present in `node_modules`. No external services, databases, or CLI utilities beyond the project's own dev toolchain are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLOR-01 | Assigning a type sets canvas node `color` to palette string | unit | `npm test -- --reporter=dot node-color-map` | ❌ Wave 0 — new file |
| COLOR-02 | Clearing type deletes `color` field from canvas node | unit | `npm test -- --reporter=dot canvas-write-back` | ✅ existing (needs new test case) |
| COLOR-03 | All 7 types have palette mappings; values are valid strings | unit | `npm test -- --reporter=dot node-color-map` | ❌ Wave 0 — new file |
| COLOR-04 | Real-time write via saveLive (live path used before Strategy A) | unit (existing live-save test) | `npm test -- --reporter=dot canvas-live-editor` | ✅ existing (existing live-save assertion covers the mechanism) |

### Sampling Rate

- **Per task commit:** `npm test -- --reporter=dot`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/node-color-map.test.ts` — covers COLOR-01 (assign path), COLOR-03 (7-type mapping)
- [ ] New test case in `src/__tests__/canvas-write-back.test.ts` — covers COLOR-02 (unmark clears color)
- [ ] Update `src/__tests__/canvas-live-editor.test.ts` line 57 — invert color PROTECTED_FIELDS assertion

---

## Security Domain

Phase 21 introduces no user input paths, no authentication, no network calls, and no file handling beyond the existing canvas write-back mechanism already used in prior phases. Security domain review is not applicable to this phase.

| ASVS Category | Applies | Note |
|---------------|---------|------|
| V2 Authentication | No | No auth changes |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | No access control changes |
| V5 Input Validation | No | Palette strings are constants, not user input |
| V6 Cryptography | No | No crypto |

Existing pitfall applies: canvas write uses `app.vault.*` (not `require('fs')`), which is already the established pattern. No new vault access patterns introduced.

---

## Sources

### Primary (HIGH confidence)
- `src/canvas/canvas-live-editor.ts` — read directly; verified PROTECTED_FIELDS at line 14, saveLive() signature, unmark path at lines 95–116
- `src/views/editor-panel-view.ts` — read directly; verified local PROTECTED_FIELDS at line 181, save method structure, pendingEdits pattern
- `src/types/canvas-internal.d.ts` — read directly; verified `color?: string` field on CanvasNodeData
- `src/graph/graph-model.ts` — read directly; verified RPNodeKind union (6 types, no snippet), RPNodeBase.color
- `src/__tests__/canvas-live-editor.test.ts` — read directly; confirmed no color-related tests
- `src/__tests__/canvas-write-back.test.ts` — read directly; verified line 57 PROTECTED_FIELDS test that asserts color is protected
- `.planning/phases/21-color-infrastructure/21-CONTEXT.md` — locked decisions D-01 through D-06
- `.planning/phases/21-color-infrastructure/21-UI-SPEC.md` — color contract, interaction paths, approved 2026-04-11
- `vitest.config.ts`, `package.json` — verified test framework and version

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — project decision history, critical pitfalls
- `.planning/ROADMAP.md` — Phase 21 success criteria

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files read directly from codebase
- Architecture: HIGH — integration points verified in source; one ASSUMED interpretation (A1)
- Pitfalls: HIGH — derived from direct code reading; two assumptions flagged

**Research date:** 2026-04-11
**Valid until:** Stable — no external dependencies; valid until source files change
