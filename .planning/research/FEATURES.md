# Feature Landscape: v1.3 Node Editor Overhaul & Snippet Node

**Domain:** Obsidian community plugin — medical imaging protocol generator
**Researched:** 2026-04-10
**Milestone:** v1.3 — four compound features mapped below
**Overall confidence:** HIGH (Obsidian API verified; UX patterns verified against industry sources; codebase read directly)

---

## Scope of this document

This is milestone-specific feature research for v1.3. It covers four new feature areas:
1. Snippet node type (runner integration + file picker)
2. Interactive placeholder chip editor (SnippetManagerView overhaul)
3. Canvas node auto-color by type
4. Node Editor auto-save with debounce

All findings are grounded in direct codebase reading plus verified research. Complexity ratings assume the existing plugin architecture described in PROJECT.md.

---

## Feature 1: Snippet Node Type (Runner Integration + File Picker)

### What similar tools do

In node-based workflow builders (Unreal Blueprint, Unity Visual Scripting, Obsidian Cannoli), a node that "calls out" to an external resource appears visually distinct from data-flow nodes. The canonical pattern: the button/node label names the resource category (not the file), and clicking it opens a picker scoped to a configured folder rather than the whole filesystem. Scoping is deliberate — showing all vault files when the user needs one of 12 snippet files is a severe failure common in naive implementations.

In Obsidian's API the standard primitive for folder-scoped file selection is `FuzzySuggestModal<TFile>`. Override `getItems()` to return `app.vault.getFiles().filter(f => f.path.startsWith(configuredFolder))` and `getItemText()` to return the display name. Fuzzy search is automatic. This is exactly how `NodePickerModal` in this codebase already picks canvas files — the pattern is already proven in the project.

For the `.md` vs JSON dispatch: the file extension is the only correct discriminator. `.json` files in the snippet folder are existing `SnippetFile` objects; `.md` files are plain text for verbatim insertion. The runner already handles the JSON path through `awaiting-snippet-fill` state. The `.md` path needs either a new state or an extension of the existing path that detects the file type and skips modal fill-in.

### Table stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Snippet node appears as a button in Runner (like Answer node) | Consistent with existing answer-button UX; user knows how to interact | Low | `RunnerView` button rendering, `RPNodeKind` union |
| File picker scoped to configured folder | Without scoping, picker is unusable in large vaults | Medium | `FuzzySuggestModal<TFile>` subclass, new `snippetNodeFolderPath` setting |
| `.json` files open `SnippetFillInModal` (existing path) | Already built and tested in v1.0 | Low | `SnippetFillInModal`, `SnippetService.load()` |
| `.md` files insert raw content into protocol textarea | Plain-text boilerplate is a real authoring pattern for standard phrases | Low | `vault.read()`, runner text accumulator |
| Cancel/skip file picker leaves runner state unchanged | Modal cancellation is an established UX contract per `safeResolve(null)` in `SnippetFillInModal` | Low | Existing `safeResolve(null)` pattern |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-node folder override | Different protocol steps may pull from different snippet libraries (CT vs MRI boilerplate) | Medium | Adds `radiprotocol_snippetFolder` to node; EditorPanel form field for it |
| Display label on runner button | "Insert Finding" vs generic "Snippet" — context label prevents confusion | Low | Already supported via `displayLabel` pattern on `AnswerNode` |

### Anti-features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Allow picking files from anywhere in vault | Radiologists don't manage vault structure; global picker causes analysis paralysis | Enforce folder scope; settings to configure that folder |
| Show file extension in picker | Irrelevant; increases cognitive load | Show name without extension; branch on extension invisibly |
| Nested folder navigation UI | Out of scope; adds surface area with no clinical value in v1 | Flat list from configured folder only; subfolders included via `path.startsWith()` filter |

### Dependencies on existing systems

`RPNodeKind` in `graph-model.ts` needs `'snippet'` added. This cascades to:
- `CanvasParser` — recognize new `radiprotocol_nodeType: 'snippet'`
- `GraphValidator` — validate snippet node structure (must have outgoing edge, folder configured)
- `EditorPanelView` — new form section for snippet node properties
- `RunnerView` — new button rendering + state transition to handle file picker
- `RadiProtocolSettings` — new `snippetNodeFolderPath: string` field (distinct from `snippetFolderPath` which is the JSON snippet store)
- `CanvasLiveEditor.saveLive()` — already handles arbitrary `radiprotocol_*` fields; no changes needed

### Complexity rating: MEDIUM

The node type itself is straightforward. Complexity concentrates in: (1) the two-branch file dispatch (`.md` vs `.json`), (2) threading `snippetNodeFolderPath` from global setting through EditorPanel per-node override to the runner's picker call at runtime.

---

## Feature 2: Interactive Placeholder Chip Editor

### What similar tools do

Template builders that mix free text with typed tokens (Zapier data insertion, Airtable formula editor, Notion formula editor, Figma variables, email template builders like Mailchimp, Braze) universally converge on the same pattern:

**The chip pattern:** Placeholder tokens are rendered as visually distinct inline elements (pills/chips) directly within the text. They are atomic units that move together, are deleted as a unit, and are colored by type. Users do not interact with raw syntax.

**Implementation approaches:** Two exist: (a) `contenteditable` div with custom chip elements embedded in the text flow, or (b) a parallel representation where a raw-text textarea holds the `{{syntax}}` and a visual chip list below shows the chips. Approach (a) requires a rich-text framework (Slate, TipTap, ProseMirror) to handle correctly. Approach (b) is correct for this plugin because:
- Obsidian's ESLint rule `no-innerHTML` bars direct DOM injection
- `contenteditable` with embedded custom elements is fragile in Electron-based apps
- The current `SnippetManagerView` already uses a textarea for the template and a list for placeholder rows — extending this is additive, not a rewrite

**Drag-and-drop to reorder within text:** This is the aspirational UX. Slate.js + dnd-kit and TipTap's drag handle extension do this correctly — but only because they own the entire editing surface. Without a framework, "drag token to new position in text" is not achievable safely in plain DOM. The correct scope-limited alternative: drag-to-reorder the placeholder list (changes `draft.placeholders[]` array order). This matters because `SnippetFillInModal` renders fill-in fields in array order (line 54 of `snippet-fill-in-modal.ts`), so reordering the array correctly changes the modal's tab-through order — which is the user's actual goal.

**Colored chips:** The existing `rp-placeholder-type-badge` badge is already a chip in spirit. Making it visually prominent with type-based color (different CSS variable per type) is low-effort, high-impact polish that matches industry standard.

### Table stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Color differentiation by placeholder type in the list | Industry standard; makes type visible at a glance without reading the label | Low | CSS variables per type in `rp-placeholder-type-badge` |
| Click chip to expand details | Already implemented in `renderPlaceholderRow()` via `row.toggleClass('is-expanded')` | Already built | No new work |
| Orphan warning when `{{id}}` remains after deletion | Already implemented in `refreshOrphanBadges()` and `renderPlaceholderRow()` removeBtn handler | Already built | No new work |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Drag-to-reorder placeholder list (list-based, not in-text) | Controls tab order in fill-in modal; lets author optimize clinical fill-in flow | Medium | HTML5 `draggable` attribute + `dragover`/`drop` events on `rp-placeholder-row` elements; reorders `draft.placeholders[]` |
| Visual chip overlay on template textarea (read-only preview with colored spans) | User sees formatted template alongside raw text; reduces mental overhead of `{{syntax}}` | High | Requires a shadow/overlay div synced with textarea scroll and font metrics; fragile; defer |

### Anti-features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| `contenteditable` with embedded chip elements | Violates `no-innerHTML`; fragile in Electron; breaks copy/paste | Keep textarea for raw editing; add visual chip list separately |
| Full rich-text editor library (Slate, TipTap, ProseMirror) | Massive bundle size; incompatible with esbuild + Obsidian bundling; out of scope for v1.3 | Not applicable |
| Drag-and-drop that repositions `{{id}}` tokens within the textarea text | Requires rich-text framework; not achievable with plain DOM | List reorder only (reorders placeholder array = modal tab order change) |

### Dependencies on existing systems

- All changes contained in `SnippetManagerView.renderPlaceholderList()` and `renderPlaceholderRow()`
- `draft.placeholders[]` array order drives `SnippetFillInModal` field order — reordering the array is the correct and complete effect of drag reorder
- No changes needed in `snippet-model.ts`, `renderSnippet()`, or `SnippetService`

### Complexity rating: LOW for chip coloring (CSS only); MEDIUM for list-based drag reorder; HIGH for in-textarea overlay (defer)

---

## Feature 3: Canvas Node Auto-Color by Type

### What similar tools do

Node-based tools universally use color to convey node type. Unity Visual Scripting colors data ports by type. Unreal Blueprint uses distinct header colors per node class. Obsidian itself uses the `color` field on `CanvasNodeData` with two value formats:

1. Palette string `"1"` through `"6"` — maps to CSS variables `--canvas-color-1` through `--canvas-color-6`, which the theme adapts to light/dark mode automatically. The community-verified mapping is: `"1"` = Red, `"2"` = Orange, `"3"` = Yellow, `"4"` = Green, `"5"` = Cyan, `"6"` = Purple.
2. Hex string `"#RRGGBB"` — fixed color that does not adapt to theme.

**Use palette indices, not hex.** Hex values will look wrong in half of user themes.

The existing `CanvasLiveEditor.saveLive()` supports writing the `color` field. It is currently in `PROTECTED_FIELDS` (intentionally skipped) to avoid clobbering user-set colors. The v1.3 requirement inverts this: when the plugin assigns `radiprotocol_nodeType`, the plugin also sets `color`. This requires removing `'color'` from `PROTECTED_FIELDS` and including it in the `edits` object passed to `saveLive()`.

**Recommended color map:**

| Node Type | Palette | Obsidian Color | Rationale |
|-----------|---------|----------------|-----------|
| `start` | `"4"` | Green | Go / begin |
| `question` | `"5"` | Cyan | Information gathering |
| `answer` | `"3"` | Yellow | Decision point |
| `text-block` | `"6"` | Purple | Content output |
| `loop-start` | `"2"` | Orange | Caution / repetition |
| `loop-end` | `"2"` | Orange | Matches loop-start |
| `snippet` (new) | `"1"` | Red | External resource / insert |
| (unmarked) | `undefined` | Default | No color on plain nodes |

### Table stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Node color set when type assigned in EditorPanel | Immediate visual confirmation of type assignment | Low | Remove `'color'` from `PROTECTED_FIELDS`; include `color` in `saveLive()` edits payload |
| Node color cleared when node is unmarked | Prevents stale color after type removal | Low | `isUnmarking` path must also clear `color` (currently it does not — see pitfall below) |
| Color uses palette indices, not hardcoded hex | Adapts to user's light/dark theme | Low | Palette string `"1"`–`"6"` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Update color when type changes (not just on first assignment) | Type corrections are common during authoring; stale color after type change confuses | Low | Same write path triggered on type dropdown `onChange` — no extra logic |

### Anti-features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Hex hardcoded colors | Breaks in dark/light mode depending on user theme | Palette indices only |
| Asking user to confirm or choose color | The point of auto-color is zero configuration | Fully automatic, no UX prompt |
| Coloring nodes not managed by RadiProtocol | Would affect plain canvas cards in mixed canvases | Only write `color` when `radiprotocol_nodeType` is being set |

### Dependencies on existing systems

- `CanvasLiveEditor`: Remove `'color'` from the `PROTECTED_FIELDS` `Set`; write `radiprotocol_nodeType` and `color` together in the same `saveLive()` call
- `EditorPanelView`: Include `color: AUTO_COLOR_MAP[selectedType]` in `pendingEdits` when type changes
- `isUnmarking` path in `saveLive()` currently removes all `radiprotocol_*` keys but does NOT clear `color` — the unmark path must additionally set `node.color = undefined` (or delete the key)

### Complexity rating: LOW

Fully contained in `CanvasLiveEditor` and `EditorPanelView`. The Pattern B live write infrastructure already works. The change is: remove `'color'` from the protected set, add a `AUTO_COLOR_MAP` constant, include color in the edits payload, fix the unmark path to also clear color.

---

## Feature 4: Node Editor Auto-Save with Debounce

### What similar tools do

Auto-save with debounce is the modern default for form-heavy editors. Notion, Linear, Figma settings, VS Code settings UI, and Obsidian's own Properties panel all auto-save on user pause — the Save button is a legacy pattern that adds a step without adding safety.

**Delay values by use case** (verified from multiple sources including GitLab's Pajamas design system):
- 300–500ms: search/suggestion autocomplete (too short for file writes)
- 500–1000ms: in-editor auto-save (user pauses, file write fires)
- 1000–2000ms: settings with expensive side effects

For RadiProtocol's `EditorPanelView`, **800–1000ms** is the correct range. The canvas write (either live via `CanvasLiveEditor` or via `vault.modify` Strategy A) is a meaningful I/O operation. 300ms causes excessive writes during normal typing. 2000ms makes the user uncertain whether a change was captured.

Note: `CanvasLiveEditor.debouncedRequestSave()` already debounces the canvas disk write at 500ms. The EditorPanel debounce (800–1000ms) fires first (after user pauses), then calls `saveLive()`, which internally schedules `requestSave()` at 500ms. The two debounces are in series and do not conflict.

**Save feedback pattern:** Auto-save without feedback creates user anxiety ("did it save?"). The minimal correct feedback is a transient "Saved" text label near the form — NOT a `Notice()` toast (too disruptive for a background save that fires constantly during authoring), NOT a spinner (over-engineered for a local file write that completes in milliseconds). GitLab Pajamas and Notion both use a subtle inline "Saved" label that appears for ~2 seconds then fades. This is the right model.

**Dirty guard removal:** `NodeSwitchGuardModal` (EDITOR-02) was added because there was an explicit Save button — without saving, switching nodes would discard edits. With auto-save, every field change triggers a save within 1 second. There is no meaningful "unsaved state" window to protect. The guard's entire purpose disappears and its presence becomes confusing (it would fire before the debounce timer completes, then the save fires anyway).

### Table stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Debounced save on every field change (800–1000ms) | No Save button = user expects changes to persist automatically | Medium | `setTimeout` in `EditorPanelView`; clear/restart on each field `input` event |
| Remove Save button from EditorPanel | Clean up UI; no dual-mode confusion | Low | Remove from `renderFormPanel()` in `editor-panel-view.ts` |
| Remove `NodeSwitchGuardModal` call from `handleNodeClick()` | Guard is only meaningful when there is a manual Save; without one it is confusing and counterproductive | Low | Remove modal call; keep `pendingEdits = {}` reset |
| Transient "Saved" inline indicator | Without it users will re-type to "make sure" it saved | Low | Single span element with CSS opacity transition; no `Notice()` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Flush pending debounce immediately on node switch | Prevents losing last change in the debounce window when user clicks to a different node | Low | Call save synchronously in `handleNodeClick()` before loading the new node |
| "Saving…" label while write is in flight | Distinguishes write latency from idle; reassures user during first save | Low | Only meaningful if canvas write takes >100ms; low priority |

### Anti-features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| `Notice()` toast on every auto-save | Extremely noisy; pops up constantly during normal authoring | Inline "Saved" label in the panel only |
| Fixed-interval save (every N seconds regardless of change) | Unnecessary writes; race condition risk with `WriteMutex`; debounce-after-change is strictly better | Debounce triggered by change events only |
| Keep dirty guard with auto-save | Contradictory UX — guard implies unsaved state which auto-save eliminates | Remove guard entirely |

### Dependencies on existing systems

- `EditorPanelView`: `pendingEdits` accumulation is already correct for batching; add a `debounceTimer` alongside it; remove guard modal call; remove Save button; add "Saved" status label
- `CanvasLiveEditor.debouncedRequestSave()` at 500ms — EditorPanel debounce at 800–1000ms fires before it; the two are in series; no conflict
- `NodeSwitchGuardModal` — remove import from `editor-panel-view.ts`; the file itself can be deleted or kept dormant

### Complexity rating: LOW–MEDIUM

Low for the debounce timer, Save button removal, and guard removal. Medium if flush-on-switch is included, because it requires awaiting the async save path before loading the new node.

---

## Feature Dependency Map

```
snippet node type ('snippet' added to RPNodeKind)
  → CanvasParser (recognize new kind)
  → GraphValidator (validate snippet node)
  → EditorPanelView (new form section)
  → RunnerView (new button + state transition)
  → FuzzySuggestModal<TFile> subclass (new file picker)
  → RadiProtocolSettings (new snippetNodeFolderPath field)

canvas auto-color
  → CanvasLiveEditor (remove 'color' from PROTECTED_FIELDS; fix isUnmarking to clear color)
  → EditorPanelView (include color in edits payload when type assigned)
  → graph-model.ts (no change — color already on RPNodeBase)

auto-save debounce
  → EditorPanelView (add debounce timer; remove Save button; remove NodeSwitchGuardModal call; add "Saved" label)
  → NodeSwitchGuardModal (remove import; file deletable)

chip editor
  → SnippetManagerView (CSS chip colors; optional drag-and-drop on placeholder list)
  → No model changes; no runner changes
```

---

## MVP Build Order for v1.3

Recommended order (each step unblocks or de-risks the next):

1. **Canvas auto-color** — lowest complexity, highest visual impact, fully contained. Validates that color write path works before adding snippet node.
2. **Auto-save debounce** — medium complexity; simplifies EditorPanel code (removes guard modal) before adding new snippet node form fields.
3. **Snippet node type** — most complex; benefits from cleaner EditorPanel (post auto-save) and validated color writes (auto-colors new snippet nodes on assignment).
4. **Chip editor** — fully independent; can run in parallel with any of the above. No model changes, no runner impact.

**Defer post-v1.3:**
- In-textarea chip overlay: HIGH complexity, marginal gain over colored chip list. Not worth the fragility.
- Nested folder picker for snippet node: unnecessary in v1; flat folder list is sufficient.

---

## Phase-Specific Warnings for Requirements Writer

| Feature Area | Watch For | Mitigation |
|--------------|-----------|-----------|
| Snippet node + `RPNodeKind` | Adding `'snippet'` cascades to every `switch` / exhaustive check in the codebase | Before writing requirements, grep `RPNodeKind` and `radiprotocol_nodeType` across all files; list every affected file explicitly |
| Auto-color + `PROTECTED_FIELDS` | `'color'` is currently intentionally protected to avoid overwriting user-set colors. Removing it means auto-color will overwrite any manually colored node when the plugin edits that node | Requirements must specify: auto-color fires ONLY when the plugin writes `radiprotocol_nodeType`; the plugin must not write color on nodes it doesn't own |
| Auto-color + unmark path | When a node is unmarked, `isUnmarking` removes all `radiprotocol_*` fields but currently does NOT clear `color`. The canvas will show a colored card with no type. | Requirements must explicitly state: unmark must also set `node.color = undefined` (remove the field from the node object) |
| Auto-save + `WriteMutex` | Two concurrent save triggers (debounce fires while a flush-on-switch save is in flight) could race on the same canvas file path | Requirements should specify: flush-on-switch must await any in-flight debounce save before loading the new node; or cancel the pending debounce and do a single synchronous flush |
| File picker + `.md` async path | `vault.read()` is async; must be awaited inside the runner's step handler | Runner's `awaiting-snippet-fill` state already handles async via the Promise-based `SnippetFillInModal`; the `.md` path should enter the same async entry point and resolve without opening a modal |
| Drag-and-drop + `draft.placeholders[]` order | `SnippetFillInModal` renders fields in array order (line 54 of `snippet-fill-in-modal.ts`) — reordering the array is the complete and correct effect | Requirements should explicitly state: drag reorder = array reorder = modal tab order change; no changes to template text, no changes to `{{id}}` token positions |
| Snippet node + global vs per-node folder | Two settings: global `snippetNodeFolderPath` in settings + `radiprotocol_snippetFolder` per-node override. Resolution must follow the same `resolveSeparator()` precedence pattern already in the codebase | Requirements should call out resolution logic: per-node override takes precedence over global setting; if neither is set, show a configuration notice rather than opening a root-vault picker |

---

## Sources

- Obsidian canvas color API: [canvas.d.ts](https://github.com/obsidianmd/obsidian-api/blob/master/canvas.d.ts); color values verified via [DeepWiki Canvas System](https://deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-system)
- `FuzzySuggestModal` API: [Obsidian Developer Docs](https://docs.obsidian.md/Reference/TypeScript+API/FuzzySuggestModal)
- Auto-save debounce timing: [GitLab Pajamas — Saving and feedback](https://design.gitlab.com/patterns/saving-and-feedback/); [Medium — Autosave with Debounce](https://kannanravi.medium.com/implementing-efficient-autosave-with-javascript-debounce-techniques-463704595a7a)
- Chip/token editor UX: [Atlassian Inline Edit](https://atlassian.design/components/inline-edit/); [Cloudscape Inline Edit](https://cloudscape.design/patterns/resource-management/edit/inline-edit/)
- Drag-and-drop in rich text: [Slate.js + dnd-kit](https://dev.to/devterminal/slatejs-dnd-kit-improving-rich-text-editor-ux-by-adding-drag-and-drop-23d3)
- Node type color conventions: [Unity Visual Scripting — Nodes](https://docs.unity3d.com/Packages/com.unity.visualscripting@1.8/manual/vs-nodes.html); [Grafana Node Graph](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/node-graph/)
- Codebase references: `src/canvas/canvas-live-editor.ts`, `src/views/editor-panel-view.ts`, `src/views/snippet-manager-view.ts`, `src/views/snippet-fill-in-modal.ts`, `src/snippets/snippet-model.ts`, `src/settings.ts`, `src/graph/graph-model.ts`
