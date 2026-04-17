---
phase: 41-live-canvas-update-on-folder-rename
reviewed: 2026-04-17T03:24:35Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/snippets/canvas-ref-sync.ts
  - src/views/snippet-manager-view.ts
  - src/__tests__/canvas-ref-sync.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-04-17T03:24:35Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 41 extends `rewriteCanvasRefs` with an optional `CanvasLiveEditor` parameter and a hybrid
live+disk write path: when a canvas is open and the Pattern-B internal API is reachable, per-node
edits are applied through `saveLive`; otherwise (and on any failure along the live path) the code
falls back to the pre-existing `vault.modify` flow. Both call sites in `SnippetManagerView`
(`performMove`, `commitInlineRename`) thread `plugin.canvasLiveEditor` through. Tests cover the
happy path, closed-canvas fallback, mixed open/closed canvases, multi-node live save, backward
compatibility when the parameter is omitted, and a mid-iteration `saveLive` failure.

The implementation is clean and well-scoped, and the added tests meaningfully exercise the new
branches. Three warnings describe real-but-narrow correctness concerns: a write-order race when
the live path partially succeeds before falling back, an unchecked `node.id` cast that feeds
`saveLive` with a possibly non-string id, and the fact that the live path is not covered by the
per-file write mutex that protects the disk path. Info items cover minor clean-up opportunities
in the new code and tests.

## Warnings

### WR-01: Mid-iteration live→disk fallback can produce a write-order race

**File:** `src/snippets/canvas-ref-sync.ts:88-109`
**Issue:** When the live path applies `saveLive` to some nodes successfully and then receives
`false` for a later node, the loop sets `liveFailed = true`, breaks, and falls through to the
`vault.modify` branch. The earlier successful `saveLive` calls have already mutated the live
canvas view (via `setData`) and scheduled a debounced `requestSave` (500 ms, see
`CanvasLiveEditor.debouncedRequestSave`). The fallback then runs `app.vault.read(file)` — which
reads disk, not the live view — recomputes the full rewrite, and calls `app.vault.modify`.

Two observable consequences are possible:

1. `vault.modify` writes the disk-derived (fully rewritten) JSON. ~500 ms later the pending
   `requestSave` from the live view fires and overwrites the file with the live in-memory state,
   which contains the successful `saveLive` edits but NOT the failed-node edits (because
   `saveLive` returned `false` before touching that node on its dedicated `updatedData` copy).
   The file ends up partially rewritten.
2. `vault.modify` triggers Obsidian's own file-change detector while the canvas view is still
   open, which can force the view to reload from disk — whether that happens before or after
   the pending `requestSave` is racy.

**Fix:** Either (a) accumulate live edits into a single `setData` call per canvas instead of
looping `saveLive` per node — a single failure then leaves the live view untouched and the
fallback is clean; or (b) when `liveFailed` occurs, explicitly cancel the pending debounce
timer for that `filePath` on `CanvasLiveEditor` before running the vault.modify path, so the
debounced `requestSave` cannot race the vault write. Approach (a) is preferred because it is
atomic from the view's perspective.

```ts
// Sketch of (a): single batched live write per canvas
const updated: CanvasData = liveEditor.getCanvasDataCopy(file.path);
// ...mutate updated.nodes in place using the same loop...
const ok = await liveEditor.commit(file.path, updated); // one setData + one requestSave
if (ok) { updatedList.push(file.path); continue; }
// else fall through to vault.modify with a clean view
```

### WR-02: `node['id'] as string` is unchecked — a malformed canvas node can silently feed `undefined` into saveLive

**File:** `src/snippets/canvas-ref-sync.ts:82`
**Issue:** The live path collects node edits with
`editsToApply.push({ nodeId: node['id'] as string, edits: nodeEdits })`. There is no guard that
`node['id']` is actually a string. If a snippet node in a canvas has no `id` field or a
non-string `id` (possible for hand-edited/corrupted canvases — remember this whole module is
explicitly best-effort), `saveLive` receives a non-string value and will run
`updatedData.nodes.find(n => n.id === undefined)`, which either returns the first
`id`-less node or returns `undefined`. In the former case the edits are applied to the WRONG
node; in the latter `saveLive` returns `false`, triggering WR-01's fallback semantics.

The parallel disk-path loop does not have this issue because it mutates the `node` object
directly without referencing `id`.

**Fix:**
```ts
const id = node['id'];
if (typeof id !== 'string' || id === '') continue; // skip malformed node
editsToApply.push({ nodeId: id, edits: nodeEdits });
```

### WR-03: Live path is not guarded by the per-file write mutex

**File:** `src/snippets/canvas-ref-sync.ts:54-164`
**Issue:** The module-level `canvasMutex` (line 14) wraps only the `app.vault.modify` branch
(line 154). The new live branch calls `saveLive` outside the mutex. If two `rewriteCanvasRefs`
invocations overlap for the same canvas (e.g. two folder renames fired in quick succession, or
a rename during an open drag-and-drop move), the live saves will interleave on the same view's
`getData()/setData()` cycle. `saveLive` is not internally serialised — each call does an
independent `getData() → mutate → setData()`, so the second call's `getData()` may see the
first call's mutation (good) or a pre-mutation snapshot depending on scheduling (bad, in
principle). Node-level edits to `radiprotocol_subfolderPath` are commutative for this specific
mapping workload, so practical corruption is unlikely, but the asymmetric locking makes the
invariant "one writer per canvas path" depend on callers, not the module.

**Fix:** Wrap each per-file iteration in a single `canvasMutex.runExclusive` that covers both
the live attempt and the vault fallback:
```ts
for (const file of canvasFiles) {
  await canvasMutex.runExclusive(file.path, async () => {
    // live-path attempt, fallback to vault.modify — both inside the lock
  });
}
```
This preserves the existing invariant and extends it to the live path at no behavioural cost.

## Info

### IN-01: Live-path error handling silently drops the file from `skipped`

**File:** `src/snippets/canvas-ref-sync.ts:105-108`
**Issue:** When the live path throws (`JSON.parse` failure on `liveJson`, unexpected type
errors, etc.), the `catch` logs to `console.error` and falls through to the vault.modify path.
If that path later succeeds, the result is consistent. But if `getCanvasJSON` returns malformed
JSON and the subsequent `vault.read` also fails, the file is recorded in `skipped` with a
"read failed" reason that masks the original live-path error. Consider appending the live-path
error to a diagnostics field or using a more specific `reason` prefix for operator debugging.
This is not a correctness issue; the behavioural contract ("best-effort, never throws") is
preserved.

**Fix:** Either drop the `console.error` (it is already logged) or promote the live-path
failure reason into the final `skipped` entry if the subsequent disk path also fails.

### IN-02: Tests use `as any` to cross the editor boundary

**File:** `src/__tests__/canvas-ref-sync.test.ts:332, 364, 398, 436, 470`
**Issue:** `liveEditor.editor as any` is used in all six new tests to bypass the
`CanvasLiveEditor` class type. This works, but a typed local alias (or
`as unknown as CanvasLiveEditor` matching the production call-site style) would keep the tests
from silently drifting if the real signature changes (e.g. a new required method is added to
`CanvasLiveEditor`).

**Fix:** Replace `as any` with `as unknown as CanvasLiveEditor` and import the type at the top
of the test file.

### IN-03: Test "mid-iteration fallback" does not assert on saveLive call count

**File:** `src/__tests__/canvas-ref-sync.test.ts:371-403`
**Issue:** The mid-iteration test asserts `saveLiveSpy` was called ("at least once") and that
`vault.modify` was called once, but it does not verify the intended invariant that `saveLive`
is called exactly twice (once per snippet node) before the fallback triggers. This leaves a
gap: if a future refactor short-circuits the loop on the first `false`, the test would still
pass even though the live path had additional side effects (partial writes, pending debounce
timers) that matter for WR-01.

**Fix:**
```ts
expect(liveEditor.saveLiveSpy).toHaveBeenCalledTimes(2);
expect(liveEditor.saveLiveSpy.mock.calls[0]![1]).toBe('s1');
expect(liveEditor.saveLiveSpy.mock.calls[1]![1]).toBe('s2');
```

### IN-04: Duplicate live-vs-disk node-walking logic

**File:** `src/snippets/canvas-ref-sync.ts:63-84` and `127-150`
**Issue:** The node-walking, `applyMapping`-based rewrite logic appears twice — once to build
`editsToApply` for the live path, once to mutate `parsed.nodes` directly for the disk path.
Any future change to the matching rules (e.g. adding support for a second field, or changing
"text" rewrite semantics) must be kept in sync across both. A shared helper
`computeSnippetEdits(node, mapping): Record<string, unknown> | null` would collapse the two
into one source of truth without changing behaviour.

**Fix:** Extract the per-node decision logic into a private helper and call it from both
branches. Maintainability improvement, not a correctness fix.

---

_Reviewed: 2026-04-17T03:24:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
