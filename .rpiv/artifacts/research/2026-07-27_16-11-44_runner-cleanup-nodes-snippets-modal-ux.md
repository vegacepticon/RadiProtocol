---
date: 2026-07-27T16:11:44+0300
author: Roman Shulgha
commit: 9c4452e
branch: main
repository: RadiProtocol
topic: "Runner footer button removal, README + JSON-snippet cleanup, text-block deprecation, loop→question merge feasibility, default Start node, insert-snippet modal CSS (positioning + highlight)"
tags: [research, codebase, inline-runner, graph, runner, snippets, protocol-editor, insert-snippet-modal, readme]
status: ready
last_updated: 2026-07-27T16:11:44+0300
last_updated_by: Roman Shulgha
---

# Research: Runner footer button removal, README + JSON-snippet cleanup, text-block deprecation, loop→question merge feasibility, default Start node, insert-snippet modal CSS

## Research Question
Seven requested changes: (1) remove the create-snippet-from-selection icon from the Runner footer (right of the X); (2) update README "Existing Canvas Protocols" and "Snippets" sections — Canvas protocols are gone, snippets are now `.md` only (no JSON); (3) remove the "Text block" node type and let "Answer" perform the same auto-insert function (`Question → Answer1 → Answer2`: Answer1 clicked, Answer2 auto-inserted); (4) feasibility discussion of removing the "Loop" node type and folding its multi-answer behavior into the "Question" node via a checkbox/icon toggle; (5) default a "Start" node into newly created protocols; (6) make the keyboard-selected snippet in the Insert Snippet modal highlight more clearly (current color too pale); (7) add a small top margin to the Insert Snippet modal and extend it vertically toward the bottom with a small bottom margin (currently flush against the top, ~half screen height).

## Summary
- **Footer button removal (Change 1)** is a clean, self-contained closed subgraph — fields, two listeners, three private methods, one CSS class, one i18n key. `SnippetEditorModal` has 3 other callers and must NOT be deleted. No tests reference the button. Low risk.
- **README + JSON snippets (Change 2)**: The README documents a "Convert Canvas protocol to .rp.json" command that **does not exist** in `main.ts` (production resolver only handles `.rp.json`; `CanvasParser` is test-only). JSON snippets are **still fully supported** in code (`snippet-service.ts` lists/loads/saves `.json`; insert modal, tree picker, and runner all handle `JsonSnippet`). Per developer decision, the JSON code support is to be **removed** alongside the README rewrite — expanding scope across the snippets layer, runner, and views. `MdTemplateSnippet` (frontmatter `.md` with placeholders) is the modern placeholder format and stays.
- **Text-block → Answer (Change 3)**: The requested `Question → Answer1 → Answer2` auto-insert behavior **already exists** — `chooseAnswer` appends Answer1 and `advanceThrough` auto-walks Answer1's first neighbor (Answer2) via the `case 'answer'` arm. Per developer decision, the strategy is **not-creatable-but-still-runnable**: keep `'text-block'` in `RPNodeKind`/parser/runner so existing protocols work, remove it only from `EDITABLE_NODE_KINDS` so new text-blocks can't be created. Answer chains become the authoring path for auto-inserted text. `TextBlockNode.snippetId` (the one unique field) keeps working for existing protocols.
- **Loop → Question merge (Change 4)** is **feasible but medium-to-high complexity**. The `LoopContext` stack, undo/redo, dead-end return, and `isExitEdge`/`stripExitPrefix` are reusable. The hard parts: reconciling `AT_NODE` (question actions) with `AWAITING_LOOP_PICK` (loop returns), making the Question renderer edge-aware so `+` exit edges aren't shown as answers, tightening LOOP-04 body semantics (current Loop accepts any target; Question only renders Answer/Snippet), and the editor toggle must also drive the edge-exit checkbox and `+`-label preservation. A `QuestionNode.isLoop?: boolean` flag reusing `loopContextStack` is the recommended shape. This is exploratory — no decision to implement yet.
- **Default Start node (Change 5)**: `createEmptyProtocolDocument()` (`src/protocol/protocol-document.ts:118-135`) returns `nodes: []`, so new protocols always fail validation with `noStartNode` (`src/graph/graph-validator.ts:60-62`). Injecting a single Start node record at `(0,0)` world coordinates inside `createEmptyProtocolDocument` is the cleanest single source of truth. `GraphValidator` already treats a single-start-node graph as valid; the editor centers the viewport on `(0,0)` by default. Only one test file (`protocol-document-store.test.ts`) needs new assertions.
- **Insert-snippet modal CSS (Changes 6 & 7)** are both confined to `src/styles/snippet-tree-picker.css` and are independent. Positioning: change `margin-top: 0` → `var(--size-4-6)`, raise the `360px` body height and `320px` list min-height, add a `max-height: calc(100vh - var(--size-4-12))` safety cap (established codebase pattern). Highlight: replace `--background-modifier-hover` with `--background-modifier-active-hover` plus a `2px` left accent stripe in `--interactive-accent`, matching the `[data-editing="true"]` row pattern already used in `snippet-manager.css`.

## Detailed Findings

### Change 1 — Remove create-snippet-from-selection footer button
The button is a self-contained "Phase 2" feature with no external callers of its private methods and no test coverage (grep of `src/__tests__/` for all Phase 2 identifiers returned zero matches).

Complete removal surface:
- Fields: `createSnippetBtnEl` and `boundSelectionHandler` declared at `src/views/inline-runner-modal.ts:79-81`.
- Import of `SnippetEditorModal` at `src/views/inline-runner-modal.ts:12` becomes unused — remove it. **Do NOT delete `SnippetEditorModal` itself**: it has 3 other production callers — `src/main.ts` `handleCreateSnippet`, and `src/views/snippet-manager-view.ts` `openEditModal` (edit) + `openCreateModal` (create) — plus dedicated test suites.
- Listener wiring in `open()`: `mouseup` on `contentEl` + `selectionchange` on `document` (the latter must be on `document` because `selectionchange` does not bubble).
- Footer render block: the `leftGroup` div (`rp-runner-footer-left`) wrapping close + create-snippet is recreated on every `render()` because `footerBtnRowEl.empty()` destroys all children. After removal, the close button can revert to a direct child of `footerBtnRowEl` and `leftGroup` becomes unnecessary.
- Three private methods: `getSelectedContentText()`, `updateCreateSnippetButtonState()`, `handleCreateSnippetFromSelection()`.
- Cleanup in `close()` detaches the two listeners and nulls the fields.
- CSS: `.rp-runner-footer-left` rule in `src/styles/inline-runner.css` becomes dead and should be removed. `.rp-inline-runner-create-snippet-btn` has **no dedicated CSS rule** (it rides on shared `.rp-runner-icon-btn`). The `.rp-runner-icon-btn:disabled` rule must be **kept** — it also styles Back/Redo/Skip disabled states.
- i18n: `protocolRunner.createSnippetFromSelection` in both `src/i18n/locales/en.json` and `ru.json` is referenced only by this button's `aria-label` — remove from both locales.

Precedent: the self-check copy button removal (`72b1106`) was an equally self-contained closed subgraph and needed zero follow-up fixes. The same low risk applies here.

### Change 2 — README rewrite + JSON snippet code removal
Two READMEs are mirrored bilingual: `README.md` (English) and `README.ru.md` (Russian).

**Canvas section is stale and references a phantom command.** The "Existing `.canvas` protocols" sections (`README.md` ~line 72-75, `README.ru.md` ~line 72-75) document a "Convert Canvas protocol to .rp.json" command. That command is **not registered** anywhere in `src/main.ts` (`onload` registers only: open-snippet-manager, open-protocol-editor, start-from-node, run-protocol-inline, insert-snippet, create-snippet). The production resolver `resolveProtocolDocumentFiles()` handles only `.rp.json`. `CanvasParser` exists but is test-only (referenced in `__tests__/` and leftover `canvasParser.*` i18n keys). The intro `.canvas` clause at `README.md:7` / `README.ru.md:7` is also stale. These should be deleted — the code already matches the intended state.

**JSON snippets are still fully supported in code — per developer decision, remove the code support too.** The `Snippet` union has 3 kinds (`src/snippets/snippet-model.ts:93`): `JsonSnippet`, `MdSnippet` (plain `.md`), and `MdTemplateSnippet` (frontmatter `.md` with placeholders). The README's "two types" split is stale and undocumented `MdTemplateSnippet` is the modern placeholder format. JSON is routed at every layer:
- `src/snippets/snippet-service.ts:124-141` — `list()` parses `.json` into `JsonSnippet`; `:143-156` splits `.md` into `md-template` (via `hasMarkdownTemplateFrontmatter`) or plain `md`.
- `src/snippets/snippet-service.ts:180-185` — `load()` routes `.json`; `:193-197` routes `.md`.
- `src/snippets/snippet-service.ts:225-227` — `save()` JSON-stringifies `JsonSnippet` via `sanitizeJson` (`:521`).
- `src/views/insert-snippet-modal.ts:61-78` — `handleSelect`/`renderSnippetForInsert` handle `snippet.kind === 'json'` (validation gate + placeholder fill).
- `src/views/snippet-tree-picker.ts:40-44` — `fileGlyph()` maps `.json` → 📄.
- `src/views/inline-runner-modal.ts:1063-1075` — runner tries `.json` extension first when resolving a snippetId, with `.json`/`.md` fallback scan.
- `src/snippets/snippet-model.ts:107-126` — `validatePlaceholders` flags legacy placeholder types (`number`, `multichoice`, `multi-choice`); the live `SnippetPlaceholder.type` union is only `'free-text' | 'choice'` (`:10-13`). The README placeholder list ("free text, choice, multi-choice, number, or date" at `README.md:13`/`README.ru.md:13`) is wrong — `date` never existed; `multi-choice`/`number` are legacy.

Removing JSON code support touches: `snippet-service.ts` (drop `.json` branches in list/load/save + `sanitizeJson`), `snippet-model.ts` (remove `JsonSnippet` from union, remove `renderSnippet`/`SnippetFile` alias if unused), `insert-snippet-modal.ts` (drop json validation gate), `snippet-tree-picker.ts` (drop `.json` glyph), `inline-runner-modal.ts` (drop `.json`-first resolution + json arms), and the README rewrite. Existing `.json` snippet files in user vaults would stop loading — a migration story (or graceful "legacy, read-only" handling) is an open design question.

### Change 3 — Text-block deprecation (not creatable, still runnable)
The requested auto-insert behavior already exists in the runner. Trace of `Question → Answer1 → Answer2`:
- `advanceThrough` halts at `case 'question'` (`src/runner/protocol-runner.ts:726-734`) — sets `AT_NODE` and returns without following any edge. This is what makes the next step click-required.
- `chooseAnswer(Answer1)` (`src/runner/protocol-runner.ts:92-126`) appends Answer1's text, then calls `advanceThrough` on `Answer1`'s first neighbor (`adjacency[0]`) — it does **not** re-traverse Answer1, so Answer1 is not double-inserted.
- `advanceThrough(Answer2)` hits `case 'answer'` (`src/runner/protocol-runner.ts:736-757`) which appends Answer2's `answerText` and follows Answer2's first neighbor automatically.

So Answer1 is "click-required" because it is reached via `chooseAnswer` (user action), and Answer2 is "auto-inserted" because it is reached as the `cursor` of `advanceThrough` (auto-advance). There is no flag distinguishing them — the distinction is how the node is reached. Answer chains already provide automatic downstream insertion.

`TextBlockNode` (`src/graph/graph-model.ts:47-52`) adds two things AnswerNode lacks: `content` (vs `answerText`) and `snippetId` (snippet-fill on auto-advance). The `case 'text-block'` arm (`src/runner/protocol-runner.ts:711-724`) checks `snippetId` first (→ `AWAITING_SNIPPET_FILL`) else appends `content` and follows the first neighbor. `resolveSeparator` already accepts Answer, TextBlock, and Snippet (`src/runner/protocol-runner.ts:646-659`).

Chosen strategy — **not creatable, still runnable**:
- Keep `'text-block'` in `RPNodeKind` (`src/graph/graph-model.ts:13`), `TextBlockNode` in `RPNode` (`:119`), the parser case (`src/protocol/protocol-document-parser.ts:31,210-218`), the runner `case 'text-block'` arm, `nodeLabel` case (`src/graph/node-label.ts:23`), and `NODE_KIND_DEFAULTS['text-block']` (`src/views/protocol-editor-view.ts:251`) so existing `.rp.json` files still parse, render, edit, and run.
- Remove `'text-block'` from `EDITABLE_NODE_KINDS` (`src/views/protocol-editor-view.ts:256`) so neither `openNodeKindPickerAtWorldPoint` (`:769-784`) nor `openNodeKindPickerAndConnectAtWorldPoint` (`:819-824`) offers it.
- Existing text-blocks (including `snippetId`-bearing ones) keep working; no migration needed.
- The "Start from specific node" picker (`src/views/node-picker-modal.ts:9,22-29,56-63,92-106`) independently lists text-blocks — if the intent is to also stop surfacing them as start points, that picker's `StartableNodeKind`/`KIND_LABELS`/`KIND_ORDER`/`buildNodeOptions` need matching edits. This is an open question (the picker currently still lists `start` and `answer` despite comments saying they're excluded — implementation is authoritative).

The loop-start/loop-end deprecation (Phase 43) is the established precedent for "parseable but not creatable": kinds stay in `RPNodeKind`, parser accepts them, validator rejects canvases containing them with a migration error (`src/graph/graph-validator.ts:65-78`). Text-block deprecation is softer — it stays runnable, not validator-rejected.

### Change 4 — Loop → Question merge (feasibility)
**Feasible but medium-to-high complexity.** The `LoopContext` stack algorithm is largely reusable; unifying the two interaction models is the hard part.

Reusable with little change:
- `LoopContext` stack (`src/graph/graph-model.ts:92-108`) — `loopNodeId` can point to a flagged Question (all ops resolve it as an ID). `iteration` and `textBeforeLoop` unchanged.
- Undo/redo snapshots and dead-end return machinery (`advanceOrReturnToLoop`, `src/runner/protocol-runner.ts:863-880`).
- `isExitEdge`/`stripExitPrefix` (`src/graph/node-label.ts:63-101`) — the `+`-prefix exit convention should be **retained** for looping Questions (no other exit discriminator exists in `RPEdge`).
- Most LOOP-04 predicates and the cycle-suppression concept.

Recommended model: `QuestionNode` gains `isLoop?: boolean` (absence = normal Question). `questionText` replaces `headerText`. The editor toggle lives in the Question edit branch of `openEditModal` (`src/views/protocol-editor-view.ts:2347-2350`), immediately below the questionText input, reusing the existing checkbox pattern (`:2181-2189`).

Significant integration work:
1. **State-machine conflict.** `chooseAnswer`/`skip`/`chooseSnippetBranch` all require `AT_NODE` (`src/runner/protocol-runner.ts:96-98,139-146,186-198`); all loop returns produce `AWAITING_LOOP_PICK` (`:773-778`, `:873-876`). A looping Question needs both answer actions AND a "done/exit" action. Three designs: keep looping Questions in `AT_NODE` (answer APIs stay, add a separate done action), keep `AWAITING_LOOP_PICK` (answer APIs must accept that status), or add a new runner state. No new payload fields are inherently required, but a status/generalization change is.
2. **Edge-aware Question rendering.** `renderQuestionAtNode` (`src/runner/render/render-question.ts:50-60`) partitions **adjacency targets** into answer/snippet and ignores all other kinds. `renderLoopPicker` (`src/runner/render/render-loop-picker.ts:44-62`) iterates concrete **edge records** and splits `+` exits from body. A looping Question cannot just concatenate both — it must classify edge records first so a `+` exit edge targeting an Answer is not shown as a normal answer button.
3. **Body semantics gap.** LOOP-04 D-07 (`src/graph/graph-validator.ts:163-167`) treats any non-`+` outgoing edge as a body. The Question renderer only shows Answer/Snippet targets. A looping Question with an unlabeled edge to a non-answer/non-snippet node would pass D-07 but render no button. Validation must define a valid looping-question body as a non-exit edge to a renderable Answer/Snippet target — a real semantic change, not just a gate swap.
4. **Editor behavior beyond the checkbox.** The edge editor only shows its exit checkbox when `fromNode.kind === 'loop'` (`src/views/protocol-editor-view.ts:2048-2057`); it must also recognize a Question with `isLoop === true`. The `+`-label display/save preservation (`:327-334`) is currently loop-source-only and must extend to looping Questions, or `+Done` edges get stripped on save (this exact bug recurred in precedent `50a7fcb`). Turning loop mode off while `+` edges still exist needs a defined cleanup behavior — current code does not auto-rewrite edges on field change.
5. **Validation re-gating.** LOOP-04 (`src/graph/graph-validator.ts:131-170`) gate becomes `node.kind === 'question' && node.isLoop === true`. Cycle detection D-09 (`:272-278`) replaces `node.kind === 'loop'` with the looping-Question predicate. D-05's "legacy labeled edge" wording conflicts with routinely-labeled Question→Answer answer-caption edges, so a looping Question with answers but no Done edge would often get D-05 — messaging needs Question terminology. Dead-end question check (`:106-115`) should be gated to non-loop Questions to avoid redundant errors.

Existing `loop` nodes would need migration: `headerText` → `questionText`, kind `loop` → `question` with `isLoop: true`, and the editor dropdown/`NODE_KIND_DEFAULTS` updated in the same slice (Phase 44 forgot the dropdown and blocked all UAT — precedent `cd98df3`).

### Change 5 — Default Start node on protocol creation
Flow: `createAndOpenProtocol` (`src/main.ts:207-215`) → `ProtocolDocumentStore.create` (`src/protocol/protocol-document-store.ts:80-107`, calls `createEmptyProtocolDocument` at `:95`) → write to disk → `activateProtocolEditorView` (`src/main.ts:162`) → `loadProtocol` → `renderDocument`.

`createEmptyProtocolDocument` (`src/protocol/protocol-document.ts:118-135`) returns `nodes: []`, `edges: []`. `GraphValidator.validate` (`src/graph/graph-validator.ts:60-62`) emits `noStartNode` and returns early when there are zero start nodes — so a brand-new protocol always fails validation until the user manually adds a Start node.

Cleanest injection point: **`createEmptyProtocolDocument` itself** (single source of truth; pure function). Add one `ProtocolNodeRecord`: `{ id: <generated>, kind: 'start', x: 0, y: 0, width: 200, height: 80, color: 'rgba(76, 175, 80, 0.28)', fields: {} }`. The protocol layer has no existing node-ID generator (`nodeUid` is view-layer at `src/views/protocol-editor-view.ts:293-295`), so inline a similar `node-${Date.now()}-${random}` pattern or accept a `startNodeId` parameter. World `(0,0)` maps to surface center via `worldXToSurfaceX/worldYToSurfaceY` (`PROTOCOL_EDITOR_ORIGIN_X/Y = 15000/12000`), and `restoreViewportState` scrolls to that center by default when `doc.viewport` is undefined — so the node is visible without auto-centering logic. A single-start-node graph with no edges is valid (zero validator errors). `renderDocument` renders the node; the `noNodes` empty-state no longer appears.

Affected tests: only `src/__tests__/protocol-document-store.test.ts` `create` tests (~lines 197-218) need new assertions (`result.doc.nodes` length 1, `kind: 'start'`). Other test fixtures construct `ProtocolDocumentV1` directly with `nodes: []` (not via `createEmptyProtocolDocument`) and are unaffected. No dedicated `createEmptyProtocolDocument` test file exists.

### Changes 6 & 7 — Insert-snippet modal CSS (highlight + positioning)
Both changes are confined to `src/styles/snippet-tree-picker.css` and are independent. The modal adds `rp-insert-snippet-modal` to `modalEl` in `onOpen` (`src/views/insert-snippet-modal.ts:22-25`).

**Positioning (Change 7):** `.rp-insert-snippet-modal { align-self: flex-start; margin-top: 0; }` (`src/styles/snippet-tree-picker.css:232-235`) opts out of Obsidian's `.modal-container` flex centering and pins flush to the top. Body height is fixed at `360px` (`:238-240`) and list `min-height: 320px` (`:243-247`); the base `.rp-stp-list { max-height: 320px }` (`:143-152`) caps the list. Recommended changes: `margin-top: var(--size-4-6)` (top gap); raise body height (fixed `520px` or `calc(100vh - var(--size-4-12))`); raise list `min-height` proportionally and add a host-scoped `max-height` override so the list fills the taller body; add `max-height: calc(100vh - var(--size-4-12))` on `.rp-insert-snippet-modal` as a safety cap. The `calc(100vh - var(--size-4-N))` pattern is established in `src/styles/inline-runner.css:71,92` and `src/styles/protocol-editor.css:285,495,516`. Keep `align-self: flex-start` (content grows downward; `align-self: stretch` would fight content-driven height). The codebase has no `.modal-container` override — Obsidian's container does not impose a `max-height`, but `.modalEl` may, hence the explicit cap. The pinning design itself (opting out of centering to stop per-keystroke recentering) is documented in `.rpiv/artifacts/designs/2026-07-26_16-19-09_slice-3_insert-snippet-modal-pinning-no-jumping-on-keystroke.md` — keep it intact.

**Highlight (Change 6):** `.rp-stp-row-highlighted { background: var(--background-modifier-hover); border-color: var(--background-modifier-border); }` (`src/styles/snippet-tree-picker.css:301-304`) uses the **same** variable as mouse-hover on every row/breadcrumb (`:131`, `snippet-manager.css:186`), and the row's base border is `1px solid transparent` (`:164`) — so the highlight is nearly indistinguishable from hover. Recommended: `background: var(--background-modifier-active-hover)` + `border-left: 2px solid var(--interactive-accent)`. This matches the `[data-editing="true"]` active-row pattern at `src/styles/snippet-manager.css:214-217` (the codebase's established "selected row" visual language). Both variables are already proven theme-compatible in this codebase. A `font-weight: var(--font-semibold)` bump is a secondary enhancement (the active breadcrumb already uses it at `:83`). Reusing `--interactive-accent` as a 2px stripe (not a full fill) stays visually distinct from the solid-accent `.rp-stp-select-folder-btn.is-committed` (`:289-293`), so no confusion. The keyboard-highlight TS machinery (`highlightedIndex`/`highlightedRowEl`, `moveHighlight` adding the class, live-DOM `querySelectorAll` at keypress time, reset after `removeBody`) is documented in `.rpiv/artifacts/designs/2026-07-26_16-19-09_slice-4_snippettree-picker-keyboard-navigation.md` — CSS-only change, no TS edits needed.

Cross-connection: extending the modal vertically (Change 7) shows more rows simultaneously, making a stronger highlight (Change 6) more important — the two should land together.

## Code References
- `src/views/inline-runner-modal.ts:79-81` — `createSnippetBtnEl` + `boundSelectionHandler` field declarations (Change 1)
- `src/views/inline-runner-modal.ts:233-239` — selection listener wiring in `open()` (Change 1)
- `src/views/inline-runner-modal.ts:446-473` — footer render teardown + leftGroup + create-snippet button (Change 1)
- `src/views/inline-runner-modal.ts:739-775` — `getSelectedContentText`/`updateCreateSnippetButtonState`/`handleCreateSnippetFromSelection` (Change 1)
- `src/styles/inline-runner.css:341-347` — `.rp-runner-footer-left` CSS to remove (Change 1)
- `src/snippets/snippet-service.ts:124-141` — `list()` `.json` branch to remove (Change 2)
- `src/snippets/snippet-service.ts:180-197` — `load()` extension routing (Change 2)
- `src/snippets/snippet-service.ts:225-237` — `save()` kind branches (Change 2)
- `src/snippets/snippet-model.ts:24-47,93` — `JsonSnippet` + `Snippet` union (Change 2)
- `src/snippets/snippet-model.ts:10-13,107-126` — placeholder type union + legacy validation (Change 2)
- `src/views/insert-snippet-modal.ts:61-78` — `handleSelect`/`renderSnippetForInsert` json arm (Change 2)
- `src/views/snippet-tree-picker.ts:40-44` — `fileGlyph()` `.json` mapping (Change 2)
- `src/views/inline-runner-modal.ts:1063-1075` — runner `.json`-first snippet resolution (Change 2)
- `src/graph/graph-model.ts:47-52` — `TextBlockNode` interface (Change 3)
- `src/protocol/protocol-document-parser.ts:27-36,210-218` — `VALID_KINDS` + text-block parse case (Change 3)
- `src/runner/protocol-runner.ts:711-724` — `case 'text-block'` arm (Change 3)
- `src/runner/protocol-runner.ts:736-757` — `case 'answer'` auto-advance arm (Change 3)
- `src/runner/protocol-runner.ts:726-734` — `case 'question'` halt (Change 3)
- `src/runner/protocol-runner.ts:92-126` — `chooseAnswer` (Change 3)
- `src/graph/node-label.ts:23` — text-block label case (Change 3)
- `src/views/protocol-editor-view.ts:248-256` — `NODE_KIND_DEFAULTS` + `EDITABLE_NODE_KINDS` (Changes 3, 4, 5)
- `src/views/node-picker-modal.ts:9,22-29,56-63,92-106` — start-picker text-block entries (Change 3)
- `src/graph/graph-model.ts:63-67,92-108` — `LoopNode` + `LoopContext` (Change 4)
- `src/runner/protocol-runner.ts:763-805` — `case 'loop'` entry/B1 guard (Change 4)
- `src/runner/protocol-runner.ts:247-282` — `chooseLoopBranch` (Change 4)
- `src/runner/protocol-runner.ts:863-880` — `advanceOrReturnToLoop` dead-end return (Change 4)
- `src/runner/render/render-loop-picker.ts:44-62` — loop picker edge-iteration render (Change 4)
- `src/runner/render/render-question.ts:50-94` — question answer/snippet partition render (Change 4)
- `src/runner/runner-state.ts:43-57` — `AwaitingLoopPickState` (Change 4)
- `src/graph/graph-validator.ts:131-170` — LOOP-04 checks (Change 4)
- `src/graph/graph-validator.ts:251-289` — `detectUnintentionalCycles` D-09 (Change 4)
- `src/graph/graph-validator.ts:106-115` — dead-end question check (Change 4)
- `src/views/protocol-editor-view.ts:2048-2057,2347-2350,327-334` — edge exit checkbox, question edit branch, label preservation (Change 4)
- `src/protocol/protocol-document.ts:118-135` — `createEmptyProtocolDocument` (Change 5)
- `src/protocol/protocol-document-store.ts:80-107` — `create()` (Change 5)
- `src/main.ts:162,207-215` — `activateProtocolEditorView`/`createAndOpenProtocol` (Change 5)
- `src/graph/graph-validator.ts:60-62` — `noStartNode` early return (Change 5)
- `src/styles/snippet-tree-picker.css:232-247` — insert-snippet modal pinning + body/list height (Change 7)
- `src/styles/snippet-tree-picker.css:301-304` — `.rp-stp-row-highlighted` (Change 6)
- `src/styles/snippet-manager.css:214-217` — `[data-editing="true"]` active-row precedent (Change 6)
- `src/styles/inline-runner.css:71,92` — `calc(100vh - var(--size-4-N))` tall-modal precedent (Change 7)
- `README.md:7,13,48,58,60,63-68,72-75` — English README edit inventory (Change 2)
- `README.ru.md:7,13,48,58,60,63-68,72-75` — Russian README edit inventory (Change 2)

## Integration Points

### Inbound References
- `src/main.ts:110-113` — `create-snippet` command calls `SnippetEditorModal` (keeps it alive after Change 1).
- `src/views/snippet-manager-view.ts:241-262` — two more `SnippetEditorModal` callers (edit + create) — keep alive (Change 1).
- `src/views/inline-runner-modal.ts:446-473` — footer render is the sole consumer of the create-snippet button; `render()` is called on every state transition (Change 1).
- `src/views/protocol-editor-view.ts:769-784,819-824` — both node-creation pickers iterate `EDITABLE_NODE_KINDS` (Changes 3, 4).
- `src/views/inline-runner-modal.ts:1004-1123` — runner snippet resolution consumes all three snippet kinds (Change 2).

### Outbound Dependencies
- `src/snippets/snippet-service.ts` → `src/snippets/snippet-model.ts` (kind union), `src/snippets/md-template.ts` (frontmatter parse) — Change 2 narrows the kind union.
- `src/runner/protocol-runner.ts` → `src/graph/node-label.ts` (`isExitEdge`), `src/graph/graph-model.ts` (`LoopContext`) — Change 4 reuses both for looping Questions.
- `src/protocol/protocol-document-parser.ts` → `src/graph/graph-model.ts` (`VALID_KINDS`, node interfaces) — Changes 3, 4 keep text-block/loop parseable.
- `src/views/protocol-editor-view.ts` → `dagre` (auto-layout), `src/graph/graph-model.ts` (`RPNodeKind`) — Change 4 dropdown/defaults.

### Infrastructure Wiring
- `src/main.ts:39-115` — `onload` command registration; no canvas-convert command exists (Change 2 confirms phantom).
- `src/i18n/locales/en.json` + `ru.json` — `protocolRunner.createSnippetFromSelection` (Change 1 removal); `protocolEditor.nodeKind.text-block` (Change 3 — keep or remove depending on whether the picker label is still needed for legacy display); `canvasParser.*` keys are orphaned test-only (Change 2 cleanup candidate).
- `src/protocol/protocol-document-store.ts:80-107` — `create()` is the sole writer of new protocol files (Change 5 injection upstream of this).

## Architecture Insights
- **Closed-subgraph removal is safe; layout changes are not.** Footer button removal (Change 1) mirrors the zero-regression self-check copy button removal. By contrast, the footer layout refactor (`182cbf4`) triggered 6 follow-up fixes — every runner state has different zone/height assumptions. Change 1 only removes a button and its wrapper, not zone structure — low risk.
- **The loop-start/loop-end deprecation is the canonical "not creatable" precedent.** Kinds stay in `RPNodeKind` for parser/validator migration; removed only from the editor dropdown and (eventually) `validKinds`. Change 3 (text-block) applies the softer variant: still runnable, not validator-rejected.
- **Node-kind removal triggers TS exhaustiveness cascades.** Removing a kind from `RPNodeKind` forces deletion of every switch arm (nodeLabel, validator, runner, color-map, picker) across 6+ files. Change 3's chosen strategy avoids this by keeping the kind. Change 4 (if implemented) would add a kind flag, not remove one — but must still update all `node.kind === 'loop'` sites.
- **The `+`-prefix exit-edge convention is load-bearing.** `isExitEdge`/`stripExitPrefix` drive validator LOOP-04, runner dispatch, loop-picker rendering, and editor label preservation. Change 4 must keep it for looping Questions.
- **Insert-snippet modal pinning exists to stop per-keystroke recentering.** The `align-self: flex-start` opt-out is intentional (the picker rebuilds its body on every debounced keystroke). Change 7 must preserve the pinning while adding margin/height.
- **`createEmptyProtocolDocument` has never been modified since introduction** (`86f1242`). Change 5 is genuinely new territory — but the validator/runner/editor all already expect exactly one start node, so a pre-seeded one makes empty protocols immediately valid.

## Precedents & Lessons
8 similar past changes analyzed.

### Precedent: Inline runner footer layout restructure
**Commit(s)**: `182cbf4` — "feat: restructure inline runner layout — close btn to footer, 3-zone split, stable button anchors" (2026-05-16)
**Blast radius**: 2 files (inline-runner.css 302 lines, inline-runner-modal.ts 100 lines)
**Follow-up fixes**: 6 fixes in 4 days (`093ccca`, `d9f9e15`, `2c4ce08`, `5cc7382`, `0ff2587`, `93f04d4`) — button sizing jitter, height jitter between node types, snippet-pick/content-only states cut to half height, progress bar relocation.
**Takeaway**: Footer layout changes are the highest-regression area; test ALL runner states, not just at-node. Change 1 avoids this by only removing a button, not restructuring zones.

### Precedent: Removing the self-check copy button from the inline runner footer
**Commit(s)**: `72b1106` (2026-05-25)
**Blast radius**: 7 files; tests flipped from presence-asserting to absence-asserting.
**Follow-up fixes**: None — self-contained closed subgraph.
**Takeaway**: Footer button removal is low-risk when the button has its own CSS/i18n/handler and no shared state. Directly applicable to Change 1.

### Precedent: Adding the create-snippet-from-selection button (the button Change 1 removes)
**Commit(s)**: `aeb7573` (2026-07-26)
**Blast radius**: 11 files across 5 layers.
**Lessons**: Footer row is `empty()`-ied and rebuilt on every `render()`; `selectionchange` must attach to `document`; left-side buttons need a flex wrapper to avoid position jumping.
**Takeaway**: Change 1 reverses this cleanly — the wrapper goes away too.

### Precedent: Phase 43/44 unified loop kind + loop-start/loop-end deprecation
**Commit(s)**: `58d8f2f`, `25ad86b`, `b5668a0`, `cd98df3`, `1dadc67`, `622b6b6` (2026-04-17 → 2026-05-13)
**Blast radius**: 15+ files across 6 layers.
**Follow-up fixes**: `961d968` (dead-end body in `chooseAnswer`/`completeSnippet` terminated protocol instead of returning to picker — escaped all automated tests, caught only in UAT), `50a7fcb` (loop exit edge labels stripped on save because display rule required both endpoints to be loop kind), `cd98df3` (dropdown forgot to offer `loop`, blocking all UAT).
**Takeaway**: When merging/removing node types, update the editor dropdown in the same slice; keep legacy kinds in the union for migration; test dead-end paths in every entry method, not just `advanceThrough`; exit-edge labels are fragile when the display rule is kind-gated. Directly relevant to Changes 3 and 4.

### Precedent: Excising the `free-text-input` node type
**Commit(s)**: `8185dbb`, `8b8b5e5` (2026-04-18)
**Blast radius**: 13+ files across 5 layers; TS exhaustiveness forced cascading deletes.
**Follow-up fixes**: `99f8afa` (residual unused imports), `3c36e46` (test mock parity broke).
**Takeaway**: Full kind removal cascades across model→parser→validator→color-map→runner→editor→tests→mocks. Change 3's "not creatable" strategy deliberately avoids this cascade.

### Precedent: `createEmptyProtocolDocument` (the gap Change 5 fills)
**Commit(s)**: `86f1242` (2026-05-12)
**Blast radius**: 16 files (full protocol-editor beta).
**Follow-up fixes**: None — function never modified since.
**Takeaway**: No prior commit has touched creation defaults; Change 5 is new territory but the validator/runner/editor all expect exactly one start node.

### Precedent: Insert-snippet modal CSS — pinning + keyboard highlight
**Commit(s)**: `e4bd18a`, `164b8e6`, `c0bb3ee`, `aeb7573` (2026-04-20 → 2026-07-26)
**Follow-up fixes**: `164b8e6`/`c0bb3ee` (same day, 2026-06-14) — shared `height: 360px`/`max-height: 320px` caps broke the resizable inline runner; inline-host and modal-host CSS had to be split; `overflow: hidden` had to be scoped to the picker host only.
**Takeaway**: When changing insert-modal CSS (Changes 6, 7), do not re-introduce shared caps that break the inline host — scope overrides to `.rp-insert-snippet-picker-host` / `.rp-insert-snippet-modal` only. The pinning and keyboard-highlight TS invariants (live-DOM query at keypress, reset after `removeBody`, preserve `keydown` listener) must stay intact.

### Precedent: README rewrites — bilingual, canvas/snippet sections
**Commit(s)**: `acd7e7c`, `8850eb5`, `d51d4fb` (2026-05-13 → 2026-06-04)
**Follow-up fixes**: 4+ version-drift fixes (`74913a8`, `ddaf072`, `f075658`, `7523a7d`).
**Takeaway**: Never hardcode version numbers in README — they drift within days. Keep the bilingual mirrored structure. Verify all `docs/` links resolve. Change 2 should point users to GitHub Releases for version info, not hardcode it.

### Composite Lessons
- Footer button removal is safe iff self-contained; flip presence-asserting tests to absence-asserting in the same commit (Precedents 2, 3).
- Node-kind removal/merge must update the editor dropdown in the same slice or UAT is blocked; keep legacy kinds parseable for migration; test dead-end paths, not just back-edges (Precedent 4).
- Modal CSS changes must be host-scoped to avoid breaking the inline runner picker; preserve the pinning + keyboard-highlight TS invariants (Precedent 7).
- Never hardcode README version numbers (Precedent 8).

## Historical Context (from `.rpiv/artifacts/`)
- `.rpiv/artifacts/research/2026-07-26_16-08-02_snippet-create-from-selection-and-insert-modal-ux.md` — prior research on the create-snippet-from-selection feature and insert-modal UX (the button Change 1 removes; the pinning Change 7 builds on).
- `.rpiv/artifacts/designs/2026-07-26_16-20-59_slice-2_create-snippet-from-selection-in-runner-footer.md` — design for the exact footer button now slated for removal (Change 1 reversal).
- `.rpiv/artifacts/designs/2026-07-26_16-19-09_slice-3_insert-snippet-modal-pinning-no-jumping-on-keystroke.md` — modal pinning CSS design (Change 7 must preserve this).
- `.rpiv/artifacts/designs/2026-07-26_16-19-09_slice-4_snippettree-picker-keyboard-navigation.md` — keyboard-nav + highlight design (Change 6 CSS-only).
- `.rpiv/artifacts/designs/2026-07-26_16-19-09_slice-5_snippettreepicker-name-only-display-via-hidesearchresultpath.md` — search result display design.
- `.rpiv/artifacts/research/2026-06-04_18-40-54_conservative-cleanup-docs-release-process.md` — closed-subgraph removal + legacy-kind migration quarantine patterns.

## Developer Context
**Q (`src/snippets/snippet-service.ts:124-141,180-185,225-227`): README says "we no longer use the JSON format" but the code still fully supports JSON snippets (list/load/save + insert modal + tree picker + runner `.json`-first resolution). What scope does the README rewrite have?**
A: Remove JSON code support too — rip out the `.json` branches in snippet-service, insert-snippet-modal, snippet-tree-picker, inline-runner-modal, and the `JsonSnippet` model, so the README can truthfully say "only `.md`" (plain + frontmatter placeholders). `MdTemplateSnippet` stays as the placeholder format.

**Q (`src/graph/graph-model.ts:47-52`, `src/runner/protocol-runner.ts:711-724,736-757`): The requested `Question → Answer1 → Answer2` auto-insert already exists via the `case 'answer'` arm. The real removal surface is the `TextBlockNode` kind (unique `snippetId`/`content` fields) across parser/validator/runner/editor/picker/CSS/i18n/tests. Which migration strategy should the research recommend?**
A: Not creatable, still runnable — keep `'text-block'` in `RPNodeKind`/parser/runner so existing protocols still load/run/edit, remove it only from `EDITABLE_NODE_KINDS` so new text-blocks can't be created. Answer chains absorb the auto-insert role going forward. `snippetId`-bearing text-blocks keep working; no migration needed.

## Related Research
- `.rpiv/artifacts/research/2026-07-26_16-08-02_snippet-create-from-selection-and-insert-modal-ux.md`

## Open Questions
- **Change 2 — migration of existing `.json` snippet files in user vaults** once JSON code support is removed: silently stop loading them, show a migration notice, or provide a `.json` → `.md`-template converter? Not resolved during checkpoint; a design decision.
- **Change 3 — should the "Start from specific node" picker (`src/views/node-picker-modal.ts`) also stop surfacing text-blocks?** Its `StartableNodeKind`/`KIND_LABELS`/`KIND_ORDER`/`buildNodeOptions` independently list text-blocks. The chosen "not creatable, still runnable" strategy leaves existing text-blocks runnable, so they may still be valid start points — but if the intent is to fully deprecate, the picker should drop them too. Not resolved.
- **Change 4 — state-machine design for looping Questions** (keep `AT_NODE` + add a done action vs. keep `AWAITING_LOOP_PICK` + extend answer APIs vs. add a new runner state): this is the single hardest integration decision and is deferred to the design stage. The research recommends the `AT_NODE` + done-action approach as the least disruptive but flags that all three options are viable.
- **Change 4 — should existing `loop` nodes be auto-migrated** to `question` with `isLoop: true` (parser-time conversion), or kept as a legacy kind with a validator migration error (mirroring loop-start/loop-end)? Deferred to design.
- **Change 4 — D-07 body semantics for looping Questions**: define a valid body as a non-exit edge to a renderable Answer/Snippet target (stricter, matches Question UI), or keep the current "any non-`+` edge" rule (matches Loop UI)? Deferred to design.