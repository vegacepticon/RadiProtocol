# Phase 51: Snippet Picker Overhaul — Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 51 delivers two joined changes:

1. A new binding variant on `SnippetNode` — a canvas author may bind a Snippet node to **a specific snippet file** (new) alongside the existing **directory binding**. Runner auto-inserts a specific-bound snippet when it is the sole outgoing option at a Question step, and renders it as a single clickable button when it sits among sibling options. Placeholder fill-in modal still runs for `.json` snippets in both paths.
2. One unified **hierarchical snippet/folder navigator** component — tree drill-down with breadcrumb + tree-wide search field — replaces every flat directory list in the plugin (Node Editor target dropdown, Runner runtime picker, Snippet Manager "Переместить в…", Snippet Editor «Папка» field).

**In scope:** Snippet node shape, picker component, and every call-site listed in D-05..D-08. Requirements covered: **PICKER-01, PICKER-02**.

**Out of scope** (from REQUIREMENTS.md Out-of-Scope and carry-forwards):
- Dedicated Runner UI for picking between sibling specific-bound and directory-bound Snippet nodes (covered incidentally by D-16 caption + existing sibling-button layout).
- Placeholder schema rework (PHLD-01, Phase 52).
- Any change to `radiprotocol_snippetLabel` / `radiprotocol_snippetSeparator` semantics from Phase 31.
- Migration tooling for legacy directory-bound canvases — Pitfall #11 requires zero-touch back-compat, not a migration.

</domain>

<decisions>
## Implementation Decisions

### Storage shape (back-compat with Pitfall #11)

- **D-01:** Add a new optional property `radiprotocol_snippetPath?: string` on the SnippetNode persisted shape (in the Canvas `.canvas` JSON) and on the `SnippetNode` TypeScript interface in `src/graph/graph-model.ts`. Binding is determined by presence: `radiprotocol_snippetPath` present (non-empty string) → **file binding**; otherwise → **directory binding** keyed by the existing `radiprotocol_subfolderPath` (empty or missing = root). The two properties are mutually exclusive on write: setting `snippetPath` clears `subfolderPath`, and picking a folder in the Node Editor clears `snippetPath`. Legacy canvases (no `snippetPath` at all) keep their exact prior shape and behaviour — Pitfall #11 satisfied natively, no migration code written or scheduled.
- **D-02:** `radiprotocol_snippetPath` stores a path **relative to `settings.snippetFolderPath`** — identical convention to the existing `radiprotocol_subfolderPath`. Example: vault has `.radiprotocol/snippets/` as `snippetFolderPath`; a snippet at `.radiprotocol/snippets/abdomen/ct/ct-routine.md` is stored as `abdomen/ct/ct-routine.md`. Canvases survive a vault move or a change of `snippetFolderPath` setting. Absence of the property (not empty string) denotes "no file binding"; empty string is not a valid persisted state and should be normalised away on write.
- **D-03:** Extension is **kept** in the stored path (`abdomen/ct-routine.md` or `liver/report.json`). Runner can branch on `endsWith('.json')` vs `endsWith('.md')` without a lookup; placeholder-fill modal decision is a pure path check. Pure-path file check avoids a `snippetService` round-trip in the hot runner-state dispatch.
- **D-04:** GraphValidator emits a **hard validation error** at canvas-open when `radiprotocol_snippetPath` references a file that does not exist under `snippetFolderPath`. Error surfaces in the RunnerView error panel, same pattern as Phase 50.1 D-04..D-08. Error text is a new Russian string to be finalised in PLAN.md; it must name the `nodeId` and the invalid relative path, matching the style of the five locked `LOOP-04` texts. File-existence check runs against the vault abstract-file index (`app.vault.getAbstractFileByPath`), not the filesystem. Planner decides the exact error-code slot inside `GraphValidator`.

### Scope of picker replacement (what the unified navigator covers in Phase 51)

- **D-05:** Node Editor integration is **inline inside the form** — replace the existing flat `new Setting(container).addDropdown(...)` block for `radiprotocol_subfolderPath` in `src/views/editor-panel-view.ts` (`case 'snippet'` arm, lines ~598–644) with the new `SnippetTreePicker` rendered directly inside a `Setting` row labeled «Target» (or «Цель» — planner decides copy). No modal hop; drill/breadcrumb/search/file-list are all visible in the editor column. Selecting a folder or file writes to `pendingEdits` (`radiprotocol_subfolderPath` OR `radiprotocol_snippetPath`, mutually exclusive per D-01) and `pendingEdits['text']` mirrors the selection label as today.
- **D-06:** Runner drill-down at `awaiting-snippet-pick` (`runner-view.ts` `renderSnippetPicker`, lines ~582–660+) is **rewritten on top of the unified component** in **file-only** mode rooted at the Snippet node's `subfolderPath`. Breadcrumb + tree-wide search appear in runtime too (search scoped to the subtree rooted at the node's `subfolderPath`, not the entire vault tree). Existing Phase 30 semantics preserved: local drill-state does not push undo; only snippet selection (`pickSnippet`) does.
- **D-07:** **Both other call-sites migrate in Phase 51** — `FolderPickerModal` (used by `snippet-manager-view.ts` «Переместить в…» context menu) and the «Папка» field in `SnippetEditorModal` (`src/views/snippet-editor-modal.ts`). Both use `SnippetTreePicker` in **folder-only** mode (files are hidden from listing and from search results in folder-only mode — see D-09). SC 2 «the widget is reused in both directory and specific flows» is read literally: every place the plugin picks a snippet or folder goes through the same component.
- **D-08:** New module location: **`src/views/snippet-tree-picker.ts`**. Public surface: `class SnippetTreePicker` (or factory fn — planner decides) accepting `{ app, snippetService, container, mode: 'folder-only' | 'file-only' | 'both', rootPath: string /* absolute vault path */, initialSelection?: string, onSelect: (result: { kind: 'folder' | 'file', relativePath: string }) => void }`. Component owns its own drill-state and search-state (reset on each open, not persisted across Node Editor re-renders — D-05 integrates by re-constructing). CSS goes into a **new `src/styles/snippet-tree-picker.css`** registered in `esbuild.config.mjs` CSS_FILES list per CLAUDE.md CSS Architecture rule — do not pollute `runner-view.css` or `snippet-manager.css`.

### Tree-wide search semantics

- **D-09:** Search matches **both snippets and folders** in the underlying tree, then filtered by the picker's `mode`: `folder-only` mode shows folder matches only, `file-only` mode shows file matches only, `both` mode shows both in one flat result list (folders-first ordering preserved, consistent with existing runner D-03 «folders first» pattern).
- **D-10:** Matching algorithm: **case-insensitive substring** — `name.toLowerCase().includes(query.trim().toLowerCase())` — one matcher for files and folders. No fuzzy, no ranked scoring, no prepareFuzzySearch import. Matches the user's existing mental model from `FolderPickerModal` (`folder-picker-modal.ts:21-24`).
- **D-11:** Result row layout: two-line (or single-line with muted secondary) rendering — primary text = name segment (filename with extension for files, folder basename for folders), secondary text = the **full relative path from the picker's `rootPath`** in a muted utility colour. Required to disambiguate duplicate names across subfolders (e.g. two `report.md` files in different folders). CSS class for muted secondary goes into the new `snippet-tree-picker.css`.
- **D-12:** Click behaviour in search-result rows: clicking a **file** commits selection (calls `onSelect` and closes / returns to caller), clicking a **folder** **drills into it** (sets the picker's drill-path to that folder, clears the search input implicitly as part of returning to drill-view). When the user clears the search input manually (empty query), the navigator restores the drill-view at the **current `drillPath`** — it does **not** reset to `rootPath`. This matches the mental model: search is a transient overlay on the current drill state.

### Auto-insert semantics (PICKER-01)

- **D-13:** Auto-insert trigger is **narrow**: a Question node whose **only** outgoing edge terminates at a **file-bound** Snippet node (`radiprotocol_snippetPath` present, `radiprotocol_subfolderPath` absent). In that exact shape, when the runner transitions into the Question node, it skips the choice-button render and auto-advances through the Snippet node's pick phase. Linear chains (Answer → Snippet with no sibling) and Snippet-as-start do not auto-insert — rationale: narrow trigger preserves predictability, and the Phase 31 `chooseSnippetBranch` click path already defines the Question→Snippet-variant flow.
- **D-14:** Auto-advance transitions the runner state **directly to `awaiting-snippet-fill`** with the bound path pre-populated as `snippetId` — no new `runnerStatus` enum value, no transient `auto-inserting-snippet` state. RunnerView `awaiting-snippet-fill` arm already handles both `.md` (plain-text read, advance) and `.json` (placeholder modal, then advance) — see `runner-view.ts:530-540` and `handleSnippetFill`. `.md` with no placeholders inserts text and advances through the snippet node as today; `.json` with placeholders opens the fill-in modal first — both paths are identical to a user-clicked specific-bound snippet, satisfying the design note's «placeholder modal always runs before insertion» rule.
- **D-15:** Undo contract: auto-advance pushes an `UndoEntry` at the **Question → auto-insert** transition (mirroring `ProtocolRunner.pickSnippet` which pushes before any mutation — `protocol-runner.ts:256`). `stepBack` from `awaiting-snippet-fill` (or from the post-insertion node) returns the runner to the Question node with the pre-insertion accumulator, consistent with existing specific-branch step-back behaviour.
- **D-16:** Specific-bound Snippet **sibling** button caption (rendered in the Question's choice-button list when the Snippet node is not the sole outgoing edge) uses a three-step fallback chain: (1) `radiprotocol_snippetLabel` if non-empty (existing Phase 31 field); (2) `basename(radiprotocol_snippetPath)` with the extension stripped (e.g. `abdomen/ct-routine.md` → `ct-routine`); (3) literal `'📄 Snippet'` (document emoji, distinct from directory-binding's `'📁 Snippet'` — gives the reader a visual cue that this is a specific file). Claude's Discretion: exact CSS class for this button (likely reuse existing `.rp-snippet-branch-btn`).

### Claude's Discretion

- Exact Russian wording for the new D-04 «file not found» validation error — planner writes it during PLAN.md, consistent with Phase 50.1 D-04..D-08 style (nodeId + path).
- Internal shape of `SnippetTreePicker` (class vs factory, internal state machine) — planner + executor decide during implementation. Public contract is D-08.
- Whether `snippetService` needs a new `listAllEntries()` flat listing for tree-wide search or the search recurses via repeated `listFolderDescendants` calls at render time. Planner picks based on tree-size expectations; fewer round-trips preferred.
- CSS: Node Editor inline layout tweaks (picker height, scroll inside editor panel) — governed by CLAUDE.md append-only rule; new styles only in `snippet-tree-picker.css`.
- Exact RunnerView arm changes for sibling-button rendering of specific-bound Snippet nodes at a Question — may reuse the existing snippet-branch button path with a variant dispatch.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design notes (primary)
- `.planning/notes/snippet-node-binding-and-picker.md` — canonical design note for Phase 51 (binding model + picker UX + safety/compatibility statement); **must be cited in module headers** for new code (per Shared Pattern H convention seen in Phase 50 modules).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Snippet Node & Picker — `PICKER-01` (binding variants + auto-insert + placeholder-modal rule) and `PICKER-02` (hierarchical navigator + search + folder-or-file selection).
- `.planning/ROADMAP.md` §Phase 51 — Goal + 4 Success Criteria (SC 1 auto-insert + click-button branch + placeholder rule; SC 2 unified hierarchical navigator replaces flat list; SC 3 back-compat per Pitfall #11; SC 4 Runner drill-down implemented via unified component).
- `.planning/STATE.md` §Standing Pitfalls #11 (back-compat of stored canvas shape); §v1.8 Design Decisions 3–4 (snippet node binding + hierarchical picker).

### Source todos (historical, supersede into this phase)
- `.planning/todos/pending/snippet-node-bind-to-specific-snippet.md` — to-be-closed by this phase (PICKER-01).
- `.planning/todos/pending/hierarchical-snippet-picker.md` — to-be-closed by this phase (PICKER-02).

### Existing code to modify or delegate to
- `src/graph/graph-model.ts` — `SnippetNode` interface (add `snippetPath?: string`; keep all existing fields byte-identical per CLAUDE.md Shared Pattern G append-only).
- `src/graph/canvas-parser.ts` — canvas → model parsing; read new `radiprotocol_snippetPath` property.
- `src/graph/graph-validator.ts` — new D-04 check (missing file) in the Snippet-node validation arm.
- `src/runner/protocol-runner.ts` — D-13/D-14/D-15 auto-insert dispatch at Question-entry; existing `chooseSnippetBranch` and `pickSnippet` remain byte-identical for the click path.
- `src/views/runner-view.ts` — rewrite `renderSnippetPicker` on top of `SnippetTreePicker`; new sibling-button branch for specific-bound Snippet at Question choice-list; preserve Phase 47 RUNFIX-02 `capturePendingTextareaScroll` ordering in all new click handlers.
- `src/views/editor-panel-view.ts` — D-05 inline picker for `case 'snippet'`.
- `src/views/folder-picker-modal.ts` — replaced or rewrapped in folder-only mode (D-07); planner decides whether to delete the file or keep as a thin adapter.
- `src/views/snippet-editor-modal.ts` — «Папка» field switches to `SnippetTreePicker` folder-only (D-07).
- `src/views/snippet-manager-view.ts` — call-site that invokes `FolderPickerModal` (line 665); may need an adapter layer.
- `src/snippets/snippet-service.ts` — may expose a tree / flat listing helper for search (planner's discretion — see Claude's Discretion).

### New files to create
- `src/views/snippet-tree-picker.ts` — unified navigator component (D-08).
- `src/styles/snippet-tree-picker.css` — scoped styles (CLAUDE.md CSS Architecture requires a new feature file registered in `esbuild.config.mjs` `CSS_FILES`).

### Obsidian API references
- `SuggestModal<T>` pattern (current `FolderPickerModal`) — contrast/migration reference.
- `app.vault.getAbstractFileByPath`, `app.vault.getFiles()`, `TFolder`/`TFile` — vault tree access primitives (already used throughout `snippet-service.ts`).

### Project rules
- `CLAUDE.md` — **CSS Architecture** (per-feature file, registered in `esbuild.config.mjs`, build regenerates `styles.css`), **Never remove existing code you didn't add** (shared files — `editor-panel-view.ts`, `runner-view.ts`, `snippet-manager-view.ts` — are explicitly named as accumulated), **CSS files: append-only per phase**.
- `.planning/STATE.md` §Standing Pitfalls 1–11 (canvas write rules, `WriteMutex`, no `innerHTML`, no `require('fs')`, `loadData()` null merge, `console.debug` only, CSS append-only, shared-file discipline, real-DOM vs mock-DOM parent lookup, no `maxIterations` revival, back-compat of stored canvas shape).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/snippets/snippet-service.ts`** — `listFolder(absPath)` returns `{ folders, snippets }` at one level; `listFolderDescendants(absPath)` returns the recursive descendant listing; `listAllFolders()` is a convenience over descendants. The new `SnippetTreePicker` can drive drill via `listFolder` (same pattern as `runner-view.ts:604`) and tree-wide search via `listFolderDescendants` or a new flat helper.
- **`src/views/runner-view.ts` lines ~582–660+** — existing drill-down picker (breadcrumb bar, Up button, folder-row `rp-snippet-folder-row`, snippet-row rendering, empty-state copy). Read this first before designing the new component — its D-02/D-03/D-05/D-13..D-17 Phase 30 decisions define the interaction grammar users already know.
- **`src/views/folder-picker-modal.ts`** — tiny (34-line) `SuggestModal<string>` with substring filter; demonstrates the exact matching semantics to port (D-10).
- **`src/views/snippet-editor-modal.ts`** — current «Папка» field implementation; constructor wiring will change to host the new picker.
- **SnippetNode existing fields** (`graph-model.ts:83-90`): `subfolderPath?`, `snippetLabel?`, `radiprotocol_snippetSeparator?`. New `snippetPath?` slots in without touching any other arm.

### Established Patterns

- **Append-only CSS per feature file** (CLAUDE.md) — a new `snippet-tree-picker.css` is the only correct place for new styles; must be added to `CSS_FILES` in `esbuild.config.mjs`.
- **`pendingEdits` + `scheduleAutoSave` pattern** in `editor-panel-view.ts` — picker callbacks follow this (write both the persisted property and a mirrored `text` field, then `scheduleAutoSave()`).
- **Undo discipline in `ProtocolRunner`** — «push `UndoEntry` BEFORE any mutation» (Phase 30 D-08 / `protocol-runner.ts:256`) — D-15 auto-insert undo must follow this.
- **Pattern B live-editor** (Phase 28/50) — canvas writes while canvas view is open go through `CanvasLiveEditor.saveLiveBatch` / `saveLive`; D-05 Node Editor edits will already use this path via the existing `saveNodeEdits` plumbing. Adding a new property (`radiprotocol_snippetPath`) into `pendingEdits` requires no new write surface — `saveLive` already handles arbitrary property writes.
- **RUNFIX-02 scroll capture** (`runner-view.ts` Phase 47 Plan 02) — `capturePendingTextareaScroll()` must be the FIRST line of any new choice-click handler in the Runner sibling-button path for specific-bound snippets.

### Integration Points

- **Canvas-parser** reads the new property with a single additional line in the snippet-node parse arm (similar to how Phase 43+ added `radiprotocol_subfolderPath`).
- **GraphValidator** gains one new check in the snippet-node validation arm (D-04). Fits the existing LOOP-04-style pattern — emit structured Russian error with nodeId.
- **ProtocolRunner state machine** — auto-insert (D-13) fires at the transition into a Question node, **before** the `at-node` render decides to show choice buttons. Existing `at-node` / `awaiting-snippet-pick` / `awaiting-snippet-fill` enum values remain sufficient (D-14 — no new state).
- **RunnerView** — two arms change: `awaiting-snippet-pick` (D-06 rewrite on top of picker), and the `at-node` Question choice-list path gains the specific-bound sibling-button branch (D-16 caption + D-13 auto-insert dispatch vs click).

</code_context>

<specifics>
## Specific Ideas

- Document emoji **`📄`** for specific-bound snippet sibling buttons — intentionally distinct from the existing folder emoji **`📁`** used for directory-bound snippet buttons (Phase 31). Makes the two binding variants visually distinguishable at a glance in a sibling list.
- Tree-wide search result secondary line shows the **full relative path from the picker's `rootPath`** — required to disambiguate duplicate filenames across folders in large vaults. Planner may use an Obsidian utility CSS colour variable (e.g. `var(--text-muted)`) for the secondary line.
- Node Editor inline picker should not explode the editor panel height — a vertically-scrollable container capped at a sensible max-height (planner picks exact value; see Phase 47 RUNFIX-03 precedent for narrow-sidebar CSS) is required.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-select in pickers** — choosing multiple files at once, e.g. to create a snippet-group node. Not in PICKER-01/02 scope; user has not requested it.
- **Persisted drill-state across picker re-opens** — could remember last-visited folder per call-site. Nice-to-have; adds state-management complexity without a concrete user pain point in v1.8.
- **Fuzzy search (`prepareFuzzySearch`)** — explicitly rejected in D-10 for v1.8. Can be revisited in a future milestone if snippet libraries grow past a size where substring search becomes painful.
- **Automatic migration of legacy directory-bound canvases to the new `snippetPath` shape** — explicitly rejected by D-01 and Pitfall #11; not a goal of Phase 51.
- **Runner UI variant for multi-variant picker** (sibling specific-bound + directory-bound Snippet nodes in the same Question) — flagged Out-of-Scope in REQUIREMENTS.md and covered incidentally by D-16 sibling caption.
- **New `snippetService.listAllEntries()` flat API** — only land if the planner decides the tree-wide search needs it; otherwise recurse existing APIs.

</deferred>

---

*Phase: 51-snippet-picker-overhaul*
*Context gathered: 2026-04-19*
