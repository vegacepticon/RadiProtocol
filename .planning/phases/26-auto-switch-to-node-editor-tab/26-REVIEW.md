---
phase: 26-auto-switch-to-node-editor-tab
reviewed: 2026-04-12T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/canvas/node-color-map.ts
  - src/main.ts
  - src/styles.css
  - src/views/editor-panel-view.ts
  - styles.css
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 26: Code Review Report

**Reviewed:** 2026-04-12
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files were reviewed covering the auto-switch-to-node-editor-tab feature (Phase 26): the canvas listener registration and tab-reveal logic in `editor-panel-view.ts`, the `ensureEditorPanelVisible` helper added to `main.ts`, the color-map data file, and both copies of the stylesheet.

The implementation is generally solid. The debounce-flush-before-navigate logic in `handleNodeClick` is correct, and the early-return guard in `attachCanvasListener` prevents listener accumulation on repeated `active-leaf-change` fires. Three warnings were found: an async race window in the type-dropdown color path, unsaved-edit loss when `activateEditorPanelView` is called directly (not via the canvas click path), and accumulated stale DOM listeners across canvas-leaf switches. Four info items cover debug artifacts, a misleading variable name, an unnecessary optional chain, and duplicated CSS rules in both stylesheet copies.

---

## Warnings

### WR-01: Color assignment not written back to `pendingEdits` — lost on subsequent debounced save

**File:** `src/views/editor-panel-view.ts:560-586`

**Issue:** `onTypeDropdownChange` sets `this.pendingEdits['radiprotocol_nodeType']` (line 561), then builds a **separate** `edits` snapshot and appends `color` only to that local copy (lines 569-575). The `color` key is never merged back into `this.pendingEdits`. When the immediate save completes asynchronously, any field change that arrives before it finishes will call `scheduleAutoSave`, which snapshots `pendingEdits` — getting `radiprotocol_nodeType` but **not** `color`. The debounced save then writes the type change without the palette colour, leaving the canvas node with an incorrect (or no) colour until the user reloads.

**Fix:** After building the `edits` snapshot with the color, also write the color back into `this.pendingEdits`:

```typescript
private onTypeDropdownChange(value: string): void {
  this.pendingEdits['radiprotocol_nodeType'] = value || undefined;
  if (this._debounceTimer !== null) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
  }
  if (this.currentFilePath && this.currentNodeId) {
    const selectedType = this.pendingEdits['radiprotocol_nodeType'] as string | undefined;
    if (selectedType && selectedType !== '') {
      const mappedColor = (NODE_COLOR_MAP as Record<string, string | undefined>)[selectedType];
      if (mappedColor !== undefined) {
        this.pendingEdits['color'] = mappedColor;  // <-- write back
      }
    } else if ('radiprotocol_nodeType' in this.pendingEdits) {
      this.pendingEdits['color'] = undefined;       // <-- write back
    }
    const edits = { ...this.pendingEdits };
    void this.saveNodeEdits(this.currentFilePath, this.currentNodeId, edits)
      .then(() => { this.showSavedIndicator(); })
      .catch(err => { console.error('[RadiProtocol] type-change save failed:', err); });
  }
}
```

---

### WR-02: `activateEditorPanelView` discards unsaved edits without flushing debounce

**File:** `src/main.ts:128-139`

**Issue:** `activateEditorPanelView` (called directly by the `open-node-editor` command and the context-menu path via `openEditorPanelForNode`) calls `workspace.detachLeavesOfType(EDITOR_PANEL_VIEW_TYPE)` on line 130, which destroys the existing view and its `_debounceTimer`. If a user had typed a field change (starting an 800 ms debounce) and then immediately invoked the command or right-clicked another node, the pending save is silently dropped. The canvas click path (`handleNodeClick`) flushes the debounce correctly before calling `activateEditorPanelView`, but the command path does not.

**Fix:** Add a flush step at the top of `activateEditorPanelView`:

```typescript
async activateEditorPanelView(): Promise<void> {
  const { workspace } = this.app;
  // Flush any pending auto-save before detaching the view
  const existingLeaves = workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
  const existingView = existingLeaves[0]?.view;
  if (existingView instanceof EditorPanelView) {
    await existingView.flushPendingSave();  // new public method — see below
  }
  workspace.detachLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
  // ... rest unchanged
}
```

`EditorPanelView` needs a public `flushPendingSave()` method that mirrors the flush block currently inlined in `handleNodeClick` (lines 107-118).

---

### WR-03: Stale DOM listeners accumulate across canvas-leaf switches

**File:** `src/views/editor-panel-view.ts:53-99`

**Issue:** Each call to `attachCanvasListener` registers a new DOM event listener via `registerDomEvent` on `canvasLeafInternal.containerEl`. The early-return guard at line 67 prevents re-registering on the *same* container, but when the user switches to a *different* canvas leaf, a new listener is registered on the new container while the old one remains registered on the old container (Obsidian's `registerDomEvent` ties cleanup to component unload, not to the individual call). If the user closes and reopens canvases several times within one session, multiple `click` handlers fire on each node click on the previously-watched container — each will attempt to load a node into the editor from stale view references.

**Fix:** Track the registered event reference and remove it before registering a new one. The simplest approach is to replace `registerDomEvent` with a manual `addEventListener`/`removeEventListener` pair guarded by the bookkeeping fields that already exist:

```typescript
// At top of attachCanvasListener, after the early-return guard:
if (this._prevContainerCleanup) {
  this._prevContainerCleanup();
  this._prevContainerCleanup = null;
}
// ...
const handler = this.canvasPointerdownHandler!;
this.watchedCanvasContainer.addEventListener('click', handler);
this._prevContainerCleanup = () =>
  this.watchedCanvasContainer?.removeEventListener('click', handler);
```

Alternatively, call `this.unregisterAllDomEvents()` before registering the new one if no other DOM events are registered by `onOpen`.

---

## Info

### IN-01: Debug `console.debug` calls left in production code

**File:** `src/main.ts:116`, `src/main.ts:121`

**Issue:** Two `console.debug` calls remain in `onload` and `onunload`. These are low-noise but pollute the browser console in production.

**Fix:** Remove both lines, or guard them behind a `this.settings.debugMode` flag if runtime diagnostics are needed.

---

### IN-02: Misleading variable name `canvasPointerdownHandler` — event registered as `'click'`

**File:** `src/views/editor-panel-view.ts:18`, `src/views/editor-panel-view.ts:94`

**Issue:** The private field is named `canvasPointerdownHandler` (line 18) and the internal comment at line 80 reads `this.canvasPointerdownHandler = () => {`, but the event is registered as `'click'` on line 95. This suggests the event type was changed from `pointerdown` to `click` at some point but the variable name was not updated.

**Fix:** Rename the field and all references to `canvasClickHandler` to match the actual event type.

---

### IN-03: Unnecessary optional chain on `removeClass` in `renderForm`

**File:** `src/views/editor-panel-view.ts:311`

**Issue:** `indicatorRow.removeClass?.('is-visible')` — `indicatorRow` is a freshly created `HTMLElement` via `createDiv`, so `removeClass` always exists. The optional chain `?.` implies the method might be absent, which it never is on `HTMLElement`.

**Fix:**
```typescript
indicatorRow.removeClass('is-visible');
```

---

### IN-04: Duplicated CSS rules for `.rp-snippet-preview-label` and `.rp-snippet-preview`

**File:** `styles.css:539-590`, `src/styles.css:539-590`

**Issue:** Both stylesheet files contain two full declarations of `.rp-snippet-preview-label` (lines 539-543 and 571-576) and `.rp-snippet-preview` (lines 545-557 and 578-590). The second declaration overrides the first in every property, making the first block entirely dead. The duplication exists identically in both `styles.css` and `src/styles.css`.

**Fix:** Remove the first (earlier) copy of each rule block — the second copy at lines 571-590 contains `margin-bottom` and `padding: var(--size-4-2)` additions that appear intentional. Specifically, delete lines 539-557 in both files:

```css
/* DELETE these duplicate blocks (lines 539-557 in both files): */
.rp-snippet-preview-label { ... }  /* first copy */
.rp-snippet-preview { ... }        /* first copy */
```

Keep the second copy (lines 571-590) which is more complete.

---

_Reviewed: 2026-04-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
