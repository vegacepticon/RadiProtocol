---
date: 2026-07-30T09:21:44+0300
author: Roman Shulgha
commit: 51d89a7
branch: main
repository: RadiProtocol
topic: "Snippet Editor two-pane file manager redesign"
tags: [research, codebase, snippet-manager-view, snippet-service, search, drag-and-drop]
status: ready
last_updated: 2026-07-30T09:21:44+0300
last_updated_by: Roman Shulgha
---

# Research: Snippet Editor two-pane file manager redesign

## Research Question
How should the current single recursive Snippet Manager be refactored into a two-pane file manager with a folders-only tree, selected-folder snippet list, debounced global name/folder/content search, root empty-area creation, and preserved menus, rename, and drag-and-drop? In particular, where should content-reading live, how should state and async refresh behave, and which existing contracts and precedents constrain the change?

## Summary
The current manager is a single mixed recursive tree. `SnippetManagerView` builds folders and files together, while `SnippetManagerTreeRenderer` renders both kinds through one row path and also contains a duplicate recursive model builder (`src/views/snippet-manager-view.ts:182-217`, `src/views/snippet-manager/tree-renderer.ts:142-197`). The two-pane boundary already exists in `SnippetService.listFolder()`, which returns direct folders and parsed direct snippets separately (`src/snippets/snippet-service.ts:103-155`).

The left pane can remain a recursive folder model rooted at `settings.snippetFolderPath`; the right pane can use direct `listFolder(selectedFolderPath).snippets`. A visible root row is new: the current model begins with the root's children, so no row represents the configured root (`src/views/snippet-manager-view.ts:182-184`). `selectedFolderPath` has no settings counterpart and should remain view-local, initialized to root on open; only expanded paths are persisted (`src/settings.ts:20-42`). Rename and move already expose old/new path pairs suitable for prefix reconciliation, while delete and external disappearance require explicit fallback because current deletion removes only the exact expanded path (`src/views/snippet-manager-view.ts:385-396`, `src/views/snippet-manager-view.ts:531-569`).

Existing service methods can technically enumerate and load all searchable snippets: `listFolderDescendants()` returns recursive paths and `load()` returns a parsed snippet or `null` (`src/snippets/snippet-service.ts:166-180`, `src/snippets/snippet-service.ts:282-304`). The content field differs by variant: plain Markdown uses `content`; Markdown templates use the frontmatter-free `template` body (`src/snippets/snippet-model.ts:27-57`). Repository boundaries favor placing any aggregate content-reading helper in `SnippetService`, where path checks, `.md` filtering, parsing, and unreadable-file behavior already live; view code should own query state and presentation rather than direct adapter reads.

`SnippetTreePicker` is the strongest async-search precedent: 120 ms debounce, trim + case-insensitive substring matching, old results retained while scanning, and post-await guards for unmount or superseding queries (`src/views/snippet-tree-picker.ts:435-472`). Its current folder matching renders folder rows and does not promote their snippets (`src/views/snippet-tree-picker.ts:481-523`). The developer resolved the manager-specific behavior: matching a folder name includes all descendant snippets, while results remain snippet-only. Active search must rerun after debounced create/delete/rename/modify events.

## Detailed Findings

### Current model and two-pane split
- `TreeNodeFolder` recursively contains the mixed `TreeNode` union; `TreeNodeFile` carries path, name, and snippet kind (`src/views/snippet-manager/tree-renderer.ts:19-31`).
- The view recursively builds folder nodes and file nodes, sorts each group, then concatenates them folders-first (`src/views/snippet-manager-view.ts:187-217`). The folders-only split must therefore occur recursively, not only at the root return.
- The renderer independently duplicates the same recursive mixed model build after expansion and rename (`src/views/snippet-manager/tree-renderer.ts:142-197`). This is an existing source-of-truth inconsistency.
- `render()` clears one container and emits every visible node as a sibling row; depth is represented by inline indentation, not nested DOM (`src/views/snippet-manager/tree-renderer.ts:104-115`, `src/views/snippet-manager/tree-renderer.ts:202-212`, `src/views/snippet-manager/tree-renderer.ts:295-305`).
- There is no selected-folder state. Folder click and Enter/Space currently toggle expansion; file activation opens the editor (`src/views/snippet-manager/tree-renderer.ts:243-252`, `src/views/snippet-manager/tree-renderer.ts:279-293`). Separating row selection from chevron expansion is therefore a new interaction contract.
- The root path is canonical for model building and root creation but has no model node (`src/views/snippet-manager-view.ts:79-90`, `src/views/snippet-manager-view.ts:182-184`). A synthetic root row must not accidentally inherit ordinary folder rename/move/delete behavior, which the generic folder branch currently gives every folder (`src/views/snippet-manager/tree-renderer.ts:344-378`).

### Selection, expansion, and mutation state
- `snippetTreeExpandedPaths` is persisted settings state; no selected-folder field exists in settings (`src/settings.ts:20-42`). View-local fields such as `currentlyEditingPath` establish the session-state precedent (`src/views/snippet-manager-view.ts:36-54`).
- Folder creation expands the parent and new path, then saves settings (`src/views/snippet-manager-view.ts:297-315`).
- Folder moves call a shared old/new prefix rewrite for every expanded descendant (`src/views/snippet-manager-view.ts:531-569`). Folder inline rename uses the same callback after service rename (`src/views/snippet-manager/tree-renderer.ts:567-586`). These paths expose enough identity to keep a selected folder aligned after rename or move.
- Folder deletion removes only the exact deleted path from expanded state, not stale descendant entries (`src/views/snippet-manager-view.ts:385-396`). A selected deleted folder or selected descendant has no current reconciliation behavior.
- Vault create/delete/rename events rebuild and rerender after 120 ms, but no mounted flag or generation check protects a close or overlapping rebuild (`src/views/snippet-manager-view.ts:130-176`). The developer chose to add modify-triggered refresh and rerun active search after the shared debounce.

### Search IO and matching semantics
- `assertInsideRoot()` rejects traversal, absolute paths, and sibling-prefix escapes before service reads (`src/snippets/snippet-service.ts:65-80`).
- `listFolder()` lists direct folders, filters lowercase `.md`, reads and parses each file, silently skips unreadable files, and returns sorted parsed snippets (`src/snippets/snippet-service.ts:103-155`).
- `load()` repeats path safety and parsing for one lowercase `.md` path, returning `null` for unsupported, missing, unreadable, or failed parses (`src/snippets/snippet-service.ts:166-180`).
- `listFolderDescendants()` is breadth-first and extension-agnostic because it also supports physical folder-delete counts (`src/snippets/snippet-service.ts:282-304`). Search must therefore exclude legacy/non-Markdown files before loading.
- There is a live suffix inconsistency: picker filtering accepts `.md` case-insensitively (`src/views/snippet-tree-picker.ts:491-503`), while `listFolder()` and `load()` accept only lowercase `.md` (`src/snippets/snippet-service.ts:128-150`, `src/snippets/snippet-service.ts:166-170`).
- Existing aggregate service precedent exists in `listAllFolders()`, which composes descendant enumeration, root inclusion, deduplication, and sorting inside the service (`src/snippets/snippet-service.ts:479-488`). This supports resolving the discover open question in favor of a service-owned aggregate content-read surface rather than view-local adapter access.
- Plain Markdown searchable body is `content`; template searchable body is `template`, excluding parsed frontmatter (`src/snippets/snippet-model.ts:27-57`).
- The picker keeps existing results visible during async enumeration and rejects completion after unmount or query supersession (`src/views/snippet-tree-picker.ts:458-476`). The manager currently has neither search generation state nor an in-flight close guard.
- Developer decision: folder-name matching includes every snippet below a matching folder at any depth. File-name and body matches remain direct case-insensitive substring matches; result rows remain snippets with their containing folder path.

### Menus, rename, and drag-and-drop
- File menus expose Edit/Rename/Move/Delete; folder menus expose Create snippet/Create subfolder/Rename/Move/Delete (`src/views/snippet-manager/tree-renderer.ts:312-380`).
- Every row context-menu handler calls `preventDefault()` and `stopPropagation()`, so an ancestor empty-area handler can coexist without double-opening on rows (`src/views/snippet-manager/tree-renderer.ts:254-259`). Root creation already routes through `openCreateModal(root)` and `handleCreateSubfolder(root)` (`src/views/snippet-manager-view.ts:79-90`, `src/views/snippet-manager-view.ts:258-267`, `src/views/snippet-manager-view.ts:274-315`).
- Every current row is draggable. Files and folders use distinct custom MIME types; a file target redirects to its parent folder; same-folder file moves and folder self/descendant moves are forbidden (`src/views/snippet-manager/tree-renderer.ts:385-436`, `src/views/snippet-manager/tree-renderer.ts:450-465`).
- Real-DOM compatibility in inline rename deliberately uses `parentElement` first and the test mock's `parent` only as fallback (`src/views/snippet-manager/tree-renderer.ts:478-481`). Enter/blur settlement prevents duplicate commits (`src/views/snippet-manager/tree-renderer.ts:497-545`).
- Successful folder rename/move rewrites protocol references and expanded prefixes; file move also rewrites protocol references (`src/views/snippet-manager/tree-renderer.ts:567-586`, `src/views/snippet-manager-view.ts:510-546`).
- Search-result snippet rows retain their real absolute paths, so they can preserve edit/rename/move/delete and file-drag source identity. Under current target semantics, dropping onto a global result would target that result's actual containing folder, not the selected left folder (`src/views/snippet-manager/tree-renderer.ts:385-398`).

### DOM, CSS, i18n, and test seams
- Current CSS is one vertical root/header/body chain; there are no pane, selected-folder, or search-result styles (`src/styles/snippet-manager.css:159-217`).
- The file icon is unconditional in the renderer and occupies a fixed 15 px box in CSS (`src/views/snippet-manager/tree-renderer.ts:223-224`, `src/styles/snippet-manager.css:237-245`). Removing it requires removing both output and spacing for right-pane snippet rows.
- Existing visual states cover hover, focus, editing, drag source, valid/forbidden drop, and rename input, but not folder selection (`src/styles/snippet-manager.css:190-217`, `src/styles/snippet-manager.css:395-419`).
- Existing tests collect folder and file rows from one tree and assert root paths together (`src/__tests__/snippet-tree-view.test.ts:306-325`). They also explicitly assert the prior master-detail class names remain absent (`src/__tests__/snippet-tree-view.test.ts:328-344`), so that source-level regression assertion conflicts with a deliberate two-pane redesign.
- DnD tests find rows directly among one `treeRootEl.children` list and verify MIME, guards, file-to-parent redirection, and expanded-prefix rewriting (`src/__tests__/snippet-tree-dnd.test.ts:376-382`, `src/__tests__/snippet-tree-dnd.test.ts:417-560`, `src/__tests__/snippet-tree-dnd.test.ts:689-718`).
- Watcher tests cover event registration, 120 ms debounce, root-prefix filtering, and cancellation before the callback begins; they do not cover modify events, overlapping rebuilds, or close during an already-running read (`src/__tests__/snippet-vault-watcher.test.ts:201-286`).
- New manager copy must be present in both locale files under `snippetManager.*`; user-authored names and paths remain raw display/interpolation values.

## Code References
- `src/views/snippet-manager-view.ts:68-176` — Lifecycle, current header, one tree container, watchers, close, and redraw debounce.
- `src/views/snippet-manager-view.ts:182-225` — Recursive mixed model construction and renderer handoff.
- `src/views/snippet-manager-view.ts:274-319` — Folder creation validation and expanded-state updates.
- `src/views/snippet-manager-view.ts:345-396` — Folder deletion, descendant enumeration, and exact-only expanded cleanup.
- `src/views/snippet-manager-view.ts:504-569` — Shared move orchestration and expanded-prefix rewrite.
- `src/views/snippet-manager/tree-renderer.ts:19-63` — Mixed tree types and callback contract.
- `src/views/snippet-manager/tree-renderer.ts:104-197` — Render entry, expansion state, and duplicate model builder.
- `src/views/snippet-manager/tree-renderer.ts:202-305` — Shared folder/file row DOM and interactions.
- `src/views/snippet-manager/tree-renderer.ts:312-380` — Existing file and folder context menus.
- `src/views/snippet-manager/tree-renderer.ts:385-465` — DnD source/target and guard behavior.
- `src/views/snippet-manager/tree-renderer.ts:478-586` — Real/mock DOM rename compatibility and commit flow.
- `src/snippets/snippet-service.ts:65-80` — Root path-safety gate.
- `src/snippets/snippet-service.ts:103-180` — Direct listing, parsing, filtering, and single-snippet load.
- `src/snippets/snippet-service.ts:282-304` — Recursive extension-agnostic descendant enumeration.
- `src/snippets/snippet-model.ts:27-57` — Variant-specific searchable body fields.
- `src/views/snippet-tree-picker.ts:435-528` — Debounce, stale guards, basename matching, and result rendering precedent.
- `src/settings.ts:20-42` — Persisted settings boundary.
- `src/styles/snippet-manager.css:159-217` — Current single-pane structure and row states.
- `src/__tests__/snippet-tree-view.test.ts:306-390` — Current single-tree structure and activation assumptions.
- `src/__tests__/snippet-tree-dnd.test.ts:417-560` — Existing DnD regression coverage.
- `src/__tests__/snippet-vault-watcher.test.ts:201-286` — Existing watcher/debounce coverage.

## Integration Points

### Inbound References
- `src/main.ts` — Registers and activates `SnippetManagerView`; the view is reused as an Obsidian `ItemView` instance.
- `src/__tests__/snippet-tree-view.test.ts:306-390` — Exercises manager rendering, file activation, and empty-folder output.
- `src/__tests__/snippet-tree-dnd.test.ts:391-560` — Exercises row drag sources/targets and move delegation.
- `src/__tests__/snippet-vault-watcher.test.ts:201-286` — Exercises vault-event refresh behavior.

### Outbound Dependencies
- `src/views/snippet-manager-view.ts:109-123` — Instantiates `SnippetManagerTreeRenderer` and supplies CRUD/state callbacks.
- `src/snippets/snippet-service.ts:103-180` — Supplies safe folder listing and parsed snippet loading.
- `src/snippets/snippet-service.ts:282-304` — Supplies recursive path enumeration.
- `src/views/snippet-manager-view.ts:513-540` — Calls snippet move operations and `rewriteProtocolSnippetRefs`.
- `src/views/snippet-manager-view.ts:232-267` — Opens `SnippetEditorModal` for edit/create flows.
- `src/views/snippet-manager-view.ts:274-319` — Opens `ConfirmModal` for folder creation.
- `src/views/snippet-manager/tree-renderer.ts:312-380` — Uses Obsidian `Menu` for row actions.
- `src/i18n/locales/en.json` — English `snippetManager.*` copy.
- `src/i18n/locales/ru.json` — Russian `snippetManager.*` copy.

### Infrastructure Wiring
- `src/views/snippet-manager-view.ts:130-145` — Vault create/delete/rename subscriptions registered through `registerEvent`; modify is absent in current code.
- `src/views/snippet-manager-view.ts:160-176` — Root-prefix filter and shared 120 ms redraw debounce.
- `src/settings.ts:20-42` — Configured snippet root and persisted expansion paths.
- `src/styles/snippet-manager.css:159-217` — Manager root/header/body and shared row styling.

## Architecture Insights
- The natural split is already expressed by `SnippetService.listFolder()` returning `{ folders, snippets }`; the current view erases that separation by concatenating two models.
- `SnippetManagerView` should remain the state/orchestration owner, while renderer code remains responsible for DOM interactions. The current renderer's duplicate model builder weakens that boundary and is the main refactor hazard.
- Safe aggregate content IO belongs at the snippet service boundary. Direct vault adapter reads in the view would duplicate `assertInsideRoot()`, extension filtering, parsing, and unreadable-file policy.
- Selected folder is transient navigation state; expanded folders are durable UI preference. Their lifetimes should remain distinct.
- Async scans need both query-generation and lifecycle guards. The existing picker guard is a proven precedent; the current manager redraw path has neither.
- Search refresh and model refresh must be coordinated through one invalidation generation to prevent older reads from repainting after newer query or watcher state.
- Matching a folder name is transitive by developer decision: every descendant snippet participates, while result presentation remains flat and snippet-only.
- Root is a special navigation entity, not an ordinary mutable folder row; current generic folder actions cannot be applied blindly.

## Precedents & Lessons
8 similar past changes analyzed.

### Precedent: Recursive Snippet Manager rewrite
**Commit(s)**: `ccbd9935` — "feat(33-04): rewrite SnippetManagerView as recursive tree with modal wiring" (2026-04-15)
**Blast radius**: 2 files across views and tests; replaced the master-detail manager with the recursive tree and introduced watcher redraw, context menus, and expansion persistence.

**Follow-up fixes**:
- `77b62c1` — "fix(34-05): use parentElement in startInlineRename so F2/ПКМ rename works in real DOM" (2026-04-15) — tests exposed a mock-only `.parent` property while real DOM required `parentElement`.
- `7919cb0` — "fix: preserve snippet names during create and rename" (2026-05-26) — corrected name preservation after later renderer extraction.

**Takeaway**: Large manager-layout changes have historically produced immediate real-DOM and identity follow-ups.

### Precedent: Renderer extraction
**Commit(s)**: `eb5c670` — "v1.13 AI-Agent Friction Reduction and Codebase Health (#2)" (2026-05-02)
**Blast radius**: 3 files across views and CSS; extracted `tree-renderer.ts` and substantially reduced `snippet-manager-view.ts`.

**Follow-up fixes**:
- `7e2918f` — "fix: disconnect shared library subsystem from plugin wiring" (2026-06-02) — removed an unused renderer callback slot after the dependent subsystem was deleted.

**Lessons from docs**:
- `.rpiv/artifacts/designs/2026-06-02_12-40-01_cleanup-and-ux-fixes.md` — recorded the dead callback wiring before removal.

**Takeaway**: A renderer contract split should be followed by an orphaned-callback audit.

### Precedent: DnD and inline rename
**Commit(s)**: `e4b07bf1` — "feat(34-02): HTML5 drag-and-drop lifecycle on snippet tree rows" (2026-04-15)
**Blast radius**: manager view, CSS, and DnD tests; established custom MIME, file-to-parent targets, and self/descendant rejection.

**Follow-up fixes**:
- `77b62c1` — corrected test-DOM versus real-DOM traversal on the same day.

**Takeaway**: Preserve absolute path identity and the `parentElement`-first compatibility pattern when rows move between panes.

### Precedent: Search flicker and stale-query guard
**Commit(s)**: `fed8242f` — "fix: eliminate search flicker in SnippetTreePicker modal" (2026-05-20)
**Blast radius**: picker and picker tests; delayed body teardown until after async enumeration and added a stale-query guard.

**Follow-up fixes**:
- Later picker sizing changes required separate layout corrections, showing that fixed-height search containers are brittle.

**Lessons from docs**:
- `.rpiv/artifacts/plans/2026-06-14_12-56-14_snippet-selection-regression-fixes.md` — covers picker sizing and host-specific layout corrections.
- `.rpiv/artifacts/slices/2026-07-26_16-13-35_snippet-create-from-selection-and-insert-modal-ux.md` — records search-body teardown constraints.

**Takeaway**: Keep the previous right-pane results visible during reads and commit only the newest mounted request.

### Precedent: Hierarchical library browser search
**Commit(s)**: `28d14dbe` — "feat: hierarchical library browser with search, breadcrumbs, and bulk install" (2026-05-21)
**Blast radius**: 7 files across views, snippets, styles, locales, and tests; used a 120 ms multi-field search.

**Follow-up fixes**:
- `7e2918f` — removed the whole disconnected library subsystem on 2026-06-02.

**Takeaway**: Search implementation is straightforward; keeping ownership narrow and avoiding disconnected subsystems is the maintainability constraint.

### Composite Lessons
- `ccbd9935` and `e4b07bf1` show that manager rewrites need focused UAT for real Obsidian DOM, not only MockEl tests.
- `fed8242f` establishes the load-then-swap and stale-request pattern for asynchronous search.
- `eb5c670` and `7e2918f` show that callback contracts should stay minimal and be audited after structural refactors.
- `28d14dbe` shows the established 120 ms debounce and bilingual multi-field-search footprint, while its later removal warns against creating a parallel subsystem.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-07-30_08-34-54_snippet-editor-two-pane-file-manager.md` — Feature requirements and chosen UX decisions.
- `.rpiv/artifacts/designs/2026-06-02_12-40-01_cleanup-and-ux-fixes.md` — Prior snippet-manager/library cleanup design.
- `.rpiv/artifacts/validation/2026-06-02_19-07-46_cleanup-and-ux-fixes.md` — Validation of renderer callback cleanup.
- `.rpiv/artifacts/plans/2026-06-14_12-56-14_snippet-selection-regression-fixes.md` — Picker layout regression plan.
- `.rpiv/artifacts/slices/2026-07-26_16-13-35_snippet-create-from-selection-and-insert-modal-ux.md` — Picker search-body and keyboard interaction slice.

## Developer Context
**Q (discover: Keep existing row context menus): Pre-resolved from codebase evidence — confirmed in Step 4.**
A: Keep existing context menus unchanged.

**Q (discover: Keep inline rename and drag-and-drop): Pre-resolved from codebase evidence — confirmed in Step 4.**
A: Keep rename + drag/drop.

**Q (discover: Left-pane nested folder representation): How should nested folders be represented in the left (folders-only) pane?**
A: Collapsible nested tree.

**Q (discover: Content search implementation): How should content search (by snippet content) be implemented, given no service API exists for it?**
A: Load-on-demand scan.

**Q (discover: Search results presentation): When a search query is active, how should results be shown in the two-pane layout?**
A: Flat global results.

**Q (discover: Remove header buttons): Confirm: remove the `+ New`, `+ Folder`, and `Collapse All` header buttons entirely (creation via context menu only)?**
A: Remove all three.

**Q (discover: Empty-area context menu items): Right-clicking an EMPTY area of the page should offer which items (targeting the root snippets folder)?**
A: "Create Folder" AND "Create Snippet".

**Q (discover: Selected-folder persistence): Should the selected (highlighted) folder persist across sessions, or always reset to root on view open?**
A: Always start at root.

**Q (discover: Remove snippet document icon): Pre-resolved from input — the `file-text` icon before each snippet name should be removed for a cleaner row.**
A: Remove the icon.

**Q (discover: Snippet row shows name only): Pre-resolved from input — each snippet row only needs to show the snippet name.**
A: Name only.

**Q (discover: Search field always visible in top bar): Pre-resolved from input — the search field should always remain visible in the top bar.**
A: Always-visible search input.

**Q (`src/views/snippet-tree-picker.ts:481-523`, `src/snippets/snippet-service.ts:282-304`): When a folder name matches but manager results must remain snippet-only, which snippets should appear?**
A: Include all descendant snippets at any depth.

**Q (`src/views/snippet-manager-view.ts:130-176`): While global search is active, how should vault changes refresh results, given current watchers omit `modify`?**
A: Rerun the active search after debounce and add modify-event refresh so content-only edits update matches.

## Related Research
- None found for this exact two-pane redesign.

## Open Questions
- None. The discover question about contents-reading placement is resolved in favor of a `SnippetService` aggregate read boundary; folder-match and active-search refresh semantics were resolved during the developer checkpoint.
