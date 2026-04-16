# Phase 39: Quick-Create UI in Node Editor - Research

**Researched:** 2026-04-16
**Domain:** Obsidian plugin UI — DOM buttons in ItemView sidebar panel
**Confidence:** HIGH

## Summary

Phase 39 adds two "quick-create" buttons to the existing Node Editor panel (`EditorPanelView`). The buttons invoke the `CanvasNodeFactory.createNode()` service (delivered in Phase 38) and then auto-load the newly created node into the editor form via the existing `loadNode()` method.

The scope is narrow and well-defined: (1) render a toolbar with two accent buttons above the existing panel content, (2) wire click handlers that call the factory + loadNode, (3) handle the disabled/no-canvas state. All infrastructure (factory, live editor, auto-color, Notice messages) already exists.

**Primary recommendation:** Add a `renderToolbar()` method to `EditorPanelView` that is called from both `renderIdle()` and `renderForm()`. Each button resolves the active canvas path, calls `canvasNodeFactory.createNode()`, and on success calls `this.loadNode()` with the returned `nodeId`. CSS goes into `src/styles/editor-panel.css` as an append-only block.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CANVAS-02 | User can create a new question node from the node editor sidebar -- node appears on canvas adjacent to the selected node with auto-positioning | `CanvasNodeFactory.createNode(path, 'question', anchorId)` already handles positioning, color, and persistence. UI only needs a button + click handler. |
| CANVAS-03 | User can create a new answer node linked to the current question node from the node editor sidebar | Same factory call with `'answer'` kind. "Linked" means positioned adjacent (factory handles), not edge-connected (out of scope per REQUIREMENTS.md). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Quick-create buttons UI | Frontend (ItemView DOM) | -- | Pure DOM rendering in Obsidian sidebar panel |
| Node creation logic | Canvas service (`CanvasNodeFactory`) | -- | Already implemented in Phase 38 |
| Auto-load after creation | Frontend (EditorPanelView) | -- | Existing `loadNode()` method |
| Canvas path resolution | Frontend (workspace API) | -- | `app.workspace.getLeavesOfType('canvas')` |
| Disabled state handling | Frontend (DOM + Notice) | -- | Button disabled attr + existing Notice from factory |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | API target | `ItemView`, `Notice`, `setIcon`, `WorkspaceLeaf` | Plugin host framework [VERIFIED: package.json] |
| vitest | 4.1.2 | Unit tests | Already in use [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| esbuild | 0.28.0 | Build & CSS concat | After any TS/CSS change [VERIFIED: package.json] |

No new dependencies required.

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Create question/answer" button
  |
  v
EditorPanelView.onCreateClick(kind)
  |
  +---> resolve canvasPath from workspace leaves
  |       (app.workspace.getLeavesOfType('canvas'))
  |
  +---> factory.createNode(canvasPath, kind, anchorNodeId?)
  |       |
  |       +---> probe canvas leaf for createTextNode API
  |       +---> calculate position (anchor offset or origin)
  |       +---> canvas.createTextNode({ pos, text, size })
  |       +---> setData({ radiprotocol_nodeType, color })
  |       +---> canvas.requestSave()
  |       +---> return { nodeId, canvasNode } | null
  |
  +---> if result !== null:
          this.loadNode(canvasPath, result.nodeId)
            |
            +---> sets currentFilePath, currentNodeId
            +---> renderNodeForm() -> renderForm() with toolbar
```

### Recommended Project Structure

No new files needed. Changes are confined to:
```
src/
  views/
    editor-panel-view.ts   # Add renderToolbar() + modify renderIdle()/renderForm()
  styles/
    editor-panel.css       # Append Phase 39 CSS block
  __tests__/
    editor-panel-create.test.ts  # New test file for quick-create UI
```

### Pattern 1: Toolbar Rendering (renderToolbar)

**What:** A private method that creates the `.rp-editor-create-toolbar` div with two buttons, inserts it at the top of `contentEl` content (before idle or form), and wires click handlers.

**When to use:** Called from both `renderIdle()` and `renderForm()` -- the toolbar is always visible per UI-SPEC.

**Example:**
```typescript
// Source: UI-SPEC + existing setIcon pattern in codebase
private renderToolbar(container: HTMLElement): void {
  const toolbar = container.createDiv({ cls: 'rp-editor-create-toolbar' });

  const qBtn = toolbar.createEl('button', { cls: 'rp-create-question-btn' });
  const qIcon = qBtn.createSpan();
  setIcon(qIcon, 'help-circle');
  qBtn.appendText('Create question node');
  qBtn.addEventListener('click', () => this.onQuickCreate('question'));

  const aBtn = toolbar.createEl('button', { cls: 'rp-create-answer-btn' });
  const aIcon = aBtn.createSpan();
  setIcon(aIcon, 'message-square');
  aBtn.appendText('Create answer node');
  aBtn.addEventListener('click', () => this.onQuickCreate('answer'));
}
```

### Pattern 2: Canvas Path Resolution

**What:** Resolve the active canvas file path from workspace leaves. Reuse the same pattern already used in `attachCanvasListener()` and the context menu handler in `main.ts`.

**Example:**
```typescript
// Source: main.ts line 98-105 + editor-panel-view.ts line 54-57
private getActiveCanvasPath(): string | undefined {
  const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
  const activeLeaf = this.plugin.app.workspace.getMostRecentLeaf();
  const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
  if (!canvasLeaf) return undefined;
  return (canvasLeaf.view as { file?: { path: string } })?.file?.path;
}
```

### Pattern 3: Post-Creation Auto-Load

**What:** After `createNode()` returns a non-null result, call `this.loadNode(canvasPath, result.nodeId)` to render the new node's form immediately.

**Key insight:** `loadNode()` is already public and handles clearing pending edits, setting `currentFilePath`/`currentNodeId`, and calling `renderNodeForm()`. No additional work needed.

### Anti-Patterns to Avoid

- **Don't create edges programmatically:** The UI-SPEC says "linked" means spatially adjacent, not edge-connected. Edge creation is explicitly out of scope (CANVAS-F02 in REQUIREMENTS.md).
- **Don't disable buttons via CSS-only:** Use the HTML `disabled` attribute so the button is inaccessible to keyboard/screen readers, then style via `:disabled` pseudo-class.
- **Don't duplicate canvas resolution logic:** Extract to a shared method (`getActiveCanvasPath()`) rather than inlining in both click handlers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Node creation + positioning | Custom canvas JSON manipulation | `CanvasNodeFactory.createNode()` | Already handles API probing, positioning, color, persist |
| Icon rendering | Raw SVG strings | `setIcon(el, 'icon-name')` from obsidian | Consistent with theme, already used throughout codebase |
| Error notices | Custom modal/toast | `Notice` class (via factory) | Factory already shows appropriate notices on failure |
| Node form rendering | Custom form for new node | `this.loadNode()` | Existing method handles full form lifecycle |

## Common Pitfalls

### Pitfall 1: Toolbar Disappears on Form Re-render

**What goes wrong:** `renderNodeForm()` calls `contentEl.empty()` which destroys the toolbar.
**Why it happens:** The toolbar must persist across idle and form states, but both `renderIdle()` and `renderForm()` clear `contentEl`.
**How to avoid:** Render the toolbar INSIDE `renderIdle()` and `renderForm()` as the first child. Since both methods call `contentEl.empty()` at the start, the toolbar is rebuilt each time -- this is correct and matches the pattern used by the saved indicator.
**Warning signs:** Toolbar visible on load but gone after clicking a canvas node.

### Pitfall 2: Stale Anchor Node ID After Creation

**What goes wrong:** After creating a node and auto-loading it, `this.currentNodeId` updates to the NEW node. If the user immediately clicks "Create answer node", the anchor is now the just-created node, not the original question.
**Why it happens:** `loadNode()` sets `this.currentNodeId` to the new node's ID.
**How to avoid:** This is actually correct behavior per UI-SPEC: "If a node is currently loaded in the editor (currentNodeId is set), use it as the anchor for positioning." The new node becomes the anchor, which places subsequent nodes in a chain. Document this as intentional.

### Pitfall 3: Race Condition with Debounced Auto-Save

**What goes wrong:** User edits a field, then immediately clicks "Create question node" before the 800ms debounce fires. The pending edits are lost.
**Why it happens:** `loadNode()` clears `pendingEdits` and resets `currentFilePath`/`currentNodeId`.
**How to avoid:** Flush the debounce timer before calling `loadNode()`, exactly as `handleNodeClick()` does (lines 107-118 of editor-panel-view.ts). Copy or extract that flush pattern into `onQuickCreate()`.
**Warning signs:** Editing a field then quickly creating a node loses the edit.

### Pitfall 4: setIcon Returns Void -- Don't Chain

**What goes wrong:** `setIcon(el, name)` modifies `el` in-place and returns void. Attempting to chain or assign its return value causes bugs.
**How to avoid:** Create a span element first, then call `setIcon(span, 'icon-name')` as a standalone statement. [VERIFIED: codebase pattern in snippet-manager-view.ts lines 112, 121]

### Pitfall 5: Shared File Regression

**What goes wrong:** Editing `editor-panel-view.ts` to add toolbar logic accidentally deletes or modifies existing code.
**Why it happens:** The file is 739 lines with complex form rendering. Agents sometimes simplify or rewrite sections.
**How to avoid:** Per CLAUDE.md -- ONLY add or modify code relevant to Phase 39. Never delete existing functions or event listeners. The planner must include explicit verification that existing form functionality still works.

## Code Examples

### Quick-Create Click Handler
```typescript
// Source: derived from UI-SPEC interaction contract + existing patterns
private onQuickCreate(kind: 'question' | 'answer'): void {
  const canvasPath = this.getActiveCanvasPath();
  if (!canvasPath) {
    new Notice('Open a canvas first to create nodes.');
    return;
  }

  // Flush pending auto-save (Pitfall 3)
  if (this._debounceTimer !== null) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
    if (this.currentFilePath && this.currentNodeId) {
      const edits = { ...this.pendingEdits };
      void this.saveNodeEdits(this.currentFilePath, this.currentNodeId, edits);
    }
  }

  const result = this.plugin.canvasNodeFactory.createNode(
    canvasPath,
    kind,
    this.currentNodeId ?? undefined
  );

  if (result) {
    this.loadNode(canvasPath, result.nodeId);
  }
}
```

### CSS (append to editor-panel.css)
```css
/* Phase 39: Quick-Create toolbar */
/* Exact CSS from UI-SPEC -- see 39-UI-SPEC.md CSS Contract section */
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual JSON editing of .canvas | `CanvasNodeFactory` via internal API | Phase 38 (current milestone) | Safe programmatic node creation with runtime probing |
| Right-click -> Edit properties only | Quick-create buttons + right-click | Phase 39 (this phase) | Faster workflow for new node creation |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Lucide icons `help-circle` and `message-square` exist in Obsidian's bundled icon set | Architecture Patterns | Buttons would render without icons; fix by choosing different icon names |
| A2 | `createNode()` is synchronous (returns result immediately, not a Promise) | Code Examples | If async, click handler needs `await` and the method signature changes to `async` |

**A2 verification:** Confirmed synchronous -- `canvas-node-factory.ts` line 38-77 shows `createNode()` returns `CreateNodeResult | null` (not a Promise). [VERIFIED: source code]

A1 remains [ASSUMED] -- Lucide icon names from UI-SPEC. Low risk: if wrong, only icon display is affected; easily fixed by substituting valid names.

## Open Questions

1. **Should the "Create answer node" button be disabled when no question node is selected?**
   - What we know: UI-SPEC says both buttons are always enabled when canvas is open. The factory places at origin (0,0) if no anchor.
   - What's unclear: Is it useful to create an answer node not adjacent to a question? The UI-SPEC explicitly allows it.
   - Recommendation: Follow UI-SPEC as written -- both buttons enabled. The user can create answer nodes in any context.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | vitest implicit (package.json `"test": "vitest run"`) |
| Quick run command | `npx vitest run src/__tests__/editor-panel-create.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANVAS-02 | Click "Create question node" calls factory with 'question' kind and loads result | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -t "question"` | Wave 0 |
| CANVAS-03 | Click "Create answer node" calls factory with 'answer' kind and loads result | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -t "answer"` | Wave 0 |
| CANVAS-02 | Anchor node ID passed when a node is loaded in editor | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -t "anchor"` | Wave 0 |
| CANVAS-05 | Button click with no canvas shows Notice | unit | `npx vitest run src/__tests__/editor-panel-create.test.ts -t "no canvas"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/editor-panel-create.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/editor-panel-create.test.ts` -- covers CANVAS-02, CANVAS-03, disabled state
- Existing test infrastructure (vitest, obsidian mock) sufficient -- no new framework install needed

## Project Constraints (from CLAUDE.md)

1. **CSS append-only:** New CSS goes at the bottom of `src/styles/editor-panel.css` with `/* Phase 39: ... */` comment
2. **Never remove existing code:** Only add/modify code relevant to Phase 39 in shared files
3. **Build after CSS change:** `npm run build` must be run after any CSS modification
4. **No innerHTML:** Use DOM API and Obsidian helpers (`createDiv`, `createEl`, `setIcon`)
5. **No console.log:** Use `console.debug()` for dev logging only
6. **No require('fs'):** Use `app.vault.*` exclusively
7. **CSS file:** `src/styles/editor-panel.css` (existing file for editor panel features)
8. **Generated file:** `styles.css` in root is generated -- never edit directly

## Sources

### Primary (HIGH confidence)
- `src/views/editor-panel-view.ts` -- full source of target file (739 lines)
- `src/canvas/canvas-node-factory.ts` -- factory API, synchronous signature confirmed
- `src/types/canvas-internal.d.ts` -- internal canvas API types
- `39-UI-SPEC.md` -- UI design contract with exact CSS, copy, and interaction specs

### Secondary (MEDIUM confidence)
- `src/views/snippet-manager-view.ts` -- reference for `setIcon()` usage pattern
- `src/main.ts` -- plugin wiring, factory instantiation, canvas path resolution pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code
- Architecture: HIGH -- simple button + existing factory call, fully specified in UI-SPEC
- Pitfalls: HIGH -- identified from direct code reading of the 739-line target file

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable -- internal plugin, no external API changes expected)
