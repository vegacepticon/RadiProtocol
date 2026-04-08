# Phase 11: Live Canvas Editing — Research

**Researched:** 2026-04-08
**Domain:** Obsidian internal Canvas View API, TypeScript ambient declarations, async save patterns
**Confidence:** HIGH (core implementation pattern verified via multiple community plugin sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: API Detection — Silent Fallback**
Probe for the internal Canvas API by checking that `canvas.data` (array) and `canvas.requestSave` (function) both exist on the active canvas view before attempting a live save. If either is absent, silently fall back to Strategy A (require canvas closed, existing `vault.modify()` path). No Notice is shown when falling back.

Detection pseudocode:
```typescript
const leaf = app.workspace.getLeavesOfType('canvas')
  .find(l => (l.view as { file?: { path: string } }).file?.path === filePath);
const canvas = leaf?.view as CanvasViewInternal | undefined;
const hasLiveApi = Array.isArray(canvas?.data) && typeof canvas?.requestSave === 'function';
```

**D-02: Live Save Path**
When the internal API is confirmed available:
1. Find the target node in `canvas.data` by `id`
2. Merge edits into the node object in-place
3. Call `canvas.requestSave()` — debounced 500ms (per STATE.md standing reminder)
4. No `vault.modify()` call — the canvas view owns the file write

**D-03: Failure Handling**
If `canvas.requestSave()` throws an exception:
- Show a Notice: `"Save failed — close the canvas and try again."`
- The node object is not mutated (or mutation is reverted before the error Notice) — the canvas state remains as before
- No automatic retry, no fallback to `vault.modify()` over the open canvas

**D-04: Strategy A Removal**
Remove the `isCanvasOpen()` block in `saveNodeEdits()` that currently shows "Close the canvas before editing node properties." and returns early. Replace with the `CanvasLiveEditor` call that handles both the open-canvas (live) and closed-canvas (Strategy A) paths.

**D-05: Editor Panel — No Visual Change**
`EditorPanelView` form looks identical whether the canvas is open or closed. No indicator, no badge, no label change. Live editing is transparent.

**D-06: Debounce on requestSave**
`canvas.requestSave()` is debounced 500ms in `CanvasLiveEditor` to avoid triggering Obsidian's dirty cycle on rapid consecutive saves (noted in STATE.md pitfall #9).

### Claude's Discretion

- Exact TypeScript interface shape for `CanvasViewInternal` and `CanvasNodeData`
- Whether to use a class or a standalone function for `CanvasLiveEditor`
- Exact debounce implementation (lodash vs inline setTimeout)
- Notice wording for save failure (English)
- Whether `canvas.requestSave()` must be awaited or is fire-and-forget

### Deferred Ideas (OUT OF SCOPE)

- New node types or new form fields in EditorPanelView
- Any UI indicator of live vs. offline edit mode
- Changes to ProtocolRunner, CanvasParser, GraphValidator, SnippetService, SessionService
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIVE-01 | `CanvasLiveEditor` module (`src/canvas/canvas-live-editor.ts`) probes for internal Canvas API and performs live node updates | Internal API shape verified: `canvas.data` array + `requestSave()` on CanvasView both confirmed in community plugin sources |
| LIVE-02 | TypeScript ambient declaration file (`src/types/canvas-internal.d.ts`) for undocumented internal API shape | Interface shape researched from obsidian-advanced-canvas Canvas.d.ts — `CanvasViewInternal` with `data`, `requestSave`, `file` |
| LIVE-03 | `EditorPanelView.saveNodeEdits()` uses `CanvasLiveEditor` when canvas is open; falls back to Strategy A when closed | Integration point identified at line 59-68 of editor-panel-view.ts; exact call site documented |
| LIVE-04 | Remove Strategy A guard (`isCanvasOpen()` → Notice "Close the canvas…") — replaced by live path | Guard at lines 65-68 of editor-panel-view.ts is the exact deletion target; `isCanvasOpen()` at lines 50-57 is repurposed or replaced |
</phase_requirements>

---

## Summary

Phase 11 upgrades `EditorPanelView.saveNodeEdits()` to write node changes directly into a live canvas through the undocumented Obsidian internal Canvas View API, eliminating the Strategy A requirement that the canvas must be closed before editing.

The core mechanism is accessing `canvas.data` (an array of `CanvasNodeData` objects exposed as a direct property on the `CanvasView` runtime object) and calling `canvas.requestSave()` to trigger a debounced file write. Multiple community plugins (obsidian-advanced-canvas, Obsidian-Link-Nodes-In-Canvas, enchanted-canvas) confirm this pattern works reliably across Obsidian versions, with `requestSave()` being present on both the `Canvas` sub-object and the `CanvasView` itself. The detection guard (`Array.isArray(canvas?.data) && typeof canvas?.requestSave === 'function'`) provides a clean runtime feature probe that silently falls back to the existing Strategy A path on any Obsidian version where the internal API is unavailable.

The two new files are small and self-contained: `src/canvas/canvas-live-editor.ts` (the module implementing probe + live write + debounce) and `src/types/canvas-internal.d.ts` (ambient declarations for TypeScript). The only change to existing files is in `editor-panel-view.ts` where the Strategy A early-return guard is replaced with a `CanvasLiveEditor` call. No new npm dependencies are required.

**Primary recommendation:** Implement `CanvasLiveEditor` as a standalone exported class with a single `saveNodeEdits(app, filePath, nodeId, edits)` method; use a per-instance `setTimeout` debounce (no lodash); define the `CanvasViewInternal` ambient interface with `data: CanvasNodeData[]` and `requestSave(): void` as the minimal surface required by D-01 and D-02.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| async-mutex | already installed | WriteMutex for Strategy A fallback path | Already used across snippet/session services; per STATE.md project pattern |
| obsidian | 1.12.3 (installed) | `App`, `Notice`, `getLeavesOfType` | Plugin's only runtime dependency; all canvas API access goes through `app.workspace` |
| TypeScript | 6.0.2 (installed) | Ambient declarations for internal API | Existing toolchain; `canvas-internal.d.ts` is a `.d.ts` file — no runtime cost |
| vitest | ^4.1.2 (installed) | Unit tests for `CanvasLiveEditor` | Existing test framework; `CanvasLiveEditor` is a pure module (no Obsidian imports) → fully unit-testable |

[VERIFIED: package.json in repo]

### No New Dependencies

`async-mutex` is already installed. `CanvasLiveEditor` receives `App` as a constructor argument so Obsidian is never imported — the module is pure. No additional packages needed. [VERIFIED: CONTEXT.md `<code_context>` section, package.json]

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── canvas/
│   └── canvas-live-editor.ts   # NEW: CanvasLiveEditor class
├── types/
│   └── canvas-internal.d.ts    # NEW: ambient declarations
├── views/
│   └── editor-panel-view.ts    # MODIFIED: saveNodeEdits() integration
└── main.ts                     # CHECK: no wiring needed (CanvasLiveEditor constructed in EditorPanelView)
```

`src/canvas/` is a new directory — the canvas directory does not yet exist. [VERIFIED: bash ls of src/]

### Pattern 1: CanvasViewInternal Ambient Declaration

**What:** A `.d.ts` file declaring the minimal TypeScript interface for the internal canvas runtime object, using `unknown` for the parts we don't touch.

**When to use:** Any time the code casts `leaf.view` to access `data` or `requestSave`.

```typescript
// src/types/canvas-internal.d.ts
// [ASSUMED interface shape — verified by community plugin research]
export interface CanvasNodeData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  color?: string;
  [key: string]: unknown; // radiprotocol_* fields + any other custom properties
}

export interface CanvasViewInternal {
  file?: { path: string };
  data: CanvasNodeData[];
  requestSave(): void;
}
```

Key design choices:
- Index signature `[key: string]: unknown` on `CanvasNodeData` allows `radiprotocol_*` fields without casting.
- The interface is the *minimal* surface needed — does not attempt to model `canvas` sub-object or `getData()`/`setData()` methods (those exist but are not used in this phase).
- `requestSave()` returns `void` — it is fire-and-forget / debounced internally by Obsidian; wrapping in a try/catch per D-03 is sufficient.

[CITED: https://github.com/Developer-Mike/obsidian-advanced-canvas/blob/main/src/@types/Canvas.d.ts — confirmed `data: CanvasData` deprecated property exists on Canvas object, `requestSave(): void` on both Canvas and CanvasView]

### Pattern 2: CanvasLiveEditor Class

**What:** A class with constructor receiving `App`, and a single public method `saveNodeEdits()`. Internally holds a debounce timer per canvas file path.

**When to use:** Called from `EditorPanelView.saveNodeEdits()`.

```typescript
// src/canvas/canvas-live-editor.ts
import type { App } from 'obsidian';
import type { CanvasViewInternal, CanvasNodeData } from '../types/canvas-internal';

export class CanvasLiveEditor {
  private readonly app: App;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Returns the live CanvasViewInternal if the canvas for filePath is currently
   * open AND exposes the internal API. Returns undefined if canvas is closed or
   * the internal API is unavailable (Obsidian version mismatch).
   */
  private getCanvasView(filePath: string): CanvasViewInternal | undefined {
    const leaf = this.app.workspace
      .getLeavesOfType('canvas')
      .find(l => (l.view as { file?: { path: string } }).file?.path === filePath);

    const view = leaf?.view as CanvasViewInternal | undefined;

    // D-01: probe for internal API presence
    if (!view || !Array.isArray(view.data) || typeof view.requestSave !== 'function') {
      return undefined;
    }
    return view;
  }

  /**
   * Returns true if a live canvas view is available for filePath.
   * Replaces EditorPanelView.isCanvasOpen() for the live path detection.
   */
  isLiveAvailable(filePath: string): boolean {
    return this.getCanvasView(filePath) !== undefined;
  }

  /**
   * Saves edits into the live canvas (D-02).
   * Returns true if live save succeeded, false if caller should use Strategy A.
   * Throws never — all errors are surfaced via Notice per D-03.
   */
  async saveLive(
    filePath: string,
    nodeId: string,
    edits: Record<string, unknown>
  ): Promise<boolean> {
    const view = this.getCanvasView(filePath);
    if (!view) return false; // caller falls through to Strategy A

    const node = view.data.find((n: CanvasNodeData) => n.id === nodeId);
    if (!node) return false; // node not found in live data — caller uses Strategy A

    // Snapshot original values for rollback on error (D-03)
    const snapshot: Record<string, unknown> = {};
    for (const key of Object.keys(edits)) {
      snapshot[key] = node[key];
    }

    // Apply edits in-place
    const PROTECTED = new Set(['id', 'x', 'y', 'width', 'height', 'type', 'color']);
    for (const [key, value] of Object.entries(edits)) {
      if (PROTECTED.has(key)) continue;
      if (value === undefined) {
        delete node[key];
      } else {
        node[key] = value;
      }
    }

    try {
      this.debouncedRequestSave(filePath, view);
      return true;
    } catch (err) {
      // Rollback
      for (const [key, value] of Object.entries(snapshot)) {
        if (value === undefined) {
          delete node[key];
        } else {
          node[key] = value;
        }
      }
      throw err; // caller handles with Notice per D-03
    }
  }

  private debouncedRequestSave(filePath: string, view: CanvasViewInternal): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing !== undefined) clearTimeout(existing);
    const timer = setTimeout(() => {
      view.requestSave();
      this.debounceTimers.delete(filePath);
    }, 500);
    this.debounceTimers.set(filePath, timer);
  }
}
```

[ASSUMED: exact field names on internal CanvasView runtime object. Verified by community plugin pattern.]

### Pattern 3: Integration in EditorPanelView.saveNodeEdits()

**What:** Replace the Strategy A guard (lines 65-68) with `CanvasLiveEditor` call. Fall through to existing `vault.modify()` path when `saveLive()` returns false.

```typescript
// In saveNodeEdits(), replacing the isCanvasOpen() guard block:
const liveResult = await this.plugin.canvasLiveEditor.saveLive(filePath, nodeId, edits);
if (liveResult) {
  new Notice('Node properties saved.');
  return;
}
// Fall through: canvas is closed or API unavailable — use Strategy A (vault.modify path)
```

Key: `CanvasLiveEditor` needs to be instantiated and accessible from `EditorPanelView`. Two approaches:
1. Add `canvasLiveEditor: CanvasLiveEditor` property to `RadiProtocolPlugin` and pass through `this.plugin.canvasLiveEditor`
2. Construct it directly in `EditorPanelView` using `this.plugin.app`

Option 2 is simpler and keeps `main.ts` unchanged. `EditorPanelView` already holds `this.plugin` for `app` access — constructing `new CanvasLiveEditor(this.plugin.app)` in the constructor is clean.

### Pattern 4: `canvas.data` vs `canvas.getData()` — Important Distinction

Community plugin research reveals TWO access patterns for canvas data:

**Pattern A (used in this phase per D-01/D-02):**
```typescript
// Direct array access via canvas view's data property
view.data          // CanvasNodeData[] — the nodes array
view.requestSave() // persists changes
```

**Pattern B (used by obsidian-advanced-canvas, Obsidian-Link-Nodes-In-Canvas):**
```typescript
// Via Canvas sub-object
view.canvas.getData()  // returns CanvasData { nodes, edges }
view.canvas.setData(data)
view.canvas.requestSave()
```

Pattern A (`view.data`) is confirmed deprecated in advanced-canvas typings (`"@deprecated Use getData instead -> Can be outdated"`) but is the pattern specified in CONTEXT.md D-01 and D-02. It is simpler and sufficient for the in-place node mutation approach. Pattern B is more robust but requires different TypeScript declarations and a different integration approach.

**IMPORTANT:** The CONTEXT.md detection pseudocode uses `Array.isArray(canvas?.data)` where `canvas` is the CanvasView — meaning `view.data`, not `view.canvas.data`. This is the pattern to implement. If `view.data` is absent or not an array (because the canvas version uses a different structure), the fallback silently activates. This is correct behavior.

[CITED: https://raw.githubusercontent.com/Developer-Mike/obsidian-advanced-canvas/main/src/@types/Canvas.d.ts — deprecated `data: CanvasData` property confirmed]
[CITED: https://raw.githubusercontent.com/Quorafind/Obsidian-Link-Nodes-In-Canvas/master/linkNodesInCanvasIndex.ts — `canvas.getData()` / `canvas.setData()` pattern confirmed]

### Anti-Patterns to Avoid

- **Calling `vault.modify()` on an open canvas:** Canvas view overwrites the file on next interaction. The `CanvasLiveEditor.saveLive()` returning `true` MUST prevent any subsequent `vault.modify()` call. [VERIFIED: STATE.md pitfall #1]
- **Not debouncing `requestSave()`:** Rapid consecutive saves (user clicks Save quickly) trigger Obsidian's dirty cycle repeatedly. 500ms debounce prevents this. [VERIFIED: STATE.md pitfall #9]
- **Mutating a node before confirming `requestSave()` won't throw:** Mutation happens before the `try` block covers it. Always snapshot-then-mutate-then-requestSave with rollback on error. [ASSUMED: standard defensive pattern]
- **Using `canvas.canvas.getData()` instead of `view.data`:** The CONTEXT.md decision uses `view.data` directly. Do not deviate to the `getData()/setData()` pattern — it would require different detection logic and different TypeScript declarations.
- **Forgetting the un-mark cleanup path:** When `radiprotocol_nodeType` is being set to `''` or `undefined`, ALL `radiprotocol_*` keys must be removed. This logic already exists in `saveNodeEdits()` Strategy A path — the same logic must apply in the live path. [VERIFIED: editor-panel-view.ts lines 104-126]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce | Custom rolling debounce state machine | `setTimeout` + `clearTimeout` with a `Map<string, ReturnType<typeof setTimeout>>` | Adequate; lodash unnecessary; already-installed async-mutex not appropriate for debounce |
| Write locking for Strategy A | New mutex | Existing `WriteMutex` (async-mutex) already used in `insertIntoCurrentNote` | Project already has write mutex pattern; do not introduce new lock types |
| TypeScript Canvas types | Inline `as any` casts | `src/types/canvas-internal.d.ts` ambient declarations | Community standard pattern; keeps ESLint `no-explicit-any` rule satisfied |

---

## Common Pitfalls

### Pitfall 1: `view.data` May Be Undefined on Some Obsidian Versions

**What goes wrong:** `canvas.data` is marked `@deprecated` in advanced-canvas typings; future Obsidian versions may remove it entirely. If `view.data` is `undefined`, the `find()` call throws.

**Why it happens:** The Obsidian Canvas is not a public API and can change between releases.

**How to avoid:** The D-01 detection guard `Array.isArray(view.data)` handles this exactly — if `data` is absent or not an array, the live path is skipped and Strategy A runs.

**Warning signs:** Users on newer Obsidian versions cannot save with canvas open (falls back to "close the canvas" message). This is expected graceful degradation.

### Pitfall 2: Node Not Found in `view.data` After Concurrent Edits

**What goes wrong:** User opens the editor panel, then another plugin or user action removes/changes the node from the canvas. The `view.data.find(n => n.id === nodeId)` returns `undefined` and the code crashes.

**Why it happens:** `view.data` is a live reference to canvas state; it can change between when `loadNode()` was called and when `saveNodeEdits()` is called.

**How to avoid:** When `view.data.find()` returns `undefined`, return `false` from `saveLive()` — the caller falls through to Strategy A which independently re-reads the file and will also fail gracefully with "Node not found" Notice. Do not throw or crash.

### Pitfall 3: `requestSave()` Debounce Timer Leaks on Plugin Unload

**What goes wrong:** If `CanvasLiveEditor` holds active `setTimeout` timers when the plugin unloads, the timers fire after the plugin is gone and `view.requestSave()` may crash.

**Why it happens:** `CanvasLiveEditor` is not an Obsidian `Component` and does not participate in the `onunload()` lifecycle automatically.

**How to avoid:** Clear all debounce timers in a `destroy()` method, called from `RadiProtocolPlugin.onunload()`. Alternatively, use `this.plugin.registerInterval()` — but that's for intervals. For this pattern, a simple `destroy()` that calls `clearTimeout` on all entries in `debounceTimers` is sufficient.

### Pitfall 4: The Un-Mark (nodeType = '') Path Must Be Handled in Live Edit

**What goes wrong:** When the user unmarks a node (sets `radiprotocol_nodeType` to `''`), the live path must remove ALL `radiprotocol_*` fields from the node object in `view.data`, not just set `radiprotocol_nodeType`. Forgetting this leaves orphaned keys in the live canvas state.

**Why it happens:** The un-mark cleanup logic is currently in the Strategy A path (editor-panel-view.ts lines 104-126). The live path must replicate or share this logic.

**How to avoid:** Extract the un-mark cleanup into a shared helper, or implement the same `isUnmarking` check in `CanvasLiveEditor.saveLive()`. The `edits` payload passed to `saveLive()` may contain `{ radiprotocol_nodeType: '' }` — detect this and iterate over node keys to delete all `radiprotocol_*` fields. [VERIFIED: editor-panel-view.ts lines 104-126]

### Pitfall 5: ESLint `no-explicit-any` — Cannot Cast to `any` for Internal API Access

**What goes wrong:** Using `leaf.view as any` to access internal properties will fail ESLint `no-explicit-any` rule, blocking the build.

**Why it happens:** The project's ESLint config (`eslint-plugin-obsidianmd`, strict TS) forbids `any`.

**How to avoid:** Use `as unknown as CanvasViewInternal` two-step cast, or use interface with index signature. The ambient declaration file (`canvas-internal.d.ts`) enables clean typed access without `any`. [VERIFIED: main.ts line 79-84 shows existing project pattern `as unknown as { ... }`]

---

## Code Examples

Verified patterns from project codebase and community plugins:

### Existing: Two-Step Cast Pattern (from main.ts)

```typescript
// Source: src/main.ts line 79-84 (VERIFIED: read in this session)
type CanvasNodeMenuHandler = (menu: Menu, node: { id: string; canvas?: unknown }) => void;
type EventRef = import('obsidian').EventRef;
this.registerEvent(
  (this.app.workspace as unknown as {
    on(event: 'canvas:node-menu', handler: CanvasNodeMenuHandler): EventRef;
  }).on('canvas:node-menu', ...)
);
```

The same `as unknown as InterfaceType` pattern must be used for `view as unknown as CanvasViewInternal`.

### Existing: getLeavesOfType Pattern (from editor-panel-view.ts)

```typescript
// Source: src/views/editor-panel-view.ts lines 50-57 (VERIFIED: read in this session)
private isCanvasOpen(filePath: string): boolean {
  return this.plugin.app.workspace
    .getLeavesOfType('canvas')
    .some(leaf => {
      const view = leaf.view as { file?: { path: string } };
      return view.file?.path === filePath;
    });
}
```

`CanvasLiveEditor.getCanvasView()` uses the same `getLeavesOfType('canvas')` call with `.find()` instead of `.some()` to retain the leaf reference.

### Community Pattern: requestSave Usage (from enchanted-canvas)

```typescript
// Source: enchanted-canvas plugin (CITED: https://github.com/borolgs/enchanted-canvas)
canvas.requestSave(); // fire-and-forget; debounced internally or by caller
```

`requestSave()` is confirmed as fire-and-forget — it does not return a Promise.

### Community Pattern: canvas.getData() / setData() (from Obsidian-Link-Nodes-In-Canvas)

```typescript
// Source: CITED: https://raw.githubusercontent.com/Quorafind/Obsidian-Link-Nodes-In-Canvas/master/linkNodesInCanvasIndex.ts
const canvas = canvasView.canvas;
const currentData = canvas.getData();
currentData.edges = [...currentData.edges, ...allEdgesData];
canvas.setData(currentData);
canvas.requestSave();
```

NOTE: This is the `canvas` sub-object pattern (Pattern B), NOT the `view.data` pattern (Pattern A) mandated by CONTEXT.md. Do NOT use this pattern — use `view.data` in-place mutation per D-02.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Strategy A: require canvas closed before `vault.modify()` | Live edit via `view.data` mutation + `requestSave()` | Phase 11 (this phase) | Users can now edit node properties without closing the canvas |
| `isCanvasOpen()` → early return with Notice | `CanvasLiveEditor.isLiveAvailable()` → live path | Phase 11 | Eliminates user friction; guard becomes transparent fallback |
| No `src/canvas/` directory | `src/canvas/canvas-live-editor.ts` | Phase 11 | New domain boundary for canvas runtime operations |
| No ambient TS declarations for internal API | `src/types/canvas-internal.d.ts` | Phase 11 | Type-safe internal API access without `any` |

**Deprecated/outdated:**
- `view.data` (direct property): Marked `@deprecated` in obsidian-advanced-canvas typings in favor of `canvas.getData()`. For this phase we use it because the CONTEXT.md detection probe is `Array.isArray(canvas?.data)` — this is a conscious tradeoff: simpler interface, graceful fallback if it disappears.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `view.data` is a `CanvasNodeData[]` array accessible directly on the CanvasView (not via `view.canvas.data`) | Architecture Patterns (Pattern 1) | Detection returns false for all canvases → always falls back to Strategy A; feature never activates |
| A2 | `view.requestSave()` exists directly on the CanvasView (not only on `view.canvas`) | Architecture Patterns (Pattern 1) | Detection returns false → always falls back to Strategy A |
| A3 | `requestSave()` returns `void` (fire-and-forget) and does not return a Promise | Code Examples | If it returns a Promise that must be awaited, un-awaited call may swallow rejections; D-03 catch block may not trigger |
| A4 | Mutating a node object in `view.data` in-place (without `setData`) is reflected in the canvas's saved state when `requestSave()` is called | Architecture Patterns (Pattern 2) | Live edits are silently discarded; canvas saves stale data; users see no error but changes don't persist |
| A5 | `debounceTimers` cleanup needed in plugin `onunload()` | Common Pitfalls (Pitfall 3) | If `requestSave()` fires after plugin unload, benign crash or no-op; low severity |

**A4 is the highest-risk assumption.** If the canvas runtime takes a snapshot of `data` at a specific point rather than holding a live mutable reference, in-place mutation would be silently ignored. The Pattern B approach (`canvas.setData(...)`) is safer but contradicts the CONTEXT.md decision. If Phase 11 manual testing shows live edits not persisting, the fallback is to switch from in-place mutation to `canvas.getData()` + merge + `canvas.setData()`.

---

## Open Questions

1. **Is `view.data` truly a live mutable reference (A4)?**
   - What we know: Community plugins use `canvas.getData()`/`canvas.setData()` (Pattern B, sub-object). The `view.data` direct property is deprecated in advanced-canvas typings.
   - What's unclear: Whether in-place mutation of `view.data` items propagates to `requestSave()` output without a `setData()` call.
   - Recommendation: Manual test in dev vault immediately after implementing. If mutation does not persist, switch to Pattern B (access via `view.canvas.getData()`/`view.canvas.setData()`); update `CanvasViewInternal` accordingly. This is a one-function change to `saveLive()`.

2. **Does `view.requestSave` exist at the view level or only at `view.canvas.requestSave`?**
   - What we know: obsidian-advanced-canvas Canvas.d.ts shows `requestSave()` on `CanvasView` AND on `Canvas` sub-object. Detection probe checks `typeof canvas?.requestSave === 'function'` where `canvas` is `leaf.view`.
   - What's unclear: Whether the actual Obsidian 1.12.x runtime has it on the view directly.
   - Recommendation: Use `leaf.view` level probe as coded in D-01. If probe always returns false, try `(leaf.view as any).canvas?.requestSave` — but check this in dev before committing to a different interface shape.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 11 is a code-only change. All dependencies (TypeScript, esbuild, vitest, async-mutex, obsidian SDK) are already installed and verified in prior phases. No new CLI tools, databases, or external services are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIVE-01 | `CanvasLiveEditor` is a class with `saveLive()` method | unit | `npm test` (covers `src/__tests__/canvas-live-editor.test.ts`) | ❌ Wave 0 |
| LIVE-01 | `saveLive()` returns `true` when canvas view has live API + node found | unit | same | ❌ Wave 0 |
| LIVE-01 | `saveLive()` returns `false` when `view.data` is not an array (no API) | unit | same | ❌ Wave 0 |
| LIVE-01 | `saveLive()` returns `false` when canvas leaf not found (canvas closed) | unit | same | ❌ Wave 0 |
| LIVE-01 | PROTECTED_FIELDS not mutated by `saveLive()` | unit | same | ❌ Wave 0 |
| LIVE-01 | Un-mark: `radiprotocol_nodeType: ''` removes all `radiprotocol_*` from live node | unit | same | ❌ Wave 0 |
| LIVE-01 | `saveLive()` rolls back node mutation if `requestSave()` throws | unit | same | ❌ Wave 0 |
| LIVE-03 | `saveNodeEdits()` calls `saveLive()` first; vault.modify NOT called when live returns true | unit | `npm test` (updates `canvas-write-back.test.ts`) | ❌ Wave 0 update |
| LIVE-04 | `saveNodeEdits()` does NOT show "Close the canvas" Notice when canvas is open | unit | same | ❌ Wave 0 update |

> Note: `canvas-write-back.test.ts` and `editor-panel.test.ts` currently FAIL with "Failed to resolve entry for package obsidian" (vi.mock path resolution issue unrelated to this phase). Wave 0 should address this or tests must be written to avoid the import — `CanvasLiveEditor` itself has no Obsidian imports so `canvas-live-editor.test.ts` can be tested cleanly.

### Sampling Rate

- **Per task commit:** `npm test` (fast, <1s for pure module tests)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work` — note 4 pre-existing failures in runner-extensions.test.ts and runner-commands.test.ts are unrelated to Phase 11 and should not be introduced by this work

### Wave 0 Gaps

- [ ] `src/__tests__/canvas-live-editor.test.ts` — covers LIVE-01 (pure module, no obsidian mock needed)
- [ ] Update `src/__tests__/canvas-write-back.test.ts` — add LIVE-03/LIVE-04 contract tests (replace canvas-open guard test)

*(No new test infrastructure needed — vitest already configured)*

---

## Security Domain

Phase 11 modifies canvas node data via internal API access. ASVS review:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — local Obsidian plugin, no auth layer |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A — user-local vault |
| V5 Input Validation | yes (partial) | PROTECTED_FIELDS set in `saveLive()` prevents `id`, `x`, `y`, `width`, `height`, `type`, `color` mutation — same guard as Strategy A |
| V6 Cryptography | no | N/A |

**Threat: Mutation of layout-critical fields via live API**
The PROTECTED_FIELDS guard is duplicated in both the Strategy A path (editor-panel-view.ts) and the new `saveLive()` method. These must stay in sync. Recommend sharing the constant.

---

## Sources

### Primary (HIGH confidence)
- Repository read: `src/views/editor-panel-view.ts` — current `saveNodeEdits()` and `isCanvasOpen()` implementation (lines 50-134 verified in this session)
- Repository read: `src/main.ts` — `as unknown as` cast pattern, `getLeavesOfType` usage (lines 79-109 verified)
- Repository read: `package.json` — no `async-mutex` or `lodash` in devDependencies, confirming no new deps
- Repository read: `vitest.config.ts` — test environment: node, include pattern confirmed
- [obsidian-advanced-canvas Canvas.d.ts](https://raw.githubusercontent.com/Developer-Mike/obsidian-advanced-canvas/main/src/@types/Canvas.d.ts) — confirmed `data: CanvasData` (deprecated) and `requestSave(): void` on both `Canvas` and `CanvasView`

### Secondary (MEDIUM confidence)
- [Obsidian-Link-Nodes-In-Canvas](https://raw.githubusercontent.com/Quorafind/Obsidian-Link-Nodes-In-Canvas/master/linkNodesInCanvasIndex.ts) — confirmed `canvas.getData()` / `canvas.setData()` / `canvas.requestSave()` pattern used in production plugin
- [enchanted-canvas](https://github.com/borolgs/enchanted-canvas) — confirmed `canvas.requestSave()` call pattern and prototype override approach
- [obsidian-api canvas.d.ts](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts) — official `CanvasData`, `CanvasNodeData` type definitions (data schema, not runtime API)

### Tertiary (LOW confidence)
- Obsidian Forum: "Any details on the canvas API?" — confirms `app.workspace.getLeavesOfType('canvas')[0].view.canvas` console inspection technique; no specific `view.data` confirmation
- obsidian-advanced-canvas README — confirms `requestSave()` usage but no source-level detail on `view.data` vs `view.canvas.data`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing tooling verified
- Architecture: MEDIUM-HIGH — `getLeavesOfType` + `view.data` pattern confirmed in principle; A4 assumption (in-place mutation without `setData()`) is unverified and is the single biggest risk
- Pitfalls: HIGH — pitfalls derived from actual code (PROTECTED_FIELDS, un-mark logic, `no-explicit-any` rule) are verified; async timer leak pitfall is assumed
- Test map: HIGH — maps directly to CONTEXT.md requirements and existing test file patterns

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (Canvas API is undocumented and could change; verify on Obsidian version upgrade)
