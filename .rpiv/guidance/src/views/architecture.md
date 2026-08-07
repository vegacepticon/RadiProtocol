# Views Layer Architecture

## Responsibility
Obsidian UI surface — Modal subclasses, ItemView panels, suggest modals, standalone DOM components, and the inline runner overlay (plain class). All Obsidian API coupling lives here. Views delegate all business logic to domain services and never contain domain logic themselves.

## Dependencies
- **All lower layers**: protocol, runner, runner/render, graph, snippets, library (`library-paths`, `LibraryService`), utils, constants, settings, i18n
- **obsidian**: `Modal`, `ItemView`, `SuggestModal`, `AbstractInputSuggest`, `App`, `Notice`, `setIcon`, `Menu`, `TFile`, `WorkspaceLeaf`, `EventRef`
- **main.ts**: type-only `import type RadiProtocolPlugin` (prevents circular deps) · **dagre**: auto-layout for `ProtocolEditorView` only

## Consumers
- **main.ts**: registers views/modals/commands on plugin load

## Module Structure
```
src/views/
├── confirm-modal.ts, node-picker-modal.ts, protocol-picker-modal.ts, insert-snippet-modal.ts, folder-suggest.ts  # Modals & pickers (Promise-based)
├── inline-runner-modal.ts, inline-runner-layout.ts     # Inline runner (non-Modal plain class) + layout math
├── protocol-editor-view.ts                             # Canvas editor (ItemView + dagre auto-layout)
├── snippet-editor-modal.ts, snippet-fill-in-modal.ts, snippet-chip-editor.ts, option-order-chip-editor.ts  # Editor modals + chip widgets
├── snippet-manager-view.ts, snippet-tree-picker.ts     # Snippet manager (ItemView + reusable picker)
├── library-view.ts, library-item-detail-modal.ts, library-install-progress-modal.ts  # Community library (ItemView + modals)
└── snippet-manager/tree-renderer.ts                    # Extracted DnD + inline-rename
```

## Promise-Based Modal Result (safeResolve Double-Guard)

```typescript
export class MyModal extends Modal {
  readonly result: Promise<MyResult>; private resolve!: (v: MyResult) => void; private resolved = false;
  constructor(app: App) { super(app); this.result = new Promise(r => { this.resolve = r; }); }
  onClose(): void { this.safeResolve({ saved: false }); this.contentEl.empty(); }
  private finish(value: MyResult): void { this.safeResolve(value); this.close(); /* re-enters onClose */ }
  private safeResolve(value: MyResult): void { if (!this.resolved) { this.resolved = true; this.resolve(value); } } // idempotent
}
// Caller: const m = new MyModal(app); m.open(); const r = await m.result;
// Result types are discriminated unions: { saved: true; data: T } | { saved: false }. Resolve intended result BEFORE close(); onClose resolves cancellation fallback (no-op if already resolved).
```

## Unsaved-Changes Guard (Overrides `close()`)

```typescript
private hasUnsavedChanges = false;  // every input mutation sets this true
close(): void {
  if (!this.resolved && this.hasUnsavedChanges) { void this.runUnsavedGuard(); return; } // intercept Esc/overlay
  super.close();
}
// runUnsavedGuard uses three-button ConfirmModal (Save/Discard/Cancel); Discard → safeResolve + super.close(), Cancel → keep open, failed Save → leave open
```

## Obsidian ItemView (Registered Events + Async-Generation Guard)

```typescript
async onOpen(): Promise<void> {
  this.registerEvent(this.app.vault.on('create', (f) => {
    if (this.shouldHandle(f.path)) this.scheduleRedraw();   // registerEvent (auto-cleanup), NOT bare on
  }));
}
private shouldHandle(path: string): boolean { return path === root || path.startsWith(root + '/'); } // slash boundary
private scheduleRedraw(): void {
  if (this.redrawTimer !== null) window.clearTimeout(this.redrawTimer);
  this.redrawTimer = window.setTimeout(async () => {
    this.redrawTimer = null; await this.rebuildModel(); this.renderTree(); // model first, one redraw
  }, 120);                                                  // coalesce rapid vault events
}
// Stale post-await work rejected via a generation counter + mounted flag (owns(generation)).
```

## State-Machine Render Dispatch + Tracked-Listener Cleanup

```typescript
// InlineRunnerModal dispatch — every status covered, compile error on new status:
switch (state.status) {
  case 'at-node': renderQuestionAtNode(textZone, actionZone, graph, state, host); break;
  // …
  default: { const _exhaustive: never = state; void _exhaustive; }
}

// Destroyable DOM components track every listener for cleanup:
type ListenerTuple = { el: EventTarget; type: string; handler: EventListener };
const listeners: ListenerTuple[] = [];
const on = (el, type, handler) => { el.addEventListener(type, handler); listeners.push({ el, type, handler }); };
return { destroy() { for (const l of listeners) l.el.removeEventListener(l.type, l.handler); listeners.length = 0; container.empty(); } };
// InlineRunnerModal is a plain class (NOT Modal) — manually tracks EventRef/observers/timers/children in close(), uses offref() for manual subscriptions.
```

## Async Persistence + I18N Injection

```typescript
this.loadGeneration++; const gen = this.loadGeneration; const path = this.currentPath; // stale-generation guard
const updated = await store.update(path, mutator);
if (this.currentPath !== path || this.loadGeneration !== gen) return; // don't apply stale completion
// I18N: Plugin views use this.plugin.i18n.t.bind(this.plugin.i18n); standalone modals accept t?: Translator defaulting to defaultT; user-authored content is NEVER wrapped in t().
// Services accessed off the plugin instance (this.plugin.libraryService, this.plugin.snippetService).
```

## Architectural Boundaries
- **Views never contain domain logic** — persistence through `SnippetService`, `ProtocolDocumentStore`, `LibraryService`, `rewriteProtocolSnippetRefs`; rendering through `renderMdTemplateSnippet`.
- **Type-only import from main.ts** — `import type RadiProtocolPlugin` prevents circular deps. **One cross-layer exception**: `runner/render/render-snippet-picker.ts` imports `SnippetTreePicker` from views — documented.
- **CSS namespaces** `rp-inline-runner-*` / `rp-protocol-editor-*` / `radi-snippet-*` / `rp-stp-*` / `radi-library-*`. **Safe DOM**: `textContent`/`createEl({text})` — never `innerHTML` for user/validation content; pair custom interactive elements with role/tabindex/aria-label + Enter/Space activation.
- **LibraryView guards**: install flow reads `isLibraryReadOnly`; installed-indicator lookups reuse pure `findInstalledRecordForPath`.

<important if="you are adding a new Modal dialog">
## Adding a Promise-Based Modal
1. Create `src/views/my-modal.ts`, extend `Modal`
2. Add `readonly result: Promise<ResultType>` + `safeResolve` double-guard + `resolved` flag
3. Define discriminated-union result type (`{ saved: true; data: T } | { saved: false }`)
4. `onOpen()`: build DOM; `onClose()`: `safeResolve(cancelResult)` + `contentEl.empty()`
5. If unsaved-changes guard needed, override `close()` + use three-button `ConfirmModal`
6. Wire in `main.ts` via command that `new MyModal(app, ...).open()`
</important>

<important if="you are adding a new ItemView sidebar panel">
## Adding a New ItemView
1. Define view type constant: `export const MY_VIEW_TYPE = 'radiprotocol-my-view'`
2. Extend `ItemView`, inject `RadiProtocolPlugin` via constructor
3. Implement `getViewType()`, `getDisplayText()` (localized), `getIcon()`
4. `onOpen()`: build shell, `rebuildModel()` then `renderTree()`
5. Vault watchers via `registerEvent()` + `shouldHandle()` slash-boundary prefix filter
6. `scheduleRedraw()` with 120ms debounce; guard stale post-await work with generation/mounted flags (clear timer in `onClose`)
7. Register in `main.ts` `onload()` via `addLeafView()` (get-or-create leaf + `setViewState` + `revealLeaf`), wire an `addCommand` (NFR-06: omit plugin-name prefix)
</important>

<important if="you are adding a standalone DOM component">
## Adding a Destroyable DOM Component
1. Accept container + state/services + callbacks + optional `t?: Translator`
2. Keep plugin/view state OUT of the component where possible
3. Empty the host when mounting; route every `addEventListener` through a tracking helper
4. Return a handle with `destroy()` (or symmetrical `mount()`/`unmount()`) — remove every tracked listener with the same target/type/handler tuple, clear timers, null DOM refs
5. Parent calls `destroy()` before remount and during modal/view close
</important>
