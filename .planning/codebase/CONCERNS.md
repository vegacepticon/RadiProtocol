# Codebase Concerns

**Analysis Date:** 2026-04-16

## Tech Debt

**Stub command left in production:**
- Issue: The `validate-protocol` command (id `'validate-protocol'`) shows `'Protocol validator coming in phase 3.'` but was never implemented. The validator exists as `GraphValidator` and is used by `RunnerView.openCanvas()`, so the command could simply invoke it on the active canvas.
- Files: `src/main.ts:50-52`
- Impact: Confusing UX -- users see a command that does nothing useful.
- Fix approach: Wire the command to parse the active canvas, run `GraphValidator.validate()`, and display results in a Notice or modal. Alternatively, remove the command if standalone validation is not planned.

**TODO: Snippet reference existence check never implemented:**
- Issue: `GraphValidator.validate()` has a commented-out Check 7 (lines 86-93) that would verify snippet references exist on disk. It has been a TODO since Phase 5.
- Files: `src/graph/graph-validator.ts:86-93`
- Impact: Users can reference nonexistent snippets in canvas nodes and only discover the problem at runtime when the snippet picker shows an empty folder.
- Fix approach: Pass `SnippetService` (or a lookup callback) into the validator and uncomment/implement the check. Requires making `validate()` async or pre-loading snippet paths.

**Phantom dependency: `async-mutex`:**
- Issue: `src/utils/write-mutex.ts` imports `async-mutex` (v0.5.0), which is installed in `node_modules/` but NOT declared in `package.json` `dependencies` or `devDependencies`. esbuild bundles it into `main.js` so the plugin works, but a fresh `npm install` on a clean checkout may not install it (depends on hoisting behavior of other packages).
- Files: `src/utils/write-mutex.ts:3`, `package.json`
- Impact: Build may break on clean installs or CI without cached `node_modules`.
- Fix approach: Add `"async-mutex": "^0.5.0"` to `dependencies` in `package.json`.

**WriteMutex never prunes its lock Map:**
- Issue: `WriteMutex` creates a `Mutex` per unique file path and stores it in `this.locks`. Mutexes are never removed, even after the file is deleted or the operation completes. Over a long session with many snippet operations, the Map grows unboundedly.
- Files: `src/utils/write-mutex.ts:13-19`
- Impact: Minor memory leak. Unlikely to matter in practice (each Mutex is ~100 bytes), but becomes relevant for vaults with hundreds of snippets being renamed/moved repeatedly.
- Fix approach: Add a `release(path)` method or use a WeakRef-based strategy. Alternatively, accept the leak given the small per-entry cost and document the decision.

**Mixed Russian/English user-facing strings:**
- Issue: Error messages and UI labels are inconsistently localized. `SnippetService` throws Russian errors (`'Имя не может быть пустым...'`, `'Файл не найден'`, `'Нельзя переместить папку внутрь самой себя.'`). `SnippetManagerView` shows Russian Notices. Meanwhile, `RunnerView`, `EditorPanelView`, settings tab, and graph validator use English exclusively.
- Files: `src/snippets/snippet-service.ts` (lines 324, 341, 371, 387, 403, 410, 442, 450), `src/views/snippet-manager-view.ts` (lines 169, 521, 539, 560, 573, 604, 616, 628, 651, 803, 958), `src/views/snippet-editor-modal.ts` (lines 239, 508)
- Impact: Jarring UX for non-Russian speakers. Plugin review for community listing would flag this.
- Fix approach: Either localize everything via an i18n system, or standardize on English for all user-facing strings and keep Russian only in documentation/comments.

## Known Bugs

**No known open bugs at analysis time.** Error handling is thorough; the codebase has been through extensive phased development with bug-fix passes (BUG-01 through BUG-03 referenced in code).

## Security Considerations

**Path traversal defense is single-layer:**
- Risk: `SnippetService.assertInsideRoot()` rejects paths containing `..` or `.` segments and paths that don't start with the snippet root. This is the only defense against directory traversal for all snippet CRUD operations.
- Files: `src/snippets/snippet-service.ts:48-64`
- Current mitigation: The check is applied before every vault I/O call. It rejects absolute paths, `..` segments, and paths outside the configured root.
- Recommendations: The implementation is solid for the Obsidian context (vault-scoped paths, no direct filesystem access). Consider adding a unit test that specifically exercises Unicode normalization edge cases (e.g., overlong UTF-8 sequences, combining characters that produce `/`). Current test coverage appears adequate for standard traversal attacks.

**Control character sanitization only on JSON snippets:**
- Risk: `sanitizeJson()` strips control characters (U+0000-U+001F, U+007F) from JSON snippet fields, but Markdown snippets (`kind: 'md'`) are written to disk with no sanitization (`payload = snippet.content`).
- Files: `src/snippets/snippet-service.ts:201-206`
- Current mitigation: Markdown snippets are free-form text by design. Obsidian's vault API handles file I/O safely.
- Recommendations: Acceptable risk since Obsidian renders markdown in a sandboxed context. Document the design decision.

**No input length limits:**
- Risk: Template strings, placeholder labels, question text, and free-text input have no maximum length enforcement. A maliciously crafted canvas or snippet could cause excessive memory usage.
- Files: `src/snippets/snippet-service.ts`, `src/runner/protocol-runner.ts`, `src/views/editor-panel-view.ts`
- Current mitigation: None beyond Obsidian's built-in memory constraints.
- Recommendations: Low priority -- the threat model is local (user edits their own vault). Add length guards if the plugin ever processes untrusted canvas files.

## Performance Bottlenecks

**canvas-ref-sync reads every .canvas file in vault:**
- Problem: `rewriteCanvasRefs()` calls `app.vault.getFiles().filter(f => f.extension === 'canvas')` and reads + parses every canvas file sequentially when a snippet folder is renamed or moved.
- Files: `src/snippets/canvas-ref-sync.ts:48-51`
- Cause: No index of which canvas files reference which snippet paths. Every rename triggers a full vault scan.
- Improvement path: For vaults with few canvas files (typical radiology use case), this is fast. For large vaults with many canvas files, consider building an in-memory index of snippet references on plugin load, or limiting the scan to canvases in `protocolFolderPath` when configured.

**Snippet tree rebuilds read entire folder hierarchy:**
- Problem: `SnippetManagerView.rebuildTreeModel()` recursively calls `listFolder()` for every subfolder, issuing sequential `vault.adapter.list()` + `vault.adapter.read()` for each snippet file.
- Files: `src/views/snippet-manager-view.ts:178-200`, `src/snippets/snippet-service.ts:86-148`
- Cause: No caching layer; every debounced vault event triggers a full re-read.
- Improvement path: Cache the tree model and invalidate only the changed subtree based on the vault event path. The 120ms debounce mitigates rapid-fire events but not the O(n) I/O cost per rebuild.

**RunnerView.render() calls contentEl.empty() on every state change:**
- Problem: Every user action (answer click, step back, snippet pick) triggers a full DOM teardown and rebuild via `this.contentEl.empty()` followed by complete re-creation of all elements.
- Files: `src/views/runner-view.ts:293-536`
- Cause: No virtual DOM or incremental update strategy. The entire view is recreated imperatively.
- Improvement path: For the current feature set this is fast enough (small DOM). If the runner gains more complex UI (nested loops, multi-step previews), consider selective DOM updates. Not urgent.

## Fragile Areas

**Reliance on undocumented Obsidian internal APIs:**
- Files: `src/canvas/canvas-live-editor.ts`, `src/types/canvas-internal.d.ts`, `src/views/editor-panel-view.ts:59-99`, `src/main.ts:82-114`
- Why fragile: The plugin uses multiple undocumented Obsidian APIs:
  - `view.canvas.getData()` / `setData()` / `requestSave()` (Pattern B live editing)
  - `canvas:node-menu` workspace event for context menu integration
  - `leaf.containerEl` for canvas click detection
  - `view.canvas.selection` Set for identifying selected nodes
  - `active-leaf-change` event (semi-documented but behavior may shift)
- Safe modification: The code probes for API existence at runtime (`typeof view.canvas?.getData === 'function'`) and falls back gracefully. Changes to Obsidian's canvas internals would break live editing (falls back to Strategy A: vault.modify) and the node editor auto-detection (falls back to right-click context menu).
- Test coverage: `canvas-live-editor.test.ts` and `canvas-write-back.test.ts` test the logic but cannot test against real Obsidian APIs.

**EditorPanelView's click-to-select node detection:**
- Files: `src/views/editor-panel-view.ts:53-99`
- Why fragile: Attaches a click listener to the canvas leaf's internal `containerEl`, then reads `canvas.selection` to determine which node was clicked. If Obsidian changes the timing of when `selection` is populated relative to the click event, node detection breaks silently.
- Safe modification: Always verify that `canvas.selection.size === 1` before reading. The current code already does this.
- Test coverage: Limited -- `editor-panel.test.ts` is a lightweight stub test, not a full integration test.

**SnippetManagerView inline rename (830-962):**
- Files: `src/views/snippet-manager-view.ts:826-963`
- Why fragile: The inline rename flow manually manages DOM (creating an input element, hiding a label, wiring keydown/blur handlers, calling cleanup). It uses multiple `as unknown as` casts to navigate Obsidian's DOM types vs standard DOM types. A single missed cleanup path (e.g., view closed during rename) could leave stale event listeners.
- Safe modification: Avoid changing the cleanup function. If modifying, ensure `cleanup()` runs in every exit path (commit, cancel, blur, view close).
- Test coverage: `snippet-tree-inline-rename.test.ts` (520 lines) covers the happy paths well.

## Scaling Limits

**Session file naming uses encodeURIComponent:**
- Current capacity: One session file per canvas path, named `encodeURIComponent(canvasFilePath) + '.json'`.
- Limit: Canvas paths longer than ~200 characters will produce filenames that exceed filesystem limits (255 bytes on most systems). Deeply nested vault structures could trigger this.
- Files: `src/sessions/session-service.ts:30-32`
- Scaling path: Switch to a hash-based naming scheme (e.g., `sha256(canvasFilePath).slice(0,16) + '.json'`) if long paths become an issue. Store the original path inside the JSON payload (already present as `canvasFilePath`).

**Loop iteration limit is configurable but not per-loop:**
- Current capacity: Global `maxLoopIterations` (default 50) applies uniformly to all loops.
- Limit: Complex protocols with both tight loops (2-3 iterations) and large loops (50+) cannot be configured independently.
- Files: `src/runner/protocol-runner.ts:9`, `src/settings.ts:9`
- Scaling path: Add a per-loop-start `maxIterations` field (the `LoopStartNode` interface already has it but the runner uses the global setting).

## Dependencies at Risk

**`obsidian` package pinned to 1.12.3:**
- Risk: The plugin depends on undocumented canvas internals that may change between Obsidian versions. The `obsidian` npm package version lags behind actual Obsidian releases.
- Impact: Canvas live editing, context menu integration, and node auto-detection could break on Obsidian updates.
- Migration plan: Already mitigated by runtime probing. Monitor Obsidian changelogs for canvas API changes. Community plugins like `obsidian-advanced-canvas` serve as canaries for breaking changes.

## Test Coverage Gaps

**View layer has minimal test coverage:**
- What's not tested: `RunnerView` (872 lines) has only a lightweight stub test (`RunnerView.test.ts`, `runner-commands.test.ts`). `EditorPanelView` (739 lines) has only `editor-panel.test.ts` which is a stub. Neither test file exercises the actual rendering logic, DOM event handlers, or async flows (session resume, snippet picker, canvas switching).
- Files: `src/views/runner-view.ts`, `src/views/editor-panel-view.ts`, `src/__tests__/RunnerView.test.ts`, `src/__tests__/editor-panel.test.ts`
- Risk: Regressions in the two largest view files go undetected until manual testing. The runner's complex multi-state render switch (idle, at-node, awaiting-snippet-pick, awaiting-snippet-fill, complete, error) is completely untested at the unit level.
- Priority: Medium -- the pure runner engine (`protocol-runner.ts`) is well-tested (982-line test suite), which covers state machine correctness. View-layer bugs are typically visual/interaction issues caught during manual QA.

**Modal views untested:**
- What's not tested: `CanvasSwitchModal`, `ConfirmModal`, `FolderPickerModal`, `NodePickerModal`, `NodeSwitchGuardModal`, `ResumeSessionModal` have no dedicated test files. Their behavior is only verified indirectly through tests that mock them.
- Files: `src/views/canvas-switch-modal.ts`, `src/views/confirm-modal.ts`, `src/views/folder-picker-modal.ts`, `src/views/node-picker-modal.ts`, `src/views/node-switch-guard-modal.ts`, `src/views/resume-session-modal.ts`
- Risk: Low -- these are thin wrappers around Obsidian's `Modal`/`SuggestModal` APIs with minimal logic.
- Priority: Low

**`CanvasSelectorWidget` untested:**
- What's not tested: The canvas file selector widget that scans the protocol folder and presents a dropdown. No test file exists.
- Files: `src/views/canvas-selector-widget.ts` (210 lines)
- Risk: Medium -- this widget handles vault scanning, file filtering, and state synchronization with the runner. Bugs here could prevent users from selecting protocols.
- Priority: Medium

**No integration/E2E tests:**
- What's not tested: The full flow from canvas open -> protocol run -> session save -> resume is never tested end-to-end. All tests are unit-level with mocked Obsidian APIs.
- Risk: Integration bugs between components (e.g., `RunnerView` <-> `SessionService` <-> `ProtocolRunner`) are only caught during manual testing.
- Priority: Low -- Obsidian's plugin architecture makes E2E testing extremely difficult without a headless Obsidian runtime.

---

*Concerns audit: 2026-04-16*
