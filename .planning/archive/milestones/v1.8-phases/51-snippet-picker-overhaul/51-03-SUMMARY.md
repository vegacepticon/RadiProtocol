---
phase: 51-snippet-picker-overhaul
plan: 03
subsystem: ui
tags: [picker-02, editor-panel, snippet-picker, autosave, tdd]

# Dependency graph
requires:
  - phase: 51-snippet-picker-overhaul plan 01
    provides: "SnippetNode.radiprotocol_snippetPath?: string (D-01)"
  - phase: 51-snippet-picker-overhaul plan 02
    provides: "SnippetTreePicker class + rp-stp-editor-host host wrapper CSS class (sole-owner model)"
  - phase: 28-canvas-live-editor
    provides: "Pattern B saveLive autosave plumbing routed through scheduleAutoSave"
  - phase: 31-snippet-branch-customisation
    provides: "Branch label + Separator override settings (preserved byte-identical)"
provides:
  - "Node Editor case 'snippet' arm rewritten: inline SnippetTreePicker in mode 'both'"
  - "D-01 mutual exclusivity enforced on every write (snippetPath ↔ subfolderPath)"
  - "Phase 31 text-mirroring contract extended to file selection (basename-without-extension)"
  - "snippetTreePicker lifecycle: unmount at top of buildKindForm before any re-render"
  - "listSnippetSubfolders marked @deprecated (Shared Pattern G — not deleted, zero callers in src/)"
affects:
  - 51-04 (Snippet Manager + SnippetEditorModal folder-only migration)
  - 51-05 (Runner file-only rewrite)
  - 51-06 (validator + runtime auto-insert)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline SnippetTreePicker mount via host wrapper class (CSS owned by Plan 02)"
    - "Single-site lifecycle cleanup at buildKindForm head (not duplicated in snippet arm)"
    - "D-01 mutual exclusivity — onSelect ALWAYS writes BOTH fields (one value, one undefined)"
    - "Basename-without-extension helper inline (no new module)"

key-files:
  created:
    - src/__tests__/views/editor-panel-snippet-picker.test.ts
  modified:
    - src/views/editor-panel-view.ts

key-decisions:
  - "Lifecycle cleanup at top of buildKindForm — cleans the picker regardless of which kind the user switches to (not just snippet)"
  - "Removed defensive in-arm unmount block after tsc narrowing flagged it as unreachable; head-of-method cleanup is the single source of truth"
  - "listSnippetSubfolders retained with @deprecated JSDoc (zero callers in src/; Shared Pattern G forbids deletion of prior-phase code)"
  - "Basename-stem parsing done inline (lastIndexOf '/' + lastIndexOf '.') — no extraction into helper; keeps the text-mirroring rule visible inside onSelect for auditability"

requirements-completed: [PICKER-02]

# Metrics
duration: ~25min
completed: 2026-04-20
---

# Phase 51 Plan 03: Node Editor inline SnippetTreePicker Summary

**The Node Editor's `case 'snippet':` arm now mounts an inline SnippetTreePicker in mode `'both'` rooted at `settings.snippetFolderPath`, replacing the Phase 30 flat-list `addDropdown`. Selection callbacks enforce D-01 mutual exclusivity on every write (folder clears file binding, file clears folder binding) and trigger `scheduleAutoSave()` through the existing Pattern B plumbing. Phase 31 Branch label + Separator override settings are preserved byte-identical below the picker.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-20T10:27:00Z
- **Completed:** 2026-04-20T10:33:00Z
- **Tasks:** 1 (TDD: RED → GREEN, no REFACTOR needed)
- **Files created/modified:** 1 created + 1 modified

## Accomplishments

- Inline SnippetTreePicker lands in `case 'snippet':` arm — mode `'both'`, rootPath = `settings.snippetFolderPath`
- `initialSelection` seeded correctly: file path wins when present, else folder path, else `undefined` (legacy back-compat)
- Folder selection writes `radiprotocol_subfolderPath` + explicit `undefined` for `radiprotocol_snippetPath` (D-01)
- File selection writes `radiprotocol_snippetPath` + explicit `undefined` for `radiprotocol_subfolderPath` (D-01)
- `pendingEdits.text` mirroring: folder → full relativePath; file → basename without extension (e.g. `abdomen/ct.md` → `ct`, `liver/r.json` → `r`)
- Lifecycle clean: `snippetTreePicker` instance field unmounted at the top of `buildKindForm()` on every render (covers re-selection of same snippet node, switching to different node, switching to non-snippet kind, and switching to `null` kind)
- Phase 31 D-01 Branch label setting + Phase 31 D-04 Separator override setting remain byte-identical below the picker
- `listSnippetSubfolders()` retained with `@deprecated Phase 51 Plan 03` JSDoc (zero remaining callers in `src/` — grep-verified — but not deleted per Shared Pattern G)
- **12 new DOM integration tests** all GREEN; full suite 561 passed / 1 skipped / 0 failed (was 549/1/0 at start of plan; +12 from this plan)
- Zero CSS modifications — the `rp-stp-editor-host` host wrapper class was shipped up-front by Plan 02 (sole-owner model)

## Exact line-range replacement in editor-panel-view.ts

The pre-Plan snippet arm (lines 598–673 at start of this plan) is replaced as follows:

| Region | Before | After |
|--------|--------|-------|
| Heading `Snippet node` | Line 599 | Line 614 — **PRESERVED** |
| `subfolderSetting` + `void async IIFE` with flat dropdown | Lines 600–643 | **REPLACED** with new `Target` Setting + `rp-stp-editor-host` div + SnippetTreePicker mount (lines 617–673) |
| Phase 31 Branch label setting | Lines 645–656 | Lines 675–686 — **PRESERVED BYTE-IDENTICAL** |
| Phase 31 Separator override setting | Lines 658–672 | Lines 688–702 — **PRESERVED BYTE-IDENTICAL** |
| `break;` | Line 673 | Line 703 — **PRESERVED** |

Plus:
- `import { SnippetTreePicker }` added at the top of the file (after `CanvasParser` import) with Shared Pattern H design-note citation comment
- Private field `snippetTreePicker: SnippetTreePicker | null = null` added below the Auto-save field block
- Single-site lifecycle unmount added at the top of `buildKindForm()` (before the `if (!kind) return` guard)
- `listSnippetSubfolders()` JSDoc extended with `@deprecated Phase 51 Plan 03` note

## DOM order (case 'snippet' arm post-plan)

```
Heading: "Snippet node"  (Phase 29)
Setting: "Target" + Russian description  (Phase 51 D-05 — NEW)
Div: rp-stp-editor-host                  (Phase 51 D-05 — NEW — hosts SnippetTreePicker)
Setting: "Branch label"                  (Phase 31 D-01 — PRESERVED)
Setting: "Separator override"            (Phase 31 D-04 — PRESERVED)
```

Test 11 asserts the host div is created; Test 12 asserts the Branch label + Separator override setNames still fire via the captured `Setting.prototype.setName` spy.

## Deprecation status of `listSnippetSubfolders`

```bash
$ rg "listSnippetSubfolders" src/
src/views/editor-panel-view.ts:944:  private async listSnippetSubfolders(basePath: string): Promise<string[]> {
```

One definition, zero callers — the sole caller (the former snippet-arm flat dropdown) was replaced by this plan. The method is retained with `@deprecated Phase 51 Plan 03 — Node Editor's case 'snippet' now mounts SnippetTreePicker (hierarchical + search) instead of this BFS-flat-list helper` JSDoc note. Per CLAUDE.md Shared Pattern G the method is NOT deleted.

## Test count delta

- `src/__tests__/views/editor-panel-snippet-picker.test.ts` — **NEW**, 12 `it()` cases across one `describe()` block (plan required ≥ 11).

Test coverage:
1. Picker mounted with mode 'both' + rootPath from settings
2. Folder selection → `radiprotocol_subfolderPath` written, `radiprotocol_snippetPath = undefined`, `scheduleAutoSave` called
3. File selection → inverse (D-01 mutual exclusivity enforced)
4. `pendingEdits.text` mirrors folder relativePath verbatim
5. `pendingEdits.text` mirrors file basename without extension (`abdomen/ct.md` → `ct`)
6. `pendingEdits.text` mirrors file basename without extension (`liver/r.json` → `r`)
7. Existing `radiprotocol_subfolderPath` seeds `initialSelection: 'abdomen'`
8. Existing `radiprotocol_snippetPath` seeds `initialSelection: 'abdomen/ct.md'` (wins over folder)
9. Back-compat — legacy node (neither field) mounts with `initialSelection: undefined` AND does NOT pre-write any `pendingEdits` keys
10. Lifecycle — second `buildKindForm` call unmounts the first picker before constructing the second
11. Host element `rp-stp-editor-host` is created in the render tree
12. `Branch label` + `Separator override` `setName` calls still fire (captured via `Setting.prototype.setName` spy)

**Full suite:** 561 passed / 1 skipped / 0 failed (was 549/1/0 pre-plan; +12 from this plan).

## Task Commits

| Hash      | Type | Scope                                                                                      |
|-----------|------|--------------------------------------------------------------------------------------------|
| `bc5cc2f` | test | RED — 12 failing tests for inline SnippetTreePicker in Node Editor                         |
| `c93898f` | feat | GREEN — inline SnippetTreePicker replaces flat-list dropdown in Node Editor (Task 1 action) |

No REFACTOR commit — GREEN landed clean; one in-place tsc narrowing adjustment was folded into the GREEN commit (see Deviations section).

## Counted-grep verification

| Grep                                                      | Expected        | Actual |
|-----------------------------------------------------------|-----------------|--------|
| `import \{ SnippetTreePicker \}` in editor-panel-view.ts  | present         | 1      |
| `new SnippetTreePicker(` in editor-panel-view.ts          | exactly 1       | 1      |
| `mode: 'both'` in editor-panel-view.ts                    | 1               | 1      |
| `radiprotocol_snippetPath` in editor-panel-view.ts        | ≥ 2 (folder write, file write in onSelect) | 4 |
| `Phase 51` in editor-panel-view.ts                        | ≥ 2             | 6      |
| `mutual exclusiv` in editor-panel-view.ts                 | present         | 3      |
| `snippet-node-binding-and-picker.md` in editor-panel-view.ts | present      | 2      |
| `rp-stp-editor-host` in editor-panel-view.ts              | present         | 2      |
| `addDropdown` in editor-panel-view.ts                     | ≤ 5 (was 6 pre-plan; -1 for replaced snippet dropdown) | 5 |
| `Branch label` in editor-panel-view.ts                    | 1 (setName)     | 1      |
| `snippetTreePicker` in editor-panel-view.ts               | ≥ 3 (field + cleanup + assignment) | 6 |
| `git diff --stat src/styles/`                             | zero entries    | zero   |

## W-1 compliance (no src/styles/ modifications)

```bash
$ git diff --stat HEAD~1 HEAD -- src/styles/
(no output — zero files changed in src/styles/ by this plan)
```

Only `src/views/editor-panel-view.ts` was modified by the implementation commit (`c93898f`); the RED commit (`bc5cc2f`) added `src/__tests__/views/editor-panel-snippet-picker.test.ts`. The `rp-stp-editor-host` host wrapper class lives in `src/styles/snippet-tree-picker.css`, owned and shipped by Plan 02 — this plan only consumes it.

## Shared Pattern G compliance

- Branch label + Separator override settings: preserved byte-identical
- `listSnippetSubfolders`: retained with added `@deprecated` JSDoc; method body unchanged
- All other `case 'XXXX':` arms (start, question, answer, text-block, loop, loop-start, loop-end): untouched
- `renderForm`, `scheduleAutoSave`, `onTypeDropdownChange`, `saveNodeEdits`, `handleNodeClick`, `attachCanvasListener`, `renderToolbar`, `renderIdle`, `renderError`, `onQuickCreate`, `onDuplicate`: untouched
- Zero unrelated deletions

## Decisions Made

See `key-decisions` in frontmatter. Two notable in-flight adjustments to the plan:

1. **Single-site lifecycle cleanup** — The plan's Step 2 asked for cleanup at the top of `buildKindForm()` AND a defensive in-arm unmount before the `new SnippetTreePicker(...)` call. Under TypeScript strict-null narrowing, the head cleanup sets `this.snippetTreePicker = null`, which narrows the field's type to `null` for the rest of the method body. The subsequent `if (this.snippetTreePicker !== null)` check then narrows to `never`, making `.unmount()` a compile error. Resolution: keep only the head-of-method cleanup (which is the correct single source of truth for the invariant) and remove the redundant in-arm guard. Test 10 still passes because the head-of-method block handles every re-render path. Documented in code with a comment pointing at the top-of-method cleanup.

2. **Basename-stem parsing stays inline** — rather than extracting into a helper, the three lines (`lastIndexOf('/')` + `lastIndexOf('.')` + slice) stay inside the `onSelect` callback so the text-mirroring rule is visible at the point of write, aiding future auditors reviewing D-01 compliance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug fix] Removed redundant defensive unmount block inside snippet arm**

- **Found during:** `npx tsc --noEmit --skipLibCheck` after initial GREEN implementation.
- **Issue:** Plan Step 2 + Step 3 both requested an unmount call at the `case 'snippet':` arm (belt-and-braces). After the Step 2 cleanup at the top of `buildKindForm()` sets `this.snippetTreePicker = null`, TypeScript narrows the field to `null` for the remainder of the method. The subsequent `if (this.snippetTreePicker !== null)` inside the snippet arm then narrows to `never`, making `.unmount()` a compile-time error (`TS2339: Property 'unmount' does not exist on type 'never'`).
- **Fix:** Removed the redundant in-arm guard. The head-of-method cleanup is the single source of truth; Test 10 (lifecycle) verifies it correctly unmounts the prior picker before a new render regardless of which re-render path the user takes.
- **Files modified:** `src/views/editor-panel-view.ts` (in-place before GREEN commit)
- **Commit:** folded into `c93898f`

### Out-of-scope (NOT deviations)

- None.

## Auth gates

None encountered.

## Threat Flags

None — this plan's trust surface matches the `<threat_model>` (T-51-03-01 Tampering + T-51-03-02 DoS) verbatim. No new network endpoints, no new file-access paths, no new auth paths, no schema changes.

Mitigations verified:
- **T-51-03-01 (Tampering — forget-to-clear-inverse-field on selection):** onSelect callback ALWAYS writes BOTH fields (one with the value, one with `undefined`). Tests 2 and 3 assert both fields' state after a selection event.
- **T-51-03-02 (DoS — listener leak via missed unmount):** Head-of-buildKindForm unmount + test-10 lifecycle assertion prove unmount fires before re-mount across every re-render path.

## Self-Check

**Files:**
- `src/views/editor-panel-view.ts` — FOUND (976 lines, +76 insertions / -41 deletions vs pre-plan HEAD)
- `src/__tests__/views/editor-panel-snippet-picker.test.ts` — FOUND (367 lines, new)

**Commits:**
- `bc5cc2f` (test RED) — FOUND in git log
- `c93898f` (feat GREEN) — FOUND in git log

**Verification greps:** all 12 acceptance-criteria greps passed (see Counted-grep table above).

**Build + tsc + tests:**
- `npx tsc --noEmit --skipLibCheck` → exit 0
- `npm run build` → exit 0, main.js deployed to TEST-BASE
- `npm test` → 561 passed / 1 skipped / 0 failed

## Self-Check: PASSED

---

*Phase: 51-snippet-picker-overhaul*
*Completed: 2026-04-20*
