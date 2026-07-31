---
date: 2026-07-30T08:34:54+0300
author: Roman Shulgha
commit: 51d89a7
branch: main
repository: RadiProtocol
topic: "Snippet Editor two-pane file manager redesign"
tags: [intent, frd, snippet-manager-view, snippet-manager, snippet-service, search]
status: ready
last_updated: 2026-07-30T08:34:54+0300
last_updated_by: Roman Shulgha
---

# FRD: Snippet Editor two-pane file manager redesign

## Summary
Redesign the `SnippetManagerView` from a single nested folder-and-snippet tree into a conventional two-pane file manager: a ~260–300 px left pane holding a collapsible folders-only tree, and a right pane showing a compact snippet list (name only, no document icon) for the selected/highlighted folder. An always-visible top search bar searches snippet name, folder name, and snippet content across the whole library, showing a flat global results list while a query is active. The `+ New` / `+ Folder` / `Collapse All` header buttons are removed; creation is exposed via row and empty-area context menus. Existing row context menus, inline rename, and drag-and-drop are preserved.

## Problem & Intent
The plugin author finds the current Snippet Editor layout cluttered. The motivation is **author organization** — a cleaner, more conventional file-manager UX — not end-user protocol speed or library-scalability pressure. Success looks like a tidy two-pane file manager where the selected folder stays visually highlighted, nested folders are navigable, and the most common operations are reachable through right-click rather than dedicated header buttons.

## Goals
- Replace the single nested tree with a two-pane layout: folders-only left pane (~260–300 px) + compact snippet list right pane.
- Keep the selected folder visually highlighted so the current directory is always obvious.
- Support navigation through nested folders via expand/collapse in the left pane.
- Add an always-visible top search bar that searches snippet name, folder name, and snippet content across the whole library.
- Remove the `+ New`, `+ Folder`, and `Collapse All` header buttons; creation moves to context menus.
- Add a "Create Folder" (and "Create Snippet") action on right-clicking an empty area of the page, targeting the root snippets folder, following the existing row context-menu interaction pattern.
- Remove the document (`file-text`) icon shown before each snippet name for a cleaner row.
- Snippet rows show only the snippet name.

## Non-Goals
- Backend, auth, or cloud sync — plugin-local only (project invariant).
- A sidebar / `RunnerView` — inline-only runner is unchanged (ADR-0001).
- Persisting the selected folder across sessions — the view always opens at the root snippets folder.
- Changing the existing snippet editor modal (`SnippetEditorModal`) itself; only the manager view layout changes.
- Maintaining an in-memory content search index — search reads contents on demand.
- Changing snippet data model, `SnippetService` path-safety/root semantics, or settings shape beyond what the new view state requires.

## Functional Requirements
1. The system SHALL render `SnippetManagerView` as two panes: a left pane ~260–300 px wide containing a folders-only collapsible tree, and a right pane listing snippets of the selected folder.
2. The system SHALL show only folders in the left pane; snippets SHALL NOT appear in the left pane.
3. The system SHALL render each snippet row in the right pane showing only the snippet name, with NO leading document/file icon.
4. The system SHALL keep the currently selected folder visually highlighted in the left pane for as long as it is the active directory.
5. The system SHALL support nested-folder navigation by expanding/collapsing folders in the left pane (reusing the existing persisted expanded-paths behavior).
6. The system SHALL provide an always-visible search input in the top bar of the view.
7. The system SHALL match the active query against snippet names, folder names, AND snippet contents across the entire snippets library (root and all descendants).
8. The system SHALL implement content search as a load-on-demand scan that reads snippet file contents at search time (debounced), with no maintained index.
9. The system SHALL, while a search query is active, switch the right pane to a flat global results list spanning all folders; each result SHALL show the snippet name and its folder path. Clearing the query SHALL restore the selected-folder snippet list.
10. The system SHALL remove the `+ New`, `+ Folder`, and `Collapse All` header buttons from the view.
11. The system SHALL preserve the existing snippet-row context menu (Edit / Rename / Move / Delete) and folder-row context menu (Create snippet here / Create subfolder / Rename / Move / Delete) unchanged in the new layout.
12. The system SHALL preserve inline rename and drag-and-drop move behaviors on rows in the new layout.
13. The system SHALL offer a context menu on right-clicking an empty area of the page containing at least "Create Folder" and "Create Snippet" items, both targeting the root snippets folder, following the same interaction pattern as the existing row context menus.
14. The system SHALL open the view with the root snippets folder selected (no persisted selected-folder state).

## Non-Functional Requirements
- **Performance**: Search is debounced; the load-on-demand scan reads snippet contents per search. No hard latency target, but must remain responsive for typical snippet libraries (tens to low hundreds of files). Must not read contents when no query is active.
- **Security**: All paths stay under the configured `snippetFolderPath` root via existing `SnippetService` path-safety checks. No new network/eval surface.
- **UX / Accessibility**: Conventional two-pane file-manager interaction; selected folder stays highlighted; creation via right-click; keyboard expand/collapse (Enter/Space) on folder rows preserved from the existing renderer.
- **Reliability**: Reuse existing `SnippetService` CRUD and vault-watcher refresh; the view rebuilds its folder model the same way it does today. Search does not mutate state; clearing the query deterministically restores the selected-folder list.

## Constraints & Assumptions
- **Technical**: TypeScript + esbuild + Vitest; Obsidian `ItemView` + DOM primitives (divs/spans, not Obsidian `TreeItem`). Dependency direction `views/ → [snippets/ ...]` must hold — no reverse imports. `SnippetService` has no `searchContents`-style API today; content search is new view-layer logic.
- **i18n**: Any new UI strings (e.g., empty-area menu items, search placeholder) MUST be added to BOTH `src/i18n/locales/en.json` and `src/i18n/locales/ru.json` under `componentName.stringName` keys; user-authored content is never wrapped in `t()`.
- **Tests**: Vitest; render layer tested with `MockEl` + host spies (see `__tests__/runner/render-question.test.ts`); manager view tested via `__tests__/snippet-tree-view.test.ts` etc. New two-pane render modes need new/updated tests.
- **Assumption**: The existing `SnippetService.listFolder()` and `listFolderDescendants()` APIs are sufficient to enumerate folders (left pane) and snippets (right pane) without new service methods, except possibly a contents-reading helper for search (research to confirm where it lives).
- **Assumption**: Persisted `snippetTreeExpandedPaths` remains the source of truth for left-pane expand/collapse state.

## Acceptance Criteria
- [ ] Opening the Snippet Manager view shows a left pane ~260–300 px wide with folders only and a right pane listing snippets of the root folder; no snippets appear in the left pane.
- [ ] Selecting a folder in the left pane highlights it and updates the right pane to that folder's snippets.
- [ ] Each right-pane snippet row shows only the snippet name; no `file-text` icon is rendered.
- [ ] Nested folders can be expanded/collapsed in the left pane; expanded state persists across view rebuilds.
- [ ] A search input is always visible in the top bar.
- [ ] Typing a query matches snippet names, folder names, AND snippet content across the whole library; the right pane switches to a flat results list showing snippet name + folder path while the query is active; clearing the query restores the selected-folder list.
- [ ] The `+ New`, `+ Folder`, and `Collapse All` buttons are absent from the header.
- [ ] Right-clicking an empty area of the page opens a menu with "Create Folder" and "Create Snippet" items targeting the root snippets folder.
- [ ] Existing row context menus (snippet and folder), inline rename, and drag-and-drop still work as before.
- [ ] Reopening the view always selects the root snippets folder (no cross-session selected-folder persistence).
- [ ] New UI strings exist in both `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`.
- [ ] `npm test` exits 0; `npm run lint` exits 0; `npm run build` exits 0.

## Recommended Approach
Refactor `src/views/snippet-manager-view.ts` and `src/views/snippet-manager/tree-renderer.ts` into a two-pane layout: add a `selectedFolderPath` field (root on open) and a top search input; split rendering into a folders-only left tree (reusing the persisted expanded-paths model and folder rows from `tree-renderer.ts`) and a right snippet list populated via `SnippetService.listFolder(selectedFolderPath).snippets`; add a load-on-demand, debounced content scan (likely using `SnippetService.listFolderDescendants(root)` + `load(path)` per result) that drives a flat global results render mode in the right pane; remove the three header buttons; add an empty-area `contextmenu` listener that opens the existing `Menu` with "Create Folder"/"Create Snippet" items targeting `settings.snippetFolderPath`; drop the `file-text` icon from snippet rows; add new i18n keys to both locales. Keep the `views/ → snippets/` dependency direction; if a contents-reading helper is needed, add it to `SnippetService` (not the view).

## Decisions

### Keep existing row context menus
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4.
**Recommended**: Keep the existing snippet-row (Edit/Rename/Move/Delete) and folder-row (Create snippet here/Create subfolder/Rename/Move/Delete) context menus unchanged; only ADD the empty-area entries.
**Chosen**: Keep existing context menus unchanged.
**Rationale**: evidence: `src/views/snippet-manager/tree-renderer.ts:312-380` + confirmed; the developer only requested the empty-area addition.

### Keep inline rename and drag-and-drop
**Question**: Pre-resolved from codebase evidence — confirmed in Step 4.
**Recommended**: Keep inline rename (double-click label) and drag-and-drop move on rows in the new layout.
**Chosen**: Keep rename + drag/drop.
**Rationale**: evidence: `src/views/snippet-manager/tree-renderer.ts:529-553`, `src/styles/snippet-manager.css:395-415` + confirmed.

### Left-pane nested folder representation
**Question**: How should nested folders be represented in the left (folders-only) pane?
**Recommended**: Collapsible nested tree showing all folders, reusing persisted expanded-paths.
**Chosen**: Collapsible nested tree.
**Rationale**: Reuses existing `snippetTreeExpandedPaths` persistence and matches a conventional two-pane file manager; supports the requested nested-folder navigation and persistent selection highlight.

### Content search implementation
**Question**: How should content search (by snippet content) be implemented, given no service API exists for it?
**Recommended**: Load-on-demand scan — read snippet contents at search time, debounced, no index.
**Chosen**: Load-on-demand scan.
**Rationale**: Zero stale-index risk, simplest correct behavior; acceptable IO for typical snippet libraries; avoids extra state-sync machinery.

### Search results presentation
**Question**: When a search query is active, how should results be shown in the two-pane layout?
**Recommended**: Flat global results in the right pane (snippet name + folder path), left pane dims/stays.
**Chosen**: Flat global results.
**Rationale**: Required to satisfy searching by name + folder name + content across the whole library; clearing the query deterministically restores the selected-folder list.

### Remove header buttons
**Question**: Confirm: remove the `+ New`, `+ Folder`, and `Collapse All` header buttons entirely (creation via context menu only)?
**Recommended**: Remove all three.
**Chosen**: Remove all three.
**Rationale**: Creation is already available via context menus; collapse-all is unnecessary with a compact folders-only left tree; declutters the header per the stated intent.

### Empty-area context menu items
**Question**: Right-clicking an EMPTY area of the page should offer which items (targeting the root snippets folder)?
**Recommended**: Only "Create Folder".
**Chosen**: "Create Folder" AND "Create Snippet".
**Rationale**: Developer chose to mirror what a folder's context menu offers, keeping a quick root-level creation path despite removing the header buttons.

### Selected-folder persistence
**Question**: Should the selected (highlighted) folder persist across sessions, or always reset to root on view open?
**Recommended**: Persist across sessions.
**Chosen**: Always start at root.
**Rationale**: Developer opted for the simpler, deterministic open behavior; selected folder is session-scoped only.

### Remove snippet document icon
**Question**: Pre-resolved from input — the `file-text` icon before each snippet name should be removed for a cleaner row.
**Recommended**: Remove the icon.
**Chosen**: Remove the icon.
**Rationale**: evidence: `src/views/snippet-manager/tree-renderer.ts:44-46,223-226`; developer explicitly requested removal.

### Snippet row shows name only
**Question**: Pre-resolved from input — each snippet row only needs to show the snippet name.
**Recommended**: Name only in the right-pane snippet list.
**Chosen**: Name only.
**Rationale**: Developer explicitly requested; reduces visual noise.

### Search field always visible in top bar
**Question**: Pre-resolved from input — the search field should always remain visible in the top bar.
**Recommended**: Always-visible search input in the top bar.
**Chosen**: Always-visible search input.
**Rationale**: Developer explicitly requested; search is not hidden behind a toggle.

## Open Questions
- Where exactly should the contents-reading helper for content search live — on `SnippetService` (preserving the `views/ → snippets/` direction and keeping IO out of the view) or as a view-local utility? Left for `research` to resolve against the existing service surface and conventions.

## Suggested Follow-ups
- `SnippetTreePicker` (`src/views/snippet-tree-picker.ts:458-521`) duplicates a basename-only search pattern; once the manager has name+folder+content search, consider unifying the search logic as a shared helper to avoid divergence. Out of scope for this redesign.
- The `snippetKind` (`md` vs `md-template`) is tracked in the tree model (`src/views/snippet-manager/tree-renderer.ts:19-31`) but does not affect row rendering; the cleaner two-pane rows could be a place to surface it if ever desired. Out of scope.

## References
- User free-text input (discover skill argument): two-pane file manager redesign request.
- `src/views/snippet-manager-view.ts` — main view (lifecycle, header, model, actions).
- `src/views/snippet-manager/tree-renderer.ts` — tree rendering, context menus, rename, drag/drop.
- `src/snippets/snippet-service.ts` — `SnippetService` CRUD + `listFolder` / `listFolderDescendants` / `listAllFolders`.
- `src/views/snippet-tree-picker.ts` — existing basename-only search (reference for reuse).
- `src/settings.ts` — `snippetFolderPath`, `snippetTreeExpandedPaths`.
- `src/styles/snippet-manager.css` — manager/tree layout CSS.