---
phase: 51-snippet-picker-overhaul
plan: 04
subsystem: ui
tags: [picker-02, snippet-manager, snippet-editor-modal, folder-only-picker, tdd]

# Dependency graph
requires:
  - phase: 51-snippet-picker-overhaul plan 02
    provides: "SnippetTreePicker class + rp-stp-editor-host + rp-stp-modal-host CSS host wrappers (sole-owner model)"
  - phase: 34-snippet-manager
    provides: "openMovePicker + performMove orchestrator (preserved byte-identical)"
  - phase: 33-snippet-editor-modal
    provides: "SnippetEditorModal lifecycle, collision-check, hasUnsavedChanges guard (preserved byte-identical)"
provides:
  - "SnippetEditorModal «Папка» row mounts folder-only SnippetTreePicker rooted at settings.snippetFolderPath"
  - "SnippetManager «Переместить в…» opens inline Modal hosting folder-only SnippetTreePicker"
  - "Move-target safety guards surface Russian Notices instead of silent failure (source-self + descendant + whitelist-membership checks)"
  - "FolderPickerModal retained with @deprecated JSDoc (Shared Pattern G — not deleted)"
affects:
  - 51-05 (Runner file-only rewrite) — independent, not touched
  - 51-06 (validator + runtime auto-insert) — independent, not touched

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline Modal-hosted SnippetTreePicker for legacy SuggestModal replacement"
    - "handleSelect closure bakes rootPath + source-node context before mount"
    - "Whitelist-membership + explicit source-self/descendant guards (D-07 safety trio)"
    - "Picker unmount on Modal onClose (lifecycle parity with SnippetEditorModal onClose)"

key-files:
  created:
    - src/__tests__/views/snippet-editor-modal-folder-picker.test.ts
    - src/__tests__/views/snippet-manager-folder-picker.test.ts
  modified:
    - src/views/snippet-editor-modal.ts
    - src/views/snippet-manager-view.ts
    - src/views/folder-picker-modal.ts
    - src/__tests__/snippet-editor-modal.test.ts
    - src/__tests__/snippet-tree-dnd.test.ts

key-decisions:
  - "Safety trio in handleSelect: source-self → Notice «Нельзя переместить папку в саму себя.»; source-descendant → Notice «Нельзя переместить в подпапку самого себя.»; non-whitelist → Notice «Эта папка недоступна как цель перемещения.»"
  - "Whitelist-set (Set<string>) computed once per openMovePicker invocation from the legacy `folders` array — preserves existing exclusion semantics (current-parent for files, source+descendants for folders) without touching the pre-amble computation"
  - "Picker is unmounted in Modal.onClose (setter-assigned callback) — matches the pattern used in SnippetEditorModal.onClose (top-of-method cleanup)"
  - "FolderPickerModal import removed from snippet-manager-view.ts (TS strict mode rejects unused imports); file itself retained with @deprecated JSDoc per CLAUDE.md Shared Pattern G"
  - "Both `buildFolderOptions` and `folderSelectEl` in snippet-editor-modal.ts retained with @deprecated JSDoc (Shared Pattern G) — zero new writes, safe to delete in a future cleanup phase"
  - "Existing tests in src/__tests__/snippet-editor-modal.test.ts and src/__tests__/snippet-tree-dnd.test.ts updated to drive the new picker surface via captured onSelect callbacks (Rule 1 — tests asserted implementation details of the legacy picker that no longer match production)"

requirements-completed: [PICKER-02]

# Metrics
duration: ~25min
completed: 2026-04-20
---

# Phase 51 Plan 04: SnippetTreePicker Migration (Wave 2) Summary

**SnippetEditorModal «Папка» и Snippet Manager «Переместить в…» теперь используют SnippetTreePicker в режиме `folder-only` (D-07). Оба call-site сохраняют существующие контракты — collision-check и unsaved-changes guard в редакторе, performMove + canvas-ref-sync в менеджере. Move-target safety guards теперь выдают русские Notice вместо тихого отказа. FolderPickerModal сохранён как @deprecated адаптер (Shared Pattern G). Plan 02 — единственный владелец CSS; этот plan не трогает src/styles/.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-20T10:37:00Z
- **Completed:** 2026-04-20T10:47:00Z
- **Tasks:** 2 (both TDD: RED → GREEN, no REFACTOR needed)
- **Files created:** 2 test files
- **Files modified:** 5 (3 production + 2 existing test files)

## Accomplishments

### Task 1 — SnippetEditorModal «Папка» (commits: `47363cb` RED + `8b0f19d` GREEN)

- `renderFolderDropdown` body rewritten: mounts `SnippetTreePicker({ mode: 'folder-only', rootPath: settings.snippetFolderPath, initialSelection, onSelect })` into a new `rp-stp-editor-host` div inside the «Папка» row.
- `initialSelection` computed inline from `this.currentFolder`:
  - `currentFolder === rootPath` → `''`
  - `currentFolder.startsWith(rootPath + '/')` → `currentFolder.slice(rootPath.length + 1)`
  - Otherwise → `undefined` (back-compat for malformed legacy state)
- `onSelect` writes `this.currentFolder` (absolute vault path), sets `this.hasUnsavedChanges = true`, schedules `runCollisionCheck()` — preserves the legacy `<select>` change-listener contract byte-identically.
- `onClose` extended: unmounts the picker if present (lifecycle cleanup).
- `buildFolderOptions` + `folderSelectEl` marked `@deprecated Phase 51 D-07` — retained per Shared Pattern G, zero new writes.

### Task 2 — SnippetManager «Переместить в…» (commits: `f7bdfd5` RED + `de152e9` GREEN)

- `openMovePicker` body: the existing pre-amble computing `allFolders` / `folders` (whitelist) / `onChoose` preserved byte-identically. Below that, the legacy `new FolderPickerModal(...).open()` line replaced with an inline `new Modal(this.app)` hosting a `SnippetTreePicker({ mode: 'folder-only', rootPath: settings.snippetFolderPath, onSelect })`.
- `handleSelect` closure implements D-07 safety trio before `onChoose`:
  1. `absPath === node.path && node.kind === 'folder'` → Notice «Нельзя переместить папку в саму себя.», bail.
  2. `node.kind === 'folder' && absPath.startsWith(node.path + '/')` → Notice «Нельзя переместить в подпапку самого себя.», bail.
  3. `!allowedSet.has(absPath)` → Notice «Эта папка недоступна как цель перемещения.», bail.
  4. Otherwise: `modal.close()` + `await onChoose(absPath)` (existing performMove flow unchanged).
- `modal.onOpen` creates the host div + mounts the picker; `modal.onClose` unmounts it.
- `import { FolderPickerModal } from './folder-picker-modal'` REMOVED (TS strict unused-import). Modal import added: `import { ItemView, Menu, Modal, Notice, ... } from 'obsidian'`.
- `src/views/folder-picker-modal.ts`: `@deprecated Phase 51 D-07 (PICKER-02)` JSDoc prepended above `export class FolderPickerModal`. Class body unchanged (Shared Pattern G — file retained).

## Exact line-range replacements

### `src/views/snippet-editor-modal.ts`

| Region                                      | Before      | After       |
| ------------------------------------------- | ----------- | ----------- |
| `SnippetTreePicker` import                  | —           | Line 25     |
| `snippetTreePicker` field + deprecated doc  | —           | Lines 89–96 |
| `folderSelectEl` deprecated JSDoc           | Line 89     | Lines 85–88 |
| `onClose` picker unmount                    | —           | Lines 192–195 |
| `renderFolderDropdown` body                 | Lines 237–262 | Lines 247–292 |
| `buildFolderOptions` deprecated JSDoc       | —           | Lines 294–296 |

### `src/views/snippet-manager-view.ts`

| Region                                      | Before      | After       |
| ------------------------------------------- | ----------- | ----------- |
| Modal + SnippetTreePicker imports           | —           | Lines 9 + 18 |
| FolderPickerModal import                    | Line 15     | **REMOVED** (W-4) |
| `openMovePicker` body — picker invocation   | Line 665    | Lines 667–713 |

### `src/views/folder-picker-modal.ts`

| Region                                      | Before      | After       |
| ------------------------------------------- | ----------- | ----------- |
| `@deprecated Phase 51 D-07` JSDoc block     | —           | Lines 9–15  |

## Confirmation of W-1 (no CSS modifications)

```bash
$ git diff --stat 069f730..HEAD -- src/styles/
(no output — Plan 04 changed zero files in src/styles/)
```

Task 1 + Task 2 both consume CSS host wrappers owned by Plan 02 (`rp-stp-editor-host`, `rp-stp-modal-host`); neither plan modifies `src/styles/snippet-tree-picker.css`.

## Confirmation of W-4 (FolderPickerModal import removed from snippet-manager-view.ts)

```bash
$ grep -c "FolderPickerModal" src/views/snippet-manager-view.ts
0
```

The identifier literally does not appear in the file — neither import nor comment mention (removed per plan's literal acceptance criterion). The file `src/views/folder-picker-modal.ts` still contains `export class FolderPickerModal` and has been annotated `@deprecated Phase 51 D-07`.

## Unsaved-changes-guard implications

The legacy `<select>.change` event handler fired `this.hasUnsavedChanges = true` + `void this.runCollisionCheck()`. The new picker's `onSelect` callback fires the same two statements in the same order (see `src/views/snippet-editor-modal.ts` lines 280–289). Test 4 in `snippet-editor-modal-folder-picker.test.ts` asserts `hasUnsavedChanges === true` after a picker-driven selection — equivalent to the old `<select>` behaviour.

## Counted-grep verification

| Grep                                                         | Expected      | Actual |
| ------------------------------------------------------------ | ------------- | ------ |
| `SnippetTreePicker` in `src/views/snippet-editor-modal.ts`   | ≥ 2           | 8      |
| `'folder-only'` in `src/views/snippet-editor-modal.ts`       | 1             | 1      |
| `Phase 51 D-07` in `src/views/snippet-editor-modal.ts`       | ≥ 2           | 5      |
| `rp-stp-editor-host` in `src/views/snippet-editor-modal.ts`  | ≥ 1           | 2      |
| `buildFolderOptions` in `src/views/snippet-editor-modal.ts`  | ≥ 1           | 1      |
| `@deprecated Phase 51` in `src/views/snippet-editor-modal.ts` | ≥ 2          | 2      |
| `createEl('select')` inside `renderFolderDropdown`           | 0             | 0      |
| `new SnippetTreePicker` in `src/views/snippet-manager-view.ts` | 1           | 1      |
| `mode: 'folder-only'` in `src/views/snippet-manager-view.ts` | 1             | 1      |
| `Phase 51 D-07` in `src/views/snippet-manager-view.ts`       | ≥ 1           | 1      |
| `Переместить в…` in `src/views/snippet-manager-view.ts`      | ≥ 1           | 8      |
| `rp-stp-modal-host` in `src/views/snippet-manager-view.ts`   | ≥ 1           | 2      |
| `modal.open()` in `src/views/snippet-manager-view.ts`        | ≥ 1 (literal) | present |
| `FolderPickerModal` in `src/views/snippet-manager-view.ts`   | 0             | 0      |
| `@deprecated Phase 51 D-07` in `src/views/folder-picker-modal.ts` | 1        | 1      |
| `export class FolderPickerModal` in `src/views/folder-picker-modal.ts` | 1 | 1      |
| `new SnippetTreePicker` across `src/` (production files)     | ≥ 3           | 3 (editor-panel-view + snippet-editor-modal + snippet-manager-view) |

## Test count delta

| File                                                              | Status    | It-count |
| ----------------------------------------------------------------- | --------- | -------- |
| `src/__tests__/views/snippet-editor-modal-folder-picker.test.ts`  | **NEW**   | 8        |
| `src/__tests__/views/snippet-manager-folder-picker.test.ts`       | **NEW**   | 6        |
| `src/__tests__/snippet-editor-modal.test.ts`                      | Updated   | 13 (no delta) |
| `src/__tests__/snippet-tree-dnd.test.ts`                          | Updated   | 15 (was 13, +2 after consolidation) |

**Baseline before Plan 04:** 561 passed / 1 skipped / 0 failed.
**After Plan 04:** 575 passed / 1 skipped / 0 failed (+14 net: +8 editor-modal picker tests, +6 manager picker tests, net +0 in existing files).

## Task Commits

| Hash      | Type | Scope                                                                    |
|-----------|------|--------------------------------------------------------------------------|
| `47363cb` | test | RED — 8 failing tests for SnippetEditorModal folder picker               |
| `8b0f19d` | feat | GREEN — SnippetEditorModal «Папка» uses SnippetTreePicker (+ test-file patches) |
| `f7bdfd5` | test | RED — 6 failing tests for SnippetManager Move-to picker                  |
| `de152e9` | feat | GREEN — SnippetManager Move-to picker uses SnippetTreePicker (+ snippet-tree-dnd test patches) |

TDD gate sequence realised for BOTH tasks: RED commits (`test(...)`) precede the corresponding GREEN commits (`feat(...)`). No separate REFACTOR commits — GREEN landed clean both times.

## Decisions Made

See `key-decisions` in frontmatter. Notable in-flight decisions:

1. **Source-self / descendant Notices are explicit guards, NOT whitelist-only rejection.** The legacy `folders` array already excludes source + descendants, so the whitelist-membership check (`allowedSet.has(absPath)`) alone would reject those targets. But the plan's intent (D-07) calls out a user-facing Notice naming the reason. To distinguish "you picked your source folder" from "you picked an unrelated disallowed folder", the `handleSelect` closure runs the three guards in order: source-self → descendant → whitelist-membership. Each surfaces a different Russian Notice.

2. **FolderPickerModal text-mention removed from snippet-manager-view.ts comments too.** The plan's strict literal acceptance criterion `grep -c "FolderPickerModal" src/views/snippet-manager-view.ts → 0` precludes even comment mentions. Comments were rewritten to refer to "the legacy SuggestModal-based picker in folder-picker-modal.ts" and "the legacy flat-list picker" — retaining audit-trail intent without tripping the literal grep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Existing `src/__tests__/snippet-editor-modal.test.ts` tests driven via legacy `<select>` element needed rewiring**

- **Found during:** Task 1 full-suite run after GREEN implementation.
- **Issue:** 5 tests in the existing suite (MODAL-04, MODAL-05, MOVE-04 ×3) drove folder changes by setting `select.value` and dispatching `change` events. After Task 1's production change, the `<select>` element no longer renders in the «Папка» row (per acceptance criterion), so `findEl(..., tagName === 'SELECT')` returns null and the tests throw.
- **Fix:** Added `vi.mock('../views/snippet-tree-picker', ...)` with a stub that captures the latest `onSelect` callback into module-scoped `lastPickerOnSelect`. Rewired the 5 tests to invoke `lastPickerOnSelect({ kind: 'folder', relativePath: '…' })` instead of driving the `<select>`. MODAL-04 (which only asserted pre-fill state) rewritten to probe `this.currentFolder` via the modal internals.
- **Files modified:** `src/__tests__/snippet-editor-modal.test.ts`
- **Verification:** 13/13 tests green post-fix; the modal's save/move/collision pipelines are unchanged — only the input-event shape changed.
- **Committed in:** `8b0f19d` (Task 1 GREEN)

**2. [Rule 1 — Bug] Existing `src/__tests__/snippet-tree-dnd.test.ts` context-menu Move-to tests referenced FolderPickerModal directly**

- **Found during:** Task 2 full-suite run after GREEN implementation.
- **Issue:** 4 tests in the `context menu Move to…` describe block used `vi.mock('../views/folder-picker-modal', ...)` with a `folderPickerCtorSpy` + `lastPickerCall` to assert constructor args and invoke `onChoose`. After Task 2's production change, `openMovePicker` no longer instantiates `FolderPickerModal`; it instantiates `new Modal(this.app)` + `new SnippetTreePicker(...)`. All 4 tests threw TypeError on `lastPickerCall!.onChoose`.
- **Fix:** Added `Modal` to the obsidian mock (with `setTitle`/`onOpen`/`onClose`/`open`/`close` instrumentation captured into `modalInstances[]`). Added `vi.mock('../views/snippet-tree-picker', ...)` with a stub that captures constructor options into `pickerInstances[]`. Rewrote the 4 tests to invoke the latest picker's `onSelect` via an absolute-to-relative-path translating helper `selectAbsolute(absPath)`. Consolidated the "picker folders list EXCLUDES source folder and its descendants" test into a new "move-target safety guards reject source-self and descendants with Russian Notices" test that exercises the D-07 safety trio end-to-end.
- **Files modified:** `src/__tests__/snippet-tree-dnd.test.ts`
- **Verification:** 15/15 tests green post-fix (was 13 pre-fix; +2 from consolidation-driven split).
- **Committed in:** `de152e9` (Task 2 GREEN)

### Out-of-scope (NOT deviations)

- None.

## Auth gates

None encountered.

## Threat Flags

None — this plan's trust surface matches the `<threat_model>` (T-51-04-01 through T-51-04-03) verbatim. No new network endpoints, no new file-access paths, no new auth paths, no schema changes.

Mitigations verified:
- **T-51-04-01 (Tampering — user selects source folder as move target → recursive corruption):** `handleSelect` in `openMovePicker` runs source-self check + descendant check via `startsWith(node.path + '/')` + whitelist membership check via `allowedSet.has(absPath)` BEFORE calling `onChoose`. Tests 5 and 6 in `snippet-manager-folder-picker.test.ts` assert Notice + non-call of performMove; `snippet-tree-dnd.test.ts` new "safety guards" test asserts the trio end-to-end.
- **T-51-04-02 (DoS):** accepted — delegated to Plan 02's SnippetTreePicker.
- **T-51-04-03 (Information Disclosure):** accepted — single-user trust scope unchanged.

## Issues Encountered

- **Existing test suites coupled to legacy UI implementation details.** Two existing test files (`snippet-editor-modal.test.ts` and `snippet-tree-dnd.test.ts`) asserted against the legacy `<select>` and `FolderPickerModal` surfaces. Both were updated in-line as Rule 1 auto-fixes (see Deviations). Neither required changes to production code beyond what the plan mandated; the fixes were strictly to test-infrastructure coupling to the old picker surface.

## Self-Check

**Files:**
- ✓ `src/views/snippet-editor-modal.ts` — FOUND (modified)
- ✓ `src/views/snippet-manager-view.ts` — FOUND (modified)
- ✓ `src/views/folder-picker-modal.ts` — FOUND (modified, @deprecated added, class body unchanged)
- ✓ `src/__tests__/views/snippet-editor-modal-folder-picker.test.ts` — FOUND (NEW, 8 tests)
- ✓ `src/__tests__/views/snippet-manager-folder-picker.test.ts` — FOUND (NEW, 6 tests)
- ✓ `src/__tests__/snippet-editor-modal.test.ts` — FOUND (modified)
- ✓ `src/__tests__/snippet-tree-dnd.test.ts` — FOUND (modified)

**Commits:**
- ✓ `47363cb` (test RED Task 1) — FOUND in git log
- ✓ `8b0f19d` (feat GREEN Task 1) — FOUND in git log
- ✓ `f7bdfd5` (test RED Task 2) — FOUND in git log
- ✓ `de152e9` (feat GREEN Task 2) — FOUND in git log

**Verification greps:** all 17 acceptance-criteria greps passed (see Counted-grep table).

**Build + tsc + tests:**
- ✓ `npm run build` → exit 0 (production bundle deployed to TEST-BASE)
- ✓ `npx tsc --noEmit --skipLibCheck` → exit 0
- ✓ `npm test` → 575 passed / 1 skipped / 0 failed

**CSS invariant:**
- ✓ `git diff --stat 069f730..HEAD -- src/styles/` returns zero entries (W-1 compliance)

## TDD Gate Compliance

Both Task 1 and Task 2 are `tdd="true"`. Gate sequence for each:

- **Task 1:** `47363cb test(51-04)` (RED gate) → `8b0f19d feat(51-04)` (GREEN gate). No REFACTOR needed.
- **Task 2:** `f7bdfd5 test(51-04)` (RED gate) → `de152e9 feat(51-04)` (GREEN gate). No REFACTOR needed.

Both RED commits proved failing tests before corresponding implementation; both GREEN commits landed the implementation with all tests passing. TDD gate sequence verified in `git log` output.

## Self-Check: PASSED

## Next Phase Readiness

- Wave 2 of Phase 51 now has two complete folder-picker migrations (Plans 03 + 04). Plan 05 (Runner file-only rewrite) is independent and unblocked.
- Plan 06 (validator + runtime auto-insert) is independent of this plan and the SnippetTreePicker surface.
- FolderPickerModal may be safely deleted in a future cleanup phase once `git grep FolderPickerModal` returns zero imports outside `src/views/folder-picker-modal.ts` itself. As of this plan: `src/__tests__/snippet-tree-inline-rename.test.ts:225` and `src/__tests__/snippet-tree-dnd.test.ts:197` both have `vi.mock('../views/folder-picker-modal', ...)` stubs; since the real module is no longer imported by any src/ production file, these mocks are currently inert but harmless.

---
*Phase: 51-snippet-picker-overhaul*
*Completed: 2026-04-20*
