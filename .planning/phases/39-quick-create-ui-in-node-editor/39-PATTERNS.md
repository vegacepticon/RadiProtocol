# Phase 39: Quick-Create UI in Node Editor - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 3 (2 modified, 1 new)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/views/editor-panel-view.ts` | component | request-response | `src/views/snippet-manager-view.ts` (button toolbar pattern) | role-match |
| `src/styles/editor-panel.css` | config | N/A | `src/styles/editor-panel.css` (self — append) | exact |
| `src/__tests__/editor-panel-create.test.ts` | test | N/A | `src/__tests__/canvas-node-factory.test.ts` | role-match |

## Pattern Assignments

### `src/views/editor-panel-view.ts` (component, request-response) — MODIFY

**Analog:** `src/views/snippet-manager-view.ts` for toolbar button pattern; self for debounce flush pattern.

**Button + icon rendering pattern** (`snippet-manager-view.ts` lines 110-125):
```typescript
// Header strip with buttons — same setIcon + createSpan + createEl pattern
const header = contentEl.createDiv({ cls: 'radi-snippet-tree-header' });
const newBtn = header.createEl('button', { cls: 'mod-cta radi-snippet-tree-new-btn' });
const newIcon = newBtn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
setIcon(newIcon, 'plus');
newBtn.createSpan({ text: 'Новый' });
this.registerDomEvent(newBtn, 'click', () => {
  void this.openCreateModal(this.plugin.settings.snippetFolderPath);
});
```

**Debounce flush before navigation pattern** (`editor-panel-view.ts` lines 107-118):
```typescript
// D-02: Flush pending debounce before switching nodes
if (this._debounceTimer !== null) {
  clearTimeout(this._debounceTimer);
  this._debounceTimer = null;
  if (this.currentFilePath && this.currentNodeId) {
    const editsSnapshot = { ...this.pendingEdits };
    try {
      await this.saveNodeEdits(this.currentFilePath, this.currentNodeId, editsSnapshot);
    } catch {
      // flush save failure does not block navigation — silent
    }
  }
}
```

**Canvas path resolution pattern** (`editor-panel-view.ts` lines 54-57):
```typescript
const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
const activeLeaf = this.plugin.app.workspace.getMostRecentLeaf();
const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
if (!canvasLeaf) return;
```

**Factory access pattern** (`src/main.ts` line 21, 41):
```typescript
// Factory is a public property on the plugin instance
canvasNodeFactory!: CanvasNodeFactory;
// ...
this.canvasNodeFactory = new CanvasNodeFactory(this.app);
```

**renderIdle insertion point** (`editor-panel-view.ts` lines 125-132):
```typescript
private renderIdle(): void {
  this.contentEl.empty();
  const container = this.contentEl.createDiv({ cls: 'rp-editor-idle' });
  container.createEl('p', { text: 'No node selected' });
  // ... toolbar must be inserted BEFORE the idle container
}
```

**renderForm insertion point** (`editor-panel-view.ts` lines 295-298):
```typescript
private renderForm(nodeRecord: Record<string, unknown>, currentKind: RPNodeKind | null): void {
  this.contentEl.empty();
  const panel = this.contentEl.createDiv({ cls: 'rp-editor-panel' });
  // ... toolbar must be inserted BEFORE `panel` or as first child of `panel`
}
```

**loadNode pattern** (`editor-panel-view.ts` lines 134-144):
```typescript
loadNode(canvasFilePath: string, nodeId: string): void {
  if (this._debounceTimer !== null) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
  }
  this.currentFilePath = canvasFilePath;
  this.currentNodeId = nodeId;
  this.pendingEdits = {};
  void this.renderNodeForm(canvasFilePath, nodeId);
}
```

---

### `src/styles/editor-panel.css` (config) — MODIFY (append-only)

**Analog:** Self — append at bottom per CLAUDE.md rules.

**Existing file ends at line 45.** New CSS block from UI-SPEC CSS Contract goes below with `/* Phase 39: ... */` comment.

**Exact CSS to append** (from `39-UI-SPEC.md` lines 180-223):
```css
/* Phase 39: Quick-Create toolbar */
.rp-editor-create-toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--size-4-1);           /* 8px */
  padding: var(--size-4-1) 0;    /* 8px vertical */
  margin-bottom: var(--size-4-1); /* 8px below toolbar */
  border-bottom: 1px solid var(--background-modifier-border);
  flex: 0 0 auto;
}

.rp-create-question-btn,
.rp-create-answer-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2-1);           /* 4px icon-to-text gap */
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

---

### `src/__tests__/editor-panel-create.test.ts` (test) — NEW

**Analog:** `src/__tests__/canvas-node-factory.test.ts` for mock structure and helper patterns; `src/__tests__/editor-panel.test.ts` for EditorPanelView instantiation.

**Mock obsidian module pattern** (`canvas-node-factory.test.ts` line 12):
```typescript
vi.mock('obsidian');
```

**EditorPanelView mock setup** (`editor-panel.test.ts` lines 11-32):
```typescript
let mockLeaf: { containerEl: Record<string, unknown> };
let mockPlugin: { app: { vault: object; workspace: object }; settings: object };
let view: EditorPanelView;

beforeEach(() => {
  mockLeaf = { containerEl: {} };
  mockPlugin = {
    app: {
      vault: {},
      workspace: { getLeavesOfType: vi.fn().mockReturnValue([]) },
    },
    settings: {},
  };
  view = new EditorPanelView(
    mockLeaf as unknown as import('obsidian').WorkspaceLeaf,
    mockPlugin as unknown as import('../main').default
  );
});
```

**Factory mock helper pattern** (`canvas-node-factory.test.ts` lines 15-27):
```typescript
function makeFakeCanvasNode(): CanvasNodeInternal {
  return {
    id: 'new-node-1',
    x: 0, y: 0, width: 250, height: 60, color: '',
    getData: vi.fn().mockReturnValue({}),
    setData: vi.fn(),
    setColor: vi.fn(),
  };
}
```

**Canvas leaf mock helper** (`canvas-node-factory.test.ts` lines 30-60):
```typescript
function makeCanvasLeaf(filePath: string, opts = {}) {
  const fakeNode = opts.fakeNode ?? makeFakeCanvasNode();
  const canvas: Record<string, unknown> = {
    getData: vi.fn().mockReturnValue({ nodes: [], edges: [] }),
    setData: vi.fn(),
    requestSave: vi.fn(),
    nodes: new Map(),
  };
  if (opts.hasCreateTextNode !== false) {
    canvas.createTextNode = vi.fn().mockReturnValue(fakeNode);
  }
  return { view: { file: { path: filePath }, canvas } };
}
```

**Test should verify:**
- `mockPlugin.canvasNodeFactory.createNode` is called with correct args (`canvasPath`, `'question'`/`'answer'`, `currentNodeId`)
- `loadNode` is called with the result nodeId on success
- `loadNode` is NOT called when factory returns null
- Debounce timer is flushed before creation (spy on `clearTimeout`)

---

## Shared Patterns

### setIcon Usage
**Source:** `src/views/snippet-manager-view.ts` lines 111-112
**Apply to:** `editor-panel-view.ts` toolbar buttons
```typescript
// Create span first, then call setIcon as standalone statement (returns void)
const iconSpan = button.createSpan();
setIcon(iconSpan, 'help-circle');
```

### Debounce Flush Before Navigation
**Source:** `src/views/editor-panel-view.ts` lines 107-118
**Apply to:** `onQuickCreate()` method — must flush pending auto-save before calling `loadNode()`
```typescript
if (this._debounceTimer !== null) {
  clearTimeout(this._debounceTimer);
  this._debounceTimer = null;
  if (this.currentFilePath && this.currentNodeId) {
    const editsSnapshot = { ...this.pendingEdits };
    try {
      await this.saveNodeEdits(this.currentFilePath, this.currentNodeId, editsSnapshot);
    } catch {
      // silent
    }
  }
}
```

### Canvas Path Resolution
**Source:** `src/views/editor-panel-view.ts` lines 54-57
**Apply to:** `getActiveCanvasPath()` helper method in `onQuickCreate()` flow
```typescript
const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
const activeLeaf = this.plugin.app.workspace.getMostRecentLeaf();
const canvasLeaf = canvasLeaves.find(l => l === activeLeaf) ?? canvasLeaves[0];
```

### Factory Synchronous Call Pattern
**Source:** `src/canvas/canvas-node-factory.ts` lines 38-77
**Apply to:** `onQuickCreate()` — no `await` needed, factory is synchronous
```typescript
const result = this.plugin.canvasNodeFactory.createNode(canvasPath, kind, anchorId);
if (result) {
  this.loadNode(canvasPath, result.nodeId);
}
```

## No Analog Found

No files lack analogs. All 3 files have strong existing patterns to follow.

## Metadata

**Analog search scope:** `src/views/`, `src/styles/`, `src/__tests__/`, `src/canvas/`, `src/main.ts`
**Files scanned:** 8 analog candidates read
**Pattern extraction date:** 2026-04-16
