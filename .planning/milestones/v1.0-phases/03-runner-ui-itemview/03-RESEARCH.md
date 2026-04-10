# Phase 3: Runner UI (ItemView) — Research

**Researched:** 2026-04-06
**Domain:** Obsidian ItemView DOM construction, command registration, SuggestModal, settings API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** RunnerView uses a vertical two-zone split: question/interaction zone fixed at the top, live preview zone scrollable at the bottom. CSS flex column with `flex: 0 0 auto` on top and `flex: 1 1 auto; overflow-y: auto` on bottom. Both zones scroll independently.
- **D-02:** The question zone scrolls independently if answer buttons overflow. Keeps the divider stable.
- **D-03:** Answer options render as a vertical list of full-width buttons — one button per line, full panel width, no truncation, no grid layout.
- **D-04:** Live preview zone is a `textarea` element (not contenteditable). `input` event calls `runner.setAccumulatedText(text)`. Accumulated text single source of truth in the runner.
- **D-05:** `setAccumulatedText()` replaces the buffer and clears the undo stack. Manual edits cannot be undone via "Step back".
- **D-06:** "Start from specific node" is a separate command `start-protocol-from-node` (not inside the panel). Opens a `SuggestModal` listing all `question` and `text-block` nodes by label. `runner.start(graph, nodeId)` called with the picked node.
- **D-07:** `ProtocolRunner.start()` needs an optional `startNodeId?: string` parameter. Existing callers are unaffected.
- **D-08:** A collapsible "Legend" section at the bottom of RunnerView (below preview zone), collapsed by default. Uses native `<details>/<summary>`. 7 node types, one row each: colour swatch + type name + one-line description.
- **D-09:** `getState()` stores `{ canvasFilePath: string | null }` only. `setState()` restores idle state with canvas preselected but does NOT resume session (Phase 7). No `sessionId` field yet.
- **D-10:** Settings tab controls: (1) `DropdownComponent` for output destination, (2) `TextComponent` for output folder path (shown/hidden by selection), (3) `SliderComponent` for max loop iterations (range 10–200, step 10).
- **D-11:** `main.ts` `onload()` updated to: register `RunnerView` via `registerView()`, update `run-protocol` command to call `activateRunnerView()`, add `start-protocol-from-node` command, update ribbon icon to open RunnerView.

### Claude's Discretion

- Exact CSS class names and visual styling (Obsidian theme variables preferred)
- Validation error panel layout (ordered list vs. card-per-error)
- Free-text input node UI (textarea height, placeholder text)
- Text-block auto-advance animation (if any)
- "Step back" button placement within the question zone
- Output button placement (toolbar at top or below preview zone)

### Deferred Ideas (OUT OF SCOPE)

- Session resume on workspace restore — Phase 7 (SessionService not yet built)
- Snippet fill-in modal integration — Phase 5 (show "Snippet support coming in a future update." placeholder)
- Context menu on canvas nodes to open RunnerView — Phase 4
- Progress indicator ("Question 3 of ~12") — Backlog
- Loop "again / done" prompt — Phase 6

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | `RunnerView` is an `ItemView` displayed in the right sidebar | §Architecture Patterns, `activateRunnerView()` snippet in ARCHITECTURE.md §11 |
| UI-02 | Live protocol preview always visible during a session; updates in real time after every answer | `textarea` in preview zone; updated on every `runner.chooseAnswer()` / `enterFreeText()` call |
| UI-03 | Render all node types: question + answer buttons, free-text input field, text-block auto-advance, loop "again/done" (Phase 6 deferred) | Render dispatcher switch on `node.kind`; loop nodes blocked in Phase 3 per runner stub |
| UI-04 | Validation errors displayed in plain language before session start | `GraphValidator.validate()` already implemented; inline panel in question zone |
| UI-05 | Copy-to-clipboard button | `navigator.clipboard.writeText()`; 1500 ms "Copied!" label feedback |
| UI-06 | Save-to-new-note button | `vault.create()` at configured `outputFolderPath`; `new Notice('Protocol saved to {path}')` |
| UI-07 | `getState()` / `setState()` storing `{ canvasFilePath }` only | D-09; workspace.json serialization; tested on Obsidian restart |
| UI-08 | All DOM construction via `createEl` / `createDiv` — no `innerHTML` | Enforced by ESLint `no-restricted-syntax`; confirmed by PITFALLS.md |
| UI-09 | All event listeners via `registerDomEvent()` | Memory leak prevention; Obsidian auto-cleans on `onClose()` |
| UI-10 | Settings tab: output destination dropdown | `Setting` + `DropdownComponent` in existing `RadiProtocolSettingsTab.display()` stub |
| UI-11 | Configurable output folder path | `TextComponent` shown/hidden based on D-10 dropdown |
| RUN-10 | Start from specific node command | `SuggestModal` + `start-protocol-from-node` command; `runner.start(graph, nodeId)` — requires D-07 extension |
| RUN-11 | Inline text editing in preview | `textarea` `input` event → `runner.setAccumulatedText()`; new method on `ProtocolRunner` |
| UI-12 | Node color legend in RunnerView | `<details>/<summary>` native collapse; 7 rows per D-08 |

</phase_requirements>

---

## Summary

Phase 3 is a **pure UI wiring phase** — the engine is fully implemented in Phase 2. `ProtocolRunner`, `RunnerState`, `GraphValidator`, and `CanvasParser` are all production-ready. This phase's work is exclusively: building the `RunnerView` DOM, connecting it to the engine, registering commands, and implementing the settings tab.

The most complex implementation challenge is the **render dispatcher**: the view must switch on `node.kind` after each runner state change and rebuild the question zone's DOM in-place. All other challenges are straightforward Obsidian API usage.

Two small Phase 2 extensions are needed: `ProtocolRunner.setAccumulatedText(text)` (D-04) and an optional `startNodeId` parameter on `start()` (D-07). Both are non-breaking additions with zero impact on existing tests.

**Primary recommendation:** Structure `RunnerView` around a private `render()` method that calls `runner.getState()` and fully rebuilds the question zone DOM. Reuse the same `textarea` for the preview zone (never rebuild it) to avoid losing cursor position during inline text edits.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Obsidian API | bundled with Obsidian | `ItemView`, `WorkspaceLeaf`, `Setting`, `Modal`, `SuggestModal`, `Notice`, `setIcon` | The only approved UI API for Obsidian plugins (NFR-02) |
| TypeScript | already in project | Type-safe DOM construction and runner state narrowing | Project already configured |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `navigator.clipboard` | browser built-in | Clipboard write for UI-05 | Supported in all Obsidian desktop versions; no polyfill needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<details>/<summary>` for legend | Custom JS collapse via `addEventListener` | `<details>` is natively accessible and zero JS; preferred for Phase 3 |
| `navigator.clipboard.writeText()` | Electron `clipboard.writeText()` | `navigator.clipboard` is the standard; Electron API requires additional import and is unnecessary |
| `textarea` for preview | `div[contenteditable]` | `textarea` is simpler, value-based, no XSS risk, satisfies RUN-11 natively |

**Installation:** No new packages required — all functionality is in the Obsidian API and browser builtins already available to the plugin.

---

## Architecture Patterns

### Recommended File Structure Changes (Phase 3)

```
src/
├── main.ts                    # MODIFIED: registerView, activateRunnerView(), two commands, ribbon
├── settings.ts                # MODIFIED: RadiProtocolSettingsTab.display() fully implemented
├── views/
│   └── runner-view.ts         # REPLACED: stub → full implementation
└── runner/
    └── protocol-runner.ts     # MODIFIED: add setAccumulatedText(), add startNodeId? to start()
```

### Pattern 1: ItemView Lifecycle

**What:** `RunnerView extends ItemView`. `onOpen()` builds the skeleton DOM once. `onClose()` empties `contentEl`. `getState()` / `setState()` handle workspace persistence.

**When to use:** Every Obsidian custom view follows this pattern.

**Implementation:**

```typescript
// Source: ARCHITECTURE.md §10, forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871
export class RunnerView extends ItemView {
  private plugin: RadiProtocolPlugin;
  private runner: ProtocolRunner | null = null;
  private graph: ProtocolGraph | null = null;
  private canvasFilePath: string | null = null;

  // DOM refs — built once in onOpen(), mutated in render()
  private questionZoneEl!: HTMLElement;
  private previewTextarea!: HTMLTextAreaElement;
  private copyBtn!: HTMLButtonElement;
  private saveBtn!: HTMLButtonElement;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return RUNNER_VIEW_TYPE; }
  getDisplayText(): string { return 'RadiProtocol runner'; }
  getIcon(): string { return 'activity'; }

  async onOpen(): Promise<void> {
    this.buildSkeleton();
    this.renderIdle();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  getState(): RunnerViewPersistedState {
    return { canvasFilePath: this.canvasFilePath };
  }

  async setState(state: RunnerViewPersistedState, result: ViewStateResult): Promise<void> {
    if (state.canvasFilePath) {
      this.canvasFilePath = state.canvasFilePath;
      // Phase 3: restore idle with canvas preselected — no session resume
      this.renderIdle();
    }
    return super.setState(state, result);
  }
}

interface RunnerViewPersistedState {
  canvasFilePath: string | null;
}
```

### Pattern 2: Opening the Right Sidebar View

**What:** The canonical `activateRunnerView()` pattern — detach existing leaves first, then set view state.

**When to use:** Any plugin command that opens a custom ItemView in the sidebar.

```typescript
// Source: ARCHITECTURE.md §1, verified forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871
async activateRunnerView(): Promise<void> {
  const { workspace } = this.app;
  workspace.detachLeavesOfType(RUNNER_VIEW_TYPE);
  const leaf = workspace.getRightLeaf(false);
  if (leaf) {
    await leaf.setViewState({ type: RUNNER_VIEW_TYPE, active: true });
    workspace.revealLeaf(workspace.getLeavesOfType(RUNNER_VIEW_TYPE)[0]);
  }
}
```

### Pattern 3: Render Dispatcher (State-Driven DOM Rebuild)

**What:** After every runner state change, call a central `render()` that empties `questionZoneEl` and rebuilds it based on `runner.getState()`. The preview `textarea` is NOT rebuilt — only its `.value` is updated.

**When to use:** Every answer selection, step-back, session open, session complete.

```typescript
// Source: project pattern derived from RunnerState discriminated union
private render(): void {
  if (!this.runner) { this.renderIdle(); return; }
  const state = this.runner.getState();
  this.questionZoneEl.empty();
  switch (state.status) {
    case 'idle':
      this.renderIdle();
      break;
    case 'at-node':
      this.previewTextarea.value = state.accumulatedText;
      this.renderAtNode(state);
      break;
    case 'complete':
      this.previewTextarea.value = state.finalText;
      this.renderComplete();
      break;
    case 'error':
      this.renderError(state.message);
      break;
    case 'awaiting-snippet-fill':
      // Phase 5 deferred: show placeholder message
      this.questionZoneEl.createEl('p', { text: 'Snippet support coming in a future update.' });
      break;
  }
}
```

### Pattern 4: SuggestModal for Node Picker (RUN-10)

**What:** `SuggestModal<T>` is the standard Obsidian fuzzy-search picker. Used for the "start from specific node" command.

**When to use:** Any command that presents a list of items for user selection with fuzzy search.

```typescript
// Source: ARCHITECTURE.md §11; Obsidian API SuggestModal
import { SuggestModal, App } from 'obsidian';

interface NodeOption {
  id: string;
  label: string;
  kind: 'question' | 'text-block';
}

class NodePickerModal extends SuggestModal<NodeOption> {
  private options: NodeOption[];
  private onChoose: (option: NodeOption) => void;

  constructor(app: App, options: NodeOption[], onChoose: (o: NodeOption) => void) {
    super(app);
    this.options = options;
    this.onChoose = onChoose;
  }

  getSuggestions(query: string): NodeOption[] {
    const q = query.toLowerCase();
    return this.options.filter(o => o.label.toLowerCase().includes(q));
  }

  renderSuggestion(option: NodeOption, el: HTMLElement): void {
    el.createEl('div', { text: option.label });
    el.createEl('small', { text: option.kind, cls: 'rp-node-kind-badge' });
  }

  onChooseSuggestion(option: NodeOption, _evt: MouseEvent | KeyboardEvent): void {
    this.onChoose(option);
  }
}
```

### Pattern 5: Settings Tab with Conditional Visibility

**What:** `Setting` + `DropdownComponent` controls the show/hide of the folder path `TextComponent`. Obsidian `Setting` API wraps all three controls.

**When to use:** Settings tab for any plugin with contextually-shown settings.

```typescript
// Source: UI-SPEC.md Settings Tab Contract; Obsidian Setting API
display(): void {
  const { containerEl } = this;
  containerEl.empty();

  new Setting(containerEl).setHeading().setName('RadiProtocol');

  let folderSetting: Setting;

  new Setting(containerEl)
    .setName('Output destination')
    .addDropdown(drop => {
      drop
        .addOption('clipboard', 'Clipboard only')
        .addOption('new-note', 'New note only')
        .addOption('both', 'Both')
        .setValue(this.plugin.settings.outputDestination)
        .onChange(async (value) => {
          this.plugin.settings.outputDestination = value as 'clipboard' | 'new-note' | 'both';
          await this.plugin.saveSettings();
          // Show/hide folder path based on selection
          folderSetting.settingEl.toggle(value !== 'clipboard');
        });
    });

  folderSetting = new Setting(containerEl)
    .setName('Output folder')
    .addText(text => {
      text.setPlaceholder('RadiProtocol Output')
        .setValue(this.plugin.settings.outputFolderPath)
        .onChange(async (value) => {
          this.plugin.settings.outputFolderPath = value;
          await this.plugin.saveSettings();
        });
    });
  // Show/hide on initial render
  folderSetting.settingEl.toggle(this.plugin.settings.outputDestination !== 'clipboard');

  new Setting(containerEl)
    .setName('Max loop iterations')
    .addSlider(slider => {
      slider.setLimits(10, 200, 10)
        .setValue(this.plugin.settings.maxLoopIterations)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxLoopIterations = value;
          await this.plugin.saveSettings();
        });
    });
}
```

### Pattern 6: Registering the View and Commands in main.ts

```typescript
// Source: ARCHITECTURE.md §1 and §11
import { RunnerView, RUNNER_VIEW_TYPE } from './views/runner-view';

// In onload():
this.registerView(RUNNER_VIEW_TYPE, (leaf) => new RunnerView(leaf, this));

this.addRibbonIcon('activity', 'RadiProtocol runner', () => {
  void this.activateRunnerView();
});

this.addCommand({
  id: 'run-protocol',
  name: 'Run protocol',
  callback: () => { void this.activateRunnerView(); },
});

this.addCommand({
  id: 'start-protocol-from-node',
  name: 'Start protocol from node',
  callback: () => { void this.openNodePickerCommand(); },
});
```

### Anti-Patterns to Avoid

- **Raw `addEventListener`:** Use `this.registerDomEvent(el, 'click', handler)` for every listener. Raw listeners on DOM elements created inside the view will leak if the view is closed and reopened.
- **Rebuilding the textarea on every render:** The preview `textarea` must persist across renders. Rebuilding it resets cursor position and loses focus during inline editing (RUN-11).
- **`innerHTML` for any DOM content:** Blocked by ESLint `no-restricted-syntax`. All text content must be set via `.textContent` or `createEl({ text: ... })`.
- **`workspace.activeLeaf`:** Deprecated. Use `workspace.getActiveViewOfType()` or `workspace.getMostRecentLeaf()`.
- **Floating promises in event handlers:** All async handlers must be wrapped: `this.registerDomEvent(btn, 'click', () => { void this.handleCopy(); })`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy search node picker | Custom filter/list component | `SuggestModal<T>` | Built-in keyboard navigation, fuzzy matching, consistent UX |
| Settings controls | `createEl('input')` directly | `Setting` + component classes (`DropdownComponent`, `TextComponent`, `SliderComponent`) | Required by `no-manual-html-headings` ESLint rule; consistent with Obsidian settings UX |
| Collapsible legend section | JS toggle with `addEventListener` | Native `<details>/<summary>` HTML | Zero JS, natively accessible, no memory leak risk |
| Clipboard write | Any manual Electron workaround | `navigator.clipboard.writeText()` | Standard browser API; available in all Obsidian desktop versions |
| Delay after copy feedback | `setInterval` manually | `setTimeout` wrapped in `window.setTimeout` (no `registerInterval` needed for one-shot) | `registerInterval` is for recurring intervals; one-shot `setTimeout` is fine and self-cleaning |

**Key insight:** This phase uses exclusively Obsidian built-in helpers. No third-party DOM library, no custom component system. The Setting API handles all settings controls; SuggestModal handles all picker UX.

---

## Common Pitfalls

### Pitfall 1: Textarea Cursor Lost on Re-Render

**What goes wrong:** If `previewTextarea` is destroyed and recreated on every `render()` call, the user's cursor position and selection are lost during inline text editing (RUN-11). The `input` event fires, `render()` runs, the textarea is rebuilt at `selectionStart: 0`.

**Why it happens:** The render dispatcher empties and rebuilds `questionZoneEl`, and if the textarea lives inside it (or is naively recreated), cursor state is discarded.

**How to avoid:** Build the `previewTextarea` once in `buildSkeleton()` inside the preview zone (not the question zone). `render()` only updates `previewTextarea.value`. Never destroy and recreate the textarea.

**Warning signs:** During inline edit, cursor jumps to the start of the text after each keystroke.

### Pitfall 2: `registerDomEvent` Scope Confusion on Dynamically Created Buttons

**What goes wrong:** Answer buttons are destroyed and recreated on every `render()` call. If `registerDomEvent()` is called for each button during render, the listener registrations accumulate on `this` (the Component) across renders and are never cleaned up until the view closes.

**Why it happens:** `registerDomEvent` registers on the Component instance. The DOM element is garbage collected when the question zone is emptied, but the Component's listener registry still holds a reference.

**How to avoid:** Use event delegation. Attach a single `registerDomEvent` on the stable `questionZoneEl` wrapper and identify which answer was clicked via `e.target.closest('[data-answer-id]')`. Alternatively, use `el.addEventListener` directly on ephemeral buttons — since the buttons are removed from the DOM on re-render, they are garbage collected and their listeners with them (no leak). The key rule is: `registerDomEvent` for stable elements (the zone wrappers, the textarea, the copy/save buttons), plain `el.onclick` for ephemeral per-render buttons.

**Warning signs:** Memory grows after many protocol steps; DevTools event listener inspector shows accumulating `click` handlers on the Component.

### Pitfall 3: getState / setState Not Called on Fresh Open

**What goes wrong:** `setState()` is only called by Obsidian on workspace restore (plugin reload, workspace switch). On a fresh "open view" triggered by a command, `setState()` is NOT called — the view starts fresh. Developers mistakenly initialize state inside `setState()` and then find the view blank on first open.

**Why it happens:** Confusion between "restoring from workspace.json" (setState path) and "first open via command" (onOpen path).

**How to avoid:** Initialize everything in `onOpen()` / `buildSkeleton()`. `setState()` only applies delta on top of the already-initialized view.

**Warning signs:** RunnerView shows correctly after an Obsidian restart but appears blank when opened for the first time via command.

### Pitfall 4: `noUncheckedIndexedAccess` and Map.get()

**What goes wrong:** The project has `noUncheckedIndexedAccess: true` in tsconfig. `Map.get(key)` returns `T | undefined`. Accessing `.questionText` on the result without narrowing is a type error.

**Why it happens:** TypeScript is more strict than usual about index access under this flag.

**How to avoid:** Always null-check `Map.get()` results before use:
```typescript
const node = this.graph?.nodes.get(state.currentNodeId);
if (node === undefined) return; // Guard before any property access
```

**Warning signs:** Build errors: "Object is possibly 'undefined'" on graph lookups.

### Pitfall 5: Output Button Visibility Logic Drift

**What goes wrong:** The "Copy to clipboard" and "Save to note" buttons' visibility depends on `plugin.settings.outputDestination`. If the user changes the setting while the view is open, the buttons do not update.

**Why it happens:** The view reads settings at render time but does not subscribe to setting changes.

**How to avoid:** Re-evaluate button visibility in `render()` every time it is called, not just on `onOpen()`. Since the setting can change at any time, always read `this.plugin.settings.outputDestination` dynamically in `render()`.

**Warning signs:** User changes output destination in settings, but the view still shows the old button set until Obsidian restarts.

### Pitfall 6: Forgetting `await` on `vault.create()` in Save-to-Note

**What goes wrong:** `vault.create()` is async. If not awaited, the `Notice` fires before the file is written, and if the plugin is disabled immediately after, the file may not be saved.

**Why it happens:** `vault.create()` returns a Promise; fire-and-forget silently discards errors.

**How to avoid:** Always `await vault.create(path, content)` inside a try/catch. Show the Notice after the await, not before.

**Warning signs:** "Protocol saved to X" notice appears but the file is not in the vault.

---

## Code Examples

Verified patterns from the project's own ARCHITECTURE.md and Obsidian API:

### Session Open Flow (the critical path)

```typescript
// Source: ARCHITECTURE.md §6 and §11; verified against Phase 2 ProtocolRunner API
async openCanvas(file: TFile): Promise<void> {
  const json = await this.plugin.app.vault.read(file);
  const parseResult = this.plugin.canvasParser.parse(json, file.path);
  if (!parseResult.success) {
    this.renderValidationErrors([parseResult.error]);
    return;
  }
  const graph = parseResult.graph;

  const validator = new GraphValidator();
  const validationResult = validator.validate(graph);
  if (!validationResult.valid) {
    this.renderValidationErrors(validationResult.errors);
    return;
  }

  this.graph = graph;
  this.canvasFilePath = file.path;
  this.runner = new ProtocolRunner({ maxIterations: this.plugin.settings.maxLoopIterations });
  this.runner.start(graph);
  this.render();
}
```

### Rendering Question Node

```typescript
// Source: project pattern; graph-model.ts QuestionNode + AnswerNode interfaces
private renderAtNode(state: AtNodeState): void {
  if (!this.graph || !this.runner) return;
  const node = this.graph.nodes.get(state.currentNodeId);
  if (node === undefined) return;

  switch (node.kind) {
    case 'question': {
      this.questionZoneEl.createEl('p', {
        text: node.questionText,
        cls: 'rp-question-text',
      });
      const answerList = this.questionZoneEl.createDiv({ cls: 'rp-answer-list' });
      // Answer buttons come from nodes adjacent to the question node
      const neighborIds = this.graph.adjacency.get(node.id) ?? [];
      for (const neighborId of neighborIds) {
        const neighbor = this.graph.nodes.get(neighborId);
        if (neighbor === undefined || neighbor.kind !== 'answer') continue;
        const btn = answerList.createEl('button', {
          text: neighbor.displayLabel ?? neighbor.answerText,
          cls: 'rp-answer-btn mod-quiet',
        });
        // Plain onclick is acceptable for ephemeral buttons (see Pitfall 2)
        btn.onclick = () => {
          this.runner?.chooseAnswer(neighborId);
          this.render();
        };
      }
      break;
    }
    case 'free-text-input': {
      this.questionZoneEl.createEl('p', { text: node.promptLabel, cls: 'rp-question-text' });
      const freeTextArea = this.questionZoneEl.createEl('textarea', {
        cls: 'rp-free-text-input',
        attr: { rows: '4', placeholder: 'Type your finding here...' },
      });
      const submitBtn = this.questionZoneEl.createEl('button', {
        text: 'Submit answer',
        cls: 'mod-cta',
      });
      submitBtn.onclick = () => {
        this.runner?.enterFreeText(freeTextArea.value);
        this.render();
      };
      break;
    }
    case 'text-block': {
      // Auto-advance: show briefly then advance immediately (0 ms per UI-SPEC)
      const indicator = this.questionZoneEl.createEl('p', {
        cls: 'rp-text-block-indicator',
        text: node.content,
      });
      void indicator; // suppress unused-variable warning
      // text-block is auto-advanced by runner already — if we reach at-node on a text-block,
      // something is wrong; this is a defensive fallback
      break;
    }
    case 'awaiting-snippet-fill': {
      this.questionZoneEl.createEl('p', { text: 'Snippet support coming in a future update.' });
      break;
    }
  }

  // Step-back button — always at bottom of question zone
  const stepBackBtn = this.questionZoneEl.createEl('button', {
    text: 'Step back',
    cls: 'rp-step-back-btn',
  });
  setIcon(stepBackBtn, 'undo-2');
  stepBackBtn.disabled = !state.canStepBack;
  stepBackBtn.onclick = () => {
    this.runner?.stepBack();
    this.render();
  };
}
```

### Copy to Clipboard with Feedback

```typescript
// Source: UI-SPEC.md Interaction Contract; navigator.clipboard is browser built-in
private async handleCopy(): Promise<void> {
  const text = this.previewTextarea.value;
  try {
    await navigator.clipboard.writeText(text);
    const original = this.copyBtn.textContent ?? 'Copy to clipboard';
    this.copyBtn.textContent = 'Copied!';
    window.setTimeout(() => {
      this.copyBtn.textContent = original;
    }, 1500);
  } catch {
    new Notice('Failed to copy to clipboard.');
  }
}
```

### Save to Note

```typescript
// Source: Obsidian Vault API; UI-SPEC.md Interaction Contract
private async handleSaveToNote(): Promise<void> {
  const text = this.previewTextarea.value;
  const folder = this.plugin.settings.outputFolderPath || 'RadiProtocol Output';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const notePath = `${folder}/${timestamp}-protocol.md`;
  try {
    await this.plugin.app.vault.create(notePath, text);
    new Notice(`Protocol saved to ${notePath}`);
  } catch (err) {
    new Notice('Failed to save note. Check the output folder setting.');
    console.error('[RadiProtocol] Save to note failed:', err);
  }
}
```

### ProtocolRunner Extensions Required (Phase 2 additions)

```typescript
// New method on ProtocolRunner — D-04, RUN-11
setAccumulatedText(text: string): void {
  this.accumulator.restoreTo(text);
  // Clear undo stack per D-05 — manual edits are not undoable via step-back
  this.undoStack = [];
}

// Modified start() signature — D-07, RUN-10
start(graph: ProtocolGraph, startNodeId?: string): void {
  this.graph = graph;
  this.currentNodeId = null;
  this.accumulator = new TextAccumulator();
  this.undoStack = [];
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
  this.runnerStatus = 'at-node';
  const entryNodeId = startNodeId ?? graph.startNodeId;
  this.advanceThrough(entryNodeId);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `workspace.activeLeaf` | `workspace.getActiveViewOfType()` / `getMostRecentLeaf()` | Obsidian 1.x deprecation | `activeLeaf` still works but triggers review warnings — never use it |
| Manual `addEventListener` | `registerDomEvent()` | Always the standard | Manual listeners leak on plugin disable/reload |
| `element.innerHTML = ...` | `createEl()` / `createDiv()` + `sanitizeHTMLToDom()` | Always forbidden in plugin review | Rejection criterion for community plugin submission |

**Deprecated/outdated:**
- `workspace.activeLeaf`: use `workspace.getActiveFile()` or `workspace.getActiveViewOfType()` instead.
- `contentEl.innerHTML`: blocked by ESLint rule `no-restricted-syntax` in this project.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `navigator.clipboard.writeText()` is available in all Obsidian desktop targets (minAppVersion 1.5.7) | Code Examples — Copy to Clipboard | May need fallback to `require('electron').clipboard`; low risk, clipboard API is standard in Chromium-based Electron since 2019 |
| A2 | `vault.create()` throws if the output folder does not exist — requires `ensureFolder()` call before `create()` | Code Examples — Save to Note | Silent failure or cryptic error; the `vault-utils.ts` `ensureFolder` helper is already in the codebase and should be called before `vault.create()` |
| A3 | Answer buttons for a question node come from its outgoing adjacency neighbors whose `kind === 'answer'` — the `adjacency` map lists them in insertion order from the canvas JSON | Code Examples — Rendering Question Node | If order is non-deterministic, button order may vary across sessions; acceptable for v1 |

---

## Open Questions (RESOLVED)

1. **ensureFolder before vault.create() in Save-to-Note** — RESOLVED: Plan 02 Task 2 `handleSave()` calls `vault.getAbstractFileByPath(folderPath)` and `vault.createFolder()` if null before `vault.create()`. `ensureFolder` from `vault-utils.ts` is used directly.

2. **Answer button order consistency** — RESOLVED: Accept current behavior for v1. Button order matches canvas edge insertion order. No action needed in Phase 3.

3. **`start-protocol-from-node` when RunnerView not open** — RESOLVED: Plan 04 shows `new Notice('Open a canvas protocol first.')` and returns early. Auto-opening RunnerView before the picker is not implemented; the notice is the accepted UX for v1. The command requires RunnerView to already be open with a canvas loaded.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is a code/config-only change with no external tool dependencies beyond the existing project toolchain (Node.js, npm, esbuild, Vitest, ESLint — all confirmed available in Phase 1/2).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npx vitest run src/__tests__/runner/` |
| Full suite command | `npx vitest run` |

### Phase 3 Requirements → Test Map

Phase 3's UI code (`RunnerView`) imports Obsidian API and cannot be unit-tested in the Vitest/Node.js environment (NFR-01 boundary: Obsidian API is not importable without mocking the entire Obsidian module). All Phase 3 testing is **manual** per the success criteria in the phase description.

The two Phase 2 engine extensions (D-04 `setAccumulatedText`, D-07 `startNodeId?`) are pure functions and ARE unit-testable.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-11 | `setAccumulatedText()` replaces buffer and clears undo stack | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts` | ✅ (extend existing test file) |
| RUN-10 | `start(graph, nodeId)` begins traversal from specified node | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts` | ✅ (extend existing test file) |
| UI-01 | RunnerView opens in right sidebar | manual | — | — |
| UI-02 | Preview updates after each answer | manual | — | — |
| UI-03 | All node types render correctly | manual | — | — |
| UI-04 | Validation errors shown before session start | manual | — | — |
| UI-05 | Copy to clipboard works | manual | — | — |
| UI-06 | Save to note creates file | manual | — | — |
| UI-07 | getState/setState survives Obsidian restart | manual | — | — |
| UI-08 | No innerHTML (ESLint) | automated lint | `npm run lint` | ✅ |
| UI-09 | registerDomEvent used for stable elements | code review | — | — |
| UI-10 | Settings tab dropdown renders | manual | — | — |
| UI-11 | Folder path shows/hides correctly | manual | — | — |
| UI-12 | Legend renders and collapses | manual | — | — |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/runner/protocol-runner.test.ts` (catches regressions in engine extensions)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green + all 6 manual success criteria confirmed before `/gsd-verify-work`

### Wave 0 Gaps

None for test infrastructure — existing `src/__tests__/runner/protocol-runner.test.ts` will be extended for the two engine extensions. No new test files needed for Wave 0.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — local plugin, no auth |
| V3 Session Management | no | No server sessions |
| V4 Access Control | no | Single-user local vault |
| V5 Input Validation | yes (limited) | Free-text input node: user types into a `textarea`; value is read via `.value` (never `innerHTML`) — no injection risk since text goes to `vault.create()` as a Markdown string and `navigator.clipboard.writeText()` |
| V6 Cryptography | no | No encryption |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Arbitrary file path in `outputFolderPath` setting | Tampering | `vault.create()` is scoped to the vault root — paths outside the vault are rejected by Obsidian Vault API; no additional check needed |
| XSS via node content displayed in UI | Tampering | All node content rendered via `createEl({ text: ... })` or `.textContent` — never `innerHTML`; blocked by ESLint rule |

---

## Sources

### Primary (HIGH confidence)

- `src/runner/protocol-runner.ts` — verified Phase 2 API: `start()`, `chooseAnswer()`, `enterFreeText()`, `stepBack()`, `completeSnippet()`, `getState()`
- `src/runner/runner-state.ts` — verified `AtNodeState`, `CompleteState`, `ErrorState`, `AwaitingSnippetFillState` fields
- `src/graph/graph-model.ts` — verified `QuestionNode.questionText`, `AnswerNode.displayLabel`, `FreeTextInputNode.promptLabel`, `TextBlockNode.content`
- `src/settings.ts` — verified `RadiProtocolSettings` fields and `DEFAULT_SETTINGS`
- `src/views/runner-view.ts` — confirmed stub; Phase 3 replaces it entirely
- `.planning/research/ARCHITECTURE.md` §1, §10, §11 — `activateRunnerView()`, `getState/setState`, command patterns
- `.planning/research/PITFALLS.md` — memory leak, innerHTML, deprecated activeLeaf patterns
- `.planning/phases/03-runner-ui-itemview/03-CONTEXT.md` — all decisions D-01 through D-11
- `.planning/phases/03-runner-ui-itemview/03-UI-SPEC.md` — CSS classes, copywriting, interaction contract, layout flex rules

### Secondary (MEDIUM confidence)

- `forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871` — `activateRunnerView()` canonical pattern (cited in ARCHITECTURE.md as VERIFIED)
- `forum.obsidian.md/t/confused-about-the-setviewstate-and-state-management-of-the-itemview-class/66798` — `getState/setState` lifecycle (cited in ARCHITECTURE.md as VERIFIED)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all APIs already used in Phase 1/2
- Architecture: HIGH — all patterns verified against existing codebase and ARCHITECTURE.md
- Pitfalls: HIGH — verified against PITFALLS.md which was researched in Phase 1

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (Obsidian API is stable; no expected changes in 30 days)
