---
phase: 14
name: Node Editor Auto-Switch and Unsaved Guard
status: discussed
discussed: 2026-04-08
---

# Phase 14 Context — Node Editor Auto-Switch and Unsaved Guard

## Domain Boundary

Two self-contained behaviours added to `EditorPanelView`:

1. **Auto-switch** — when `EditorPanelView` is open, clicking any canvas node immediately calls `loadNode(filePath, nodeId)` without requiring the context menu. This replaces the existing "right-click → Edit RadiProtocol properties" flow as the primary path.
2. **Unsaved guard** — if `pendingEdits` is non-empty when the user clicks a different node, a Modal confirmation blocks the switch until the user explicitly chooses to discard or stay.

The phase boundary is FIXED. It does not include:
- Changing how the context menu item works (it stays as a secondary path)
- Auto-opening EditorPanelView if it is not already open
- Adding a "Save first" option to the guard prompt
- Smart dirty detection (value comparison)

---

## Canonical Refs

- `src/views/editor-panel-view.ts` — `EditorPanelView`: `loadNode()`, `pendingEdits`, `renderNodeForm()`, `renderIdle()`
- `src/main.ts` — `openEditorPanelForNode()`, `canvas:node-menu` registration pattern, `EDITOR_PANEL_VIEW_TYPE`
- `src/views/canvas-switch-modal.ts` — existing `Modal` subclass pattern with `Promise<boolean>` result to copy for the guard modal
- `src/types/canvas-internal.d.ts` — internal Canvas API shape; researcher needs to find the node-click/selection event

---

## Decisions

### 1. Auto-switch scope: ALL canvas nodes (including plain nodes)

**Decision:** Auto-switch fires for every canvas node click, regardless of whether the node has `radiprotocol_nodeType`. A newly created node with no RP properties will load the editor with type dropdown at "— unset —", allowing the user to assign a type immediately.

**Why:** Users create plain nodes first, then assign RP properties. Auto-loading them avoids the need to right-click just to start configuring.

**Consequence:** `loadNode()` receives the filePath and nodeId; `renderNodeForm()` already handles the "no `radiprotocol_nodeType`" case gracefully (shows the type dropdown as unset with no kind-specific fields).

---

### 2. Unsaved guard prompt: 2 buttons

**Decision:** When `pendingEdits` is non-empty and the user clicks a different node, show a Modal with:

```
h2: Перейти к другому узлу?
p:  Есть несохранённые изменения. Они будут потеряны.

[ Остаться ]   [ Сбросить и перейти ]
                ^^^^^^^^^^^^^^^^^^
                mod-cta (primary)
```

- **"Остаться"** — closes modal, does nothing; editor stays on current node, `pendingEdits` intact.
- **"Сбросить и перейти"** (mod-cta) — closes modal, resets `pendingEdits`, calls `loadNode()` for the new node.

**Pattern:** Copy the `CanvasSwitchModal` structure (`Promise<boolean>` result, `onClose` resolves false). Name the new class `NodeSwitchGuardModal`.

**No "Save first" option** — out of scope per SC. User can save manually before clicking away.

---

### 3. Dirty detection: simple — any `pendingEdits` key = dirty

**Decision:** `Object.keys(this.pendingEdits).length > 0` → show guard. No comparison with original values.

**Known trade-off:** If the user types something and then clears it, `pendingEdits` still has a key → false-positive guard dialog. Accepted: the user can click "Сбросить и перейти" without consequence. Precision is not worth the added complexity.

---

## Non-Decisions (Claude's Discretion)

- Which Obsidian workspace event to hook for node clicks (researcher task — `canvas:node-selection-changed`, observer pattern on canvas selection, or equivalent)
- Exact button label language (English vs Russian) — follow existing English-only UI convention (PROJECT.md: "English-only UI for v1")
- Whether to add a test for `NodeSwitchGuardModal` presence in the DOM — yes, follow `RunnerView.test.ts` pattern

---

## Deferred Ideas

*(none raised during discussion)*
