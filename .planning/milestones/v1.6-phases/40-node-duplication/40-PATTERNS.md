# Phase 40: Node Duplication - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 3 (modified)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/views/editor-panel-view.ts` | controller | request-response | `src/views/editor-panel-view.ts` (self — `onQuickCreate`) | exact |
| `src/styles/editor-panel.css` | config | n/a | `src/styles/editor-panel.css` (self — Phase 39 button styles) | exact |
| `src/__tests__/editor-panel-create.test.ts` | test | n/a | `src/__tests__/editor-panel-create.test.ts` (self — quick-create tests) | exact |

## Pattern Assignments

### `src/views/editor-panel-view.ts` — `onDuplicate()` method (controller, request-response)

**Analog:** `src/views/editor-panel-view.ts` lines 714-753 (`onQuickCreate`)

**Imports pattern** (lines 1-4):
```typescript
import { ItemView, WorkspaceLeaf, Setting, TFile, Notice, setIcon } from 'obsidian';
import type { RPNodeKind } from '../graph/graph-model';
import type RadiProtocolPlugin from '../main';
import { NODE_COLOR_MAP } from '../canvas/node-color-map';
```
No new imports needed. All types and utilities already imported.

**Debounce flush pattern** (lines 722-733):
```typescript
// Flush pending auto-save before switching (Pitfall 3 from RESEARCH.md)
if (this._debounceTimer !== null) {
  clearTimeout(this._debounceTimer);
  this._debounceTimer = null;
  if (this.currentFilePath && this.currentNodeId) {
    const editsSnapshot = { ...this.pendingEdits };
    try {
      await this.saveNodeEdits(this.currentFilePath, this.currentNodeId, editsSnapshot);
    } catch {
      // flush save failure does not block creation — silent
    }
  }
}
```
Copy this block verbatim into `onDuplicate()`.

**Factory call pattern** (lines 735-739):
```typescript
const result = this.plugin.canvasNodeFactory.createNode(
  canvasPath,
  kind,
  this.currentNodeId ?? undefined
);
```
In `onDuplicate()`, `kind` comes from source node's `radiprotocol_nodeType` and anchor is `this.currentNodeId`.

**In-memory load pattern** (lines 741-752):
```typescript
if (result) {
  this.currentFilePath = canvasPath;
  this.currentNodeId = result.nodeId;
  this.pendingEdits = {};
  const nodeRecord = result.canvasNode.getData();
  const currentKind = (nodeRecord['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
  this.renderForm(nodeRecord, currentKind);
}
```
In `onDuplicate()`, insert the property-copy step between factory call and form render.

**Canvas access pattern** (from `canvas-node-factory.ts` lines 83-105):
```typescript
// Access live canvas to read source node data
private getCanvasForPath(canvasPath: string): CanvasInternal | undefined {
  const leaf = this.plugin.app.workspace
    .getLeavesOfType('canvas')
    .find((l) => {
      const v = l.view as { file?: { path: string } };
      return v.file?.path === canvasPath;
    });
  if (!leaf) return undefined;
  return (leaf.view as unknown as { canvas?: CanvasInternal })?.canvas;
}
```
This replicates the factory's `getCanvasWithCreateAPI` pattern but without the Notice/createTextNode check (only reads, does not create).

---

### `src/views/editor-panel-view.ts` — `renderToolbar()` update (controller, request-response)

**Analog:** `src/views/editor-panel-view.ts` lines 755-769 (`renderToolbar`)

**Button creation pattern** (lines 758-768):
```typescript
const qBtn = toolbar.createEl('button', { cls: 'rp-create-question-btn' });
const qIcon = qBtn.createSpan();
setIcon(qIcon, 'help-circle');
qBtn.appendText('Create question node');
this.registerDomEvent(qBtn, 'click', () => { void this.onQuickCreate('question'); });
```
Duplicate button follows identical structure:
- `toolbar.createEl('button', { cls: 'rp-duplicate-btn' })`
- `setIcon(icon, 'copy')` for the copy icon
- `dupBtn.appendText('Duplicate node')`
- `this.registerDomEvent(dupBtn, 'click', () => { void this.onDuplicate(); })`
- Add `if (!this.currentNodeId) dupBtn.disabled = true;` for disabled state

---

### `src/styles/editor-panel.css` — duplicate button styles (config)

**Analog:** `src/styles/editor-panel.css` lines 59-90 (Phase 39 button styles)

**Button style pattern** (lines 59-90):
```css
.rp-create-question-btn,
.rp-create-answer-btn {
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

.rp-create-question-btn:hover,
.rp-create-answer-btn:hover {
  filter: brightness(1.1);
}

.rp-create-question-btn:active,
.rp-create-answer-btn:active {
  filter: brightness(0.95);
}

.rp-create-question-btn:disabled,
.rp-create-answer-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: none;
}
```
New `.rp-duplicate-btn` styles are identical. Append at the bottom with `/* Phase 40: ... */` comment per CLAUDE.md rules.

---

### `src/__tests__/editor-panel-create.test.ts` — duplication tests (test)

**Analog:** `src/__tests__/editor-panel-create.test.ts` lines 51-131 (quick-create tests)

**Test setup pattern** (lines 12-49):
```typescript
function makeCanvasLeaf(filePath: string) {
  return { view: { file: { path: filePath } } };
}

// mockPlugin with canvasNodeFactory.createNode mock
mockPlugin = {
  app: {
    vault: {},
    workspace: {
      getLeavesOfType: vi.fn().mockReturnValue([canvasLeaf]),
      getMostRecentLeaf: vi.fn().mockReturnValue(canvasLeaf),
    },
  },
  settings: {},
  canvasNodeFactory: {
    createNode: vi.fn().mockReturnValue(null),
  },
  canvasLiveEditor: {
    saveLive: vi.fn().mockResolvedValue(false),
  },
};
```
For duplication tests, extend `mockPlugin` with a canvas mock that has `nodes.get()` returning a mock node with `getData()`.

**Private method access pattern** (lines 51-56):
```typescript
await (view as unknown as { onQuickCreate(kind: string): Promise<void> }).onQuickCreate('question');

expect((mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode)
  .toHaveBeenCalledWith('test.canvas', 'question', undefined);
```
`onDuplicate()` is also private, so use the same `as unknown as` cast pattern.

**renderForm spy pattern** (lines 75-93):
```typescript
const mockNodeData = { id: 'new-node-1', radiprotocol_nodeType: 'question' };
const mockCanvasNode = { getData: vi.fn().mockReturnValue(mockNodeData) };

(mockPlugin.canvasNodeFactory as { createNode: ReturnType<typeof vi.fn> }).createNode
  .mockReturnValue({ nodeId: 'new-node-1', canvasNode: mockCanvasNode });

const renderFormSpy = vi.spyOn(
  view as unknown as { renderForm: (nodeRecord: Record<string, unknown>, kind: string | null) => void },
  'renderForm'
).mockImplementation(() => {});
```
For duplication, mock `getData()` on the source node to return `radiprotocol_*` properties and verify they appear in the `setData()` call on the new node.

---

## Shared Patterns

### Debounce Flush Before Node Operation
**Source:** `src/views/editor-panel-view.ts` lines 722-733
**Apply to:** `onDuplicate()` method
```typescript
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
```

### In-Memory Node Load (No Disk Read)
**Source:** `src/views/editor-panel-view.ts` lines 741-752
**Apply to:** `onDuplicate()` after property copy
```typescript
this.currentFilePath = canvasPath;
this.currentNodeId = result.nodeId;
this.pendingEdits = {};
const nodeRecord = result.canvasNode.getData();
const currentKind = (nodeRecord['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
this.renderForm(nodeRecord, currentKind);
```

### Canvas Node Factory Call
**Source:** `src/canvas/canvas-node-factory.ts` lines 38-77
**Apply to:** `onDuplicate()` — createNode(canvasPath, sourceKind, anchorId)
Factory handles: ID generation, position offset, type property, color, requestSave.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have exact analogs within the same codebase |

## Metadata

**Analog search scope:** `src/views/`, `src/canvas/`, `src/styles/`, `src/__tests__/`
**Files scanned:** 5
**Pattern extraction date:** 2026-04-16
