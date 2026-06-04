# Views Layer Architecture

## Responsibility
Obsidian UI surface — Modal subclasses, ItemView panels, suggest modals, standalone DOM components, and the inline runner overlay. All Obsidian API coupling lives here. Views delegate all business logic to domain services and never contain domain logic themselves.

## Dependencies
- **All lower layers**: protocol, runner, runner/render, graph, snippets, utils, constants, i18n
- **obsidian**: Modal, ItemView, SuggestModal, AbstractInputSuggest, App, Notice, setIcon, Menu, TFile, WorkspaceLeaf
- **main.ts**: Type-only import of `RadiProtocolPlugin` (prevents circular deps)
- **dagre**: Auto-layout algorithm for `ProtocolEditorView`

## Consumers
- **main.ts**: Registers views, modals, and commands on plugin load

## Module Structure
```
src/views/
├── confirm-modal.ts, node-picker-modal.ts, protocol-picker-modal.ts, insert-snippet-modal.ts, folder-suggest.ts
│                                    # Modals & pickers (Promise-based result pattern)
├── inline-runner-modal.ts, inline-runner-layout.ts     # Inline runner (non-Modal class)
├── protocol-editor-view.ts                             # Canvas editor (ItemView + dagre auto-layout)
├── snippet-editor-modal.ts, snippet-fill-in-modal.ts, snippet-chip-editor.ts
│                                    # Snippet editor modals + inline chip editor
├── snippet-manager-view.ts, snippet-tree-picker.ts     # Snippet manager (ItemView + picker)
└── snippet-manager/tree-renderer.ts                    # Extracted DnD + inline-rename (Phase 82)
```

## Promise-Based Modal Result (safeResolve Double-Guard)

```typescript
export class MyModal extends Modal {
  readonly result: Promise<MyResult>;
  private resolve!: (value: MyResult) => void;
  private resolved = false;

  constructor(app: App) {
    super(app);
    this.result = new Promise<MyResult>((res) => { this.resolve = res; });
  }

  onClose(): void { this.safeResolve({ saved: false }); }

  private finish(value: MyResult): void {
    this.safeResolve(value);
    this.close();  // triggers onClose, but safeResolve is idempotent
  }

  private safeResolve(value: MyResult): void {
    if (!this.resolved) { this.resolved = true; this.resolve(value); }
  }
}
// Caller: const modal = new MyModal(app); modal.open(); const result = await modal.result;
```

Result types are always discriminated unions: `{ saved: true; data: T } | { saved: false }`.

## Obsidian ItemView (Debounced Vault Watcher)

```typescript
async onOpen(): Promise<void> {
  this.registerEvent(this.app.vault.on('create', (file) => {
    if (this.shouldHandle(file.path)) this.scheduleRedraw();
  }));
}

private scheduleRedraw(): void {
  if (this.redrawTimer !== null) window.clearTimeout(this.redrawTimer);
  this.redrawTimer = window.setTimeout(async () => {
    this.redrawTimer = null;
    await this.rebuildModel();
    this.renderTree();
  }, 120);  // 120ms debounce — coalesce rapid vault events
}
```

Use `registerEvent` (not bare `on`) for auto-cleanup on view close.

## State-Machine Render Dispatch (InlineRunnerModal)

```typescript
switch (state.status) {
  case 'at-node':       renderQuestionAtNode(textZone, actionZone, graph, state, host); break;
  case 'awaiting-loop-pick': renderLoopPicker(textZone, actionZone, graph, state, host); break;
  // ... every status covered
  default: { const _exhaustive: never = state; void _exhaustive; }
}
```

Always uses `default: never` exhaustiveness check — compile error if a new status is unhandled.

## Tracked-Listener Cleanup (Destroyable DOM Components)

```typescript
type ListenerTuple = { el: EventTarget; type: string; handler: EventListener };
const listeners: ListenerTuple[] = [];

const on = (el, type, handler) => {
  el.addEventListener(type, handler);
  listeners.push({ el, type, handler });
};

return { destroy() {
  for (const l of listeners) l.el.removeEventListener(l.type, l.handler);
  listeners.length = 0; container.empty();
} };
```

## Mutation-Tracking Dirty State + Unsaved-Changes Guard

```typescript
// Every input mutation sets the flag
this.hasUnsavedChanges = true;

// close() interception prevents data loss
close(): void {
  if (!this.resolved && this.hasUnsavedChanges) {
    void this.runUnsavedGuard();  // ConfirmModal with Save/Discard/Cancel
    return;
  }
  super.close();
}
```

## I18N Injection Pattern

```typescript
// Plugin views: const t = this.plugin.i18n.t.bind(this.plugin.i18n);
// Standalone modals: constructor(app, ..., t?: Translator) { this.t = t ?? defaultT; }
// All user-visible strings use t('key.with.dots')
// User-authored content is NEVER wrapped in t()
```

## Architectural Boundaries
- **Views never contain domain logic** — all persistence through `SnippetService`, `ProtocolDocumentStore`, `rewriteProtocolSnippetRefs`
- **Type-only import from main.ts** — `import type RadiProtocolPlugin` prevents circular deps
- **One cross-layer exception**: `runner/render/render-snippet-picker.ts` imports `SnippetTreePicker` from views — documented
- **CSS namespaces**: `rp-inline-runner-*`, `rp-protocol-editor-*`, `radi-snippet-*`, `rp-stp-*`

<important if="you are adding a new Modal dialog">
## Adding a Promise-Based Modal
1. Create `src/views/my-modal.ts`, extend `Modal` from `obsidian`
2. Add `readonly result: Promise<ResultType>` with `safeResolve` double-guard
3. Define discriminated-union result type (`{ saved: true; data: T } | { saved: false }`)
4. Implement `onOpen()` with DOM building, `onClose()` with `safeResolve(cancelResult)` + `contentEl.empty()`
5. If unsaved-changes guard needed, override `close()` and use `ConfirmModal`
6. Wire in `main.ts` via command that `new MyModal(app, ...).open()`
</important>

<important if="you are adding a new ItemView sidebar panel">
## Adding a New ItemView
1. Define view type constant: `export const MY_VIEW_TYPE = 'radiprotocol-my-view'`
2. Extend `ItemView`, inject `RadiProtocolPlugin` via constructor
3. Implement `getViewType()`, `getDisplayText()`, `getIcon()`
4. In `onOpen()`: build header + content, `rebuildModel()` then `renderTree()`
5. Register vault watchers with `registerEvent()` + `shouldHandle()` prefix filter
6. Add `scheduleRedraw()` with 120ms debounce
7. In `onClose()`: clear debounce timer + `contentEl.empty()`
8. Register in `main.ts` `onload()` via `addLeafView()`
</important>