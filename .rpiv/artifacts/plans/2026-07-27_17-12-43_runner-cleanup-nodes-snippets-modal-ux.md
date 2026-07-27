---
date: 2026-07-27T17:12:43+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 9c4452e
topic: "Runner cleanup, node defaults/deprecation, snippet format cleanup, and insert-modal UX"
status: ready
last_updated: 2026-07-27T18:30:33+0300
last_updated_by: Roman Shulgha
last_updated_note: "Address architecture-fit verdict 18-14-34: move snippet-ID resolution into SnippetService.resolveSnippet discriminated resolver; reduce inline-runner-modal.ts to orchestration and render-snippet-fill.ts to presentation."
phase_count: 5
phases:
  - { n: 1, title: "Remove create-snippet-from-selection footer button", slice: 1 }
  - { n: 2, title: "Remove JSON snippet code support and rewrite README", slice: 2 }
  - { n: 3, title: "Deprecate new Text block creation and preserve legacy compatibility", slice: 3 }
  - { n: 4, title: "Default a Start node into newly created protocols", slice: 4 }
  - { n: 5, title: "Strengthen Insert Snippet modal highlight and vertical layout", slice: 5 }
risks:
  - { id: c1-r1, claim: "Re-parenting the close button directly under footerBtnRowEl preserves the footer's left/right split across every runner state without a height or zone regression." }
  - { id: c2-r1, claim: "Legacy .json snippet files remain untouched on disk and hidden from snippet listings/search, while direct runner references receive an explicit unsupported-JSON message directing users to recreate the snippet as Markdown." }
  - { id: c2-r2, claim: "renameSnippet rejects every non-.md source before computing a destination, so legacy JSON bytes can never be relabeled as Markdown." }
  - { id: c2-r3, claim: "The footer-removal and JSON-removal edits to shared files are symbol- and region-disjoint and can be applied without either phase reintroducing the other's deleted code or locale keys." }
  - { id: c3-r1, claim: "Removing Text block only from new-node creation leaves legacy text-block protocols parseable, runnable, editable, styled, and selectable as start points, while Answer chains become the supported authoring path for pass-through text." }
  - { id: c4-r1, claim: "Inlining Start-node dimensions and color in the protocol layer, with a cross-reference comment rather than a views-layer import, is an acceptable architecture-preserving duplication." }
  - { id: c4-r2, claim: "No caller or test outside the updated create tests depends on createEmptyProtocolDocument returning an empty nodes array." }
  - { id: c5-r1, claim: "Viewport-derived child heights plus modal overflow preserve top pinning and scrolling while reaching 480px/440px only when space permits." }
  - { id: c5-r2, claim: "An inset 2px accent stripe strengthens keyboard focus while retaining the row's existing 1px border-box geometry and avoiding content shift." }
sources:
  - .rpiv/artifacts/subplans/2026-07-27_17-10-27_cluster-1.md
  - .rpiv/artifacts/subplans/2026-07-27_17-10-27_cluster-2.md
  - .rpiv/artifacts/subplans/2026-07-27_17-10-27_cluster-3.md
  - .rpiv/artifacts/subplans/2026-07-27_17-10-27_cluster-4.md
  - .rpiv/artifacts/subplans/2026-07-27_17-11-36_cluster-5.md
  - .rpiv/artifacts/research/2026-07-27_16-11-44_runner-cleanup-nodes-snippets-modal-ux.md
tags: [plan, synthesized]
---

# Plan: Runner cleanup, node defaults/deprecation, snippet format cleanup, and insert-modal UX

## Synthesis Notes
- Five dependency-independent cluster sub-plans are carried through as five phases in cluster order. They may be implemented independently, but the order keeps the runner cleanup together before the node and CSS work.
- Phases 1 and 2 both edit `src/views/inline-runner-modal.ts`, but their regions and symbols are disjoint: Phase 1 removes the footer button/listener machinery near the import, lifecycle, footer render, and private helper sections; Phase 2 removes JSON snippet resolution and rendering branches later in the file. Phase 2 must not reintroduce `SnippetEditorModal`, `createSnippetBtnEl`, `boundSelectionHandler`, `leftGroup`, or the removed selection helpers.
- Phases 1 and 2 also both edit `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`. Phase 1 removes `protocolRunner.createSnippetFromSelection`; Phase 2 removes `insertSnippet.cannotBeUsed` and `inlineRunner.snippetCannotBeUsed`. Apply all three removals in each locale without disturbing retained snippet-validation and canvas-parser keys.
- Phase 2 owns the narrowing of `Snippet` to `MdSnippet | MdTemplateSnippet`. Every consumer and JSON-dependent suite named in that phase must lose `JsonSnippet`, `SnippetFile`, `renderSnippet`, `snippetKind: 'json'`, and `kind === 'json'` assumptions in the same atomic change. Legacy `.json` files remain untouched on disk but are filtered from listing and descendant search; direct legacy runner references render an explicit unsupported-format message rather than a generic not-found message. All snippet-ID resolution (direct full-path, extensionless root probe, and unique-subdirectory fallback) is owned by a new `SnippetService.resolveSnippet` method returning a discriminated `found | legacy-json | missing` result, so `inline-runner-modal.ts` only orchestrates on that result and `render-snippet-fill.ts` stays presentation-only — no path probing, vault scans, or `.json`/`.md` trial loops remain in the views or render layers.
- Phase 3 follows the **developer-approved compatibility exception** recorded in the Phase 3 body (approved 2026-07-27 by Roman Shulgha): the goal's "remove the Text block node type" is satisfied functionally — Text block is removed from the creation surface (`EDITABLE_NODE_KINDS`, which feeds both new-node creation pickers) and Answer chains become the sole authoring path for pass-through text — while stored legacy `text-block` nodes remain a sanctioned, explicitly approved compatibility surface: kept in the graph model, parser, runner, labels, editor defaults/editing, start-from-node picker, styles, locales, fixtures, and compatibility tests. This is a deprecation-with-legacy-support boundary, not a literal kind removal; the exception is documented in-repo rather than framed as removal. Existing Answer traversal already supplies the requested `Question → Answer1 → Answer2` behavior: selecting Answer1 appends it, then `advanceThrough()` appends downstream Answer2 without another click. Both READMEs stop advertising Text block creation and identify Answer chains as the authoring path while documenting continued legacy support.
- Phases 3 and 4 only conceptually meet at `src/views/protocol-editor-view.ts`: Phase 3 narrows the new-node creation list while retaining Text block defaults and edit arms; Phase 4 merely cross-references the Start defaults from comments in `src/protocol/protocol-document.ts`. Phase 4 must not introduce a lower-layer import from `views/`.
- Phase 5's sizing overrides remain scoped to `.rp-insert-snippet-modal` / `.rp-insert-snippet-picker-host`, while the stronger `.rp-stp-row-highlighted` state intentionally applies to every keyboard-enabled picker host. Do not leak insert-modal height rules into the inline runner, editor host, or move-to modal.
- The researched Loop→Question merge is feasible but medium-to-high complexity. The recommended intuitive UX is a `QuestionNode.isLoop?: boolean` checkbox in the Question editor plus one clearly separated Done/exit action; answer/snippet choices remain normal question buttons, while `+` exit edges are hidden from that list and reuse the loop context stack. Implementation is explicitly deferred because it requires a coordinated runner-status decision, edge-aware rendering, LOOP-04/cycle validation changes, editor exit-label preservation, and a migration policy for existing Loop nodes—work that is not atomic with this cleanup. No phase adds `QuestionNode.isLoop`, migrates `loop` nodes, changes runner states, or rewrites LOOP-04 validation.
- Inherited verification commands were normalized where their original form would false-match retained names (for example `renderSnippetFillNotFound`) or assume a single-phase working tree.

## Risk Flags
- **c1-r1** — Verify the direct close-button child still anchors left while Back/Redo/Skip anchor right in at-node, awaiting-loop-pick, snippet-pick, and content-only states; prior footer restructures regressed state-specific height and positioning.
- **c2-r1** — Confirm `.json` files are left untouched on disk, omitted from folder listings and descendant search, and that `SnippetService.resolveSnippet` returns `legacy-json` for both explicit `.json` references AND extensionless IDs backed by a `.json` file at the root or a unique subdirectory, and `missing` when no `.md`/`.json` match exists. The view switches on the discriminated result, delegating to `render-snippet-fill.ts` presentation helpers only. README migration copy must tell users to recreate them as frontmatter-backed Markdown templates rather than implying automatic conversion. Cover all three outcomes with service resolver tests plus view/render tests.
- **c2-r2** — Confirm `renameSnippet` rejects non-`.md` source paths before destination calculation or vault mutation; retain direct regression coverage proving a `.json` file's bytes/path are unchanged.
- **c2-r3** — Confirm the shared-file edits in Phases 1 and 2 remain disjoint: footer/listener removal versus snippet-resolution removal in `src/views/inline-runner-modal.ts`, and distinct key removals in both locale files.
- **c3-r1** — Confirm Text block is absent only from new-node creation while legacy model/parser/runner/editor/start-picker/CSS/i18n/fixture/test support remains intact, including `snippetId`-bearing nodes; Answer chains must preserve separator, auto-advance, loop-body, undo/redo, and dead-end behavior.
- **c4-r1** — Rule whether duplicating `200×80` and `rgba(76, 175, 80, 0.28)` in the protocol layer with comments is preferable to introducing shared lower-layer constants; reject any solution that imports from `views/` into `protocol/`.
- **c4-r2** — Search all `createEmptyProtocolDocument` call sites and assertions; pass only if no unmodified code relies on `nodes: []`.
- **c5-r1** — Exercise search rebuilding on tall and short viewports. The body and bare-result list must use viewport-derived heights capped at 480px/440px, while modal overflow provides the final safety net; pinning and list scrolling must not jump.
- **c5-r2** — Compare keyboard-highlight, mouse-hover, and committed-folder states in theme variants; use a non-layout-affecting inset accent stripe so the row's 1px border-box geometry and text position remain constant.

## Phase 1: Remove create-snippet-from-selection footer button
### Changes
- `src/views/inline-runner-modal.ts` — Remove the `SnippetEditorModal` import; delete `createSnippetBtnEl`, `boundSelectionHandler`, the `mouseup`/`selectionchange` listener setup and teardown, and the private `getSelectedContentText`, `updateCreateSnippetButtonState`, and `handleCreateSnippetFromSelection` methods. Rewrite the footer rebuild so the close button is a direct child of `footerBtnRowEl`, matching `buildContainer()`, while `renderFooterIcons()` continues to append Back/Redo/Skip as the second flex item. Keep `SnippetEditorModal` itself and its other callers untouched.
- `src/styles/inline-runner.css` — Remove the obsolete `.rp-runner-footer-left` rule and its feature comment. Retain `.rp-runner-icon-btn:disabled`, which is shared by Back/Redo/Skip.
- `src/i18n/locales/en.json` — Remove `protocolRunner.createSnippetFromSelection`.
- `src/i18n/locales/ru.json` — Remove `protocolRunner.createSnippetFromSelection`.

### Success Criteria
#### Automated Verification:
- [x] `npm run build` passes with no references to the removed import, fields, listeners, or methods.
- [x] `npm run lint` passes after the TypeScript, CSS, and locale deletions.
- [x] `npm test` passes without requiring new footer-button tests.
- [x] `rg -n "createSnippetFromSelection|createSnippetBtn|boundSelectionHandler|getSelectedContentText|updateCreateSnippetButtonState|handleCreateSnippetFromSelection|rp-runner-footer-left|rp-inline-runner-create-snippet-btn" src` returns no matches.
#### Manual Verification:
- [ ] The inline-runner footer shows only close (×) on the left and Back/Redo/Skip on the right when applicable; no create-snippet icon remains.
- [ ] Footer alignment and height are unchanged in at-node, awaiting-loop-pick, snippet-pick, and content-only states.
- [ ] Selecting runner content produces no console error or state change now that the selection listeners are gone.

## Phase 2: Remove JSON snippet code support and rewrite README
### Changes
- `src/snippets/snippet-model.ts` — Remove `JsonSnippet`, `SnippetFile`, and `renderSnippet`; narrow `Snippet` to `MdSnippet | MdTemplateSnippet`. Retain `SnippetPlaceholder`, both Markdown models, `renderMdTemplateSnippet`, validation, and slugging behavior.
- `src/snippets/snippet-service.ts` — Remove the `JsonSnippet` import and all `.json` list/load/save routing; `.json` entries are skipped and `.json` loads return `null`. Remove `sanitizeJson`; deep-copy placeholders only for `md-template` duplication; narrow relative-path extension stripping to `.md`. In `renameSnippet`, reject every normalized source that does not end in `.md` before computing a destination or touching the vault, then preserve `.md`; do not relabel legacy JSON bytes. Add `resolveSnippet(snippetId: string): Promise<SnippetResolution>` owning ALL root-checked snippet-ID resolution — direct full-path, extensionless root probe, and unique-subdirectory fallback scan via `this.app.vault.getFiles()` scoped to the snippet root — routed through `assertInsideRoot`. Return a discriminated `SnippetResolution = { status: 'found'; snippet: MdSnippet | MdTemplateSnippet } | { status: 'legacy-json'; path: string } | { status: 'missing' }`: `.md` hits load via the narrowed `load()`; explicit `.json` refs and extensionless IDs whose backing `.json` file exists at the root or in a unique subdirectory return `legacy-json` with the matched path; everything else returns `missing`. Export `SnippetResolution` from `snippet-service.ts` (or `snippet-model.ts` if it needs shared model typing).
- `src/views/insert-snippet-modal.ts` — Remove JSON validation and render branches; retain plain Markdown and Markdown-template insertion.
- `src/views/snippet-tree-picker.ts` — Remove the `.json`-specific glyph branch; return the Markdown glyph for `.md` and the existing default otherwise. Filter descendant-search `fileMatches` to `.md` before basename matching so `listFolderDescendants()` can remain extension-agnostic for accurate folder-delete counts while legacy `.json` files never render as selectable search rows.
- `src/views/inline-runner-modal.ts` and `src/runner/render/render-snippet-fill.ts` — Move ALL snippet-ID resolution out of the view and into `SnippetService.resolveSnippet` (see the service bullet). `inline-runner-modal.ts` `handleSnippetFill` reduces to: call `this.plugin.snippetService.resolveSnippet(snippetId)`, then switch on the discriminated result — `found` → existing `md`/`md-template` fill dispatch (unchanged); `legacy-json` → call `renderSnippetFillUnsupportedFormat(questionZone, resolution.path, t)`, `this.runner.stepBack()`, and `this.render()`; `missing` → call `renderSnippetFillNotFound(questionZone, snippetId)`. Delete the view's path-shape branching (`isPhase51FullPath` / the `isFullSnippetPath` import), the root `${id}.json`/`${id}.md` probe loop, the `this.app.vault.getFiles().filter(...)` subdirectory scan, the `snippet.kind === 'json'` validation gate, and the inline `Notice` for `inlineRunner.snippetCannotBeUsed` — all superseded by the resolver. `render-snippet-fill.ts` stays presentation-only: add `renderSnippetFillUnsupportedFormat(zone, path, t)` emitting the localized legacy-JSON message using the new `inlineRunner.snippetLegacyJson` key; keep `renderSnippetFillLoading` and `renderSnippetFillNotFound`; internalize `isFullSnippetPath` into the service resolver and remove it from `render-snippet-fill.ts` only if `rg -n "isFullSnippetPath" src` confirms no other caller remains. Preserve Phase 1's footer/listener deletions.
- `src/views/snippet-editor-modal.ts` — Narrow `DraftKind` to `'md' | 'md-template'`; remove JSON clone/save/path/type-label branches; keep `.md` paths and `md-template` validation.
- `src/views/snippet-chip-editor.ts` — Narrow `EditableTemplateSnippet` to `MdTemplateSnippet` and remove the `JsonSnippet` import.
- `src/views/snippet-fill-in-modal.ts` — Accept `MdTemplateSnippet` and render exclusively with `renderMdTemplateSnippet`.
- `src/views/snippet-manager/tree-renderer.ts` — Narrow `TreeNodeFile.snippetKind` to `'md' | 'md-template'` and use `file-text` for snippet files.
- `src/runner/render/render-snippet-picker.ts` — Remove the JSON validation gate before `onSnippetReady`.
- `src/i18n/locales/en.json` — Remove `insertSnippet.cannotBeUsed` and `inlineRunner.snippetCannotBeUsed`; add the localized legacy-JSON unsupported runner message under key `inlineRunner.snippetLegacyJson` (consumed by `renderSnippetFillUnsupportedFormat`, with `{path}` interpolation); preserve `snippetModel` validation and `canvasParser.*` keys.
- `src/i18n/locales/ru.json` — Apply the same removals/addition while preserving the same retained key families.
- `README.md` — Remove the intro `.canvas` clause, the Existing Canvas Protocols section, and the phantom conversion command. Document only plain `.md` snippets and frontmatter-backed `.md` templates, correct placeholders to free text or choice, and change setup wording from “JSON or Markdown” to “Markdown” without hardcoded versions. Add a migration note that legacy `.json` snippets are not converted or deleted and must be recreated as Markdown templates.
- `README.ru.md` — Apply the mirrored Russian rewrite and migration note.
- `src/__tests__/snippet-model.test.ts` — Remove `renderSnippet` / `SnippetFile` coverage while retaining slugging and Markdown-model coverage.
- `src/__tests__/snippet-service.test.ts` — Remove JSON fixtures and list/load/save assertions; retain `.md` and `md-template` behavior. Add `resolveSnippet` resolver tests covering all five outcomes: found `.md`, found `md-template`, explicit `.json` → `legacy-json`, extensionless ID backed by a unique-subdir `.json` → `legacy-json`, and `missing` (no `.md`/`.json` match). Assert every probe routes through `assertInsideRoot` — unsafe/traversal-escaping IDs return `missing` without touching the vault.
- `src/__tests__/snippet-service-validation.test.ts` — Remove JSON-loaded validation cases; retain direct `md-template` placeholder validation.
- `src/__tests__/snippet-editor-modal.test.ts` — Remove JSON draft fixtures/tests; retain Markdown and Markdown-template cases.
- `src/__tests__/runner/render-snippet-picker.test.ts` — Replace JSON fixtures with `md-template` data or remove the obsolete JSON-gate case.
- `src/__tests__/views/snippet-chip-editor.test.ts`, `src/__tests__/views/snippet-fill-in-modal.test.ts`, `src/__tests__/views/snippet-editor-modal-banner.test.ts`, and `src/__tests__/views/snippet-editor-modal-folder-picker.test.ts` — Replace `JsonSnippet` fixtures/types with `MdTemplateSnippet` and preserve the same placeholder/editor behavior assertions.
- `src/__tests__/views/snippet-tree-picker.test.ts`, `src/__tests__/snippet-tree-view.test.ts`, `src/__tests__/snippet-tree-dnd.test.ts`, `src/__tests__/snippet-tree-inline-rename.test.ts`, and `src/__tests__/views/snippet-manager-folder-picker.test.ts` — Remove `snippetKind: 'json'` and JSON row fixtures; use `.md`/`md-template` fixtures and add descendant-search coverage proving `.json` files returned by the raw recursive listing are omitted.
- `src/__tests__/views/inline-runner-modal.test.ts` — Replace JSON insertion/fill fixtures with Markdown-template fixtures, retain separator/cancel/autosave coverage, and add view/render tests for each `resolveSnippet` outcome: `found` renders the fill flow, `legacy-json` (both explicit `.json` and extensionless-backing cases) renders the localized unsupported-format state and calls `stepBack`, and `missing` renders the not-found state. Mock `snippetService.resolveSnippet` to return each variant so the view is tested in isolation from the service resolver (which has its own tests).
- `src/__tests__/snippet-service-move.test.ts` — Convert supported rename/move assertions to `.md`; replace the `.json` rename-success case with a rejection assertion that verifies no rename occurred and the legacy file remains byte-for-byte at its old path.

### Success Criteria
#### Automated Verification:
- [x] `rg -n '\b(JsonSnippet|SnippetFile|renderSnippet|sanitizeJson)\b' src` returns no matches; retained longer symbols such as `renderSnippetFillNotFound` do not count as failures.
- [x] `rg -n "kind\s*===\s*['\"]json['\"]|kind:\s*['\"]json['\"]" src` returns no matches.
- [x] `rg -n "insertSnippet\.cannotBeUsed|inlineRunner\.snippetCannotBeUsed" src` returns no matches.
- [x] `npm run build` passes with the narrowed `Snippet` union and no JSON-related exhaustiveness errors.
- [x] `npm test` passes with every JSON-dependent suite updated, including model/service/editor/render suites plus snippet chip/fill/banner/folder-picker, tree picker/view/DnD/inline-rename/manager-folder-picker, inline-runner, and service move coverage.
- [x] `npm run lint` passes.
#### Manual Verification:
- [ ] `Snippet` is exactly `MdSnippet | MdTemplateSnippet`, and `renderMdTemplateSnippet` is the only placeholder-template render engine.
- [ ] A `.json` file in the snippet root is absent from normal listing and descendant search, and `SnippetService.load()` returns `null` for it; recursive folder-delete counts still include all physical files.
- [ ] Plain `.md` and `md-template` list/load/save/duplicate/rename flows still work; editor creation continues to default to `md-template`.
- [ ] `renameSnippet()` rejects a direct `.json` source without renaming or rewriting it.
- [ ] Insert-modal, inline-runner, fill-in modal, and snippet-picker flows render Markdown snippets correctly without JSON branches.
- [ ] `SnippetService.resolveSnippet(snippetId)` returns the discriminated `SnippetResolution` (`found | legacy-json | missing`) and owns all root-checked direct, extensionless, and unique-subdirectory lookup; every probe routes through `assertInsideRoot`.
- [ ] `npm test` includes service resolver tests for all five outcomes (found-md, found-md-template, explicit-`.json`→legacy-json, extensionless-`.json`-backed→legacy-json, missing) plus view/render tests for each of the three outcomes (`found` fill, `legacy-json` unsupported-format + `stepBack`, `missing` not-found).
- [ ] `inline-runner-modal.ts` `handleSnippetFill` contains no path-shape branching, no `${id}.json`/`${id}.md` probe loop, no `app.vault.getFiles().filter(...)` subdirectory scan, and no `snippet.kind === 'json'` gate — resolution is a single `resolveSnippet` call followed by a switch on the discriminated result.
- [ ] `rg -n "vault\.getFiles\(\)" src/views/inline-runner-modal.ts` returns no matches (the subdirectory scan moved to the service).
- [ ] A runner reference ending in `.json` OR an extensionless ID backed by a `.json` file reaches the explicit localized unsupported-format state via `renderSnippetFillUnsupportedFormat` (not the generic not-found state and not an exception); a missing `.md` reference with no `.json` counterpart still uses the ordinary not-found state.
- [ ] Both READMEs contain no stale Canvas protocol/conversion section or JSON-snippet setup wording, accurately describe the two `.md` formats and supported placeholder types, and state that legacy JSON files are left untouched and require manual recreation.

## Phase 3: Deprecate new Text block creation and preserve legacy compatibility

### Goal Reconciliation & Approved Compatibility Exception
**Approved by Roman Shulgha on 2026-07-27.** The goal states "I want to remove the 'Text block' node type." This phase implements removal at the authoring surface — Text block is removed from `EDITABLE_NODE_KINDS`, so neither new-node creation flow can produce it, and Answer chains become the sole supported authoring path for fixed pass-through text (`Question → Answer1 → Answer2`, with Answer1 selected explicitly and downstream Answer2 auto-appended via `advanceThrough()`). A literal end-to-end removal of the `text-block` kind was considered and rejected because it would break existing vaults whose stored protocols contain `text-block` nodes (including `snippetId`-bearing ones). Accordingly, the retention of `text-block` in the graph model, parser, runner, labels, editor, start-from-node picker, styles, locales, fixtures, and compatibility tests is recorded here as an **explicitly approved compatibility exception** — a sanctioned deprecation-with-legacy-support boundary — not as a claim of full removal. The READMEs describe this exact boundary (no new Text block creation; existing Text blocks continue to load, run, edit, and appear in "Start from specific node"). This note exists to reconcile the goal's "remove" wording with the legacy-support reality the correctness verdict (17-55-58) flagged.

### Changes
- `src/views/protocol-editor-view.ts` — Remove `'text-block'` only from `EDITABLE_NODE_KINDS`, making the list exactly `['start', 'question', 'answer', 'loop', 'snippet']`; both new-node picker flows consume this list, so Text block is no longer creatable. Retain `NODE_KIND_DEFAULTS['text-block']`, the title/edit-field arms, rendering attributes, and dirty-state behavior so stored legacy Text blocks remain visible and editable.
- `src/graph/graph-model.ts`, `src/protocol/protocol-document-parser.ts`, `src/runner/protocol-runner.ts`, `src/runner/runner-state.ts`, and `src/graph/node-label.ts` — Preserve `'text-block'`, `TextBlockNode`, parser acceptance, label resolution, separator handling, the ordinary content traversal arm, and `snippetId`-driven fill state. Do not migrate or reject stored legacy nodes. Preserve the Answer arm unchanged: a clicked Answer is appended by `chooseAnswer()`, and each downstream Answer is appended and followed automatically by `advanceThrough()` until an interactive node or terminal edge is reached.
- `src/views/node-picker-modal.ts` — Retain Text block in `StartableNodeKind`, `KIND_LABEL_KEYS`, `KIND_LABELS`, `KIND_ORDER`, runtime option building, and protocol-record option building. “Start from specific node” selects existing runnable nodes rather than creating nodes, so legacy Text blocks remain valid start points.
- `src/protocol/protocol-document.ts`, `src/styles/protocol-editor.css`, `src/views/inline-runner-modal.ts`, and `src/views/snippet-fill-in-modal.ts` — Preserve the legacy `content` field inventory, Text block minimap/node styling, and traversal/fill comments needed to explain compatibility behavior.
- `src/i18n/locales/en.json` and `src/i18n/locales/ru.json` — Preserve `protocolEditor.nodeKind.text-block`, `protocolEditor.defaultNodeText.text-block`, `nodePicker.textBlock`, `protocolEditor.contentLabel`, and `protocolEditor.textSeparatorLabel` because legacy display/editing and start-point selection still consume them. Leave `canvasParser.legacyFreeTextInput` compatibility guidance unchanged.
- `README.md` and `README.ru.md` — Remove Text block from the list of newly authorable node kinds and replace the instruction to create Text blocks with guidance to chain Answer nodes for fixed pass-through text. Add a compatibility note that existing Text blocks, including snippet-backed ones, continue to load, run, edit, and appear in “Start from specific node”; do not imply that users must migrate or that the parser rejects them. Keep these edits disjoint from Phase 2's Canvas/JSON-snippet rewrite.
- `src/__tests__/helpers/canvas-parser.ts`, Text-block fixtures, and existing compatibility tests under `src/__tests__/` — Retain Text block parsing, labels, editor-helper behavior, start-picker options, ordinary traversal, separators, loop behavior, undo/redo, dead ends, and `snippetId` fill coverage. Add creation-surface assertions that both new-node flows omit Text block. Add an explicit `Question → Answer1 → Answer2` runner assertion proving Answer1 requires selection and downstream Answer2 is appended automatically; keep empty-answer, multi-answer chain, terminal, loop-return, separator, step-back, and redo coverage.

### Success Criteria
#### Automated Verification:
- [x] `npm run build` passes with `text-block` retained in `RPNodeKind`/`RPNode` and every legacy parser, runner, editor, picker, style, locale, fixture, and helper consumer still compiling.
- [x] `npm test` passes with compatibility tests proving a stored `kind: 'text-block'` parses successfully, renders/edits with its legacy fields, runs ordinary `content` and `snippetId` paths, and remains selectable as a start point.
- [x] Protocol-editor creation tests confirm both new-node picker flows derive from `EDITABLE_NODE_KINDS` and do not offer Text block, while tests for editing an existing Text block continue to pass.
- [x] A runner test for `Start → Question → Answer1 → Answer2 → Question2` confirms the runner first halts at Question, selecting Answer1 appends both Answer1 and downstream Answer2 exactly once, and traversal then halts at Question2 without another click.
- [x] Answer-chain tests cover configured separators, an empty downstream Answer, terminal completion, loop-body dead-end return, step-back, and redo.
- [x] `rg -n "text-block|Text block|текстов(ый|ого) блок" src README.md README.ru.md` is reviewed repo-wide across code and user documentation: remaining source references are legacy compatibility surfaces/tests, and README matches are compatibility notes rather than instructions or claims that Text block is newly creatable.
#### Manual Verification:
- [ ] New-node creation menus contain no Text block option, while opening an existing Text block still shows its content, separator, and snippet-related edit behavior with the existing styling and localized labels.
- [ ] An unmigrated protocol containing `text-block` loads and runs unchanged; ordinary content and `snippetId`-backed fill both work, and “Start from specific node” continues to list the legacy node.
- [ ] `Question → Answer1 → Answer2` behaves as requested: Answer1 is selected explicitly and Answer2 is inserted automatically; Answer chains continue to work before, inside, and after loops and with snippet nodes.
- [ ] Both READMEs direct new authoring to Answer chains, do not advertise Text block creation, and clearly state the retained legacy compatibility boundary.
- [ ] Loop remains a separate node in this implementation; the documented `Question.isLoop` checkbox + Done-action design is deferred for the state/validation/migration reasons recorded in Synthesis Notes.

## Phase 4: Default a Start node into newly created protocols
### Changes
- `src/protocol/protocol-document.ts` — Extend `createEmptyProtocolDocument()` with an optional fourth `startNodeId` parameter defaulting to ``node-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}``; use the already-injected `now` value for the timestamp. Seed `nodes` with one `ProtocolNodeRecord`: `{ id: startNodeId, kind: 'start', x: 0, y: 0, width: 200, height: 80, color: 'rgba(76, 175, 80, 0.28)', fields: {} }`. Keep `edges: []` and all document metadata behavior unchanged. Update JSDoc to explain the seeded node and deterministic-ID parameter. Inline dimensions/color with comments referencing the editor defaults, but do not import from `src/views/protocol-editor-view.ts`.
- `src/__tests__/protocol-document-store.test.ts` — Extend both create tests to assert one seeded node whose kind is `start`. Do not assert the random default ID in store tests; direct factory verification may pass an explicit ID.

### Success Criteria
#### Automated Verification:
- [x] A direct factory assertion confirms the default node has kind `start`, world position `(0,0)`, dimensions `200×80`, color `rgba(76, 175, 80, 0.28)`, empty fields, and an ID beginning with `node-`.
- [x] A direct factory assertion with `createEmptyProtocolDocument('id-1', 'T', new Date('2026-01-01T00:00:00Z'), 'start-fixed')` confirms `nodes[0].id === 'start-fixed'`.
- [x] Factory assertions confirm `edges` remains empty and schema/version/document metadata behavior is unchanged.
- [x] `ProtocolDocumentStore.create()` tests confirm `doc.nodes.length === 1` and `doc.nodes[0].kind === 'start'`.
- [x] A graph parsed from the seeded document has zero `GraphValidator` errors, including no `noStartNode`.
- [x] `rg -n "createEmptyProtocolDocument" src` confirms the sole live caller in `src/protocol/protocol-document-store.ts` accepts the new default behavior and no assertion still expects an empty node array.
- [x] `npm test`, `npm run lint`, and `npm run build` pass; the store call site compiles unchanged because the new parameter is optional.
#### Manual Verification:
- [ ] “Create new protocol” opens with one green Start node visible in the initial viewport and no missing-start validation error.
- [ ] The seeded node matches a manually created Start node's dimensions and color.
- [ ] The seeded node can be selected, dragged, edited, connected, deleted, saved, and reopened like an ordinary node.

## Phase 5: Strengthen Insert Snippet modal highlight and vertical layout
### Changes
- `src/styles/snippet-tree-picker.css` — Change `.rp-stp-row-highlighted` to `background: var(--background-modifier-active-hover)` and add `box-shadow: inset 2px 0 0 var(--interactive-accent)` instead of changing `border-left` width. Retain the base 1px transparent border geometry and add `.rp-stp-row-highlighted .rp-stp-row-title { font-weight: var(--font-semibold); }`.
- `src/styles/snippet-tree-picker.css` — On `.rp-insert-snippet-modal`, preserve `align-self: flex-start`, change the top margin to `var(--size-4-6)`, add `max-height: calc(100vh - var(--size-4-12))`, and add vertical overflow as the final short-viewport safety net.
- `src/styles/snippet-tree-picker.css` — Replace the fixed drill-body height with `height: min(480px, calc(100vh - 10rem))` and `min-height: 0`, so normal viewports reach 480px but short viewports reserve space for modal/search chrome and shrink before the modal cap.
- `src/styles/snippet-tree-picker.css` — Give the direct-child bare result list `height` and `max-height` of `min(440px, calc(100vh - 12.5rem))` plus `min-height: 0`, preserving a stable search-result box while reserving the additional search-row space and allowing it to shrink; leave the flexed inner drill-view list untouched. Keep all height rules scoped to the Insert Snippet host.

### Success Criteria
#### Automated Verification:
- [x] `npm run lint` passes Stylelint for `src/styles/snippet-tree-picker.css`.
- [x] `npm run build` and `npm test` pass without TypeScript or test changes for this phase.
- [x] The Phase-5-scoped patch/commit changes only `src/styles/snippet-tree-picker.css`; earlier plan phases may legitimately change other files in the overall working tree.
- [x] `rg -n "background-modifier-hover" src/styles/snippet-tree-picker.css` shows that token only on mouse-hover rules, not `.rp-stp-row-highlighted`.
- [x] CSS inspection confirms `.rp-stp-row-highlighted` does not change border width and Insert Snippet body/list heights contain both viewport-derived shrinking and 480px/440px caps.
#### Manual Verification:
- [ ] Keyboard-highlighted and mouse-hovered rows are visibly distinct; the focused title is semibold and has a 2px inset accent stripe with no horizontal text movement.
- [ ] `.rp-insert-snippet-modal` retains top pinning, has a small top margin, is capped below viewport height, and provides vertical overflow when content cannot shrink further.
- [ ] On a normal viewport the drill view reaches `480px` and bare search results reach `440px`; both shrink from those caps on a short viewport.
- [ ] On a normal viewport the modal extends farther downward with small top/bottom margins; on a short viewport it clamps and scrolls without overflow.
- [ ] Typing in search does not recenter or jump the modal.
- [ ] Inline-runner, editor-host, and Snippet Manager move-to pickers retain their previous heights.
