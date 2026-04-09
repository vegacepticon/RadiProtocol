# Phase 4: Canvas Node Editor Side Panel — Research

**Researched:** 2026-04-06
**Domain:** Obsidian Canvas runtime API, ItemView form patterns, canvas write-back safety, context menu integration
**Confidence:** MEDIUM (canvas runtime internals are undocumented; form patterns are HIGH; write-back safety strategy is MEDIUM; context menu event is MEDIUM)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-01 | `EditorPanelView` is an `ItemView` side panel that displays per-node configuration forms when a canvas node is selected | ItemView pattern is established from Phase 3; stub `editor-panel-view.ts` already exists and registers correctly |
| EDIT-02 | Forms expose all `radiprotocol_*` fields for each node kind using labeled input fields | Field schemas are fully derivable from `graph-model.ts` node types; `Setting` API used for labeled inputs |
| EDIT-03 | Node type selector allows changing a node's kind | A `DropdownComponent` over `RPNodeKind` values; saving re-writes `radiprotocol_nodeType` and adds/removes other fields |
| EDIT-04 | Write-back to `.canvas` JSON file requires canvas to be closed first OR uses undocumented internals with version guards | Two viable strategies researched and compared; decision required before plan execution |
| EDIT-05 | Context menu integration on canvas nodes to open the editor panel | `workspace.on('canvas:node-menu', ...)` event discovered and confirmed via community plugins — undocumented but stable in practice |

</phase_requirements>

---

## Summary

Phase 4 implements the `EditorPanelView` — a form-based side panel that allows a radiologist to configure any canvas node's `radiprotocol_*` properties without editing raw JSON. The phase has three independent concerns: (1) the ItemView form UI, (2) the write-back strategy for persisting edits to the `.canvas` file, and (3) context menu integration so the panel opens when the user right-clicks a canvas node.

The form UI is straightforward: Obsidian's `Setting` API with `TextComponent`, `DropdownComponent`, and `TextAreaComponent` is exactly the right tool, following the same pattern already used in `RadiProtocolSettingsTab`. The field schema is fully derivable from the existing `graph-model.ts` discriminated union. No new design decisions are needed here.

The write-back strategy is the central risk of this phase and the only open decision. Two strategies are viable: (A) require the canvas to be closed before editing — simple, safe, and zero risk of corruption; or (B) use the undocumented `canvas.setData()` + `canvas.requestSave()` API path while the canvas is open — seamless UX but fragile across Obsidian updates. A third option — writing directly via `vault.modify()` to the `.canvas` file while it is open — is explicitly forbidden; the Canvas view will silently overwrite changes. Strategy A is the recommended default; Strategy B is documented as an optional enhancement with required version guards.

Context menu integration uses `workspace.on('canvas:node-menu', (menu, node) => {...})`. This event is undocumented in the official Obsidian API but is confirmed by multiple community plugins (Enchanted Canvas, Advanced Canvas) and the forum discovery thread. The callback receives a `Menu` object and a canvas node object with `id`, `x`, `y`, `width`, `height`, and `color` properties, but the node object's TypeScript type requires a cast since it is not in the public API type definitions.

**Primary recommendation:** Implement Strategy A (require canvas closed) as the default. Detect whether the target canvas is open using `workspace.getLeavesOfType('canvas').some(leaf => leaf.view.file?.path === filePath)` and show a `Notice` if so. Wire EDIT-05 context menu using `workspace.on('canvas:node-menu', ...)` wrapped in `this.registerEvent()`.

---

## User Constraints

> No CONTEXT.md exists for Phase 4. The following constraints are drawn from REQUIREMENTS.md and STATE.md locked decisions.

### Locked Decisions (from REQUIREMENTS.md + STATE.md)

- `radiprotocol_*` property namespace — all custom canvas properties must use this prefix (PARSE-04, KEY DECISION)
- No `innerHTML` / `outerHTML` — all DOM via `createEl()` / Obsidian `Setting` API (UI-08, NFR constraint)
- No raw `addEventListener` — all listeners via `this.registerDomEvent()` or `this.registerEvent()` (UI-09)
- No `require('fs')` — all file I/O via `app.vault.*` (NFR-07)
- No `console.log` — use `console.debug()` / `console.warn()` / `console.error()` (NFR)
- No `any` types — `@typescript-eslint/no-explicit-any` enforced (NFR)
- Never call `vault.modify()` on a `.canvas` file while it is open in the Canvas view (CONSTRAINT, CRITICAL)
- `EditorPanelView` stub already exists at `src/views/editor-panel-view.ts` — extend, do not replace

### Open Assumption Requiring Decision (A4 / A5 from STATE.md)

**A4/A5:** Canvas write-back strategy — require canvas closed (simple, safe) vs. undocumented Canvas view internals with version guards (seamless, fragile). Both options are documented below. **The planner must choose one and document the decision before writing tasks.**

The STATE.md note says: "The recommended option for A4 is: require canvas closed — user must confirm this UX tradeoff."

Recommendation carried forward: **implement Strategy A (require canvas closed) as the primary path.**

### Claude's Discretion

- Panel layout: whether node type selector appears first or last in the form
- Empty/idle state message when no node is selected
- Whether "Save" is a button or auto-saves on field change
- Exact CSS class naming and visual styling (Obsidian theme variables preferred)
- Error display format for invalid field values
- Whether the panel auto-opens when a canvas node is right-clicked (via context menu) or must be manually opened first

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `obsidian` | 1.12.3 [VERIFIED: npm registry 2026-04-06] | `ItemView`, `Setting`, `Menu`, `Notice`, `TFile`, `WorkspaceLeaf` | Required plugin runtime |
| TypeScript | 5.8.x [VERIFIED: STACK.md] | Type-safe plugin code | Project standard |

### Supporting (no new packages needed)

Phase 4 introduces no new npm dependencies. All required APIs come from the `obsidian` package already installed.

| Feature | API | Source |
|---------|-----|--------|
| Side panel view | `ItemView` subclass | obsidian |
| Labeled form fields | `Setting` with `addText`, `addDropdown`, `addTextArea` | obsidian |
| Context menu extension | `workspace.on('canvas:node-menu', ...)` | obsidian (undocumented event) |
| Open canvas detection | `workspace.getLeavesOfType('canvas')` | obsidian |
| File read/write | `vault.read()` + `vault.modify()` | obsidian |
| User notification | `Notice` | obsidian |

**Version verification:**
```bash
npm view obsidian version
# 1.12.3 [VERIFIED: 2026-04-06]
```

No installation step needed — no new packages.

---

## Architecture Patterns

### Recommended File Structure (Phase 4 additions)

```
src/
├── views/
│   └── editor-panel-view.ts   # Replace stub — full implementation
├── main.ts                    # Add: register EditorPanelView, add context menu handler,
│                              #      add 'open-node-editor' command
```

No new files in `src/graph/` or `src/runner/` — Phase 4 is purely UI + write-back.

### Pattern 1: EditorPanelView as ItemView

`EditorPanelView` follows the identical lifecycle pattern as `RunnerView` from Phase 3:

```typescript
// Source: established pattern from Phase 3 runner-view.ts + ARCHITECTURE.md §1
export const EDITOR_PANEL_VIEW_TYPE = 'radiprotocol-editor-panel';

export class EditorPanelView extends ItemView {
  private plugin: RadiProtocolPlugin;
  private currentNodeId: string | null = null;
  private currentFilePath: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return EDITOR_PANEL_VIEW_TYPE; }
  getDisplayText(): string { return 'RadiProtocol node editor'; }
  getIcon(): string { return 'pencil'; }

  async onOpen(): Promise<void> {
    this.renderIdle();
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  // Called by context menu handler or command with node ID + canvas path
  loadNode(canvasFilePath: string, nodeId: string): void {
    this.currentFilePath = canvasFilePath;
    this.currentNodeId = nodeId;
    void this.renderNodeForm(canvasFilePath, nodeId);
  }
}
```

[CITED: Phase 3 runner-view.ts — established ItemView pattern for this project]
[CITED: .planning/research/ARCHITECTURE.md §1 — ItemView registration pattern]

### Pattern 2: Form Fields via Setting API

Use Obsidian's `Setting` API — the same API used in `RadiProtocolSettingsTab`. This is the correct approach for labeled form fields inside an ItemView.

```typescript
// Source: [CITED: established pattern from settings.ts in this project]
// Build form for a QuestionNode
private buildQuestionForm(container: HTMLElement, node: QuestionNode): void {
  new Setting(container)
    .setHeading()
    .setName('Question node');

  new Setting(container)
    .setName('Question text')
    .setDesc('Displayed to the user during the protocol session.')
    .addTextArea(ta => {
      ta.setValue(node.questionText)
        .onChange(value => {
          this.pendingEdits['radiprotocol_questionText'] = value;
        });
    });
}
```

**Key principle:** Collect edits in a `pendingEdits: Record<string, unknown>` object. Only write to disk when the user clicks "Save changes". This avoids partial writes and allows cancellation.

[ASSUMED: "Save" button rather than auto-save on change — simpler, safer for a phase with high write-safety requirements]

### Pattern 3: Node Type Selector (EDIT-03)

A `DropdownComponent` over all `RPNodeKind` values. Changing the kind clears incompatible fields and rebuilds the form section for the new kind.

```typescript
// Source: [CITED: established pattern from settings.ts in this project]
new Setting(container)
  .setName('Node type')
  .setDesc('The RadiProtocol role of this canvas node.')
  .addDropdown(drop => {
    drop
      .addOption('start', 'Start')
      .addOption('question', 'Question')
      .addOption('answer', 'Answer')
      .addOption('free-text-input', 'Free-text input')
      .addOption('text-block', 'Text block')
      .addOption('loop-start', 'Loop start')
      .addOption('loop-end', 'Loop end')
      .setValue(currentKind)
      .onChange(value => {
        this.pendingEdits['radiprotocol_nodeType'] = value;
        // Rebuild form section for new kind
        kindFormSection.empty();
        this.buildKindForm(kindFormSection, value as RPNodeKind);
      });
  });
```

### Pattern 4: Write-Back Strategy A — Require Canvas Closed (RECOMMENDED)

**What:** Before writing, check whether the `.canvas` file is currently open in any Canvas view leaf. If open, show a Notice and abort. If closed, read the file, patch the node's fields, and write back.

```typescript
// Source: [VERIFIED: community pattern confirmed via WebSearch + multiple plugin examples]
private isCanvasOpen(filePath: string): boolean {
  return this.plugin.app.workspace
    .getLeavesOfType('canvas')
    .some(leaf => {
      // leaf.view.file is a TFile on canvas leaves
      const view = leaf.view as { file?: { path: string } };
      return view.file?.path === filePath;
    });
}

async saveNodeEdits(filePath: string, nodeId: string, edits: Record<string, unknown>): Promise<void> {
  if (this.isCanvasOpen(filePath)) {
    new Notice('Close the canvas before editing node properties.');
    return;
  }

  const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) {
    new Notice('Canvas file not found.');
    return;
  }

  const raw = await this.plugin.app.vault.read(file);
  let canvasData: { nodes: Array<Record<string, unknown>>; edges: unknown[] };
  try {
    canvasData = JSON.parse(raw) as typeof canvasData;
  } catch {
    new Notice('Canvas file contains invalid JSON — cannot save.');
    return;
  }

  const nodeIndex = canvasData.nodes.findIndex(n => n['id'] === nodeId);
  if (nodeIndex === -1) {
    new Notice('Node not found in canvas file.');
    return;
  }

  // Patch only radiprotocol_* fields — never touch native canvas fields
  for (const [key, value] of Object.entries(edits)) {
    canvasData.nodes[nodeIndex]![key] = value;
  }

  await this.plugin.app.vault.modify(file, JSON.stringify(canvasData, null, 2));
  new Notice('Node properties saved.');
}
```

[VERIFIED: `getLeavesOfType('canvas')` pattern confirmed via WebSearch cross-referencing multiple community plugin implementations]
[CITED: .planning/research/PITFALLS.md — "Canvas File Overwrites Plugin Changes" pitfall]

### Pattern 5: Write-Back Strategy B — Undocumented Canvas Internals (OPTIONAL ENHANCEMENT)

**What:** Access the live canvas object via `getLeavesOfType('canvas')[0].view.canvas` and call `canvas.setData()` + `canvas.requestSave()`. This modifies the canvas in memory and persists it without requiring the user to close it.

**Caution:** This API is undocumented, confirmed only via community reverse-engineering, and can break on any Obsidian update without notice. Requires explicit version guards and try/catch.

```typescript
// Source: [CITED: github.com/Quorafind/Obsidian-Link-Nodes-In-Canvas — confirmed pattern]
// Source: [CITED: github.com/borolgs/enchanted-canvas — canvas.requestSave usage]
// WARNING: Undocumented API — must be wrapped in try/catch + version guard

private async saveViaCanvasInternals(
  filePath: string,
  nodeId: string,
  edits: Record<string, unknown>
): Promise<boolean> {
  // Version guard — required if choosing Strategy B
  // [ASSUMED: minimum version to check; adjust based on when canvas.setData was available]
  if (!requireApiVersion('1.5.7')) {
    return false; // Fall through to Strategy A
  }

  try {
    const canvasLeaves = this.plugin.app.workspace.getLeavesOfType('canvas');
    const targetLeaf = canvasLeaves.find(leaf => {
      const view = leaf.view as { file?: { path: string } };
      return view.file?.path === filePath;
    });

    if (!targetLeaf) return false; // Canvas not open — use Strategy A instead

    // These are undocumented internal properties — may break on any Obsidian update
    const canvasView = targetLeaf.view as unknown as {
      canvas?: {
        getData: () => { nodes: Array<Record<string, unknown>>; edges: unknown[] };
        setData: (data: unknown) => void;
        requestSave: () => void;
      };
    };

    const canvas = canvasView.canvas;
    if (!canvas?.getData || !canvas.setData || !canvas.requestSave) {
      console.warn('[RadiProtocol] Canvas internal API not available — falling back to Strategy A');
      return false;
    }

    const data = canvas.getData();
    const node = data.nodes.find(n => n['id'] === nodeId);
    if (!node) return false;

    for (const [key, value] of Object.entries(edits)) {
      node[key] = value;
    }

    canvas.setData(data);
    canvas.requestSave();
    return true;
  } catch (err) {
    console.warn('[RadiProtocol] Canvas internal API failed:', err);
    return false; // Caller falls back to Strategy A or shows error
  }
}
```

**Decision protocol:** If Strategy B is chosen, implement both: try Strategy B first; if it returns `false`, fall back to Strategy A. This provides the best UX when the API is available and safe fallback when it is not.

[VERIFIED: `canvas.setData()` + `canvas.requestSave()` confirmed via Quorafind/Obsidian-Link-Nodes-In-Canvas source code and enchanted-canvas README]
[CITED: forum.obsidian.md/t/any-details-on-the-canvas-api/57120 — confirmed undocumented]

### Pattern 6: Context Menu Integration (EDIT-05)

Use `workspace.on('canvas:node-menu', ...)` wrapped in `this.registerEvent()`. This fires when the user right-clicks a canvas node.

```typescript
// Source: [CITED: github.com/borolgs/enchanted-canvas — confirmed pattern]
// Source: [CITED: forum.obsidian.md/t/creating-an-event-for-menus-on-canvas-items/85646 — event name verified]
// NOTE: 'canvas:node-menu' is undocumented but confirmed working in multiple community plugins

// In main.ts onload() or EditorPanelView setup:
this.registerEvent(
  this.app.workspace.on('canvas:node-menu', (menu: Menu, node: unknown) => {
    // node is the internal canvas node object — id, x, y, width, height, color accessible
    const canvasNode = node as { id: string; canvas?: { view?: { file?: { path: string } } } };
    const nodeId = canvasNode.id;

    // Derive the canvas file path from the canvas leaf
    const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
    const activeLeaf = canvasLeaves.find(leaf =>
      leaf.view === (canvasNode.canvas as unknown as { view: unknown })?.view
    );
    const filePath = (activeLeaf?.view as { file?: { path: string } })?.file?.path;

    if (!filePath) return;

    menu.addSeparator();
    menu.addItem(item =>
      item
        .setTitle('Edit RadiProtocol properties')
        .setSection('radiprotocol')
        .onClick(() => {
          void this.openEditorPanelForNode(filePath, nodeId);
        })
    );
  })
);
```

**Typing challenge:** The canvas node object received in `canvas:node-menu` is not typed in `obsidian.d.ts`. Use `unknown` with a cast to access `id`. The TypeScript compiler will require explicit casts — do not use `any`; use typed intermediaries instead.

[VERIFIED: `canvas:node-menu` event confirmed via borolgs/enchanted-canvas source code]
[CITED: forum.obsidian.md/t/creating-an-event-for-menus-on-canvas-items/85646 — community discovery thread]

### Pattern 7: Opening EditorPanelView from main.ts

Follow the same `activateView()` pattern established for `RunnerView` in Phase 3:

```typescript
// Source: [CITED: Phase 3 main.ts activateRunnerView() — project-established pattern]
async activateEditorPanelView(): Promise<void> {
  const { workspace } = this.app;
  workspace.detachLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
  const leaf = workspace.getRightLeaf(false);
  if (leaf) {
    await leaf.setViewState({ type: EDITOR_PANEL_VIEW_TYPE, active: true });
    const activeLeaf = workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE)[0];
    if (activeLeaf !== undefined) {
      workspace.revealLeaf(activeLeaf);
    }
  }
}

async openEditorPanelForNode(filePath: string, nodeId: string): Promise<void> {
  await this.activateEditorPanelView();
  const leaves = this.app.workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
  const leaf = leaves[0];
  if (leaf === undefined) return;
  const view = leaf.view;
  if (view instanceof EditorPanelView) {
    view.loadNode(filePath, nodeId);
  }
}
```

### Anti-Patterns to Avoid

- **Never call `vault.modify()` on a canvas file while it is open in Canvas view.** The Canvas view will silently overwrite the change on its next auto-save. Always check `isCanvasOpen()` first. [VERIFIED: PITFALLS.md + multiple forum threads]
- **Never use `innerHTML` for form construction.** Use the `Setting` API and `createEl()` exclusively. [VERIFIED: eslint-plugin-obsidianmd enforces this]
- **Never store the canvas node JS object** (received from `canvas:node-menu`) beyond the event callback. The object is part of the Canvas view's live internal state and its lifetime is unpredictable.
- **Never modify native canvas fields** (`id`, `x`, `y`, `width`, `height`, `type`, `text`, `color`) when writing back. Only write `radiprotocol_*` fields. This preserves the round-trip invariant and keeps the canvas visually correct.
- **Never use `workspace.activeLeaf`** — deprecated. Use `getActiveViewOfType()` or `getLeavesOfType()`. [VERIFIED: PITFALLS.md]
- **Do not use raw `addEventListener()`** — use `this.registerDomEvent()` for DOM events, `this.registerEvent()` for workspace events. [VERIFIED: PITFALLS.md]

---

## Field Schema: radiprotocol_* Properties Per Node Kind

This is the definitive reference for form construction. Derived from `src/graph/canvas-parser.ts` and `src/graph/graph-model.ts`.

| Node Kind | Field Key | Type | Default | Required |
|-----------|-----------|------|---------|----------|
| `start` | (none beyond nodeType) | — | — | — |
| `question` | `radiprotocol_questionText` | string | `""` (or `node.text`) | yes |
| `answer` | `radiprotocol_answerText` | string | `""` (or `node.text`) | yes |
| `answer` | `radiprotocol_displayLabel` | string | `undefined` | no |
| `free-text-input` | `radiprotocol_promptLabel` | string | `""` (or `node.text`) | yes |
| `free-text-input` | `radiprotocol_prefix` | string | `undefined` | no |
| `free-text-input` | `radiprotocol_suffix` | string | `undefined` | no |
| `text-block` | `radiprotocol_content` | string | `""` (or `node.text`) | yes |
| `text-block` | `radiprotocol_snippetId` | string | `undefined` | no |
| `loop-start` | `radiprotocol_loopLabel` | string | `"Loop"` | yes |
| `loop-start` | `radiprotocol_exitLabel` | string | `"Done"` | yes |
| `loop-start` | `radiprotocol_maxIterations` | number | `50` | yes |
| `loop-end` | `radiprotocol_loopStartId` | string | `""` | yes (required, validated) |

[VERIFIED: derived from `src/graph/canvas-parser.ts` — parser source is ground truth for field names and defaults]

**Write-back note:** When saving, also write `radiprotocol_nodeType` to mark/unmark a node as a RadiProtocol node, and optionally sync the native `text` field with the primary human-readable content field (e.g., `radiprotocol_questionText` → `text`) so the canvas remains visually readable. The parser already reads from `text` as fallback, so this is cosmetic but valuable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Labeled form fields | Custom HTML form | `Setting` API with `.addText()`, `.addDropdown()`, `.addTextArea()` | Already used in `RadiProtocolSettingsTab`; consistent with Obsidian UX |
| Context menu items | Custom DOM popup | `workspace.on('canvas:node-menu')` + `menu.addItem()` | Platform-provided menu with correct positioning, keyboard nav, and theme |
| Open canvas detection | File-watcher or event system | `getLeavesOfType('canvas').some(...)` | O(n-leaves) synchronous check; no subscription overhead |
| File JSON patch | Custom JSON merge library | `JSON.parse` + field assignment + `JSON.stringify` | Canvas JSON is flat; no deep merge needed |

**Key insight:** Phase 4's complexity is almost entirely in the write-back strategy, not in the form construction. The form is a straightforward application of the `Setting` API against a known field schema. Resist the temptation to build a "reactive form framework" — the fields are static per node kind.

---

## Common Pitfalls

### Pitfall 1: Writing to an Open Canvas File
**What goes wrong:** `vault.modify()` called on a `.canvas` file currently open in the Canvas view. The user sees the edit appear briefly, then the Canvas view auto-saves its in-memory state and overwrites the change silently.
**Why it happens:** Canvas view has no external file-change detection. It does not refresh from disk when the file is modified externally.
**How to avoid:** Always call `isCanvasOpen(filePath)` before any write. If `true`, either prompt the user to close the canvas first (Strategy A), or use `canvas.setData()` + `canvas.requestSave()` via the undocumented API (Strategy B). Never call `vault.modify()` on an open canvas.
**Warning signs:** User reports that edits "disappear" after saving. This is the symptom of writing to an open canvas.

[VERIFIED: PITFALLS.md "Canvas File Overwrites Plugin Changes" — multiple forum confirmations]

### Pitfall 2: Corrupting the Canvas JSON on Write
**What goes wrong:** The write-back modifies the JSON incorrectly — missing a field, changing the structure, or serializing incorrectly — causing Obsidian's Canvas view to fail to open the file.
**Why it happens:** `JSON.stringify(canvasData, null, 2)` should be safe, but common mistakes include: accidentally converting `Map` to `{}`, serializing class instances instead of plain objects, or dropping the `edges` array.
**How to avoid:** Parse the canvas JSON to a plain `{ nodes: Array<object>, edges: Array<object> }` shape, patch only specific fields on specific nodes, and re-serialize. Never construct a new canvas object from scratch — always round-trip the original parsed data.
**Warning signs:** Canvas view shows an empty canvas, shows an error, or crashes after saving.

### Pitfall 3: Accessing canvas:node-menu Node's Internal Properties
**What goes wrong:** The node object received in the `canvas:node-menu` callback contains internal Canvas view state (DOM references, event emitters, etc.). Storing this object or accessing undocumented properties causes errors on subsequent Obsidian updates.
**Why it happens:** The node object is an internal Canvas view class instance, not a plain `CanvasNodeData`. Its public surface (`id`, `x`, `y`, `width`, `height`, `color`) is stable; everything else is private implementation.
**How to avoid:** Extract only `node.id` from the callback. Read the full node data from the canvas JSON via `vault.read()` — do not rely on the live node object for data.
**Warning signs:** TypeScript errors after Obsidian update; `cannot read properties of undefined` on `node.someField`.

### Pitfall 4: TypeScript Errors from Undocumented canvas:node-menu Typing
**What goes wrong:** `workspace.on('canvas:node-menu', ...)` is not in `obsidian.d.ts`. TypeScript reports "No overload matches this call" or similar. Developers reach for `as any` to silence it.
**Why it happens:** Undocumented events are not type-declared.
**How to avoid:** Use a typed cast to `unknown` then to a minimal interface: `(node: unknown) => { const canvasNode = node as { id: string }; ... }`. Never use `as any` — this violates `@typescript-eslint/no-explicit-any`.
**Warning signs:** `eslint` error on `any` cast; TypeScript error on `workspace.on` call.

Workaround pattern:
```typescript
// Silence TypeScript for undocumented events without using 'any'
type WorkspaceEvents = Parameters<typeof this.app.workspace.on>[0];
// OR: cast workspace to unknown first
(this.app.workspace as unknown as {
  on(event: 'canvas:node-menu', cb: (menu: Menu, node: { id: string }) => void): unknown;
}).on('canvas:node-menu', (menu, node) => { ... });
```
[ASSUMED: exact TypeScript workaround pattern — test in compiler before committing]

### Pitfall 5: noUncheckedIndexedAccess on Array Lookups
**What goes wrong:** `canvasData.nodes.find(...)` returns `T | undefined` with `noUncheckedIndexedAccess` enabled. Accessing `.id` on the result without a null check causes a TypeScript error.
**Why it happens:** `tsconfig.json` has `noUncheckedIndexedAccess: true` — established project setting.
**How to avoid:** Always guard array results: `const node = canvasData.nodes.find(...); if (!node) return;`

### Pitfall 6: main.ts Registering EditorPanelView Twice
**What goes wrong:** If `main.ts` already registers the `EDITOR_PANEL_VIEW_TYPE` view (stub from Phase 3), registering it again causes a runtime error or the second view never receiving events.
**Why it happens:** The Phase 3 stub `editor-panel-view.ts` is already imported in `main.ts` — but `main.ts` does NOT currently register it (the registration is missing from the current stub). Phase 4 must add the `registerView()` call without duplicating it.
**How to avoid:** Check `main.ts` before adding `registerView(EDITOR_PANEL_VIEW_TYPE, ...)` — confirm it is not already registered. (Current state: NOT registered — Phase 4 must add it.)

[VERIFIED: `src/main.ts` read — `EDITOR_PANEL_VIEW_TYPE` is NOT imported or registered in current `main.ts`]

---

## Code Examples

### Reading a Node from a Canvas File

```typescript
// Source: [CITED: Phase 1 canvas-parser.ts — established project pattern]
async function readNodeFromCanvas(
  app: App,
  filePath: string,
  nodeId: string
): Promise<Record<string, unknown> | null> {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) return null;
  const raw = await app.vault.read(file);
  const data = JSON.parse(raw) as { nodes: Array<Record<string, unknown>> };
  return data.nodes.find(n => n['id'] === nodeId) ?? null;
}
```

### Building a Form Section for a Known Node Kind

```typescript
// Source: [CITED: settings.ts RadiProtocolSettingsTab — established project pattern]
private buildFreeTextInputForm(container: HTMLElement, node: FreeTextInputNode): void {
  new Setting(container)
    .setName('Prompt label')
    .setDesc('Text shown to the user above the input field.')
    .addText(text =>
      text
        .setPlaceholder('e.g., Describe the finding:')
        .setValue(node.promptLabel)
        .onChange(v => { this.pendingEdits['radiprotocol_promptLabel'] = v; })
    );

  new Setting(container)
    .setName('Prefix (optional)')
    .setDesc('Text prepended to the user\'s input in the protocol report.')
    .addText(text =>
      text
        .setValue(node.prefix ?? '')
        .onChange(v => { this.pendingEdits['radiprotocol_prefix'] = v || undefined; })
    );

  new Setting(container)
    .setName('Suffix (optional)')
    .setDesc('Text appended to the user\'s input in the protocol report.')
    .addText(text =>
      text
        .setValue(node.suffix ?? '')
        .onChange(v => { this.pendingEdits['radiprotocol_suffix'] = v || undefined; })
    );
}
```

### Registering the Context Menu Event

```typescript
// Source: [CITED: github.com/borolgs/enchanted-canvas — confirmed pattern]
// In main.ts onload():
this.registerEvent(
  (this.app.workspace as unknown as {
    on(event: 'canvas:node-menu', cb: (menu: Menu, node: { id: string }) => void): void;
  }).on('canvas:node-menu', (menu, node) => {
    const nodeId = node.id;
    const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
    const filePath = (canvasLeaves[0]?.view as { file?: { path: string } })?.file?.path;
    if (!filePath) return;

    menu.addItem(item =>
      item
        .setTitle('Edit RadiProtocol properties')
        .setSection('radiprotocol')
        .onClick(() => { void this.openEditorPanelForNode(filePath, nodeId); })
    );
  })
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Modal-based node editing (user opens a separate dialog) | Side panel ItemView persists across interactions | Obsidian 1.0+ stable pattern | Better UX — panel stays open as user clicks different nodes |
| Raw JSON file editing for canvas custom properties | Write-back via `vault.modify()` with closed-canvas guard | RadiProtocol-specific design | Safe round-trip without Canvas view corruption |
| Direct `addEventListener` | `this.registerDomEvent()` + `this.registerEvent()` | Established Obsidian plugin pattern | Auto-cleanup on unload, no memory leaks |
| `workspace.activeLeaf` | `getLeavesOfType()` or `getActiveViewOfType()` | Deprecated in recent Obsidian | Required for forward compatibility |

**Deprecated/outdated:**
- `workspace.activeLeaf`: Deprecated, use `getLeavesOfType()` or `getActiveViewOfType()`.
- Direct `vault.modify()` on open canvas: Never acceptable — context and guards required.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `canvas:node-menu` event name is stable and will not be renamed in a future Obsidian version | Standard Stack / Context Menu Pattern | Context menu integration (EDIT-05) breaks silently; must re-discover event name |
| A2 | `canvas.setData()` + `canvas.requestSave()` are the correct Strategy B methods for in-memory canvas mutation | Write-Back Strategy B | If wrong, Strategy B fails and falls through to Strategy A — no data loss |
| A3 | `leaf.view.file?.path` is the correct property path to get the canvas file path from a canvas leaf | Write-Back Strategy A / isCanvasOpen | Open canvas detection fails; risk of writing to an open canvas |
| A4 | "Save changes" button (rather than auto-save on field change) is the correct UX for the editor panel | Architecture Patterns §2 | If wrong, field-by-field auto-save creates partial-write risk; button is conservative default |
| A5 | TypeScript workaround using `(workspace as unknown as ...)` cast is the correct approach for undocumented events | Pitfall 4 | Compiler error; may need a different escape pattern |
| A6 | `noUncheckedIndexedAccess` applies to `.find()` return type (returns `T \| undefined`) | Pitfall 5 | No impact if wrong — just a defensive check |
| A7 | Strategy A (require canvas closed) is the locked decision for A4/A5 from STATE.md | All write-back patterns | If user wants Strategy B, additional implementation and version-guard work required |

**Highest-risk assumption:** A1 (canvas:node-menu event name stability) and A3 (leaf.view.file path). Both are verifiable by running the plugin against a dev vault during Phase 4 implementation.

---

## Open Questions (RESOLVED)

1. **Write-back strategy: Strategy A only, or Strategy A + B fallback?** (RESOLVED)
   - What we know: Strategy A is documented as the recommended option (STATE.md A5). Strategy B is possible but requires additional version-guard code.
   - **Resolution:** Strategy A only is implemented in Phase 4. The plan uses `isCanvasOpen()` guard + `vault.modify()` when canvas is closed. Strategy B (undocumented `canvas.setData()`) is deferred — it can be added as a future enhancement if the seamless UX becomes a priority. No task in this phase implements Strategy B.

2. **How to retrieve the canvas file path from the canvas:node-menu callback's node object?** (RESOLVED)
   - What we know: The node object is an internal Canvas class instance. The canvas leaf's `view.file.path` is the correct path. But matching the node object's canvas back to a leaf is indirect.
   - **Resolution:** Scan all canvas leaves via `getLeavesOfType('canvas')` and find the one whose internal `canvas` property matches `node.canvas`. This is implemented in Plan 02 Task 2 (main.ts context menu handler). The `node.canvas.view.file.path` internal chain is NOT used — leaf scanning is more robust (Pitfall 3).

3. **Does removing `radiprotocol_nodeType` (to "un-mark" a node as a RadiProtocol node) require also removing all `radiprotocol_*` fields?** (RESOLVED)
   - What we know: The parser silently skips nodes without `radiprotocol_nodeType`. Orphaned `radiprotocol_*` fields on a plain canvas node are harmless but messy.
   - **Resolution:** YES — implemented in Plan 02 Task 1. When `saveNodeEdits()` receives `radiprotocol_nodeType: ''` (or unset), it iterates all keys on the node and deletes every key matching `key.startsWith('radiprotocol_')`. This keeps the canvas JSON clean and prevents stale fields from accumulating. The `canvas-write-back.test.ts` stub (Plan 00 Task 2, test 5) provides automated coverage for this behavior.

---

## Environment Availability

Phase 4 is code-only. It adds no new runtime dependencies, CLI tools, or external services beyond what is already required by the project. The environment availability check is skipped.

The only build-time requirement is `obsidian@1.12.3` (already installed). All canvas runtime APIs used in Phase 4 (`getLeavesOfType`, `vault.read`, `vault.modify`) are available from `minAppVersion: "1.5.7"`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` at repo root |
| Quick run command | `npx vitest run src/__tests__` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-01 | `EditorPanelView` is an `ItemView` with correct `getViewType()` | unit | `npx vitest run src/__tests__/editor-panel-view.test.ts` | No — Wave 0 |
| EDIT-02 | Form renders correct fields for each node kind | unit | `npx vitest run src/__tests__/editor-panel-view.test.ts` | No — Wave 0 |
| EDIT-03 | Node type dropdown changes form fields | unit | `npx vitest run src/__tests__/editor-panel-view.test.ts` | No — Wave 0 |
| EDIT-04 | Write-back patches correct fields in canvas JSON without touching native fields | unit | `npx vitest run src/__tests__/canvas-write-back.test.ts` | No — Wave 0 |
| EDIT-04 | `isCanvasOpen()` correctly detects open canvas | manual | Run plugin in dev vault — open canvas, trigger save, verify Notice | manual only |
| EDIT-04 | Canvas file is not corrupted after write-back | manual | Open canvas in native Canvas view after save; verify all nodes/edges intact | manual only |
| EDIT-05 | Context menu appears on canvas node right-click | manual | Right-click canvas node in dev vault; verify "Edit RadiProtocol properties" item | manual only |

**Notes on automated vs. manual split:**
- Write-back correctness (JSON patching logic) can be unit-tested by passing a canvas JSON string and expected edit map to a pure `patchCanvasNode()` helper function, if that helper is extracted from the view.
- Canvas-open detection, context menu wiring, and file corruption checks require a running Obsidian instance and must be manual.

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/editor-panel-view.test.ts src/__tests__/canvas-write-back.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual UAT checklist before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/editor-panel-view.test.ts` — covers EDIT-01, EDIT-02, EDIT-03; needs Obsidian mock extension for `Setting` API
- [ ] `src/__tests__/canvas-write-back.test.ts` — covers EDIT-04 JSON patching logic; pure function, no Obsidian mock needed
- [ ] `src/__mocks__/obsidian.ts` — extend with `Setting`, `Notice`, `Menu` stubs for editor panel tests

---

## Security Domain

Phase 4 modifies canvas files on disk and receives input from the user via form fields. The primary security concerns are input handling and file write integrity.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — local plugin, no auth |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A — local vault, no multi-user |
| V5 Input Validation | yes | Validate string lengths; reject empty required fields; coerce numeric fields (maxIterations) to integer range |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Oversized string input in form fields | Tampering | Validate/trim string inputs before writing to canvas JSON; `maxLength` on TextComponent inputs if Obsidian API supports |
| Malformed `radiprotocol_loopStartId` reference | Tampering | Validate that `loopStartId` references an existing node ID in the current canvas before saving |
| JSON injection via user input | Tampering | `JSON.stringify` handles escaping correctly; no string concatenation into JSON |
| Overwriting non-radiprotocol fields | Tampering | Whitelist: only write keys that start with `radiprotocol_` |

**Key safety invariant:** The write-back function must only modify properties whose keys start with `radiprotocol_`. A runtime whitelist check (or a TypeScript compile-time constraint) should enforce this.

---

## Sources

### Primary (HIGH confidence)
- `src/graph/canvas-parser.ts` — ground truth for `radiprotocol_*` field names and defaults [VERIFIED: read directly]
- `src/graph/graph-model.ts` — ground truth for `RPNode` discriminated union types [VERIFIED: read directly]
- `src/views/runner-view.ts`, `src/settings.ts` — established ItemView and Setting API patterns for this project [VERIFIED: read directly]
- `src/main.ts` — confirmed `EDITOR_PANEL_VIEW_TYPE` is NOT registered (Phase 4 must add it) [VERIFIED: read directly]
- `github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts` — official canvas type definitions [CITED]
- `.planning/research/PITFALLS.md` — canvas write-back pitfalls, established in prior research [VERIFIED]
- `.planning/research/ARCHITECTURE.md` — ItemView registration and plugin-as-service-locator pattern [CITED]

### Secondary (MEDIUM confidence)
- `github.com/borolgs/enchanted-canvas` — confirmed `canvas:node-menu` event and `canvas.requestSave()` pattern [CITED]
- `github.com/Quorafind/Obsidian-Link-Nodes-In-Canvas` — confirmed `canvas.setData()` + `canvas.requestSave()` write-back pattern [CITED]
- `forum.obsidian.md/t/creating-an-event-for-menus-on-canvas-items/85646` — community discovery of canvas menu events; `canvas:node-menu` named [CITED]
- WebSearch results confirming `getLeavesOfType('canvas')` + `leaf.view.file.path` for open-canvas detection [VERIFIED: cross-referenced with multiple sources]

### Tertiary (LOW confidence — not independently verified)
- `github.com/Developer-Mike/obsidian-advanced-canvas` — confirms canvas runtime API pattern via community reverse-engineering; exact API paths not independently confirmed
- TypeScript workaround for undocumented event typing — reasoned pattern, not tested against the compiler in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs are from existing project or `obsidian` package; no new packages
- Form construction patterns: HIGH — direct extension of Phase 3 `Setting` API patterns already in codebase
- Write-back Strategy A: HIGH — `vault.modify()` + open-canvas guard is well-established and safe
- Write-back Strategy B: MEDIUM — `canvas.setData()` / `canvas.requestSave()` confirmed via 2 community plugins but undocumented
- Context menu (`canvas:node-menu`): MEDIUM — confirmed in multiple community plugins and forum thread; not in official TypeScript types
- TypeScript escape patterns for undocumented events: LOW — reasoned, not compiler-tested

**Research date:** 2026-04-06
**Valid until:** 2026-06-01 (stable Obsidian API changes slowly; canvas internals may shift on a minor update)
