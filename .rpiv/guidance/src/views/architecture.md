# Views Layer

## Responsibility
UI surface — transforms domain objects (protocols, snippets, graphs) into interactive Obsidian components. Two `ItemView` panes, multiple `Modal`/`SuggestModal` dialogs, and reusable DOM widgets. No business logic — delegates to services in lower layers.

## Dependencies
- **All lower layers**: `runner/`, `snippets/`, `protocol/`, `graph/`, `utils/`, `constants/`, `i18n/`
- **obsidian**: `ItemView`, `Modal`, `SuggestModal`, `Notice`, `Menu`, `setIcon`
- **dagre**: DAG auto-layout in `protocol-editor-view.ts`

## Consumers
- `main.ts` — registers view types, wires commands
- `runner/render/render-snippet-picker.ts` — imports `SnippetTreePicker` (intentional exception)

## Module Structure
```
views/
├── protocol-editor-view.ts          # ItemView — graph editor (dagre layout)
├── snippet-manager-view.ts          # ItemView — snippet library tree
├── snippet-manager/tree-renderer.ts # Delegated tree renderer (DnD, rename)
├── inline-runner-modal.ts           # Floating DOM panel (NOT an Obsidian Modal — historic name)
├── inline-runner-layout.ts          # Position/drag/resize manager
├── snippet-editor-modal.ts          # Create/edit modal with unsaved-changes guard
├── confirm-modal.ts                 # Generic 2/3-button confirmation dialog
├── snippet-tree-picker.ts           # Reusable hierarchical file/folder picker
├── {snippet-chip-editor, snippet-fill-in-modal, ...}  # Specialized widgets
└── {library-browser-modal, node-picker-modal, ...}    # Feature modals
```

## Modal-as-Promise Pattern

```typescript
class MyModal extends Modal {
  readonly result: Promise<MyResult>;   // Caller awaits this
  private resolve!: (v: MyResult) => void;
  private resolved = false;
  private safeResolve(v: MyResult) {    // Double-guard against Esc + click race
    if (!this.resolved) { this.resolved = true; this.resolve(v); }
  }
  onClose() { this.safeResolve({ saved: false }); }  // Fallback
}
// Usage: const res = await new MyModal(app, plugin).open().result;
```

## ItemView Lifecycle

```typescript
class MyView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  async onOpen()    { this.contentEl.empty(); /* build + render */ }
  async onClose()   { /* null refs, no dangling closures */ }
  // registerDomEvent / registerEvent for auto-cleanup
}
```

## Architectural Boundaries
- **NO business logic**: Views delegate to services — they never access vault directly for snippet CRUD
- **View-last loading**: Views receive `RadiProtocolPlugin` via constructor, access services through `plugin.*`
- **NO direct access to view internals**: Sub-renderers communicate via typed callback interfaces
- **`InlineRunnerModal` naming**: Is a historical artifact — it is a floating DOM panel, not an Obsidian `Modal` subclass

<important if="you are adding a new modal">
## Adding a New Modal
1. Create `src/views/my-modal.ts` extending `Modal`
2. Define `Result` type + `readonly result: Promise<Result>`
3. Implement `safeResolve` double-guard
4. Build form DOM in `onOpen()`, clean up in `onClose()`
5. Override `close()` if unsaved-changes guard is needed
6. Wire into main plugin: add command and call `new MyModal(app, plugin, opts).open()`
</important>

<important if="you are adding a new ItemView pane">
## Adding a New View
1. Create `src/views/my-view.ts` extending `ItemView`
2. Define view type constant (`export const MY_VIEW_TYPE = 'radiprotocol-my-view'`)
3. Constructor accepts `leaf` + `plugin`, calls `super(leaf)`
4. Implement `getViewType()`, `getDisplayText()`, `getIcon()`
5. Build DOM shell in `onOpen()`, null refs in `onClose()`
6. Use `registerDomEvent`/`registerEvent` for auto-cleanup
7. Register in `main.ts` via `this.registerView(MY_VIEW_TYPE, ...)`
</important>

<important if="you are adding a new reusable UI component (chip editor, tree renderer, etc.)">
## Adding a Reusable UI Component
1. Create `src/views/my-component.ts` — export a `mount()` function
2. Return a handle with `destroy()` for cleanup
3. Track all event listeners via array for manual removal
4. Mutate draft in-place (caller owns state), call `onChange` callback
5. Accept `Translator` as optional param with `defaultT` fallback
6. Container-emptied on mount AND on destroy
</important>
