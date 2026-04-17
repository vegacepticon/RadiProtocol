# Phase 40: Node Duplication - Research

**Researched:** 2026-04-16
**Domain:** Obsidian Canvas node duplication via internal API
**Confidence:** HIGH

## Summary

Phase 40 adds a "Duplicate node" button to the existing quick-create toolbar in the Node Editor panel. The implementation is straightforward because Phase 38 already built `CanvasNodeFactory` with `createNode()` and Phase 39 established the `onQuickCreate()` pattern for creating nodes and loading them into the editor. Duplication is a variation: instead of creating a blank typed node, we create a node of the same type and then copy all `radiprotocol_*` properties from the source node's live data.

The core challenge is property copying. The source node's `getData()` returns a flat record with all `radiprotocol_*` keys plus positional/structural keys (`id`, `x`, `y`, `width`, `height`, `type`). The duplication logic must copy only the `radiprotocol_*` properties (plus `text` and `color`) while letting the factory handle ID generation and positioning. Edges are explicitly NOT copied (DUP-02, also listed in Out of Scope in REQUIREMENTS.md).

**Primary recommendation:** Add an `onDuplicate()` method to `EditorPanelView` that reuses the existing `CanvasNodeFactory.createNode()` for node creation, then copies `radiprotocol_*` properties via `setData()` on the returned `canvasNode`. Append a "Duplicate node" button to the existing toolbar. No new services or files needed.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Duplicate button UI | Frontend (EditorPanelView) | -- | Button lives in the editor panel toolbar |
| Node creation on canvas | Frontend (CanvasNodeFactory) | -- | Uses live canvas internal API |
| Property copying | Frontend (EditorPanelView) | -- | Reads source getData(), writes to new node setData() |
| Persistence | Frontend (Canvas.requestSave) | -- | Canvas owns disk writes |

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DUP-01 | User can duplicate the selected canvas node -- copy preserves all `radiprotocol_*` properties, generates new ID, offsets position | Supported by CanvasNodeFactory.createNode() for ID+position, and canvasNode.setData() for property copying |
| DUP-02 | Duplicated node does NOT copy edges (user draws connections manually) | CanvasNodeFactory.createNode() creates an isolated text node with no edges by design -- no extra work needed |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Build: `npm run build` (esbuild), `npm test` (vitest)
- CSS: per-feature files in `src/styles/`, append-only with phase comments
- New CSS for this phase goes at the bottom of `src/styles/editor-panel.css` (duplicate button is part of editor panel toolbar)
- Never remove existing code in shared files (main.ts, editor-panel-view.ts)
- No `innerHTML` -- use DOM API and Obsidian helpers
- No `require('fs')` -- use `app.vault.*`
- `console.debug()` only, no `console.log` in production
- After CSS changes, run `npm run build` to regenerate `styles.css`

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Obsidian API | ^1.1.10 | Plugin framework, DOM helpers, Notice, setIcon | Required for Obsidian plugins [VERIFIED: existing codebase] |
| vitest | (existing) | Unit testing | Already configured in project [VERIFIED: package.json] |
| esbuild | (existing) | Build/bundle | Already configured in project [VERIFIED: esbuild.config.mjs] |

No new dependencies required. This phase uses only existing infrastructure.

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Duplicate node" button
        |
        v
EditorPanelView.onDuplicate()
        |
        +-- Flush pending auto-save (debounce timer)
        |
        +-- Read source node: canvas.nodes.get(currentNodeId).getData()
        |       Returns: { id, x, y, ..., radiprotocol_nodeType, radiprotocol_*, text, color }
        |
        +-- CanvasNodeFactory.createNode(canvasPath, sourceNodeType, currentNodeId)
        |       Returns: { nodeId: string, canvasNode: CanvasNodeInternal }
        |       New node positioned offset from source, has correct type + color
        |
        +-- Copy radiprotocol_* properties: newNode.setData({ ...newNode.getData(), ...rpProps })
        |       Filters: only keys starting with "radiprotocol_" plus "text"
        |       Excludes: id, x, y, width, height, type (positional/structural)
        |       Color already set by factory via NODE_COLOR_MAP
        |
        +-- canvas.requestSave()  (persist to disk)
        |
        +-- Load new node in editor: set currentNodeId, renderForm(nodeData, kind)
```

### Recommended Project Structure

No new files. Changes to existing files only:

```
src/
├── views/editor-panel-view.ts    # Add onDuplicate(), update renderToolbar()
├── styles/editor-panel.css       # Append .rp-duplicate-btn styles
└── __tests__/editor-panel-create.test.ts  # Add duplication tests
```

### Pattern 1: Property Copy with Prefix Filtering

**What:** Extract all `radiprotocol_*` keys from source node data, plus `text`, for copying to duplicate.
**When to use:** When duplicating a node and needing to preserve custom properties without copying structural fields.

```typescript
// Source: codebase analysis of existing getData() shape
function extractRadiProtocolProps(sourceData: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sourceData)) {
    if (key.startsWith('radiprotocol_') || key === 'text') {
      props[key] = value;
    }
  }
  return props;
}
```

[VERIFIED: codebase review of canvas-internal.d.ts and editor-panel-view.ts]

### Pattern 2: Reuse onQuickCreate Flow

**What:** The `onDuplicate()` method follows the exact same pattern as `onQuickCreate()` -- flush debounce, call factory, read in-memory data, render form.
**When to use:** This is the established pattern for creating nodes and loading them in the editor (Phase 39 race condition fix).

```typescript
// Source: existing onQuickCreate pattern in editor-panel-view.ts lines 714-753
private async onDuplicate(): Promise<void> {
  const canvasPath = this.getActiveCanvasPath();
  if (!canvasPath) { new Notice('Open a canvas first to create nodes.'); return; }

  // Flush pending auto-save (same pattern as onQuickCreate)
  // ... debounce flush ...

  // Get source node data from live canvas (bypass disk)
  const canvas = this.getCanvasForPath(canvasPath);
  if (!canvas) return;
  const sourceNode = canvas.nodes.get(this.currentNodeId!);
  if (!sourceNode) { new Notice('Source node not found on canvas.'); return; }
  const sourceData = sourceNode.getData();
  const sourceKind = sourceData['radiprotocol_nodeType'] as RPNodeKind;

  // Create new node via factory
  const result = this.plugin.canvasNodeFactory.createNode(canvasPath, sourceKind, this.currentNodeId!);
  if (!result) return;

  // Copy radiprotocol_* properties
  const rpProps = extractRadiProtocolProps(sourceData);
  const newData = result.canvasNode.getData();
  result.canvasNode.setData({ ...newData, ...rpProps });
  canvas.requestSave();

  // Load in editor (in-memory, no disk read)
  this.currentFilePath = canvasPath;
  this.currentNodeId = result.nodeId;
  this.pendingEdits = {};
  const finalData = result.canvasNode.getData();
  const finalKind = (finalData['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
  this.renderForm(finalData, finalKind);
}
```

[VERIFIED: pattern matches existing onQuickCreate in editor-panel-view.ts]

### Pattern 3: Canvas Access from EditorPanelView

**What:** The editor panel needs to access the live canvas object to read source node data. The factory already has `getCanvasWithCreateAPI()` but it's private.
**When to use:** When the editor panel needs to read live node data before calling the factory.

Two approaches:
1. **Make getCanvasWithCreateAPI public** -- simplest, but couples editor to factory internals
2. **Access canvas directly** -- the editor panel already accesses canvas via workspace.getLeavesOfType('canvas') in `attachCanvasListener()`. Reuse this pattern.

**Recommendation:** Access the canvas directly from `onDuplicate()` using the same leaf-finding pattern already in `getActiveCanvasPath()`. This avoids changing the factory's API surface.

```typescript
// Inline canvas access (no factory change needed)
private getCanvasForDuplication(canvasPath: string): CanvasInternal | undefined {
  const leaf = this.plugin.app.workspace
    .getLeavesOfType('canvas')
    .find(l => (l.view as { file?: { path: string } })?.file?.path === canvasPath);
  if (!leaf) return undefined;
  return (leaf.view as unknown as { canvas?: CanvasInternal })?.canvas;
}
```

[VERIFIED: matches existing pattern in canvas-node-factory.ts getCanvasWithCreateAPI]

### Anti-Patterns to Avoid

- **Reading from disk for source data:** `vault.read()` introduces a race condition because `requestSave()` from prior edits may not have flushed. Always use live `getData()` from `canvas.nodes.get()`. [VERIFIED: Phase 39 race condition fix]
- **Copying edges:** DUP-02 explicitly forbids this. `createNode()` creates an isolated node with no edges.
- **Copying structural fields:** Never copy `id`, `x`, `y`, `width`, `height`, `type` from source. The factory generates these correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node creation + positioning | Custom canvas JSON manipulation | `CanvasNodeFactory.createNode()` | Handles API probing, positioning, color, ID generation [VERIFIED: Phase 38] |
| Node type coloring | Manual color assignment | Factory already applies `NODE_COLOR_MAP[kind]` | Color consistency guaranteed [VERIFIED: canvas-node-factory.ts line 68-71] |
| Auto-save flush | Custom timer management | Reuse existing debounce flush pattern from `onQuickCreate()` | Battle-tested in Phase 39 [VERIFIED: editor-panel-view.ts line 722-732] |
| Editor panel loading | Custom form rendering | Reuse `renderForm()` with in-memory data | Avoids disk-read race condition [VERIFIED: Phase 39 fix] |

## Common Pitfalls

### Pitfall 1: Disk Read Race Condition
**What goes wrong:** Reading node data from `vault.read()` after `requestSave()` returns stale data because `requestSave()` is fire-and-forget async.
**Why it happens:** Canvas batches writes. The `.canvas` file may not reflect the latest state.
**How to avoid:** Always read from `canvas.nodes.get(id).getData()` for live data. This is the fix applied in Phase 39.
**Warning signs:** Duplicated node has default/empty properties instead of source properties.

### Pitfall 2: Double requestSave Call
**What goes wrong:** `CanvasNodeFactory.createNode()` already calls `canvas.requestSave()`. If `onDuplicate()` also calls `requestSave()` after `setData()`, that's fine -- `requestSave()` is debounced internally. But if someone removes the factory's call thinking the duplicate method handles it, properties won't persist.
**Why it happens:** Two different code paths both need to persist.
**How to avoid:** Call `requestSave()` after copying properties in `onDuplicate()`. The factory's call handles the initial creation; the duplicate's call handles the property copy. Both are necessary.
**Warning signs:** Duplicated node appears but loses `radiprotocol_*` properties on canvas reload.

### Pitfall 3: Forgetting the `text` Field
**What goes wrong:** Canvas nodes display their `text` field as visible content. If only `radiprotocol_*` keys are copied but `text` is skipped, the duplicated node appears blank on the canvas even though it has the right properties.
**Why it happens:** `text` doesn't start with `radiprotocol_` prefix.
**How to avoid:** Include `text` in the property copy filter alongside `radiprotocol_*` keys.
**Warning signs:** Duplicated node shows as empty card on canvas.

### Pitfall 4: Untyped Source Node
**What goes wrong:** If the user has a node loaded that has NO `radiprotocol_nodeType` (unmarked node), calling `createNode()` with `undefined` kind would fail or create a broken node.
**Why it happens:** Not all canvas nodes are RadiProtocol-typed.
**How to avoid:** Check that `sourceData['radiprotocol_nodeType']` exists before attempting duplication. If absent, show a Notice: "Select a RadiProtocol node to duplicate."
**Warning signs:** Error thrown or node created without type/color.

### Pitfall 5: Button Enabled State Not Syncing
**What goes wrong:** The duplicate button shows as enabled even when no node is loaded, or stays disabled after a node is selected.
**Why it happens:** The button's disabled state must be updated whenever `currentNodeId` changes (on node load, on idle, on creation).
**How to avoid:** The simplest approach: the button is always rendered. Since `onDuplicate()` checks `this.currentNodeId` at click time, a disabled visual state is nice-to-have but the guard clause is the safety net. The UI-SPEC says disabled when no node is selected -- implement this by checking `this.currentNodeId` in `renderToolbar()` and updating on each render.
**Warning signs:** User clicks duplicate on empty state, gets confusing error instead of disabled button.

## Code Examples

### Complete onDuplicate Implementation Pattern

```typescript
// Source: pattern derived from existing onQuickCreate (editor-panel-view.ts:714-753)
private async onDuplicate(): Promise<void> {
  if (!this.currentNodeId || !this.currentFilePath) {
    return; // No node loaded — button should be disabled, but guard anyway
  }

  const canvasPath = this.getActiveCanvasPath();
  if (!canvasPath) {
    new Notice('Open a canvas first to create nodes.');
    return;
  }

  // Flush pending auto-save (identical to onQuickCreate pattern)
  if (this._debounceTimer !== null) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
    if (this.currentFilePath && this.currentNodeId) {
      const editsSnapshot = { ...this.pendingEdits };
      try {
        await this.saveNodeEdits(this.currentFilePath, this.currentNodeId, editsSnapshot);
      } catch { /* flush failure non-blocking */ }
    }
  }

  // Read source node data from live canvas
  const canvas = this.getCanvasForDuplication(canvasPath);
  if (!canvas) return;
  const sourceNode = canvas.nodes.get(this.currentNodeId);
  if (!sourceNode) return;
  const sourceData = sourceNode.getData();

  const sourceKind = sourceData['radiprotocol_nodeType'] as RPNodeKind | undefined;
  if (!sourceKind) {
    new Notice('Select a RadiProtocol node to duplicate.');
    return;
  }

  // Create new node via factory (handles position offset, type, color)
  const result = this.plugin.canvasNodeFactory.createNode(
    canvasPath, sourceKind, this.currentNodeId
  );
  if (!result) return;

  // Copy radiprotocol_* properties + text from source to new node
  const rpProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sourceData)) {
    if (key.startsWith('radiprotocol_') || key === 'text') {
      rpProps[key] = value;
    }
  }
  const newData = result.canvasNode.getData();
  result.canvasNode.setData({ ...newData, ...rpProps });
  canvas.requestSave();

  // Load new node in editor (in-memory, no disk read)
  this.currentFilePath = canvasPath;
  this.currentNodeId = result.nodeId;
  this.pendingEdits = {};
  const finalData = result.canvasNode.getData();
  const finalKind = (finalData['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
  this.renderForm(finalData, finalKind);
}
```

### Toolbar Update Pattern

```typescript
// Source: existing renderToolbar in editor-panel-view.ts:755-769
// Add duplicate button after existing answer button
private renderToolbar(container: HTMLElement): void {
  const toolbar = container.createDiv({ cls: 'rp-editor-create-toolbar' });

  // ... existing question + answer buttons ...

  // Phase 40: Duplicate button
  const dupBtn = toolbar.createEl('button', { cls: 'rp-duplicate-btn' });
  const dupIcon = dupBtn.createSpan();
  setIcon(dupIcon, 'copy');
  dupBtn.appendText('Duplicate node');
  if (!this.currentNodeId) dupBtn.disabled = true;
  this.registerDomEvent(dupBtn, 'click', () => { void this.onDuplicate(); });
}
```

### CSS Addition

```css
/* Phase 40: Duplicate node button — appended to editor-panel.css */
.rp-duplicate-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2-1);
  padding: 6px 12px;
  border-radius: var(--radius-s);
  font-size: var(--font-ui-small);
  font-weight: var(--font-semibold);
  cursor: pointer;
  border: none;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  transition: filter 0.1s ease;
}

.rp-duplicate-btn:hover { filter: brightness(1.1); }
.rp-duplicate-btn:active { filter: brightness(0.95); }
.rp-duplicate-btn:disabled { opacity: 0.4; cursor: not-allowed; filter: none; }
```

[VERIFIED: matches UI-SPEC CSS contract exactly]

## Complete radiprotocol_* Property Inventory

All properties that may need copying during duplication, by node type:

| Node Type | radiprotocol_* Properties | Also Copy |
|-----------|--------------------------|-----------|
| start | `radiprotocol_nodeType` | -- |
| question | `radiprotocol_nodeType`, `radiprotocol_questionText` | `text` |
| answer | `radiprotocol_nodeType`, `radiprotocol_answerText`, `radiprotocol_displayLabel`, `radiprotocol_separator` | `text` |
| free-text-input | `radiprotocol_nodeType`, `radiprotocol_promptLabel`, `radiprotocol_prefix`, `radiprotocol_suffix`, `radiprotocol_separator` | `text` |
| text-block | `radiprotocol_nodeType`, `radiprotocol_content`, `radiprotocol_snippetId`, `radiprotocol_separator` | `text` |
| loop-start | `radiprotocol_nodeType`, `radiprotocol_loopLabel`, `radiprotocol_exitLabel`, `radiprotocol_maxIterations` | -- |
| loop-end | `radiprotocol_nodeType`, `radiprotocol_loopStartId` | -- |
| snippet | `radiprotocol_nodeType`, `radiprotocol_subfolderPath`, `radiprotocol_snippetLabel`, `radiprotocol_snippetSeparator` | `text` |

[VERIFIED: cross-referenced editor-panel-view.ts buildKindForm() and graph-model.ts]

**Key insight:** Using prefix filtering (`key.startsWith('radiprotocol_')`) is future-proof -- any new `radiprotocol_*` properties added in future phases will automatically be copied without code changes.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Strategy A (vault.modify) | Pattern B (live canvas API) | Phase 38 | Node creation uses createTextNode() on live canvas |
| Disk read after create | In-memory getData() | Phase 39 | Eliminates race condition with requestSave() |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `setData()` on a newly created node merges with existing data (spread operator) | Pattern 1 | If setData replaces entirely, we'd lose factory-set properties -- but factory also uses this pattern successfully |
| A2 | `loop-end` nodes with `radiprotocol_loopStartId` should be copied as-is (pointing to original loop-start) | Property Inventory | Duplicated loop-end would reference original loop-start, which may be incorrect -- but user is expected to edit after duplication |

**Note on A1:** The factory itself uses `canvasNode.setData({ ...nodeData, radiprotocol_nodeType: kind, color: ... })` at line 67-71 of canvas-node-factory.ts, confirming the spread-merge pattern works. Risk is LOW.

**Note on A2:** This is by design -- the user duplicates a node to modify it. Copying the original loopStartId is better than leaving it blank, as it gives the user a starting point.

## Open Questions

None. The implementation path is clear and all APIs are verified from existing codebase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | vitest via package.json |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DUP-01 | onDuplicate calls factory with source kind + anchor, copies radiprotocol_* props | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -x` | Extend existing |
| DUP-01 | Duplicate of each node type preserves all radiprotocol_* properties | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -x` | Extend existing |
| DUP-02 | No edge copying (implicit -- factory creates isolated node) | unit | `npx vitest run src/__tests__/canvas-node-factory.test.ts -x` | Already covered |
| DUP-01 | Untyped node shows Notice instead of duplicating | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -x` | Extend existing |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
None -- existing test infrastructure in `editor-panel-create.test.ts` covers the patterns. New tests are additions to the existing file.

## Security Domain

No security concerns for this phase. Node duplication is a local operation within the user's vault. No network calls, no authentication, no user input validation beyond what already exists. All data stays within the Obsidian vault.

## Sources

### Primary (HIGH confidence)
- `src/canvas/canvas-node-factory.ts` -- CanvasNodeFactory API, createNode() signature and behavior
- `src/views/editor-panel-view.ts` -- EditorPanelView, onQuickCreate pattern, renderToolbar, buildKindForm
- `src/types/canvas-internal.d.ts` -- CanvasNodeInternal.getData(), setData() API shape
- `src/graph/graph-model.ts` -- RPNodeKind type, all node interfaces and their properties
- `src/canvas/node-color-map.ts` -- NODE_COLOR_MAP confirming color is handled by factory
- `src/__tests__/editor-panel-create.test.ts` -- Existing test patterns for quick-create
- `src/__tests__/canvas-node-factory.test.ts` -- Factory test patterns and mock helpers
- `.planning/phases/40-node-duplication/40-UI-SPEC.md` -- UI contract for button placement, CSS, interaction flow

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing infrastructure
- Architecture: HIGH -- direct extension of Phase 39 pattern with one additional step (property copy)
- Pitfalls: HIGH -- all pitfalls derived from verified codebase patterns and Phase 39 lessons learned

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable -- internal APIs, no external dependencies)
