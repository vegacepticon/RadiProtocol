---
date: 2026-07-31T13:07:07+0300
author: Roman Shulgha
commit: 921d6d6
branch: main
repository: RadiProtocol
topic: "Snippet Editor Modal Redesign"
tags: [research, codebase, snippet-editor-modal, snippet-manager, tree-renderer, styles]
status: ready
last_updated: 2026-07-31T13:07:07+0300
last_updated_by: Roman Shulgha
---

# Research: Snippet Editor Modal Redesign

## Research Question
How should the layout-only redesign described in `.rpiv/artifacts/discover/2026-07-31_13-00-53_snippet-editor-modal-redesign.md` fit the current modal DOM, chip-editor structure, folder editing behavior, snippet-manager callback contract, duplication service, lifecycle guards, tests, and i18n surfaces?

## Summary
The redesign fits the existing architecture without domain changes. `SnippetEditorModal` currently emits all form rows, status elements, editor content, and buttons as direct siblings; a new bounded modal shell with one internal scroll body is the missing containment seam. The existing `.radi-snippet-editor-content` should remain the chip-editor mount target and become the two-column grid because `mountChipEditor(..., { skipName: true })` already emits Template and Placeholders as its only two direct sections (`src/views/snippet-editor-modal.ts:385-404`, `src/views/snippet-chip-editor.ts:103-130`, `src/views/snippet-chip-editor.ts:219-222`).

Folder compaction can remain presentation-only: the current input displays a root-relative path, `FolderSuggest` dispatches the same `input` event as typing, and the handler alone updates absolute folder state, collision checks, dirty state, and the folder-specific unsaved dot (`src/views/snippet-editor-modal.ts:296-355`, `src/views/folder-suggest.ts:59-62`).

Duplication should move through a new `TreeRendererCallbacks.duplicateSnippet(path): Promise<void>` callback owned by `SnippetManagerView`. The renderer should only invoke it; the view should call the existing service, own localized failure handling, and run the generation-guarded `refresh()` so both selected-folder and active-search models reload (`src/views/snippet-manager/tree-renderer.ts:52-65`, `src/views/snippet-manager-view.ts:224-251`, `src/snippets/snippet-service.ts:367-385`). The modal-only duplicate result/member/handler surface then becomes dead.

Obsidian `MenuItem` has no supported separate aria-label API (`node_modules/obsidian/obsidian.d.ts:4178-4224`). The developer chose `snippetEditor.duplicate` as the visible menu title and accessible name; `snippetEditor.duplicateTitle` remains unused after the modal button is removed.

## Detailed Findings

### Modal DOM and scroll containment
- `.rp-snippet-editor-modal` is installed on Obsidian's outer modal element, while `.radi-snippet-editor-modal` is installed on `contentEl` (`src/views/snippet-editor-modal.ts:159-168`). These are distinct sizing and content-layout seams.
- Type, Folder, Name, optional validation banner, editor content, save error, and button row are currently emitted in one normal-flow sequence (`src/views/snippet-editor-modal.ts:179-226`). No element currently owns bounded internal scrolling.
- The coherent scroll boundary is a new form-body child of `.radi-snippet-editor-modal` containing Folder, Name/collision UI, validation banner, and `.radi-snippet-editor-content`. The save-error element and `.modal-button-container` remain outside that body so save failures and actions stay visible.
- Existing behavior is reference-based rather than selector-based: validation locking retains `contentRegionEl` and `saveBtnEl`, collision UI retains its element references, and initial focus uses `nameInputEl` (`src/views/snippet-editor-modal.ts:230-243`, `src/views/snippet-editor-modal.ts:423-437`, `src/views/snippet-editor-modal.ts:625-628`). Nesting those nodes does not alter their state paths.
- Current CSS only pads the content element, sizes controls, and styles the normal-flow button row (`src/styles/snippet-manager.css:388-412`). The outer modal currently constrains width only (`src/styles/snippet-manager.css:525-528`); bounded height, flex shrinkability, overflow ownership, footer background, and inline-size containment do not exist.
- A single vertical overflow owner is required. Multiple overflow ancestors would introduce nested scrollbars and could allow the footer to scroll away. `min-height: 0` is load-bearing on shrinking flex descendants because the chip editor has substantial intrinsic content height.
- The container-query boundary is the outer `.rp-snippet-editor-modal`, whose actual width is the requirement's subject. The queried descendant is `.radi-snippet-editor-content`; using the editor content itself as its own query container would not provide the intended modal-width signal.

### Folder editing remains behaviorally unchanged
- `renderFolderDropdown()` creates the folder label, nested unsaved-dot span, and either an editable input or a static span when `disableFolderPicker` is true (`src/views/snippet-editor-modal.ts:296-315`). The static branch returns before suggestion or input wiring.
- The editable value is root-relative: the root displays as an empty string, descendants have the configured root prefix removed, and other paths pass through unchanged (`src/views/snippet-editor-modal.ts:339-347`).
- Input converts the relative display value back to an absolute folder, sets the modal dirty flag, schedules collision checking, and updates the folder dot (`src/views/snippet-editor-modal.ts:323-327`, `src/views/snippet-editor-modal.ts:349-355`). It does not persist or move anything before Save.
- `FolderSuggest` is configured relative to the snippet root and includes the root option; selection writes into the same input and dispatches a bubbling `input` event (`src/views/snippet-editor-modal.ts:316-321`, `src/views/folder-suggest.ts:26-32`, `src/views/folder-suggest.ts:59-62`).
- The folder dot compares only `currentFolder` with `savedFolder`, independently of general dirty state (`src/views/snippet-editor-modal.ts:331-336`). Its hidden/visible modifier contract is CSS-defined (`src/styles/snippet-manager.css:483-495`).
- Existing folder CSS already preserves compact shrinkability through flexible input/static content and `min-width: 0` (`src/styles/snippet-manager.css:544-570`). A breadcrumb-like presentation must preserve the one relative input rather than copying an absolute root prefix into its editable value.

### Two-column chip-editor seam
- `renderContentRegion()` keeps one stable mount element and passes the template draft, dirty callback, `skipName: true`, and translator to `mountChipEditor()` (`src/views/snippet-editor-modal.ts:385-404`).
- With `skipName: true`, the optional Name section is skipped (`src/views/snippet-chip-editor.ts:103-116`). The direct children are the Template section and Placeholders section (`src/views/snippet-chip-editor.ts:119-136`, `src/views/snippet-chip-editor.ts:219-222`).
- The add-placeholder button and mini-form remain nested in the Template section (`src/views/snippet-chip-editor.ts:134-160`); the placeholder list remains nested in the Placeholders section (`src/views/snippet-chip-editor.ts:219-222`). They are not third and fourth grid items.
- Expanded placeholder editors remain full-width children inside individual chips (`src/styles/snippet-manager.css:52-65`, `src/styles/snippet-manager.css:124-128`). Their controls increase right-column height and intrinsic width pressure but do not alter the two top-level columns.
- Zero-floor grid tracks and shrinkable direct sections are necessary because the mini-form, fixed chip controls, expanded editors, and option rows otherwise contribute content-based minimum widths.
- The legacy plain-Markdown branch creates one `.radi-snippet-editor-md-textarea` directly under the same mount element (`src/views/snippet-editor-modal.ts:405-414`). In a two-track grid that single item requires full-track spanning; `width: 100%` alone only fills its assigned first track.
- Listener tracking, in-place draft mutation, the modal's dirty callback, and `destroy()` remain independent of layout (`src/views/snippet-chip-editor.ts:65-73`, `src/views/snippet-chip-editor.ts:494-500`).

### Duplicate callback and service flow
- The renderer callback interface contains view-owned asynchronous operations and has no duplication member today (`src/views/snippet-manager/tree-renderer.ts:52-65`). The exact matching extension is path-only and returns `Promise<void>`; the service's returned destination path is an implementation detail of the view callback.
- The file menu order is Edit, Rename, Move, separator, Delete (`src/views/snippet-manager/tree-renderer.ts:317-343`). Duplicate belongs after Move and before the separator; the folder menu remains unchanged.
- `SnippetManagerView.onOpen()` constructs the renderer callback object with thin named assignments (`src/views/snippet-manager-view.ts:128-151`). The structural test parses every interface member and requires both a named view assignment and a literal renderer invocation (`src/__tests__/snippet-tree-view.test.ts:1085-1101`).
- Completion and failure belong in the view. Neighboring manager mutations call the service, show localized notices, and refresh from the view rather than the renderer (`src/views/snippet-manager-view.ts:472-484`, `src/views/snippet-manager-view.ts:499-506`).
- `refresh()` reloads the folder tree, selected-folder snippets, and active global-search results; it commits and renders only while mounted and while its generation is current (`src/views/snippet-manager-view.ts:224-278`). This is the correct post-duplicate model update surface rather than direct row insertion or reliance on the 120 ms vault watcher.
- `onClose()` invalidates outstanding work by clearing `mounted` and advancing the generation (`src/views/snippet-manager-view.ts:184-190`). A duplicate completion followed by `refresh()` therefore cannot commit into a detached pane.
- `SnippetService.duplicateSnippet()` already loads the source, probes `-copy`, `-copy-2`, and later candidates, writes through `save()`, and returns the new path (`src/snippets/snippet-service.ts:367-385`). Service tests cover templates, collisions, plain Markdown, and missing sources (`src/__tests__/snippet-service.test.ts:716-729`, `src/__tests__/snippet-service.test.ts:751-781`).
- Template placeholder cloning creates a new array and new top-level placeholder objects, but nested arrays such as `options` are not recursively cloned (`src/snippets/snippet-service.ts:382`). This is existing service behavior and outside the redesign scope.

### Modal duplicate surface becomes dead
- The false result arm currently includes `duplicatedTo`, used only by `handleDuplicate()` (`src/views/snippet-editor-modal.ts:28-30`, `src/views/snippet-editor-modal.ts:640-648`). No manager caller consumes it.
- The override interface and `snippetService()` return type each expose `duplicateSnippet()` solely for the modal action (`src/views/snippet-editor-modal.ts:41-48`, `src/views/snippet-editor-modal.ts:275-285`). Those members become dead when the modal button and handler are removed.
- Cancel and Create/Save are independent blocks in `renderButtonRow()` (`src/views/snippet-editor-modal.ts:439-474`). Removing the middle Duplicate block does not change their handlers, result arms, or save pipeline.
- `SnippetManagerView.openEditModal()` already branches only on `result.saved`; it has no `duplicatedTo` branch (`src/views/snippet-manager-view.ts:395-424`). Its save/cancel behavior can remain unchanged.

### Tests and i18n
- Create-mode tests explicitly find `Markdown template`, and edit-mode tests explicitly find `Markdown` (`src/__tests__/snippet-editor-modal.test.ts:427-450`, `src/__tests__/snippet-editor-modal.test.ts:469-489`). These expectations must invert while retaining create/edit title, no-toggle, and draft-kind coverage.
- Existing folder tests drive the same input event path and assert the saved absolute destination (`src/__tests__/snippet-editor-modal.test.ts:321-328`, `src/__tests__/snippet-editor-modal.test.ts:492-544`). They are regression coverage for the compact presentation.
- Modal tests need exact action-row coverage for Cancel + Create and Cancel + Save, not only absence of a Duplicate label. Tree tests inherit the responsibility for menu order, callback path, service invocation, refresh, and localized failure.
- The menu mock already captures title, icon, and click callback (`src/__tests__/snippet-tree-view.test.ts:202-216`); its current `addSeparator()` is not recorded, so ordered visible items can prove Duplicate lies between Move and Delete but not independently prove separator placement.
- `snippetEditor.duplicate`, `duplicateTitle`, and `duplicateError` exist symmetrically in both locales (`src/i18n/locales/en.json:140-142`, `src/i18n/locales/ru.json:140-142`). `duplicate` becomes the context-menu title/accessibility name, `duplicateError` moves to view-owned error handling, and `duplicateTitle` becomes unused.
- `snippetEditor.type` must remain: removing the modal Type row eliminates two consumers, but the chip editor still uses the key for placeholder type fields (`src/views/snippet-chip-editor.ts:147`, `src/views/snippet-chip-editor.ts:401`). It is not globally dead.

## Code References
- `src/views/snippet-editor-modal.ts:159-243` — Modal classes, flat DOM sequence, validation lock, focus, and button-row placement.
- `src/views/snippet-editor-modal.ts:296-355` — Editable/static folder branches, relative path conversion, dirty state, collision scheduling, and unsaved dot.
- `src/views/snippet-editor-modal.ts:385-474` — Chip-editor mount, validation banner, and action-row construction.
- `src/views/snippet-editor-modal.ts:640-648` — Modal-owned duplicate operation and result.
- `src/views/snippet-chip-editor.ts:103-160` — Optional Name section, Template section, and nested add-placeholder form.
- `src/views/snippet-chip-editor.ts:219-222` — Direct Placeholders section and nested list.
- `src/views/folder-suggest.ts:26-32` — Root-relative suggestion conversion.
- `src/views/folder-suggest.ts:59-62` — Suggestion selection dispatches the canonical input event.
- `src/styles/snippet-manager.css:388-412` — Current modal and normal-flow action-row rules.
- `src/styles/snippet-manager.css:525-570` — Outer width constraint and folder-row sizing.
- `src/views/snippet-manager/tree-renderer.ts:52-65` — Renderer callback contract.
- `src/views/snippet-manager/tree-renderer.ts:313-343` — File context-menu construction and order.
- `src/views/snippet-manager-view.ts:128-151` — Callback wiring.
- `src/views/snippet-manager-view.ts:224-278` — Generation-guarded model reload, commit, and render path.
- `src/snippets/snippet-service.ts:367-385` — Canonical duplication service.
- `src/__tests__/snippet-editor-modal.test.ts:427-589` — Type-row, folder, and chip-editor modal coverage.
- `src/__tests__/snippet-tree-view.test.ts:1059-1101` — Mutation refresh and callback structural contracts.
- `node_modules/obsidian/obsidian.d.ts:4178-4224` — Supported `MenuItem` API; no separate aria-label setter.

## Integration Points

### Inbound References
- `src/views/snippet-manager/tree-renderer.ts:317-343` — File-row context menu is the new user entry point for Duplicate.
- `src/views/snippet-manager-view.ts:128-151` — View constructs the callback implementation supplied to the renderer.
- `src/__tests__/snippet-tree-view.test.ts:1085-1101` — Static contract audit requires every callback member to be wired and consumed.

### Outbound Dependencies
- `src/views/snippet-manager-view.ts:224-278` — Duplicate completion must use the existing guarded model refresh surface.
- `src/snippets/snippet-service.ts:367-385` — View delegates all duplication semantics and persistence.
- `src/i18n/locales/en.json:140-142` — English visible label and failure copy.
- `src/i18n/locales/ru.json:140-142` — Russian visible label and failure copy.

### Infrastructure Wiring
- `src/views/snippet-editor-modal.ts:159-168` — Runtime classes connect TypeScript DOM construction to modal CSS.
- `src/styles/snippet-manager.css:388-412` — Content shell and action-row style ownership.
- `src/styles/snippet-manager.css:525-528` — Outer modal sizing and future container-query boundary.
- `src/views/snippet-manager-view.ts:184-190` — View-close invalidation protects post-await rendering.

## Architecture Insights
- The correct separation is view-owned orchestration, renderer-owned presentation/delegation, and service-owned persistence. Duplication should mirror delete/move callback ownership rather than place service/error logic in `tree-renderer.ts`.
- The modal already exposes distinct outer and inner class seams. Outer modal sizing/container containment and inner content flex/scroll ownership should remain separate.
- Parent-level grid is a codebase-fit solution because the reusable chip editor already emits the required sibling sections and owns listener cleanup. DOM restructuring would add no behavioral capability.
- Folder state uses a display-value/domain-value boundary: root-relative text in the input, absolute vault path in modal state. Visual breadcrumb treatment must not blur that boundary.
- Save, collision, validation, and unsaved-guard behavior is held through element references and state, so containment changes do not require business-path edits.
- Active search is part of the manager model. Explicit guarded refresh is necessary after duplication; a file-system watcher alone is delayed and does not express operation ownership.

## Precedents & Lessons
8 similar past changes analyzed.

### Precedent: Two-pane snippet manager redesign
**Commit(s)**: `fa2a3b4` — "feat: redesign snippet manager as two-pane layout with global search" (2026-07-30)
**Blast radius**: 11 files across views, styles, snippets, i18n, and tests.

**Follow-up fixes**:
- Validation found unguarded async model mutation and mutation paths bypassing the generation-owned refresh surface.
- A second validation found `openEditModal()` could still resume after close without mounted/generation ownership.

**Lessons from docs**:
- `.rpiv/artifacts/handoffs/2026-07-30_13-48-23_snippet-manager-validation-fixes-blueprint.md` — build locally, verify ownership, then commit model state.
- `.rpiv/artifacts/validation/2026-07-30_18-11-12_snippet-manager-validation-race-and-mutation-fixes.md` — lifecycle checks must cover pre-modal service awaits.

**Takeaway**: Keep Duplicate completion on `refresh()` and preserve its lifecycle/generation guards.

### Precedent: Remove JSON/Markdown type toggle
**Commit(s)**: `e8ea106` — "chore: remove JSON/MD type toggle in Snippet Editor — always md-template" (2026-05-26)
**Blast radius**: 4 files across views and tests.

**Follow-up fixes**:
- `7919cb0` — "fix: preserve snippet names during create and rename" (2026-05-26) — restored name preservation after create/rename flow changes.

**Takeaway**: Invert presentation assertions without weakening draft-kind, name, and path coverage.

### Precedent: Replace folder picker with path input
**Commit(s)**: `57f3850`, `3bcc8ac` — "feat: replace folder tree picker with path input + inline choice options" (2026-05-26)
**Blast radius**: 16 files across views, styles, i18n, tests, and configuration.

**Follow-up fixes**:
- `7919cb0` — name preservation required same-day repair.

**Takeaway**: Preserve the existing input event and relative-path contract; treat compaction as CSS/DOM presentation only.

### Precedent: Add Duplicate button and service
**Commit(s)**: `980cd51` — "feat(runner/editor): Beta B – insert snippet command, start-from-node opt-in, duplicate snippet button in editor" (2026-05-15)
**Blast radius**: 9 files across views, snippets, i18n, and tests.

**Follow-up fixes**:
- No duplicate-specific follow-up was found.

**Takeaway**: The service path is stable; relocation risk is callback wiring, refresh ownership, and modal contract cleanup.

### Precedent: Add Move context-menu flow
**Commit(s)**: `d964740` — "feat(34-01): add «Переместить в…» context menu flow" (2026-04-15)
**Blast radius**: 3 files across views and tests.

**Follow-up fixes**:
- `77b62c1` — fixed real-DOM `parentElement` use for context-menu/F2 rename.
- `1de3f6a` — replaced a non-atomic modal move-on-save path.
- `fd0d50d` — preserved pure name renames in modal save.

**Takeaway**: Follow the callback/menu pattern but do not touch save, rename, or move routing.

### Precedent: Modal and CSS foundations
**Commit(s)**: `c5e6117` — "feat(33-03): add SnippetEditorModal with D-09 move pipeline" (2026-04-15); `97a1aad` — "feat(33-04): tree view and editor modal styles" (2026-04-15)
**Blast radius**: modal and stylesheet foundations, followed by multiple UAT repairs.

**Follow-up fixes**:
- `1d25985` — removed duplicate Name/content fields.
- `5d4dde9` — repaired Type-row spacing.
- `794a922` — added validation banner and Save lock.
- `9900a56` — fixed expanded-chip event handling.

**Takeaway**: Preserve validation locking, one Name owner, and the chip editor's event/listener lifecycle while changing containment.

### Precedent: CSS migration and theme specificity
**Commit(s)**: `d06c2da`, `07f856d`, `e74e8ce` (2026-05-01); `7231c9a` (2026-05-29)
**Blast radius**: small view/CSS migrations followed by one stylesheet specificity repair.

**Follow-up fixes**:
- `7231c9a` hardened button selectors against later Obsidian theme rules.

**Takeaway**: Verify the fixed footer and action buttons against Obsidian's cascade, not only isolated plugin CSS.

### Composite Lessons
- Keep the change layout-only in the modal and orchestration-only in the manager; same-day regressions historically came from incidental save/name/move edits (`7919cb0`, `1de3f6a`, `fd0d50d`).
- Preserve guarded refresh ownership after async mutations (`fa2a3b4` follow-up validations).
- Use the existing renderer callback structural audit when extending `TreeRendererCallbacks`.
- Verify real Obsidian DOM/CSS behavior in addition to `MockEl`, especially containment, sticky footer background, focus reachability, and theme cascade.
- Update tests that deliberately encode the old Type row and action set rather than deleting broad create/edit coverage.

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/discover/2026-07-31_13-00-53_snippet-editor-modal-redesign.md` — Chained feature requirements and locked decisions.
- `.rpiv/artifacts/research/2026-07-30_09-21-44_snippet-editor-two-pane-file-manager.md` — Prior snippet-manager codebase research.
- `.rpiv/artifacts/handoffs/2026-07-30_13-48-23_snippet-manager-validation-fixes-blueprint.md` — Prior lifecycle/mutation-fix handoff.
- `.rpiv/artifacts/plans/2026-07-30_12-33-56_snippet-manager-validation-race-and-mutation-fixes.md` — Prior manager validation-fix plan.
- `.rpiv/artifacts/validation/2026-07-30_12-03-37_snippet-editor-two-pane-file-manager-redesign.md` — Initial two-pane validation.
- `.rpiv/artifacts/validation/2026-07-30_18-11-12_snippet-manager-validation-race-and-mutation-fixes.md` — Follow-up lifecycle validation.
- `.rpiv/artifacts/designs/2026-07-27_17-06-52_slice-2_remove-json-snippet-code-support-and-rewrite-readme.md` — Prior JSON-snippet removal design slice.

## Developer Context
**Q (discover: D-01 — Fixed action bar via sticky footer + internal scroll body): Which containment model should keep actions visible?**
A: Sticky footer + scroll body.

**Q (discover: D-02 — Duplicate moves to context menu, modal button removed): Where should Duplicate live?**
A: Add it to the existing file context menu, wire it to `SnippetService.duplicateSnippet()`, and remove the modal button.

**Q (discover: D-03 — Scope: layout-only, behavior unchanged): May save, collision, unsaved guards, validation, or duplicate-service behavior change?**
A: No. The change is layout-only; Name and validation UI may only be repositioned.

**Q (discover: D-04 — Folder stays editable but restyled compact): Should folder editing remain in the modal?**
A: Yes. Keep the existing editable folder path and restyle it compactly.

**Q (discover: D-05 — Two-column via CSS grid on parent): Should the chip editor DOM be restructured?**
A: No. Apply CSS grid to `.radi-snippet-editor-content` and retain the chip editor's mount structure.

**Q (discover: D-06 — Narrow-screen collapse via container query on the modal): What should drive responsive collapse?**
A: A container query on the modal at approximately 640 px.

**Q (discover: D-07 — Type row removed in both create and edit modes): Which modes lose the Type row?**
A: Both create and edit modes.

**Q (discover: D-08 — Duplicate context-menu placement): Where should Duplicate appear?**
A: After Move and before the separator/Delete.

**Q (`src/views/snippet-editor-modal.ts:449-451`, `node_modules/obsidian/obsidian.d.ts:4178-4224`): The modal button had separate visible and aria labels, but `MenuItem` has no supported separate aria-label API. Which label contract should the context menu use?**
A: Use `snippetEditor.duplicate` as the visible menu label and accessible name. Leave `snippetEditor.duplicateTitle` unused; do not reach into undocumented menu DOM.

## Related Research
- `.rpiv/artifacts/research/2026-07-30_09-21-44_snippet-editor-two-pane-file-manager.md`

## Open Questions
None. The discover artifact's callback-shape question is resolved: `TreeRendererCallbacks` should expose view-owned `duplicateSnippet(path: string): Promise<void>`, with the renderer delegating and the view owning service invocation, failure notice, and guarded refresh.
