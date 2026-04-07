# Feature Landscape: RadiProtocol v1.1

**Domain:** Obsidian community plugin — medical imaging protocol runner
**Researched:** 2026-04-07
**Milestone:** v1.1 UX & Community Release

---

## Feature Index

1. Full-tab runner view
2. Canvas selector dropdown
3. Live canvas node editing
4. Insert into current note
5. Node templates
6. Community submission

---

## 1. Full-Tab Runner View

### What the UX pattern is

In Obsidian, any view can live in either the sidebar (left/right) or the main editor area (tabs). The main editor area is the "root split." Users expect interactive tools — anything they work with actively for more than a few seconds — to open as an editor tab, not a sidebar panel. Sidebars are for persistent reference panels (file explorer, backlinks, outline). A protocol runner is interactive like a form; users treat it like "opening a document." The expected UX is: run a command, a new tab opens with the runner, the tab has a title ("Protocol runner"), the tab persists across sessions, user can have it open alongside a canvas.

### How it works technically

The existing `RunnerView` extends `ItemView` and is registered for the right sidebar via `getLeaf('right')`. To open the same view in the main editor area instead, the leaf creation call changes:

```typescript
// Current (sidebar):
const leaf = this.app.workspace.getRightLeaf(false);

// Tab pattern:
const leaf = this.app.workspace.getLeaf('tab');
await leaf.setViewState({ type: RUNNER_VIEW_TYPE, active: true });
this.app.workspace.revealLeaf(leaf);
```

`getLeaf('tab')` creates a new leaf in the root split (main editor area). `getLeaf(false)` returns the most recently navigable leaf in the root split, reusing an existing tab if the view type is already open. `workspace.revealLeaf()` ensures the tab becomes active and scrolls into view.

The `ItemView` class itself does not need to change — the same `RunnerView` code works in both sidebar and tab. Only the leaf creation and placement logic in `main.ts` changes.

`getViewType()`, `getDisplayText()`, `getIcon()` and `getState()`/`setState()` all carry over unchanged.

### Table stakes vs differentiator

**Table stakes.** Users who open protocol runners (complex interactive tools) expect a full tab. The current sidebar placement is a v1 expedient; full-tab is the standard pattern for any view that requires sustained interaction. Missing this makes the runner feel cramped.

### Complexity

**Low.** The `RunnerView` code is unchanged. The change is one leaf creation call in `main.ts`. Risk: if the view is also registered for the sidebar somewhere, need to audit and remove that registration or make placement configurable. Existing `getState()`/`setState()` workspace persistence already handles tab restoration across Obsidian restarts.

### Dependencies on existing code

- `RunnerView` (no changes required to the view itself)
- `main.ts` `activateRunnerView()` method — leaf creation changes here
- `getState()`/`setState()` — already implemented, already handles persistence
- No engine changes needed

---

## 2. Canvas Selector Dropdown

### What the UX pattern is

Currently the runner requires running a command to open a canvas file — the user must close and re-invoke "Run protocol" to switch canvases. The expected UX for any plugin that works on multiple files is an in-panel dropdown (a `<select>` or fuzzy modal trigger) listing all `.canvas` files in the vault. User changes selection, runner re-loads for the new canvas. This is the same pattern used by Dataview (choose a query file), QuickAdd (choose a macro), and Obsidian's own Template picker.

Two valid sub-patterns exist:

1. **Inline `<select>` element** in the runner view header — always visible, low friction for users who switch canvases often. Rebuilds on vault file change events.
2. **Button that opens `FuzzySuggestModal`** — matches Obsidian's native file picker UX, better for large vaults with many canvas files, no DOM complexity.

For a plugin where canvas switching is an occasional action (not per-step), pattern 2 (fuzzy modal) is more idiomatic. Pattern 1 is more appropriate if switching is frequent.

### How it works technically

**Pattern 2 (recommended):**

```typescript
class CanvasSuggestModal extends FuzzySuggestModal<TFile> {
  getItems(): TFile[] {
    return this.app.vault.getFiles().filter(f => f.extension === 'canvas');
  }
  getItemText(file: TFile): string { return file.basename; }
  onChooseItem(file: TFile): void { this.runnerView.openCanvas(file.path); }
}
```

A "Change canvas" button in the runner view header opens this modal. `vault.getFiles()` is synchronous and always fresh. No file watcher needed for the modal pattern.

**Pattern 1 (inline select):**
Populate on `onOpen()` and re-populate on `this.app.vault.on('create' | 'delete' | 'rename', ...)` events. Wrap in `registerEvent()` for cleanup. Filter by `.extension === 'canvas'`. Requires DOM management when the canvas list changes.

### Table stakes vs differentiator

**Table stakes for v1.1.** Once the plugin is public, users will have multiple canvas files (one per modality, one per protocol). Requiring command re-invocation to switch is a friction point that will generate immediate feedback.

### Complexity

**Low-medium.** The fuzzy modal pattern is ~20 lines. The inline select adds ongoing vault event subscription complexity. The runner already has `openCanvas(filePath)` — the selector only needs to call it.

### Dependencies on existing code

- `RunnerView.openCanvas()` — already implemented, called with new path
- `ProtocolRunner` state machine — `runner.reset()` or equivalent needed before re-opening; verify runner has a clean-reset path
- Session service — opening a new canvas should prompt to clear current session (same flow as current "canvas modification warning")
- No engine changes

---

## 3. Live Canvas Node Editing

### What the UX pattern is

Currently `EditorPanelView` requires the canvas to be closed before it can write back node edits (Strategy A). The expected UX for a "live editing" workflow is: canvas is open, user right-clicks a node, editor panel shows the node's current properties, user edits them, changes reflect on the canvas without closing it.

This is the workflow used by Advanced Canvas, Resize Card Plugin, and Enhanced Canvas — all of which modify canvas node data at runtime using Obsidian's internal canvas API.

### How it works technically

The canvas runtime API is **entirely undocumented** — it is not in `obsidian-api` (`canvas.d.ts` only contains the data schema, not runtime classes). The community pattern, confirmed by multiple plugins (Resize Card Plugin, Advanced Canvas, canvas-event-patcher), is:

```typescript
// Access the live canvas object
const canvasLeaves = app.workspace.getLeavesOfType('canvas');
const canvasView = canvasLeaves.find(l =>
  (l.view as any).file?.path === targetFilePath
)?.view as any;
const canvas = canvasView?.canvas;

// Get a node and mutate it
const node = canvas?.nodes?.get(nodeId);
node?.setData({ ...existingData, ...updatedFields });

// Trigger Obsidian to write the .canvas file
canvas?.requestSave();
```

Key points about this API:
- `canvas.nodes` is a `Map<string, CanvasNode>` where keys are node IDs
- `node.setData(data)` updates the node's in-memory data and re-renders the node
- `canvas.requestSave()` triggers the debounced file write that Obsidian uses natively
- The API is internal (no TypeScript types) — all access requires `as any` or a local type shim
- The API has been stable across Obsidian versions that multiple published plugins depend on, but it is not guaranteed; a breaking Obsidian update could silently break it

### Table stakes vs differentiator

**Differentiator.** The "canvas must be closed" constraint (Strategy A) is unusual and creates friction for advanced users. However, Strategy A is correct and safe for the general case. Live editing is a quality-of-life improvement, not a missing baseline feature. Many protocol authors will build the canvas, close it, run the protocol — the current workflow works.

### Complexity

**High.** Reasons:
1. No TypeScript types — requires a local interface shim or `as any` throughout (conflicts with the project's ESLint `no-explicit-any` rule, needs deliberate exception)
2. The access pattern requires detecting whether the canvas is currently open (`getLeavesOfType('canvas')` + matching by file path)
3. Must gracefully fall back to Strategy A when the canvas is not open
4. `canvas.requestSave()` triggers file write — need to verify this does not conflict with the `WriteMutex` used for snippets/sessions (different files, probably safe, but needs audit)
5. Community Review risk: Obsidian reviewers are aware that internal API use is fragile; this may generate review feedback asking for a safer approach or a clear fallback

### Dependencies on existing code

- `EditorPanelView` — Strategy A write-back logic needs a branch: "if canvas open, use live API; else use file write"
- `isCanvasOpen()` method already exists in `EditorPanelView` (line 50 of editor-panel-view.ts) — this is the detection hook
- `WriteMutex` — audit whether `canvas.requestSave()` conflicts with vault.modify() guards
- ESLint config — `no-explicit-any` will fire; needs targeted disable comments or a local type shim

---

## 4. Insert Into Current Note

### What the UX pattern is

Currently the runner outputs to clipboard or a new note. The expected third mode is: insert the generated report text at the cursor position in whatever note the user currently has active. This is standard in Obsidian plugins that produce text (Templater's "Append to current note", QuickAdd's inline mode, various AI writing tools). The mental model: the radiologist has a patient note open, runs the protocol, and the report appears directly in the note at the cursor without any intermediate step.

### How it works technically

The challenge is that when the runner view is active (tab or sidebar), the main editor loses `activeEditor` focus. The pattern to get around this:

```typescript
// Get the most recently active leaf in the root split
const leaf = this.app.workspace.getMostRecentLeaf();
const view = leaf?.view;
// MarkdownView has an 'editor' property
if (view instanceof MarkdownView) {
  const editor = view.editor;
  editor.replaceSelection(reportText);  // inserts at cursor, replaces selection if any
}
```

Alternatively: `this.app.workspace.activeEditor?.editor` — but this returns null when a sidebar or tab view (like the runner) has focus.

`getMostRecentLeaf()` returns the leaf that had focus before the runner took over. If the user's workflow is: open note → open runner → complete protocol → insert — this returns the correct note.

Edge case: if no markdown note was ever open (user opened the runner immediately on launch), `getMostRecentLeaf()` may return the runner leaf itself or null. Need a null-check and a fallback notice ("No active note found — use Copy or Save instead").

The setting for output destination (`settings.outputDestination`) already has at least two modes (new note, clipboard based on v1.0 settings tab). A third `insert-at-cursor` enum value is added.

### Table stakes vs differentiator

**Table stakes for clinical workflow.** The clinical use case is explicitly: run protocol, output goes into patient note. Copy-to-clipboard + paste is a two-step friction that adds time in a clinical environment. This is the most directly useful output mode for the target user.

### Complexity

**Low.** The `getMostRecentLeaf()` + `instanceof MarkdownView` + `editor.replaceSelection()` pattern is ~10 lines. The main work is the settings UI change (adding a third output mode) and null-handling. No engine changes needed.

### Dependencies on existing code

- `RunnerView` output buttons — add third button "Insert into note" alongside existing Copy and Save
- `settings.ts` — add `insert-at-cursor` to `outputDestination` enum/union
- `RadiProtocolSettingsTab` — add the third option to the setting dropdown
- `MarkdownView` import needed in `runner-view.ts`
- No engine changes

---

## 5. Node Templates

### What the UX pattern is

Node templates allow a user to save a pre-configured node structure (e.g., a Question node with a label and four preset Answer nodes already connected) and later insert it into any canvas with a single action. This is the canvas equivalent of Obsidian's built-in Templates plugin — "here is a structure I use often, stamp it into the canvas."

The expected UX: in the node editor or via a command, user selects nodes on the canvas (or defines a template from scratch), names the template, saves it. Later, they invoke "Insert template" (command or button) and the node structure is inserted into the open canvas.

**Scope boundary for v1.1:** The realistic scope given the live canvas API complexity is "save a single node's properties as a template and insert it as a new node." Full multi-node sub-graph templates (saving a Question + 4 Answers + edges as one unit) require canvas write-back while open or complex JSON stitching, which increases scope significantly.

### How it works technically

Templates are stored as JSON files in `.radiprotocol/templates/` (same pattern as snippets: `SnippetService`). A `TemplateService` provides CRUD.

A template record contains:
```typescript
interface NodeTemplate {
  id: string;          // uuid
  name: string;        // user-visible label
  kind: RPNodeKind;    // which node type
  data: Record<string, unknown>;  // the node's RP properties
}
```

Inserting a template means writing a new node entry into the target canvas file. If canvas is closed: read file, append node JSON, write back. If canvas is open: use `canvas.createTextNode()` or equivalent (undocumented) API, or fall back to file write with close-detection.

For single-node templates, the simpler path is Strategy A (require canvas closed for insertion). This avoids the live API risk entirely.

A `TemplateManagerView` (new `ItemView` modeled on `SnippetManagerView`) provides the CRUD UI. A "Insert template" command opens a `FuzzySuggestModal` listing available templates.

### Table stakes vs differentiator

**Differentiator.** No existing Obsidian plugin (as of research date) offers canvas node templates for protocol authoring. This is novel functionality. The table-stakes version (save/load node configs) adds real value for protocol authors who build similar patterns repeatedly. Multi-node sub-graph templates are out of scope for v1.1.

### Complexity

**Medium** (single-node templates with Strategy A). Reasons:
- New service (`TemplateService`) modeled on `SnippetService` — low risk, established pattern
- New view (`TemplateManagerView`) modeled on `SnippetManagerView` — medium effort, established DOM pattern
- Canvas node insertion: adding a node to the `.canvas` JSON is straightforward (it's just appending to the `nodes` array) but requires positioning logic (where to place the new node on the canvas — default to viewport center or a fixed offset)
- Node positioning: `.canvas` files include `x`, `y`, `width`, `height` per node — inserting with hardcoded or user-specified coordinates, or defaulting to `0, 0` with a note to user, is acceptable for v1.1

**High** if multi-node sub-graph templates are in scope (out of scope for v1.1).

### Dependencies on existing code

- `SnippetService` — direct model for `TemplateService` architecture
- `SnippetManagerView` — direct model for `TemplateManagerView` DOM patterns
- `EditorPanelView` — needs "Save as template" button on node forms
- `WriteMutex` — template file writes should use the same mutex pattern
- Canvas file format knowledge already in `CanvasParser` — inverse (write) operation needed
- Settings: template folder path (or hardcode to `.radiprotocol/templates/`)

---

## 6. Community Submission

### What the UX pattern is

This is not a user-facing UX feature — it is a delivery milestone. The expected output is: the plugin is listed in Obsidian's Community Plugins browser, users can install it with one click, the README answers "what is this, how do I install it, how do I use it."

### What is required (verified from official sources)

**manifest.json fields (required/critical):**
- `id` — alphanumeric + dashes, no "obsidian" prefix, must be unique in the registry
- `name` — display name
- `version` — must exactly match the GitHub release tag (no "v" prefix on tag: tag is `1.1.0` not `v1.1.0`)
- `minAppVersion` — set to latest stable Obsidian if unsure; controls who can install
- `description` — max 250 characters, starts with action verb, ends with period, no emoji, no "This is a plugin"
- `author`
- `isDesktopOnly: true` — **required** because the plugin uses Node.js/Electron APIs (file system via `vault.adapter`)

**Files required in GitHub release assets (must be attached individually, not as zip):**
- `main.js`
- `manifest.json`
- `styles.css` (if present)

**Repository files required:**
- `README.md` — usage docs, installation instructions, example canvas structure
- `LICENSE` — must be present (MIT is standard for community plugins)

**PR process:**
- Fork `obsidianmd/obsidian-releases`
- Add entry to `community-plugins.json` (id, name, author, description, repo)
- Complete the PR template checklist
- Automated CI validates JSON structure, naming conventions, manifest accessibility, release assets

**Common rejection reasons to pre-empt:**
- Plugin ID contains "obsidian" as prefix
- Release tag is `v1.0.0` but manifest says `1.0.0` (must match exactly, no "v")
- `main.js` not attached as a release asset (separate from the source `.zip` GitHub auto-generates)
- No LICENSE file
- Description starts with "This is a plugin" or contains emoji

**Plugin guidelines (from review process):**
- No `innerHTML` (project already enforces this via ESLint `eslint-plugin-obsidianmd` rules — confirmed in project ESLint config)
- No `eval()`
- External network requests must be declared and justified; this plugin makes none
- `isDesktopOnly: true` if using Node.js/Electron APIs
- Command IDs must not repeat the plugin ID prefix (already correct per NFR-06)
- Remove all sample/placeholder code before submission

**Example canvases:**
Not a formal requirement, but standard practice for this type of plugin — include one or two `.canvas` files in the repository demonstrating a minimal protocol and a loop protocol. This dramatically reduces time-to-first-success for new users.

**versions.json:**
A `versions.json` file in the repo root maps each plugin version to the minimum Obsidian version that supports it. Must be kept up to date with each release.

### Table stakes vs differentiator

**Table stakes** — this IS the milestone goal. Without it, v1.1 is not a community release.

### Complexity

**Medium** (time not technical). Reasons:
- README writing is time-consuming to do well for a non-technical audience (radiologists)
- Example canvas creation requires careful authoring (must validate, must demonstrate loops + snippets)
- Release pipeline: need a `release.yml` GitHub Actions workflow to auto-attach `main.js`, `manifest.json`, `styles.css` to GitHub releases (the `obsidianmd/obsidian-sample-plugin` contains the reference workflow)
- The `versions.json` file must be created and maintained
- One-time PR process; not technically hard but requires checklist discipline

### Dependencies on existing code

- `manifest.json` — audit all required fields, add `isDesktopOnly: true`
- `versions.json` — create if not present
- GitHub Actions release workflow — create if not present
- No source code changes required unless review surfaces a guideline violation

---

## Table Stakes vs Differentiators: Summary

| Feature | Category | Rationale |
|---------|----------|-----------|
| Full-tab runner view | Table stakes | Expected UX for interactive tools in Obsidian |
| Canvas selector dropdown | Table stakes | Multi-canvas users blocked without it |
| Insert into current note | Table stakes (clinical workflow) | Core use case: output to open patient note |
| Live canvas node editing | Differentiator | Strategy A works; live editing is QoL improvement |
| Node templates | Differentiator | Novel; no equivalent in ecosystem |
| Community submission | Milestone requirement | Not a feature; it is the delivery gate |

---

## Feature Dependencies

```
Full-tab runner view
  depends on: RunnerView (no changes), main.ts leaf creation logic

Canvas selector dropdown
  depends on: RunnerView.openCanvas(), ProtocolRunner reset path, session clear flow
  note: openCanvas() already implemented; verify runner reset is clean

Insert into current note
  depends on: RunnerView output section, settings.outputDestination enum
  note: getMostRecentLeaf() + instanceof MarkdownView pattern; ~10 lines

Live canvas node editing
  depends on: EditorPanelView.isCanvasOpen() (already exists)
  depends on: internal canvas API (undocumented, as-any)
  conflicts with: ESLint no-explicit-any (needs targeted exemption)
  risk: undocumented API, version fragility, WriteMutex audit required

Node templates
  depends on: SnippetService pattern (model for TemplateService)
  depends on: EditorPanelView "Save as template" button (new)
  depends on: CanvasParser knowledge (inverse: node insertion into .canvas JSON)
  depends on: WriteMutex pattern (reuse from SnippetService)

Community submission
  depends on: manifest.json audit, versions.json creation, GitHub release workflow
  depends on: README authored (no code dependency)
  depends on: example .canvas files created
  independent of: all other v1.1 features (can be parallelized)
```

---

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-node sub-graph templates in v1.1 | Requires live canvas API for node + edge insertion; doubles scope | Single-node templates only in v1.1 |
| Canvas selector as persistent inline `<select>` | Ongoing vault event subscription complexity | FuzzySuggestModal on demand — same UX, fewer lines, no DOM bookkeeping |
| Live canvas editing as the only write path | If internal API breaks in Obsidian update, node editing breaks entirely | Live API as enhancement; Strategy A as required fallback |
| Auto-insert into note without confirmation | Could silently corrupt a clinical note if wrong note is active | Show which note will receive output before inserting |
| TemplateManagerView as a separate sidebar panel | Adds another registered view type; template management is occasional | Inline modal for CRUD, or a tab in the same panel space as SnippetManagerView |

---

## MVP Recommendation for v1.1

Priority order based on user-visible impact, implementation risk, and dependencies:

1. **Community submission prep** — Do this first (or in parallel). It audits existing code and surfaces any guideline violations that would require changes to source code. Non-blocking for other features.
2. **Full-tab runner view** — Lowest complexity, highest perceived UX improvement. Sets the correct base context (tab, not sidebar) before other runner changes are built on top.
3. **Canvas selector dropdown** — Low complexity, immediately unblocks multi-canvas users. Builds on the runner view and calls the existing `openCanvas()`.
4. **Insert into current note** — Low complexity, highest clinical value. Independent of other features.
5. **Node templates (single-node, Strategy A)** — Medium complexity, novel differentiator. Requires the SnippetService pattern (already proven) and a canvas node insertion utility (new code).
6. **Live canvas node editing** — Highest risk/complexity due to undocumented internal API. Implement last, after all other features are stable and community submission is underway. Include Strategy A fallback unconditionally.

**Defer from v1.1:**
- Multi-node sub-graph templates
- Template insertion while canvas is open via live API (use Strategy A only)

---

## Sources

- [FileView — Obsidian Developer Documentation](https://docs.obsidian.md/Reference/TypeScript+API/FileView)
- [Workspace — Obsidian Developer Documentation](https://docs.obsidian.md/Plugins/User+interface/Workspace)
- [Submit your plugin — Obsidian Developer Documentation](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)
- [Submission requirements for plugins — Obsidian Developer Documentation](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins)
- [Plugin Submission Guide — DeepWiki](https://deepwiki.com/obsidianmd/obsidian-releases/6.1-plugin-submission-guide)
- [obsidian-api/canvas.d.ts — GitHub](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts)
- [canvas-event-patcher — GitHub](https://github.com/neonpalms/obsidian-canvas-event-patcher)
- [obsidian-advanced-canvas — GitHub](https://github.com/Developer-Mike/obsidian-advanced-canvas)
- [obsidian-resize-card-plugin — GitHub](https://github.com/jasperyzh/obsidian-resize-card-plugin)
- [Any details on the canvas API? — Obsidian Forum](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120)
- [Access current editor from a sidebar plugin — Obsidian Forum](https://forum.obsidian.md/t/access-current-editor-from-a-sidebar-plugin/79477)
- [Canvas System — DeepWiki](https://deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-system)
- [Making A Custom View in Obsidian — upskil.dev](https://upskil.dev/blog/obsidian_plugin_custom_view)
