---
date: 2026-07-30T13:48:23+0300
author: Roman Shulgha
commit: 9e99e9d
branch: main
repository: RadiProtocol
topic: "Snippet Manager validation-fix blueprint — Step 9 triage"
tags: [blueprint, plan, snippet-manager, validation-fix, async-race, mutation-recovery]
status: complete
last_updated: 2026-07-30T13:48:23+0300
last_updated_by: Roman Shulgha
type: implementation_strategy
---

# Handoff: Snippet Manager validation-fix blueprint — mid Step 9 triage

## Task(s)

Producing an implement-ready phased plan that fixes the failed two-pane Snippet Manager validation, so that after `/skill:implement` the developer can rerun `/skill:validate` and commit.

**Parent validation (input):** `.rpiv/artifacts/validation/2026-07-30_12-03-37_snippet-editor-two-pane-file-manager-redesign.md` — verdict `fail`. Deviations reduce to two themes:
1. Async model construction mutates shared `folderTreeData`/`snippetData` before ownership checks (`src/views/snippet-manager-view.ts:239-287`); stale/unmounted work can expose mixed state.
2. CRUD/move and renderer-rename completion bypass the shared generation guard; folder rename/move delays path reconciliation until after protocol-reference sync, so an unexpected sync rejection mislabels a completed storage mutation as failed.

**Plan artifact (output):** `.rpiv/artifacts/plans/2026-07-30_12-33-56_snippet-manager-validation-race-and-mutation-fixes.md`
- status: `in-review` (flips to `ready` after Step 9 triage completes)
- 2 phases, both code fences + Success Criteria filled, both approved in Step 6.4.
- Phase 1: Atomic async model ownership (foundation) — `snippet-manager-view.ts`, `snippet-tree-view.test.ts`.
- Phase 2: Guarded mutation completion and sync recovery — `snippet-manager-view.ts`, `tree-renderer.ts`, `snippet-tree-view.test.ts`, `snippet-tree-dnd.test.ts`, `snippet-tree-inline-rename.test.ts`, `en.json`, `ru.json`.

**Current step:** Step 9 (Review & Iterate) — triaging Step 8 reviewer findings. **3 of 7 rows resolved; 4 remain.** The user declined to answer the Concern 2 question (the ask was declined, not the finding dismissed) — the next session must re-ask or decide Concern 2, then batch-triage Concerns 3–5.

## Critical References

- `.rpiv/artifacts/plans/2026-07-30_12-33-56_snippet-manager-validation-race-and-mutation-fixes.md` — the plan being triaged. The `## Plan Review (Step 8)` table at line ~1241 holds the 7 findings with per-row `resolution` column.
- `.rpiv/artifacts/validation/2026-07-30_12-03-37_snippet-editor-two-pane-file-manager-redesign.md` — the failed validation that scopes the plan; its "Recommendations" and "Code Review Findings → Deviations from Plan" define the fix intent.
- `.rpiv/artifacts/plans/2026-07-30_09-49-45_snippet-editor-two-pane-file-manager.md` — the original 4-phase redesign plan that was implemented and then failed validation; this fix plan is its corrective successor (same working-tree changes are in place, uncommitted).

## Recent changes

All edits are to the plan artifact only (blueprint never edits source files). The codebase working tree already carries the uncommitted redesign implementation from the prior session (`git status` shows 11 modified files + the plan/validation/research artifacts).

Plan artifact edits this session (`Z:/projects/RadiProtocol/.rpiv/artifacts/plans/2026-07-30_12-33-56_snippet-manager-validation-race-and-mutation-fixes.md`):
- Skeleton written at skill Step 5; Phase 1 and Phase 2 code fences + Success Criteria filled via Edit at Step 6.4 approvals.
- Frontmatter `status: in-progress` → `in-review`; `unresolved_phase_count: 2` → `0`; Plan History rows updated to "approved as generated".
- Step 8 `## Plan Review (Step 8)` table appended (7 rows: 2 blockers, 5 concerns, 0 suggestions).
- Blocker 1 applied: added Phase 2 Manual Verification bullet "Rerun `/skill:validate` ... record successful validate-owned `npm run check` and `npm run check:release` results".
- Blocker 2 applied: extended `MUTATION-ROUTING` test to enumerate every `TreeRendererCallbacks` member (assignment in view's `callbacks:` block + `this.callbacks.<name>(` invocation in renderer source); added AV bullet `npx vitest run src/__tests__/snippet-tree-view.test.ts -t "MUTATION-ROUTING"`.
- Concern 1 applied: added `private requestedFolderPath: string` field, initialized in constructor + `onOpen`, set as `refresh()` default parameter target, committed alongside `selectedFolderPath` in `commitModel()`; added `TREE-03-WATCHER` regression proving a watcher refresh during `selectFolder()` cannot revert to the old folder.

## Learnings

- **One mounted generation owns model commits.** The core fix pattern (modeled after `src/views/protocol-editor-view.ts:1682-1718` and `src/views/snippet-tree-picker.ts:455-473`): build folder tree, snippet rows, and search results entirely in local values inside `loadModel()`; validate `mounted && generation === searchGeneration` via `ownsRefresh()` immediately before `commitModel()`; only that atomic swap touches shared fields. Stale operations may finish already-issued vault reads but cannot commit, render, emit stale errors, or clear another generation's `.is-scanning`.
- **Active-search folder selection restarts the unchanged query** (developer decision, Step 4). `selectFolder(path)` calls `refresh(path)` without eager-assigning `selectedFolderPath`; the restart preserves single-generation ownership.
- **Storage mutation is the commit boundary.** `performMove` / `completeFolderRename` reorder to: storage mutation → `refreshAfterFolderPathChange` (rewrite selected/expanded + guarded refresh) → independent `syncProtocolRefs`. `syncProtocolRefs()` catches unexpected `rewriteProtocolSnippetRefs` rejection, returns `null`, emits a localized `referenceSyncWarning`, and logs `[RadiProtocol] snippet manager protocol-reference sync failed` — it never surfaces `moveError`/`renameError` for a successful storage op.
- **slice-verifier is strict on test-wait timing.** Phase 2 inserts a full guarded `refresh()` before protocol sync, so existing DnD/inline-rename tests that waited only 2–3 microtasks (`await Promise.resolve()`) cannot pass. Fix: replace positive-operation waits with `await flushAsync()` (`await new Promise(r => setTimeout(r, 0))`); negative early-return tests may keep one microtask.
- **Blueprint workflow discipline that paid off:** (a) always re-dispatch slice-verifier after a VIOLATION and re-present only the corrected delta; (b) hold the full Phase 2 code in one verifier dispatch so decisions/cross-slice/research are cleared together; (c) never fill empty Phase content at Step 7 — empty at finalize = return to Step 6.
- **Two private `toSnippetRelativePath` utilities exist** — the view's (`src/views/snippet-manager-view.ts`, preserves `.md`) and the service's exported one (`src/snippets/snippet-service.ts:41`, strips `.md`). Concern 3 flags this as a codebase-fit smell to reconcile.
- **Move/rename i18n notices are inconsistent with the new sync-result shape.** `movedFileNotice`/`movedFolderNotice` require `{canvasCount}` AND `{protocolCount}`, but Phase 2 supplies only `protocolCount` — the `{canvasCount}` placeholder would render literally. `folderRenamedNotice` labels `{updated}`/`{skipped}` as canvas results but `completeFolderRename` returns protocol-reference counts. Concerns 4 and 5.

## Artifacts

- `.rpiv/artifacts/plans/2026-07-30_12-33-56_snippet-manager-validation-race-and-mutation-fixes.md` — the plan (in-review). Key sections: `## Plan Review (Step 8)` at ~line 1241; Phase 1 code at ~line 160; Phase 2 code at ~line 600.
- `.rpiv/artifacts/validation/2026-07-30_12-03-37_snippet-editor-two-pane-file-manager-redesign.md` — failed validation (input).
- `.rpiv/artifacts/plans/2026-07-30_09-49-45_snippet-editor-two-pane-file-manager.md` — original 4-phase redesign plan (already implemented in the working tree).
- `.rpiv/artifacts/research/2026-07-30_09-21-44_snippet-editor-two-pane-file-manager.md` — upstream research.

## Action Items & Next Steps

1. **Resolve Concern 2** (re-ask; user declined the question, not the finding). Recommendation: apply — in `refreshAfterFolderPathChange`, set `this.requestedFolderPath = selectedFolderPath` immediately after computing the rewritten path and before `rewriteExpandState`/`refresh`, so a refresh failure cannot pair a successful mutation with an obsolete requested path. Edit the Phase 2 `refreshAfterFolderPathChange` code fence and fill the Concern 2 `resolution` cell.
2. **Batch-triage Concerns 3, 4, 5** in one `ask_user_question` call (independent rows, different files/intents, no cross-references):
   - Concern 3 (`toSnippetRelativePath` name collision): recommend **applied** — rename the view helper to e.g. `toProtocolRelativePath` (extension-preserving) and update the two call sites in `performMove` / `syncProtocolRefs`. Edit Phase 2 §1 code fence + resolution cell.
   - Concern 4 (`movedFileNotice`/`movedFolderNotice` missing `{canvasCount}`): recommend **applied** — change both EN/RU move notices to reference only `{protocolCount}` (canvas-ref sync was removed in an earlier commit; `rewriteProtocolSnippetRefs` is the only fan-out now), or drop `{canvasCount}` from the strings. Edit `en.json`/`ru.json` blocks + resolution cell.
   - Concern 5 (`folderRenamedNotice` mislabels counts as canvas results): recommend **applied** — update EN/RU `folderRenamedNotice` wording to "protocol references updated: {updated}, skipped: {skipped}" (and RU counterpart). Edit `en.json`/`ru.json` blocks + resolution cell.
3. **After all 7 rows have a `resolution`**, Edit frontmatter `status: in-review` → `status: ready`.
4. **Present the plan location** to the developer per Step 9.2 template (N decisions, 2 phases, 7 modified files, 0 new files, reviewer findings triaged: 5 applied, 0 deferred, 0 dismissed — adjust counts to actual triage).
5. **Next step for the developer:** `/skill:implement .rpiv/artifacts/plans/2026-07-30_12-33-56_snippet-manager-validation-race-and-mutation-fixes.md Phase 1` — start a fresh session with `/new` first.

## Other Notes

- **Do not edit source files.** This is still the blueprint skill — all code lives in the plan artifact's `## Phase N` code fences. `/skill:implement` applies them.
- **The two-phase decomposition is sequential and non-parallelizable** because Phase 2 revisits `snippet-manager-view.ts` and `snippet-tree-view.test.ts` and assumes Phase 1 signatures (`refresh(selectedFolderPath?)`, `loadModel`, `commitModel`, `ownsRefresh`, `requestedFolderPath`). Phase 2 also deletes the Phase 1 temporary compatibility wrappers `rebuildTreeModel()` / `rebuildSelectedSnippets()` / `reconcileSelectedFolder()` after replacing their callers.
- **AV exit-0 contract** (reconcile stage re-runs each `#### Automated Verification:` backtick span via `execFileSync`): every AV command must be one self-contained command that exits 0 exactly when the criterion holds. The added callback-coverage AV uses `npx vitest run ... -t "MUTATION-ROUTING"` (exits 0 on pass). The no-builder AV uses a `node -e` probe that exits 1 on match — correct (exit 0 only when the regex does NOT match).
- **The whole-project `npm run check` and `npm run check:release` gates are validate-owned**, not phase-local — they write `main.js`/`styles.css` repo-wide and violate the per-phase write-scope rule. They live in the Phase 2 Manual Verification bullet (rerun `/skill:validate`) instead.
- **slice-verifier final clearance for Phase 2:** Decisions OK, Cross-slice OK, Research OK after the `flushAsync()` timing fix. That fix is part of the approved Phase 2 code (replace fixed `Promise.resolve()` waits after positive operations in `snippet-tree-dnd.test.ts` and `snippet-tree-inline-rename.test.ts`).
- **No new files** are created by this plan; 7 existing files are modified.