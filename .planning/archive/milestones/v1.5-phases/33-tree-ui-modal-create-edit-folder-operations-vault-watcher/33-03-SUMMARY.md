---
phase: 33
plan: 03
subsystem: views
tags: [modal, create-edit, canvas-sync, move-on-save, wave-2]
provides:
  - SnippetEditorModal class (mode=create|edit, Promise<SnippetEditorResult>)
  - SnippetEditorResult type
  - SnippetEditorOptions interface
  - First production call site of rewriteCanvasRefs (D-09 move pipeline)
requires:
  - mountChipEditor (Plan 02)
  - ConfirmModal (Plan 02)
  - rewriteCanvasRefs (Phase 32)
  - SnippetService.{save,delete,exists,listFolderDescendants}
  - slugifyLabel (snippet-model)
affects: []
tech-stack:
  added: []
  patterns: [debounced-pre-flight, safe-resolve-double-guard, close-intercept-guard, single-file-canvas-sync]
key-files:
  created:
    - src/views/snippet-editor-modal.ts
  modified:
    - src/__tests__/snippet-editor-modal.test.ts
decisions:
  - D-09 resolved: single-file Map([[oldPath, newPath]]), NOT folder paths, into rewriteCanvasRefs
  - Close() is overridden to intercept Esc / overlay click when hasUnsavedChanges is true
  - Collision pre-flight debounced at 150ms; edit-mode skips the snippet's own path
metrics:
  completed: 2026-04-15
  duration_minutes: 7
---

# Phase 33 Plan 03: SnippetEditorModal Summary

**One-liner:** Unified create/edit modal for every snippet interaction in the new tree UI, with 3-button unsaved-changes guard, 150ms debounced name-collision pre-flight, and the first production wiring of `rewriteCanvasRefs` on «Папка»-change save (D-09) using exact single-file path mapping.

## What Changed

### `src/views/snippet-editor-modal.ts` (new, 543 lines)

Single-file implementation of `SnippetEditorModal extends Modal`:

- **Constructor** `(app, plugin, options)` — validates `options.snippet` for edit mode, seeds `draft` via `cloneSnippet`, computes `currentFolder` from `dirname(snippet.path)` in edit mode or `options.initialFolder` in create mode.
- **`onOpen()`** — sets `modalEl.style.maxWidth = '800px'` (D-07), renders title (`Новый сниппет` / `Редактирование: {name}`), type toggle (create-only, segmented JSON/Markdown radio buttons), folder dropdown (populated from `listFolderDescendants(root)` + root itself, A–Z), name input with inline collision error placeholder, content region (chip editor or textarea), save-error placeholder, button row.
- **`onClose()`** — `safeResolve({ saved: false })`, destroys chip editor handle, clears debounce timer, empties `contentEl`.
- **`close()` override** — if `hasUnsavedChanges` and not yet resolved, routes through `runUnsavedGuard()` instead of calling `super.close()` directly. Handles Esc / overlay click.
- **Type toggle** (create only) swaps the content region between chip editor and plain textarea; edit mode renders a static `radi-snippet-editor-type-static` label instead (D-06: type locked in edit mode).
- **Collision pre-flight** (`scheduleCollisionCheck` → `runCollisionCheck`) — 150ms debounce, skips when candidate path equals `options.snippet.path` in edit mode, updates `collisionErrorEl` visibility and `saveBtnEl.disabled` state.
- **`handleSave()`** — validates name, builds `draftToSave` with `computeCandidatePath()` (`folder + '/' + slugifyLabel(name) + '.' + ext`), then branches:
  - Create OR edit-without-move: single `snippetService.save(draftToSave)`, resolve `{ saved: true, movedFrom: null }`, close.
  - Edit-with-folder-change: `save(new)` → `delete(oldPath)` → `rewriteCanvasRefs(app, new Map([[oldPath, newPath]]))` → `Notice('Сниппет перемещён. Обновлено канвасов: X, пропущено: Y.')` → resolve with `movedFrom: oldPath` → close.
  - Error path: inline `Не удалось сохранить: {msg}. Попробуйте ещё раз.` — does NOT close, does NOT resolve.
- **`runUnsavedGuard()`** — opens `ConfirmModal` with 3-button variant (`discardLabel: 'Не сохранять'`, `cancelLabel: 'Отмена'`, `confirmLabel: 'Сохранить'`, title `Несохранённые изменения`, body interpolates snippet name). On `confirm` → runs `handleSave()` (close happens only on save success). On `discard` → resolves `{ saved: false }` and closes. On `cancel` → stays open.

### `src/__tests__/snippet-editor-modal.test.ts` (rewritten, 689 lines)

Replaces the Plan 01 `it.skip` stubs with **11 real tests** — all passing. Infrastructure:

- Local `MockEl` factory that supports `createEl` / `createDiv` / `addClass` / `setAttribute` / `dispatchEvent` / `children` tree, plus pass-through `value` / `disabled` / `type` / `textContent` getters-setters.
- `vi.mock('obsidian', ...)` replaces the standard mock's `Modal` with a class whose `contentEl`/`titleEl` are `MockEl` instances, and adds a `modalEl.style` stub.
- `vi.mock('../views/snippet-chip-editor', ...)` — captures `(container, draft, onChange)` arg tuple on every mount.
- `vi.mock('../views/confirm-modal', ...)` — captures constructor options and returns a pre-seeded `result` promise (default `cancel`).
- `vi.mock('../snippets/canvas-ref-sync', ...)` — captures `(app, mapping)` and resolves `{ updated: ['canvas-a.canvas'], skipped: [] }`.

Test coverage (one per requirement + two integration):

| Test | Assertion |
|---|---|
| MODAL-01 | Create mode title = «Новый сниппет»; type toggle has 2 radio buttons |
| MODAL-02 | Edit mode title = «Редактирование: {name}»; name input pre-filled |
| MODAL-03 | Edit mode has no radio toggle; static `is-type-static` label present |
| MODAL-04 | Create mode «Папка» select.value === `options.initialFolder` |
| MODAL-05 | Changing «Папка» + save → `save` called with path under new folder |
| MODAL-06 | JSON create mode mounts chip editor with draft.kind === 'json' |
| MODAL-07 | Clicking Markdown toggle swaps chip editor for a `<textarea>` |
| MODAL-08 | Cancel while unsaved → ConfirmModal constructed with all 3 labels |
| D-09 pipeline | Edit + folder change → save/delete/rewriteCanvasRefs called; mapping is 1 entry with exact file paths |
| Collision | `exists(candidatePath)` true → Save disabled + error visible + correct text |
| MD-save | MD mode textarea input → save receives `{ kind: 'md', path: .../doc.md, content: 'Hello markdown' }` |

## Verification

- `npm run build` → tsc + esbuild exit 0
- `npx vitest run src/__tests__/snippet-editor-modal.test.ts` → **11/11 passing**
- `npm test` (full suite) → 280 passing, 7 skipped, 3 pre-existing `runner-extensions.test.ts` failures (documented tech debt per PROJECT.md; out of scope per SCOPE BOUNDARY rule — identical failures as Plans 01/02)
- Acceptance greps:
  - `export class SnippetEditorModal extends Modal` → 1
  - `maxWidth = '800px'` → 1
  - `mountChipEditor` in modal → 2
  - `rewriteCanvasRefs` in modal → 3
  - `new Map([[oldPath, newPath]])` → 1
  - `D-09 resolved` → 2
  - `ConfirmModal` → 4
  - `Несохранённые изменения` → 1
  - `Файл с таким именем уже существует` → 1
  - `Сниппет перемещён` → 1
  - `slugifyLabel` → 3
  - `Phase 34` (multi-file deferral comment) → 2
  - `wc -l src/views/snippet-editor-modal.ts` → **543** (≥250)
  - Tests: `it.skip` → 0, `MODAL-0[1-8]` → 9, `rewriteCanvasRefs` → 8, `discardLabel` → 3

## D-09 Resolution (file-path vs folder-path mapping)

The plan's resolved-questions block is load-bearing for correctness: `canvas-ref-sync` applies **prefix match** over the mapping keys. Passing `Map([[oldFolder, newFolder]])` on a single-file «Папка» change would redirect **every** canvas reference under that folder — not just the one snippet the user edited. The implementation therefore passes exact file paths:

```typescript
// Phase 33 (D-09 resolved): Pass exact file paths, NOT folder paths.
// canvas-ref-sync applies prefix match; (oldFolder → newFolder) on a
// single-file move would redirect ALL canvas refs in that folder.
await rewriteCanvasRefs(this.app, new Map([[oldPath, newPath]]));
```

This invariant is asserted in the test `D-09 pipeline: edit-mode save with folder change calls save → delete → rewriteCanvasRefs with exact file-path Map` — the test walks the mapping entries and checks both key and value are full `.json` paths, not directory paths.

## Phase 34 deferral

Two code comments explicitly defer multi-file / folder-drag operations to Phase 34. Folder-level moves, drag-and-drop, and inline rename are **not** wired in this plan; the modal handles only the single-snippet «Папка» change path.

## Deviations from Plan

None. Plan executed exactly as written. All Task 1 and Task 2 acceptance criteria met on first build/test run.

## Commits

- `c5e6117` feat(33-03): add SnippetEditorModal with D-09 move pipeline
- `4498f89` test(33-03): real MODAL-01..08 + D-09 pipeline tests for SnippetEditorModal

## Test-Infrastructure Helpers Introduced

A single helper lives inline in the test file (not in `test-utils/`):

- `makeEl(tag)` — minimal DOM-ish element with event-dispatch, classList, children, and accessor pass-throughs.

The `obsidian` module is re-mocked at file scope via `vi.mock` so that `Modal.contentEl` / `titleEl` / `modalEl.style` are backed by `makeEl()`. This is self-contained to this test file; other test files continue to use the project-wide `src/__mocks__/obsidian.ts` unchanged.

## Self-Check: PASSED

- FOUND: src/views/snippet-editor-modal.ts (543 lines)
- FOUND: src/__tests__/snippet-editor-modal.test.ts (updated)
- FOUND commit: c5e6117
- FOUND commit: 4498f89
- CONFIRMED: `npm run build` exits 0
- CONFIRMED: `npx vitest run src/__tests__/snippet-editor-modal.test.ts` → 11/11 passing
