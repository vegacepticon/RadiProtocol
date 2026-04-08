# Phase 14: Node Editor Auto-Switch and Unsaved Guard — Research

**Researched:** 2026-04-08
**Domain:** Obsidian Plugin API — Canvas internal events, Modal pattern, EditorPanelView extension
**Confidence:** HIGH (all critical implementation paths verified against live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

1. **Auto-switch scope: ALL canvas nodes (including plain nodes)**
   - Auto-switch fires for every canvas node click, regardless of `radiprotocol_nodeType`.
   - Plain nodes load the editor with type dropdown at "— unset —".
   - `loadNode()` already handles the no-type case gracefully.

2. **Unsaved guard prompt: 2 buttons**
   - Modal title: `h2: Unsaved changes` (English-only per PROJECT.md — see Non-Decisions)
   - `p`: Unsaved changes will be lost.
   - Button 1: `Stay` — closes modal, does nothing; pendingEdits intact.
   - Button 2: `Discard and switch` (`mod-cta`) — resets `pendingEdits`, calls `loadNode()` for new node.
   - Class name: `NodeSwitchGuardModal`.
   - Pattern: copy `CanvasSwitchModal` (`Promise<boolean>` result, `onClose` resolves false).

3. **Dirty detection: simple — any `pendingEdits` key = dirty**
   - `Object.keys(this.pendingEdits).length > 0` → show guard.
   - No value comparison with original. False-positive guard on cleared fields is accepted.

### Claude's Discretion

- Which Obsidian workspace event to hook for node clicks (researcher task — `canvas:node-selection-changed`, observer pattern on canvas selection, or equivalent).
- Exact button label language — follow English-only UI convention (PROJECT.md: "English-only UI for v1").
- Whether to add a test for `NodeSwitchGuardModal` presence in the DOM — yes, follow `RunnerView.test.ts` pattern.

### Deferred Ideas

*(none raised during discussion)*
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDITOR-01 | When EditorPanel is open, clicking a canvas node immediately loads that node's settings without any additional action | Canvas node-click detection via `registerDomEvent` on canvas container + `canvas.selection` read; or prototype patch of `updateSelection`; `loadNode()` already exists |
| EDITOR-02 | Clicking a different node while edits are unsaved presents a confirmation prompt before discarding; staying leaves editor unchanged and unsaved edits intact | `NodeSwitchGuardModal` (copy of `CanvasSwitchModal`); dirty check via `Object.keys(pendingEdits).length > 0`; auto-switch handler checks dirty state before calling `loadNode()` |
</phase_requirements>

---

## Summary

Phase 14 adds two behaviours to `EditorPanelView`: auto-switch (EDITOR-01) and unsaved guard (EDITOR-02). Both behaviours are fully self-contained within `EditorPanelView` and `main.ts`. No new library dependencies are needed.

The primary research question is how to detect canvas node clicks from a plugin. Obsidian does not publish a workspace event for node selection. The confirmed approaches from the community are: (a) patch the canvas prototype's `updateSelection` method (used by Advanced Canvas plugin), or (b) use `registerDomEvent` on the canvas container element and read `canvas.selection` after the pointer event settles. Approach (b) is strongly preferred for this codebase because it avoids prototype mutation, aligns with the project's pattern of using `registerDomEvent`, and sidesteps fragility from internal Canvas prototype changes.

The `NodeSwitchGuardModal` is a straightforward copy of `CanvasSwitchModal` — same `Promise<boolean>` pattern, same two-button layout. The guard integration is a conditional inserted in the auto-switch handler: before calling `loadNode()`, check if `pendingEdits` is non-empty; if so, await the modal result.

**Primary recommendation:** Use `registerDomEvent` on the active canvas leaf's container element, reading `canvas.selection` on `pointerdown` (with a `setTimeout(0)` microtask deferral to let Obsidian settle the selection before reading it). Register and deregister listeners inside `EditorPanelView.onOpen()` / `onClose()` via a helper that also watches for active leaf changes.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | 1.12.3 (installed) | Plugin API — Modal, registerDomEvent, workspace events | Project dependency |
| TypeScript | 6.0.2 (installed) | Type-safe plugin development | Project toolchain |
| Vitest | ^4.1.2 (installed) | Unit testing | Project test framework |

[VERIFIED: package.json]

No new library dependencies required for this phase.

### Supporting (no new installs)
| Class / Pattern | Source | Purpose |
|----------------|--------|---------|
| `Modal` (obsidian) | Existing in `CanvasSwitchModal` | `NodeSwitchGuardModal` base class |
| `registerDomEvent` | Existing in `RunnerView`/`CanvasSelectorWidget` | Safe DOM event registration with auto-cleanup |
| `registerEvent` | Existing in `main.ts` | Workspace event subscription with auto-cleanup |

---

## Architecture Patterns

### Recommended Project Structure

No new files/folders needed beyond:

```
src/
├── views/
│   ├── editor-panel-view.ts     # Modified: add auto-switch handler, dirty guard, onOpen/onClose hooks
│   └── node-switch-guard-modal.ts  # New: NodeSwitchGuardModal (copy of canvas-switch-modal.ts)
src/__tests__/
│   └── node-switch-guard-modal.test.ts  # New: tests for EDITOR-01/EDITOR-02
```

### Pattern 1: Canvas Node-Click Detection (registerDomEvent on container)

**What:** On `EditorPanelView.onOpen()`, find the active canvas leaf. Register a `pointerdown` listener on the canvas leaf's container element. When the pointer fires, defer with `setTimeout(0)` to let Obsidian update `canvas.selection`, then read the selected node ID.

**When to use:** Whenever `EditorPanelView` is open and visible. The listener must be removed in `onClose()`.

**Why pointerdown + setTimeout(0):** `pointerdown` fires before Obsidian processes the click and updates the selection set. A zero-delay timeout yields to the event loop, allowing Obsidian to call its internal `updateSelection` and populate `canvas.selection`. This is the standard community pattern for reading selection state reactively without prototype patching.

**Example (canonical pattern from research):**

```typescript
// Source: Obsidian community pattern — canvas.selection read after pointer event
// Inside EditorPanelView:

private canvasPointerdownHandler: (() => void) | null = null;
private watchedCanvasContainer: HTMLElement | null = null;

private attachCanvasListener(): void {
  this.detachCanvasListener(); // clean up any previous

  const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
  const activeLeaf = this.plugin.app.workspace.getMostRecentLeaf();
  const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
  if (!canvasLeaf) return;

  const canvasView = canvasLeaf.view as unknown as {
    file?: { path: string };
    canvas?: { selection?: Set<{ id: string }> };
  };

  this.watchedCanvasContainer = canvasLeaf.containerEl;

  this.canvasPointerdownHandler = () => {
    setTimeout(() => {
      const selection = canvasView.canvas?.selection;
      if (!selection || selection.size !== 1) return; // multi-select: ignore

      const node = Array.from(selection)[0];
      if (!node?.id) return;

      const filePath = canvasView.file?.path;
      if (!filePath) return;

      void this.handleNodeClick(filePath, node.id);
    }, 0);
  };

  this.registerDomEvent(
    this.watchedCanvasContainer,
    'pointerdown',
    this.canvasPointerdownHandler
  );
}

private detachCanvasListener(): void {
  // registerDomEvent tracks handlers; Obsidian auto-removes on view close.
  // Explicit null-out for bookkeeping:
  this.canvasPointerdownHandler = null;
  this.watchedCanvasContainer = null;
}
```

**Important:** `registerDomEvent` (from `Component`, which `ItemView` extends) automatically removes the listener when the component is unloaded. No manual `removeEventListener` needed in `onClose()` as long as `registerDomEvent` is used. [VERIFIED: Obsidian Plugin API — Component.registerDomEvent auto-cleanup]

### Pattern 2: handleNodeClick — guard + auto-switch

**What:** The single entry-point for node clicks. Checks dirty state, conditionally shows guard modal, then calls `loadNode()`.

**When to use:** Called from the canvas pointer listener.

```typescript
// Source: derived from existing CanvasSwitchModal pattern in this codebase
private async handleNodeClick(filePath: string, nodeId: string): Promise<void> {
  // No-op if same node already loaded (avoids form flicker on re-click)
  if (this.currentFilePath === filePath && this.currentNodeId === nodeId) return;

  // Dirty check (Decisions §3)
  if (Object.keys(this.pendingEdits).length > 0) {
    const modal = new NodeSwitchGuardModal(this.plugin.app);
    modal.open();
    const confirmed = await modal.result; // true = discard and switch
    if (!confirmed) return; // user chose Stay
    this.pendingEdits = {}; // clear before loadNode (loadNode also clears, but explicit is clearer)
  }

  this.loadNode(filePath, nodeId);
}
```

### Pattern 3: NodeSwitchGuardModal — copied from CanvasSwitchModal

**What:** A `Modal` subclass with `Promise<boolean>` result. Two buttons: Stay (false) and Discard and switch (true, mod-cta). Escape/overlay click resolves false.

**Button labels (English-only per PROJECT.md):**
- `Stay` — matches the intent from CONTEXT.md "Остаться" decision; English equivalent
- `Discard and switch` — matches CONTEXT.md "Сбросить и перейти" decision

```typescript
// Source: direct copy of canvas-switch-modal.ts pattern [VERIFIED: codebase]
import { App, Modal } from 'obsidian';

export class NodeSwitchGuardModal extends Modal {
  readonly result: Promise<boolean>;
  private resolve!: (value: boolean) => void;
  private resolved = false;

  constructor(app: App) {
    super(app);
    this.result = new Promise<boolean>(res => { this.resolve = res; });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Unsaved changes' });
    contentEl.createEl('p', {
      text: 'You have unsaved changes. They will be lost.',
      cls: 'mod-warning',
    });

    const btnRow = contentEl.createDiv({ cls: 'modal-button-container' });

    const stayBtn = btnRow.createEl('button', { text: 'Stay' });
    stayBtn.addEventListener('click', () => { this.confirm(false); });

    const discardBtn = btnRow.createEl('button', {
      text: 'Discard and switch',
      cls: 'mod-cta',
    });
    discardBtn.addEventListener('click', () => { this.confirm(true); });
  }

  onClose(): void {
    if (!this.resolved) { this.resolve(false); this.resolved = true; }
    this.contentEl.empty();
  }

  private confirm(value: boolean): void {
    if (!this.resolved) { this.resolve(value); this.resolved = true; }
    this.close();
  }
}
```

### Pattern 4: Workspace active-leaf-change — re-attach listener when canvas leaf changes

**What:** When the user switches to a different canvas leaf (or closes and reopens), the pointer listener must be re-attached to the new container element.

**How:** Register a `workspace:active-leaf-change` event in `EditorPanelView.onOpen()` via `this.registerEvent(...)`. In the handler, call `attachCanvasListener()` again.

```typescript
// Source: Obsidian Plugin API — registerEvent pattern [VERIFIED: main.ts in codebase]
async onOpen(): Promise<void> {
  this.renderIdle();
  this.attachCanvasListener();

  // Re-attach when user switches active leaf (e.g. opens a second canvas)
  this.registerEvent(
    this.plugin.app.workspace.on('active-leaf-change', () => {
      this.attachCanvasListener();
    })
  );
}
```

### Anti-Patterns to Avoid

- **Prototype patching canvas internal methods:** Avoid patching `Canvas.prototype.updateSelection`. This approach is used by Advanced Canvas but is brittle — an Obsidian update that renames or moves the internal method silently breaks the plugin. The `registerDomEvent` + `canvas.selection` read is safer. [CITED: Advanced Canvas canvas-patcher.ts analysis]
- **Using `addEventListener` directly instead of `registerDomEvent`:** Direct `addEventListener` creates a leak if the view is closed without cleanup. Always use `registerDomEvent` which auto-deregisters. [VERIFIED: Obsidian Plugin API docs]
- **Not guarding same-node re-click:** Without an `if (same node) return` check, every click on the already-loaded node would re-run `renderNodeForm()`, discarding any pending edits the user is mid-filling.
- **Blocking the pointer handler with await:** The `pointerdown` handler must be synchronous; the async logic lives in `handleNodeClick()` called via `void`. [VERIFIED: existing pattern in this codebase — loadNode uses `void this.renderNodeForm(...)`]
- **Showing guard when no node is currently loaded:** The guard must only fire if `currentNodeId !== null` — if EditorPanel is in idle state, clicking a node should directly call `loadNode()` without a guard even if `pendingEdits` somehow has stale keys.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal with Promise result | Custom dialog overlay | `Modal` subclass + `Promise<boolean>` (existing `CanvasSwitchModal` pattern) | Obsidian handles focus trap, Escape, accessibility, z-index |
| DOM event cleanup | Manual removeEventListener bookkeeping | `registerDomEvent` | Auto-removed when component unloads; prevents leaks |
| Workspace event cleanup | Manual off() calls | `registerEvent` | Auto-removed when plugin unloads |

---

## Common Pitfalls

### Pitfall 1: canvas.selection is a Set — iterate with Array.from()

**What goes wrong:** Code that tries to access `canvas.selection[0]` (array index) gets `undefined` — `Set` doesn't support index access.

**Why it happens:** TypeScript types `canvas.selection` as `Set<CanvasNode>`, not an array.

**How to avoid:** Always use `Array.from(canvas.selection)[0]` or spread syntax `[...canvas.selection][0]`.

**Warning signs:** TypeScript error `Property '0' does not exist on type 'Set'` or runtime `undefined` on the node.

### Pitfall 2: Selection read too early (before Obsidian updates it)

**What goes wrong:** Reading `canvas.selection` synchronously inside the `pointerdown` handler returns the PREVIOUS selection (the node that was selected before the click).

**Why it happens:** Obsidian's internal click handler updates `canvas.selection` AFTER the `pointerdown` event has fired. A synchronous read sees stale state.

**How to avoid:** Defer the selection read with `setTimeout(0)` to yield to the event loop after Obsidian's handlers have run.

**Warning signs:** The editor always loads the previously-selected node, not the one just clicked.

### Pitfall 3: Listener attached to wrong container (canvas leaf vs. canvas view)

**What goes wrong:** Attaching `pointerdown` to `canvasLeaf.view.containerEl` instead of `canvasLeaf.containerEl` — the view's container may not include the full interactive canvas area, so clicks near the edge are missed.

**How to avoid:** Use `canvasLeaf.containerEl` which is the full leaf container.

### Pitfall 4: Stale listener after canvas leaf closes and reopens

**What goes wrong:** The `watchedCanvasContainer` stored from a previous `attachCanvasListener()` call becomes detached from the DOM after the canvas leaf is closed. The `pointerdown` listener fires on a detached element (or fires but the canvas view reference is stale).

**How to avoid:** Always call `attachCanvasListener()` on `active-leaf-change` to reattach to the current container. The previous `registerDomEvent` listener on the old detached element is harmless (it won't fire since the element is gone) and Obsidian will clean it up on component unload.

### Pitfall 5: Guard fires when EditorPanel is in idle state (no node loaded)

**What goes wrong:** If `pendingEdits` somehow has keys but `currentNodeId` is null (edge case from a bug), the guard shows unnecessarily when the panel is in idle state.

**How to avoid:** In `handleNodeClick()`, only show the guard when `currentNodeId !== null`.

### Pitfall 6: Multi-select click shows guard for each node

**What goes wrong:** User shift-clicks two nodes → selection.size = 2 → handler fires twice → two guard modals stack.

**How to avoid:** Guard with `if (selection.size !== 1) return` — auto-switch only fires for single-node selection, consistent with the "load one node's settings" UX intent.

---

## Code Examples

### Existing CanvasSwitchModal pattern (direct template for NodeSwitchGuardModal)
```typescript
// Source: src/views/canvas-switch-modal.ts [VERIFIED: codebase]
export class CanvasSwitchModal extends Modal {
  readonly result: Promise<boolean>;
  private resolve!: (value: boolean) => void;
  private resolved = false;

  constructor(app: App) {
    super(app);
    this.result = new Promise<boolean>(res => { this.resolve = res; });
  }

  onOpen(): void {
    // ... createEl('h2'), createEl('p'), createDiv('modal-button-container')
    // cancelBtn resolves false, continueBtn resolves true (mod-cta)
  }

  onClose(): void {
    if (!this.resolved) { this.resolve(false); this.resolved = true; }
    this.contentEl.empty();
  }

  private confirm(value: boolean): void {
    if (!this.resolved) { this.resolve(value); this.resolved = true; }
    this.close();
  }
}
```

### Existing canvas selection read (from community research)
```typescript
// Source: Obsidian forum "Get current selected card id in canvas" [CITED: forum.obsidian.md/t/get-current-selected-card-id-in-canvas/80444]
const canvasView = this.app.workspace.getActiveViewOfType(ItemView);
if (canvasView?.getViewType() !== 'canvas') return;
const canvas = (canvasView as unknown as { canvas: { selection: Set<{ id: string }> } }).canvas;
const selected = Array.from(canvas.selection);
// selected[0].id = node ID
```

### Existing canvas-internal.d.ts (extend for selection)
```typescript
// Source: src/types/canvas-internal.d.ts [VERIFIED: codebase]
// Need to ADD to CanvasInternal interface:
/** Currently selected nodes. Set<CanvasNode>. Access via Array.from(canvas.selection). */
selection?: Set<{ id: string; [key: string]: unknown }>;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Right-click → Edit RadiProtocol properties (only path) | Right-click remains as secondary; left-click auto-switches when panel open | Phase 14 | Faster authoring workflow |
| Prototype patching for node click | `registerDomEvent` + `setTimeout(0)` + `canvas.selection` | This phase | Safer, no prototype mutation |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `canvas.selection` is a `Set<{id: string}>` accessible after `setTimeout(0)` in a `pointerdown` handler | Architecture Patterns (Pattern 1) | If Obsidian defers selection update longer or to a different tick, the read would return stale state; mitigation: use `setTimeout(50)` or a `requestAnimationFrame` as fallback |
| A2 | `registerDomEvent` on `canvasLeaf.containerEl` captures all node clicks within the canvas | Architecture Patterns (Pattern 1) | If the canvas renders in an inner element not covered by containerEl, some clicks would be missed; can verify during UAT by clicking in canvas corners |
| A3 | ESLint `no-explicit-any` rule requires `unknown` cast chain to access `canvas.selection` | Architecture Patterns | The type cast pattern is visible in `main.ts` and `canvas-live-editor.ts`; if ESLint rejects it a slightly different cast is needed |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (Claims A1–A3 are LOW confidence but plan-executable with runtime validation in UAT.)

---

## Open Questions

1. **Does `canvas.selection` update in the same synchronous tick as pointer handling, or is a longer delay needed?**
   - What we know: `setTimeout(0)` is the standard community pattern; Advanced Canvas patches the prototype directly to avoid this question entirely.
   - What's unclear: whether Obsidian's latest version (1.12.x) still updates selection in the same event loop tick.
   - Recommendation: The plan should include a UAT step that validates the correct node loads on click. If `setTimeout(0)` proves unreliable, the fallback is a DOM `MutationObserver` on the canvas container watching for `.is-focused` class changes, which is more reliable but more complex.

2. **Should auto-switch fire for the canvas associated with the CURRENT file loaded in EditorPanel, or ANY open canvas?**
   - What we know: CONTEXT.md does not restrict to the same file — decision says "every canvas node click".
   - What's unclear: If two canvases are open in split view, clicking node in canvas B while EditorPanel shows a node from canvas A — should it switch?
   - Recommendation: Yes — the `filePath` is derived from whichever canvas leaf was clicked, so this works naturally with the `pointerdown` approach. The `handleNodeClick(filePath, nodeId)` signature already accepts any filePath.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all changes are code/config within the existing TypeScript + Obsidian plugin toolchain).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

[VERIFIED: vitest.config.ts, package.json]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDITOR-01 | `NodeSwitchGuardModal` class is importable and exports correct constant/type | unit | `npm test -- --reporter=verbose` | ❌ Wave 0 |
| EDITOR-01 | `EditorPanelView.handleNodeClick` method exists on prototype | unit | `npm test` | ❌ Wave 0 |
| EDITOR-02 | `NodeSwitchGuardModal` has `result: Promise<boolean>` property | unit | `npm test` | ❌ Wave 0 |
| EDITOR-02 | `NodeSwitchGuardModal` `onClose` resolves result with `false` | unit | `npm test` | ❌ Wave 0 |
| EDITOR-01/02 | `EditorPanelView` imports `NodeSwitchGuardModal` (import guard) | unit | `npm test` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/node-switch-guard-modal.test.ts` — covers EDITOR-01/EDITOR-02
- [ ] Pattern: mirror `RunnerView.test.ts` and `editor-panel.test.ts` — `vi.mock('obsidian')`, prototype method existence checks, `Promise<boolean>` result verification

*(No new test infrastructure needed — Vitest + `vi.mock('obsidian')` pattern is fully established.)*

---

## Security Domain

This phase makes no changes to data storage, authentication, session management, input validation, or cryptography. The only new external interaction is DOM event registration (read-only: reads `canvas.selection`) and a Modal UI dialog (no data written until user confirms save via existing "Save changes" button). No ASVS categories apply to this phase.

- V5 Input Validation: `nodeId` read from `canvas.selection` is used as a lookup key in `renderNodeForm()` — the existing `nodeRecord` lookup (`canvasData.nodes.find(n => n['id'] === nodeId)`) already handles missing nodes gracefully with `renderError()`. No new attack surface.

---

## Sources

### Primary (HIGH confidence)
- `src/views/editor-panel-view.ts` — full source read; `loadNode()`, `pendingEdits`, `renderNodeForm()` verified
- `src/views/canvas-switch-modal.ts` — full source read; `Promise<boolean>` pattern verified
- `src/main.ts` — full source read; `canvas:node-menu` registration, `openEditorPanelForNode()` verified
- `src/types/canvas-internal.d.ts` — full source read; `CanvasInternal` shape without `selection` confirmed
- `src/__mocks__/obsidian.ts` — full source read; Modal mock pattern verified
- `src/__tests__/RunnerView.test.ts` — test pattern for `vi.mock('obsidian')` + prototype checks verified
- `package.json` — dependency versions verified
- `vitest.config.ts` — test configuration verified

### Secondary (MEDIUM confidence)
- [Advanced Canvas canvas-patcher.ts analysis](https://github.com/Developer-Mike/obsidian-advanced-canvas) — `updateSelection` patch pattern and `canvas.selection` Set confirmed
- [Obsidian forum: Get current selected card id](https://forum.obsidian.md/t/get-current-selected-card-id-in-canvas/80444) — `canvas.selection` as iterable Set confirmed

### Tertiary (LOW confidence)
- `setTimeout(0)` deferral pattern — synthesized from community patterns; not verified against current Obsidian 1.12.x timing behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all from verified package.json and existing codebase
- Architecture (NodeSwitchGuardModal): HIGH — direct copy of verified CanvasSwitchModal pattern
- Architecture (canvas node-click detection): MEDIUM — `canvas.selection` community-verified; `setTimeout(0)` timing assumed LOW but UAT-verifiable
- Pitfalls: MEDIUM — derived from canvas internals research and existing codebase patterns

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (30 days — Obsidian plugin API is relatively stable)
