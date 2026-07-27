---
date: 2026-07-27T19:22:50+0300
author: Roman Shulgha
commit: 9c4452e
branch: main
repository: RadiProtocol
topic: "Validation of Runner cleanup, node defaults/deprecation, snippet format cleanup, and insert-modal UX"
status: ready
verdict: pass
parent: ".rpiv/artifacts/plans/2026-07-27_17-12-43_runner-cleanup-nodes-snippets-modal-ux.md"
tags: [validation, plan, synthesized]
risk_rulings:
  - { id: c1-r1, pass: true }
  - { id: c2-r1, pass: true }
  - { id: c2-r2, pass: true }
  - { id: c2-r3, pass: true }
  - { id: c3-r1, pass: true }
  - { id: c4-r1, pass: true }
  - { id: c4-r2, pass: true }
  - { id: c5-r1, pass: true }
  - { id: c5-r2, pass: true }
last_updated: 2026-07-27T19:22:50+0300
---

## Validation Report: Runner cleanup, node defaults/deprecation, snippet format cleanup, and insert-modal UX

### Implementation Status

- ✓ Phase 1: Remove create-snippet-from-selection footer button — Fully implemented
- ✓ Phase 2: Remove JSON snippet code support and rewrite README — Fully implemented
- ✓ Phase 3: Deprecate new Text block creation and preserve legacy compatibility — Fully implemented
- ✓ Phase 4: Default a Start node into newly created protocols — Fully implemented
- ✓ Phase 5: Strengthen Insert Snippet modal highlight and vertical layout — Fully implemented

### Automated Verification Results

- ✓ Build: `npm run build` — `tsc -noEmit -skipLibCheck && esbuild production` passes with no errors.
- ✓ Lint: `npm run lint` — `eslint . --max-warnings 0 && stylelint src/styles/**/*.css` passes clean.
- ✓ Tests: `npm test` — 57 test files / 752 tests passed (0 failures).
- ✓ Phase 1 symbol purge: `rg -n "createSnippetFromSelection|createSnippetBtn|boundSelectionHandler|getSelectedContentText|updateCreateSnippetButtonState|handleCreateSnippetFromSelection|rp-runner-footer-left|rp-inline-runner-create-snippet-btn" src` — no matches.
- ✓ Phase 2 removed symbols: `rg -n '\b(JsonSnippet|SnippetFile|renderSnippet|sanitizeJson)\b' src` — no matches (retained `renderSnippetFillNotFound` does not match the word-boundary search).
- ✓ Phase 2 kind:'json' purge: `rg -n "kind\s*===\s*['\"]json['\"]|kind:\s*['\"]json['\"]" src` — no matches.
- ✓ Phase 2 removed locale keys: `rg -n "insertSnippet\.cannotBeUsed|inlineRunner\.snippetCannotBeUsed" src` — no matches.
- ✓ Phase 2 view scan removal: `rg -n "vault\.getFiles\(\)" src/views/inline-runner-modal.ts` — only a documentation comment remains (line 966); no live call.
- ✓ Phase 2 path-shape branching removal: `rg -n "isFullSnippetPath|isPhase51FullPath" src` — only a documentation comment in `render-snippet-fill.ts:18`; no live branch.
- ✓ No regressions detected.

### Code Review Findings

#### Matches Plan:

- **Phase 1 — footer restructure** (`src/views/inline-runner-modal.ts:302-342, 427-486`): `SnippetEditorModal` import, `createSnippetBtnEl`, `boundSelectionHandler`, the `mouseup`/`selectionchange` listeners, and the three private selection helpers are gone. The close button is a direct child of `footerBtnRowEl` in both `buildContainer()` (line 339) and the footer rebuild (line 432); `renderFooterIcons()` (line 557) appends Back/Redo/Skip as a second flex item (`rp-runner-footer-row` div, line 563). `.rp-runner-footer-left` rule removed from `src/styles/inline-runner.css`. `protocolRunner.createSnippetFromSelection` removed from both locales.
- **Phase 2 — discriminated resolver** (`src/snippets/snippet-service.ts:16-19, 498-551`): `SnippetResolution = found | legacy-json | missing` exported and owned by `SnippetService.resolveSnippet`. Direct full-path, extensionless root `.md`/`.json` probe, and `findUniqueSubdirMatch` fallback all route through `assertInsideRoot`; traversal-escaping IDs return `missing` without vault access (test at `snippet-service.test.ts:902` asserts `vault.adapter.exists` called 0× and `vault.getFiles` called 0× for `../../etc/passwd`). `load()` returns `null` for non-`.md` (line 167-170); listing skips non-`.md` (line 134-135); `sanitizeJson` gone.
- **Phase 2 — `renameSnippet` `.json` guard** (`src/snippets/snippet-service.ts:336-347`): rejects every normalized source not ending in `.md` before destination calculation or vault mutation. `snippet-service-move.test.ts` converted; `.json` rename-success case replaced with a rejection assertion.
- **Phase 2 — view/render split** (`src/views/inline-runner-modal.ts:962-989`, `src/runner/render/render-snippet-fill.ts:55-62`): `handleSnippetFill` is a single `resolveSnippet` call + switch on discriminated status — no path-shape branching, no `${id}.json`/`${id}.md` probe loop, no `getFiles().filter(...)` scan, no `kind === 'json'` gate. `renderSnippetFillUnsupportedFormat` emits the localized `inlineRunner.snippetLegacyJson` message with `{path}` interpolation. `inline-runner-modal.test.ts:240-301` covers all three outcomes (found fill, legacy-json unsupported-format + `stepBack` for both explicit `.json` and extensionless-backing, missing not-found + no `stepBack`) with `resolveSnippet` mocked.
- **Phase 2 — model narrowing**: `Snippet` narrowed to `MdSnippet | MdTemplateSnippet`; `JsonSnippet`, `SnippetFile`, `renderSnippet` removed from `snippet-model.ts`. `DraftKind` narrowed to `'md' | 'md-template'` in `snippet-editor-modal.ts`; `EditableTemplateSnippet` narrowed to `MdTemplateSnippet` in `snippet-chip-editor.ts`; `TreeNodeFile.snippetKind` narrowed to `'md' | 'md-template'` with `file-text` glyph in `tree-renderer.ts`; JSON gate removed from `render-snippet-picker.ts`; `snippet-tree-picker.ts` filters descendant-search `fileMatches` to `.md`. READMEs rewritten: legacy JSON note present (`README.md:74`), no stale Canvas/`.canvas` section, no "JSON or Markdown" setup wording.
- **Phase 3 — Text block deprecation** (`src/views/protocol-editor-view.ts:256`): `EDITABLE_NODE_KINDS = ['start', 'question', 'answer', 'loop', 'snippet']` — `text-block` removed from both new-node picker flows (lines 769, 819). `text-block` retained in `graph-model.ts:13,47-48`, `protocol-document-parser.ts:31,210-211`, `protocol-runner.ts:711`, `runner-state.ts:62`, `node-label.ts:23`; `NODE_KIND_DEFAULTS['text-block']`, edit arms, and start-picker options preserved. Answer-chain runner test at `protocol-runner.test.ts:1087` confirms Answer1 selected explicitly → Answer2 auto-appended → halts at Question2; empty-answer, terminal, loop-body, step-back, redo coverage present (lines 1112+). Both READMEs document the deprecation-with-legacy-support boundary (`README.md:63`, `README.ru.md:63`).
- **Phase 4 — seeded Start node** (`src/protocol/protocol-document.ts:119-145`): `createEmptyProtocolDocument` gains optional `startNodeId` (default `node-${now.getTime()}-${...}`) and seeds one `{ kind: 'start', x: 0, y: 0, width: 200, height: 80, color: 'rgba(76, 175, 80, 0.28)', fields: {} }` node. Dimensions/color inlined with JSDoc cross-reference to `NODE_KIND_DEFAULTS['start']` (lines 110-111) — no `views/` import. `protocol-document-store.ts:95` call site unchanged (optional parameter). `protocol-document-factory.test.ts` covers default-ID shape, explicit-ID override, unchanged metadata, and zero-error `GraphValidator` parse. `protocol-document-store.test.ts:208-222` asserts `nodes.length === 1` and `nodes[0].kind === 'start'` for both create tests.
- **Phase 5 — insert-modal CSS** (`src/styles/snippet-tree-picker.css:232-257, 313-320`): `.rp-insert-snippet-modal` preserves `align-self: flex-start`, top margin `var(--size-4-6)`, adds `max-height: calc(100vh - var(--size-4-12))` + `overflow-y: auto`. Drill-body `height: min(480px, calc(100vh - 10rem))` + `min-height: 0`; bare result list `height`/`max-height: min(440px, calc(100vh - 12.5rem))` + `min-height: 0`. `.rp-stp-row-highlighted` uses `background: var(--background-modifier-active-hover)` + `box-shadow: inset 2px 0 0 var(--interactive-accent)` (no border-width change) + semibold title. `--background-modifier-hover` appears only on mouse-hover selectors (line 127-131), never on `.rp-stp-row-highlighted`. All height rules scoped to `.rp-insert-snippet-modal` / `.rp-insert-snippet-picker-host` — no leakage into inline-runner, editor-host, or move-to modal.

#### Deviations from Plan:

None. Implementation is a faithful realization of the plan.

#### Pattern Conformance:

- ✓ `SnippetResolution` discriminated union, `resolveSnippet` ownership, and `assertInsideRoot`-first probing follow the snippets-layer path-safety guard convention documented in `src/snippets/architecture.md`.
- ✓ `handleSnippetFill` orchestration + `render-snippet-fill.ts` presentation split honors the views→lower-layer dependency direction (no reverse import; render layer stays presentation-only).
- ✓ Phase 4 inlines Start dimensions/color with a cross-reference comment rather than importing from `views/`, preserving the protocol-layer boundary.
- ✓ CSS height rules scoped to Insert Snippet host selectors only; keyboard-highlight stripe uses an inset `box-shadow` (non-layout-affecting) per the plan's geometry-preservation requirement.
- Minor observation (acceptable variation, not a deviation): `findUniqueSubdirMatch` filters `vault.getFiles()` by a raw `startsWith(root + '/')` prefix check, then re-runs only the single selected match through `assertInsideRoot`. Because `getFiles()` returns the vault's own real file paths (not user input) and the final match is re-validated, traversal safety is preserved — the inline comment slightly overstates "every considered path is re-checked" but the security guarantee holds and is covered by the traversal test.

#### Potential Issues:

None — all nine plan risk flags ruled `pass` and the analyzer/pattern-finder surfaced no unaddressed risks.

### Manual Testing Required:

1. **Phase 1 — inline runner footer**:
   - [ ] Footer shows only close (×) on the left and Back/Redo/Skip on the right across at-node, awaiting-loop-pick, snippet-pick, and content-only states; no create-snippet icon remains.
   - [ ] Selecting runner content produces no console error or state change (listeners removed).
2. **Phase 2 — JSON snippet removal**:
   - [ ] A `.json` file in the snippet root is absent from folder listings and descendant search; `load()` returns null for it; recursive folder-delete counts still include all physical files.
   - [ ] Plain `.md` and `md-template` list/load/save/duplicate/rename flows still work; editor creation defaults to `md-template`.
   - [ ] A runner reference ending in `.json` OR an extensionless ID backed by a `.json` file reaches the localized unsupported-format state via `renderSnippetFillUnsupportedFormat`; a missing `.md` reference with no `.json` counterpart uses the ordinary not-found state.
   - [ ] Both READMEs contain no stale Canvas/conversion section or JSON-snippet setup wording; legacy JSON note directs users to recreate as Markdown templates.
3. **Phase 3 — Text block deprecation**:
   - [ ] New-node creation menus contain no Text block option; opening an existing Text block still shows content/separator/snippet edit behavior with existing styling and labels.
   - [ ] An unmigrated `text-block` protocol loads and runs; ordinary content and `snippetId`-backed fill both work; "Start from specific node" lists the legacy node.
   - [ ] `Question → Answer1 → Answer2` behaves as requested (Answer1 explicit, Answer2 auto-appended); chains work before/inside/after loops and with snippet nodes.
4. **Phase 4 — seeded Start node**:
   - [ ] "Create new protocol" opens with one green Start node visible and no missing-start validation error.
   - [ ] The seeded node matches a manually created Start node's dimensions/color and can be selected, dragged, edited, connected, deleted, saved, and reopened.
5. **Phase 5 — insert-modal UX**:
   - [ ] Keyboard-highlighted and mouse-hovered rows are visibly distinct; focused title is semibold with a 2px inset accent stripe and no horizontal text movement.
   - [ ] Normal viewport: drill view reaches 480px, bare search results 440px; short viewport: both shrink, modal clamps and scrolls without overflow.
   - [ ] Typing in search does not recenter or jump the modal; inline-runner, editor-host, and move-to pickers retain previous heights.

### Recommendations:

- Ready to commit — implementation is complete and validated. All nine risk flags pass, build/lint/test are green, and the working tree contains exactly the files named in the plan's per-phase change lists.