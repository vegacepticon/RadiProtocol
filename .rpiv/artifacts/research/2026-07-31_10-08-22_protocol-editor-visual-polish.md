---
date: 2026-07-31T10:08:22+0300
author: Roman Shulgha
commit: 8d2f9bb
branch: main
repository: RadiProtocol
topic: "Protocol Editor visual polish — dotted grid, consolidated auto-layout button, snippet tooltip removal"
tags: [research, codebase, protocol-editor, snippet-manager, accessibility, styles]
status: ready
last_updated: 2026-07-31T10:08:22+0300
last_updated_by: Roman Shulgha
---

# Research: Protocol Editor visual polish — dotted grid, consolidated auto-layout button, snippet tooltip removal

## Research Question
How should the three visual-polish changes defined in `.rpiv/artifacts/discover/2026-07-31_09-45-07_protocol-editor-visual-polish.md` fit the current codebase: a zoom-aligned two-level dotted grid, one auto-layout button backed by an Obsidian Menu, and tooltip-free snippet panes that retain durable screen-reader names?

## Summary
The three changes remain confined to styles, view rendering, and regression tests. The grid is painted entirely by `.rp-protocol-editor-viewport`; `applyZoom()` already publishes the same zoom factor used by the transformed surface, and the stylesheet already relies on the required `color-mix(..., transparent)` syntax (`src/styles/protocol-editor.css:18-29`, `src/views/protocol-editor-view.ts:1927-1947`). The selected 24px fine / 120px coarse spacing preserves the current 24px unit and aligns each coarse point with every fifth fine point; fixed 1px/2px radii keep dots legible while only spacing scales with zoom.

The existing two auto-layout controls are only trigger UI. Both already map vertical to `TB` and horizontal to `LR`; `autoLayoutNodes()` owns dagre layout, geometry persistence, `layoutDirection`, notices, and reload behavior (`src/views/protocol-editor-view.ts:612-630`, `src/views/protocol-editor-view.ts:1804-1888`). The repository’s canonical Menu precedent is `SnippetManagerTreeRenderer`: construct `Menu`, add localized items, and position it from the originating `MouseEvent` (`src/views/snippet-manager/tree-renderer.ts:172-184`). Existing locale keys cover the consolidated button and both menu entries.

The snippet pane roots are passed directly to `SnippetManagerTreeRenderer`, whose every render starts by emptying both roots (`src/views/snippet-manager-view.ts:126-160`, `src/views/snippet-manager/tree-renderer.ts:111-140`). Therefore headings created once in `onOpen()` would be removed during the initial asynchronous refresh. The chosen ownership is for the renderer to recreate both localized hidden headings immediately after each `empty()` and before any row. A generic `.rp-sr-only` utility belongs in `_utilities.css`; the existing picker-scoped implementation is the property precedent and will migrate to the shared class (`src/styles/_utilities.css:1-3`, `src/styles/snippet-tree-picker.css:374-381`).

## Detailed Findings

### Dotted viewport grid
- The viewport’s dimensions, overflow, base color, two line gradients, and shared zoom-scaled 24px repeat interval are all declared together (`src/styles/protocol-editor.css:18-29`). No DOM or canvas drawing code paints the grid.
- `applyZoom()` writes `--rp-protocol-editor-zoom` to the viewport and applies the same `this.zoom` value to the node surface and edge SVG transforms (`src/views/protocol-editor-view.ts:1927-1947`). Both dot-layer repeat intervals can therefore track the existing zoom source without new state or per-frame work.
- The selected geometry is a 24px fine interval with 1px dots and a 120px coarse interval with 2px dots. Since 120 is five times 24, centered coarse dots coincide with every fifth centered fine dot at all zoom values.
- Existing transparent color mixes establish project and target-runtime precedent: the editor uses `color-mix(in srgb, <theme color> <percentage>, transparent)` for port halos and translucent editor chrome (`src/styles/protocol-editor.css:174`, `src/styles/protocol-editor.css:735-745`, `src/styles/protocol-editor.css:802-810`, `src/styles/protocol-editor.css:821-841`). The requested `var(--background-modifier-border)` at 25% follows that convention.
- Scroll extent is independent of the background. The viewport pseudo-element consumes scaled width/height variables (`src/styles/protocol-editor.css:36-43`), while `applyZoom()` updates those variables separately from the background zoom custom property (`src/views/protocol-editor-view.ts:1945-1947`).
- `protocol-editor.css` is already in the ordered CSS source list, and the build concatenates configured source stylesheets into generated `styles.css` (`esbuild.config.mjs:27-58`). No build registration changes are needed.

### Consolidated auto-layout Menu
- `renderShell()` currently creates four floating buttons: self-check, minimap, vertical layout, and horizontal layout. The last two share the `layout` icon and directly invoke `autoLayoutNodes('TB')` and `autoLayoutNodes('LR')` (`src/views/protocol-editor-view.ts:581-630`).
- `protocolEditor.autoLayout` already provides the consolidated trigger’s accessible name; `protocolEditor.autoLayoutVertical` and `protocolEditor.autoLayoutHorizontal` already provide the two item labels in both locales (`src/i18n/locales/en.json:74-76`, `src/i18n/locales/ru.json:74-76`). No locale files need modification.
- `SnippetManagerTreeRenderer` imports and constructs Obsidian `Menu`, configures fluent items, and passes the originating mouse event to `showAtMouseEvent()` (`src/views/snippet-manager/tree-renderer.ts:172-184`). `ProtocolEditorView` currently does not import `Menu` (`src/views/protocol-editor-view.ts:1`).
- `PROTOCOL_EDITOR_LAYOUT_CONFIG` owns the existing direction-specific dagre parameters (`src/views/protocol-editor-view.ts:155-168`). The trigger consolidation does not alter these values.
- `autoLayoutNodes()` guards missing/empty documents, measures nodes, runs dagre, normalizes coordinates, updates persisted geometry and `layoutDirection`, shows the localized completion notice, and reloads the protocol (`src/views/protocol-editor-view.ts:1804-1888`).
- `layoutDirection` is canonical document state limited to `LR | TB` (`src/protocol/protocol-document.ts:23-51`). Reload normalization defaults everything except explicit `TB` to `LR` (`src/views/protocol-editor-view.ts:228-230`), and rendering consumers use the restored direction for port sides and edge routing (`src/views/protocol-editor-view.ts:951-960`, `src/views/protocol-editor-view.ts:1023-1041`).
- History shows that auto-layout internals have a high regression cost. The UI consolidation must terminate at the existing TB/LR handler calls rather than modifying dagre, geometry, persistence, or routing.

### Durable accessible snippet pane headings
- `SnippetManagerView.onOpen()` creates the folder and snippet roots, assigns `role="tree"` and `role="list"`, and currently gives each root a localized `aria-label` (`src/views/snippet-manager-view.ts:108-131`). Those two pane labels are the attributes being removed; the roles remain.
- The same roots are passed directly to `SnippetManagerTreeRenderer`, followed by an awaited initial refresh (`src/views/snippet-manager-view.ts:133-160`).
- Every renderer pass unconditionally empties both roots before rendering folder and snippet content (`src/views/snippet-manager/tree-renderer.ts:111-140`). This path is reached by the initial refresh, folder selection, expansion redraw, search, vault watchers, and mutation callbacks (`src/views/snippet-manager-view.ts:226-241`, `src/views/snippet-manager-view.ts:329-341`, `src/views/snippet-manager-view.ts:383-425`).
- Renderer-owned heading recreation is the selected lifecycle model. Both headings are recreated after the two `empty()` calls and before folder rows, search rows, ordinary snippet rows, or empty placeholders, so each remains the root’s first child after every render.
- Search rendering reads `snippetContainer.children[length - 1]` immediately after appending each result row (`src/views/snippet-manager/tree-renderer.ts:142-167`). A heading inserted once before the loop does not disturb that last-child invariant.
- Existing localized strings already contain the required heading text in English and Russian (`src/i18n/locales/en.json:235-236`, `src/i18n/locales/ru.json:235-236`). No new i18n keys are needed.

### Shared visually-hidden utility
- `_utilities.css` explicitly owns shared reusable CSS and loads before feature styles (`src/styles/_utilities.css:1-3`, `esbuild.config.mjs:31-40`). It currently contains no hidden-text utility.
- `.rp-stp-sr-only` is the sole current precedent: absolute positioning, one-pixel dimensions, hidden overflow, `clip-path: inset(50%)`, and non-wrapping text (`src/styles/snippet-tree-picker.css:374-381`). Its only production consumer is the picker’s live-status span (`src/views/snippet-tree-picker.ts:160-168`).
- The selected consolidation promotes those properties to generic `.rp-sr-only` in `_utilities.css`, applies it to the two pane headings, and migrates the picker status span. This keeps shared semantics in the shared stylesheet instead of making `rp-stp-*` a cross-feature API.
- The picker’s status span is intentionally preserved across body redraws because it lives inside `.rp-stp-search`, while `removeBody()` deletes other root children (`src/views/snippet-tree-picker.ts:156-168`, `src/views/snippet-tree-picker.ts:247-260`, `src/views/snippet-tree-picker.ts:358-363`). Migrating only its class does not change that lifecycle.

### Regression coverage
- The protocol keyboard suite already builds the shell and asserts floating-action labels, including the current pair of layout buttons (`src/__tests__/views/protocol-editor-keyboard.test.ts:534-610`). Its local Obsidian mock does not currently expose `Menu` (`src/__tests__/views/protocol-editor-keyboard.test.ts:230-257`).
- Existing snippet-manager tests provide capture-capable Menu mocks that model `addItem`, item titles/callbacks, and `showAtMouseEvent()` (`src/__tests__/snippet-tree-view.test.ts:202-218`, `src/__tests__/snippet-tree-dnd.test.ts:158-174`). That is the closest test-double precedent.
- The chosen test boundary is the changed trigger only: one generic auto-layout button, exactly two localized menu items, the originating click event passed for positioning, and exact `TB`/`LR` callback mapping. The unchanged dagre/store path is not expanded into a new persistence test.
- `TREE-02` is the existing two-pane shell regression (`src/__tests__/snippet-tree-view.test.ts:378-386`). The same suite can inspect absent root `aria-label`s, localized hidden `H2` first children, and heading survival after refresh/search because its view tests already exercise repeated refreshes (`src/__tests__/snippet-tree-view.test.ts:725-729`, `src/__tests__/snippet-tree-view.test.ts:812-827`).

## Code References
- `src/styles/protocol-editor.css:18-29` — Current viewport line grid and zoom-scaled 24px interval.
- `src/styles/protocol-editor.css:174` — Existing transparent `color-mix()` syntax.
- `src/styles/protocol-editor.css:735-745` — Floating-action styling and theme-aware translucent background.
- `src/views/protocol-editor-view.ts:581-630` — Floating toolbar and current two auto-layout triggers.
- `src/views/protocol-editor-view.ts:155-168` — Direction-specific dagre configuration.
- `src/views/protocol-editor-view.ts:1804-1888` — Unchanged layout, persistence, notice, and reload path.
- `src/views/protocol-editor-view.ts:1927-1947` — Zoom publication and surface/SVG scaling.
- `src/protocol/protocol-document.ts:23-51` — Canonical persisted `layoutDirection` field.
- `src/views/snippet-manager-view.ts:108-160` — Pane roots, roles, labels, renderer wiring, and initial refresh.
- `src/views/snippet-manager/tree-renderer.ts:111-140` — Full-root redraw ownership.
- `src/views/snippet-manager/tree-renderer.ts:142-184` — Search last-child behavior and Menu precedent.
- `src/styles/_utilities.css:1-26` — Shared utility stylesheet surface.
- `src/styles/snippet-tree-picker.css:374-381` — Existing visually-hidden property set.
- `src/views/snippet-tree-picker.ts:156-168` — Existing hidden live-status consumer.
- `esbuild.config.mjs:27-58` — Ordered CSS aggregation pipeline.
- `src/__tests__/views/protocol-editor-keyboard.test.ts:230-257` — Protocol editor’s local Obsidian mock.
- `src/__tests__/views/protocol-editor-keyboard.test.ts:534-610` — Existing floating-action tests.
- `src/__tests__/snippet-tree-view.test.ts:378-386` — Existing two-pane shell test.

## Integration Points

### Inbound References
- `src/views/protocol-editor-view.ts:574-580` — Protocol loading restores direction and zoom, then rebuilds the shell that contains the layout trigger and viewport.
- `src/views/protocol-editor-view.ts:1779-1795` — Wheel zoom updates `this.zoom` and calls `applyZoom()`, which changes both grid intervals through the CSS custom property.
- `src/views/snippet-manager-view.ts:226-241` — Successful guarded refresh commits a model and enters the renderer that recreates headings.
- `src/views/snippet-manager-view.ts:329-341` — Folder selection and expansion re-enter refresh/render paths.
- `src/views/snippet-manager-view.ts:383-425` — View-level render and modal lifecycle paths repeatedly invoke the same renderer.

### Outbound Dependencies
- `src/views/protocol-editor-view.ts:1` — Obsidian runtime imports; consolidated control adds `Menu` to this surface.
- `src/views/protocol-editor-view.ts:1810-1837` — Auto-layout delegates graph calculation to dagre using existing configuration.
- `src/views/protocol-editor-view.ts:1866-1884` — Auto-layout delegates persistence to `ProtocolDocumentStore.update()` and reloads the protocol.
- `src/views/snippet-manager/tree-renderer.ts:75-91` — Renderer receives plugin/i18n capability needed to recreate localized headings.
- `src/i18n/locales/en.json:74-76` and `src/i18n/locales/ru.json:74-76` — Existing layout trigger and menu item labels.
- `src/i18n/locales/en.json:235-236` and `src/i18n/locales/ru.json:235-236` — Existing pane heading text.

### Infrastructure Wiring
- `esbuild.config.mjs:31-40` — `_utilities` loads first and `protocol-editor` is already registered.
- `esbuild.config.mjs:43-58` — Source CSS files are concatenated into generated `styles.css` after successful builds.
- `vitest.config.ts:4-8` — Repository tests alias Obsidian, while the affected protocol keyboard suite overrides it locally.
- `src/__tests__/views/protocol-editor-keyboard.test.ts:230-257` — Local mock boundary that must supply the newly imported `Menu`.

## Architecture Insights
- Visual editor background geometry is CSS-driven; TypeScript only publishes zoom and world dimensions. Keeping dot painting in CSS preserves the pure view-state boundary.
- `autoLayoutNodes()` is the behavior boundary. UI controls select a direction, while dagre parameters, measured geometry, persistence, notices, reload, and direction-aware rendering stay behind that method.
- `SnippetManagerTreeRenderer` owns complete pane contents, not only rows. Accessibility elements placed inside those roots must follow renderer lifecycle unless a new content-host boundary is introduced.
- Shared utility selectors belong in `_utilities.css`; feature prefixes such as `rp-stp-*` remain feature-owned.
- Existing locale values are semantic resources usable across attributes, menu titles, and hidden heading text; no user-authored content is involved.
- Tests use local hand-built DOM and Obsidian doubles. Adding a production runtime import requires auditing every local mock that evaluates the module, even when only one suite exercises the new API.

## Precedents & Lessons
Six precedent families were reviewed.

### Precedent: Auto-layout trigger introduction and direction split
**Commit(s)**: `dd6bb43` — "feat: auto-layout button for protocol editor nodes + larger canvas" (2026-05-16); `987fda9` — "feat: split auto-layout into vertical/horizontal buttons, add TB dagre layout" (2026-05-28)

**Blast radius**: The split touched 4 files across view, tests, and i18n, with 77 insertions and 18 deletions.

**Follow-up fixes**:
- `67db3c6` — "fix: align dagre layout ports and edge anchors" (2026-05-28).
- `33ff217` — "fix: remove dagre graph from renderEdges to prevent off-screen edges" (2026-05-28).
- `b95b215` — "fix: use measured node geometry for protocol editor layout" (2026-05-28).

**Lessons from docs**:
- `.rpiv/artifacts/plans/2026-06-02_10-40-04_protocol-editor-review-fixes.md` — documents the later protocol-editor correction work.

**Takeaway**: Consolidate only the trigger UI; do not reopen dagre, port, edge, geometry, or persistence behavior.

### Precedent: Snippet manager two-pane shell and Menu usage
**Commit(s)**: `fa2a3b4` — "feat: redesign snippet manager as two-pane layout with global search" (2026-07-30)

**Blast radius**: The four directly relevant files changed by 1,208 insertions and 425 deletions across view, renderer, styles, and tests.

**Follow-up fixes**: None present at this revision.

**Lessons from docs**:
- `.rpiv/artifacts/discover/2026-07-30_08-34-54_snippet-editor-two-pane-file-manager.md` — source intent for the current two-pane shell.

**Takeaway**: The pane labels and local Menu precedent are recent and share the same renderer/view boundary targeted by this polish.

### Precedent: Tooltip-triggering accessibility attributes and hidden feedback
**Commit(s)**: `5acd77b` — "feat: runner layout refactor + editor icon polish" (2026-05-16); `093ccca` — "fix: unified runner button sizing; removed duplicate hover tooltips" (2026-05-16); `164b8e6` — "fix: improve SnippetTreePicker layout sizing and remove tooltip-triggering attributes" (2026-06-14)

**Blast radius**: Changes crossed view/render code, feature CSS, and focused tests.

**Follow-up fixes**:
- `093ccca` followed the runner layout refactor on the same day to correct duplicate tooltip/button presentation.
- `164b8e6` later removed another tooltip-triggering attribute in the picker.

**Lessons from docs**:
- `.rpiv/artifacts/designs/2026-07-26_16-19-09_slice-4_snippettree-picker-keyboard-navigation.md` — establishes visually-hidden live feedback in the picker.

**Takeaway**: Removing the tooltip-producing attribute must be paired with a durable, non-hover accessibility channel.

### Precedent: CSS drift and theme specificity
**Commit(s)**: `ba98021` — "chore: remove dead toolbar CSS + allowlist entries; add __mocks__/ to CLAUDE.md code map" (2026-05-21); `cb41717` — "chore: fix nightly drift — dead CSS/i18n cleanup, missing CSS rules, allowlist updates" (2026-05-22); `7231c9a` — "fix: harden CSS button selectors against Obsidian .mod-cta theme override" (2026-05-29)

**Blast radius**: CSS cleanup and selector corrections touched feature styles, audits, and related source references.

**Follow-up fixes**:
- `7231c9a` hardened plugin button selectors against Obsidian theme overrides.

**Takeaway**: Reuse the existing floating-action class and ensure the promoted utility has real TypeScript consumers so CSS drift checks recognize it.

### Composite Lessons
- Auto-layout’s internal geometry path has repeatedly required follow-up fixes (`67db3c6`, `33ff217`, `b95b215`); this change should stop at exact `TB`/`LR` callback preservation.
- Complete-container renderers own accessibility descendants as well as visible rows. The `fa2a3b4` pane architecture makes renderer recreation the minimal durable model.
- A shared hidden-text utility should replace, not coexist indefinitely with, the picker-specific duplicate; the picker’s established properties and tests supply the precedent.
- Obsidian Menu is already idiomatic in this repository, but local test mocks—not dependency installation—are the integration cost.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-07-31_09-45-07_protocol-editor-visual-polish.md` — Chained feature requirements and decisions.
- `.rpiv/artifacts/discover/2026-07-30_08-34-54_snippet-editor-two-pane-file-manager.md` — Current snippet-manager two-pane feature discovery.
- `.rpiv/artifacts/designs/2026-07-26_16-19-09_slice-4_snippettree-picker-keyboard-navigation.md` — SnippetTreePicker keyboard/accessibility design.
- `.rpiv/artifacts/plans/2026-06-02_10-40-04_protocol-editor-review-fixes.md` — Prior protocol-editor correction plan.

## Developer Context
**Q (discover: Intent — first-impression polish): What problem are you solving with these Protocol Editor visual changes, and who experiences it today?**
A: First-impression polish — new users opening the editor for the first time find it looks busy/unprofessional; the goal is a cleaner, more refined default appearance.

**Q (discover: Snippets tooltip — keep accessibility, drop the visual tooltip): Keep accessibility while removing only the visual tooltip, or remove the labels entirely?**
A: Keep a11y, drop tooltip.

**Q (discover: Grid pattern — two overlapping dot grids): For the dotted background: a single dot grid, or two overlapping grids?**
A: Two overlapping dot grids.

**Q (discover: Dot opacity — 25% via color-mix): What opacity should the dots use relative to the current grid-line color?**
A: 25% via `color-mix(in srgb, var(--background-modifier-border) 25%, transparent)`.

**Q (discover: Auto-layout menu — Obsidian Menu popover): How should the consolidated auto-layout button expose its two options?**
A: Obsidian Menu popover.

**Q (discover: a11y mechanism — visually-hidden heading): How should the panes keep their screen-reader names after removing container `aria-label`s?**
A: A visually-hidden `<h2>` as the first child of each pane.

**Q (discover: Scope — these three only): Should this feature stay limited to the three editor visual changes?**
A: These three only.

**Q (`src/views/snippet-manager/tree-renderer.ts:119-123`): The renderer empties both pane roots on every render. Which ownership model should make hidden headings durable?**
A: Renderer recreates both headings after every `empty()` and before rows.

**Q (`src/styles/snippet-tree-picker.css:374-381`, `src/styles/_utilities.css:1-3`): Should the picker-specific hidden-text pattern become shared, and should the picker migrate?**
A: Promote the pattern to `.rp-sr-only` in `_utilities.css` and migrate the picker consumer.

**Q (`src/styles/protocol-editor.css:26-29`): Which exact aligned dot spacing/radius pair should the design use?**
A: 24px/120px spacing with 1px/2px radii.

**Q (`src/__tests__/views/protocol-editor-keyboard.test.ts:599-610`, `src/views/protocol-editor-view.ts:1866-1884`): Should regression coverage test only the changed trigger boundary or add direct persistence coverage?**
A: Test the trigger boundary only; the unchanged persistence handler stays out of scope.

## Related Research
- None found for this exact three-part polish change.

## Open Questions
- None.
