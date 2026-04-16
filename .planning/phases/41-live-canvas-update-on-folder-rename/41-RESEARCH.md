# Phase 41: Live Canvas Update on Folder Rename - Research

**Researched:** 2026-04-16
**Domain:** Obsidian Canvas internal API (Pattern B), snippet folder rename sync
**Confidence:** HIGH

## Summary

Phase 41 addresses a UX gap: when a user renames a snippet folder in the Snippet Manager, the `rewriteCanvasRefs` utility updates `.canvas` files on disk via `vault.modify()` (Strategy A). If the affected canvas is currently open, the in-memory canvas state becomes stale -- the user sees the old folder name on snippet nodes until they close and reopen the canvas. The fix is to also push the update through `canvasLiveEditor.saveLive()` (Pattern B) for any canvas that is currently open, so the visual node text updates immediately.

The existing `CanvasLiveEditor` class already supports per-node edits via `saveLive(filePath, nodeId, edits)`. The current `rewriteCanvasRefs` iterates all `.canvas` files, parses JSON, rewrites `radiprotocol_subfolderPath` and `text` fields on matching snippet nodes, and writes back via `vault.modify()`. The enhancement needs to: (1) detect if a canvas is currently open with Pattern B available, (2) if yes, push edits through `saveLive()` instead of (or in addition to) `vault.modify()`, (3) if Pattern B is unavailable, fall back to the existing `vault.modify()` path.

**Primary recommendation:** Extend `rewriteCanvasRefs` (or create a wrapper) to accept the `CanvasLiveEditor` instance and use `saveLive()` for open canvases, falling back to `vault.modify()` for closed ones.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Folder rename | Frontend (SnippetManagerView) | -- | User action triggers rename in tree UI |
| Canvas ref rewrite | Plugin logic (canvas-ref-sync.ts) | -- | Vault-wide utility rewrites all .canvas files |
| Live canvas mutation | Plugin logic (CanvasLiveEditor) | -- | Pattern B API bridges to Obsidian internal canvas state |
| Visual node update | Obsidian Canvas View (internal) | -- | `setData()` + `requestSave()` refreshes DOM immediately |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Obsidian Plugin API | 1.7.2+ | Vault I/O, workspace leaf access | Required runtime [VERIFIED: package.json] |
| TypeScript | 5.x | Type safety | Project standard [VERIFIED: codebase] |
| CanvasLiveEditor (internal) | -- | Pattern B live canvas mutations | Already exists in `src/canvas/canvas-live-editor.ts` [VERIFIED: source] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| async-mutex (WriteMutex) | existing | Per-file write serialization | Already used by canvas-ref-sync for vault.modify() [VERIFIED: source] |

No new dependencies needed. This phase reuses existing infrastructure.

## Architecture Patterns

### System Architecture Diagram

```
Folder Rename (SnippetManagerView)
        |
        v
  snippetService.renameFolder()
        |
        v
  rewriteCanvasRefs(app, mapping, canvasLiveEditor?)
        |
        +-- For each .canvas file:
        |     |
        |     +-- Is canvas open with Pattern B? (canvasLiveEditor.isLiveAvailable)
        |     |     |
        |     |     YES --> For each matching snippet node:
        |     |     |         saveLive(filePath, nodeId, { text, radiprotocol_subfolderPath })
        |     |     |
        |     |     NO --> vault.read() -> parse -> mutate -> vault.modify() (existing path)
        |     |
        v
  Return CanvasSyncResult { updated, skipped }
```

### Pattern 1: Hybrid Live/Disk Write in rewriteCanvasRefs
**What:** When a canvas file is open and Pattern B is available, use `saveLive()` per-node instead of `vault.modify()` for the whole file. When closed, keep existing `vault.modify()` path.
**When to use:** Always -- this is the only pattern needed.

Key insight: `saveLive()` operates per-node (takes `nodeId` + `edits`), while `rewriteCanvasRefs` currently operates per-file. For open canvases, we need to iterate the nodes returned by `canvasLiveEditor.getCanvasJSON()` or `view.canvas.getData()` to find matching snippet nodes, then call `saveLive()` for each.

**Approach options:**

**Option A -- Modify `rewriteCanvasRefs` signature** to accept an optional `CanvasLiveEditor`. For each canvas file, check `isLiveAvailable()` first. If live, use `getCanvasJSON()` to parse nodes, find matches, call `saveLive()` per matching node. If not live, use existing `vault.read/modify` path.

**Option B -- Wrapper in call sites** that first tries live path, then calls existing `rewriteCanvasRefs` for non-live canvases. This avoids changing the existing tested utility.

**Recommendation: Option A** -- it keeps the logic centralized. The function already iterates all `.canvas` files; adding a live check per-file is natural. The `CanvasLiveEditor` param is optional so existing test mocks don't break.

### Pattern 2: Multi-Node saveLive Batching
**What:** When multiple snippet nodes in one canvas reference the renamed folder, call `saveLive()` for each node sequentially. The `debouncedRequestSave` (500ms) in `CanvasLiveEditor` coalesces disk writes automatically.
**When to use:** Whenever a canvas has >1 snippet node referencing the same folder.

```typescript
// Source: existing saveLive signature [VERIFIED: canvas-live-editor.ts:75-82]
async saveLive(
  filePath: string,
  nodeId: string,
  edits: Record<string, unknown>
): Promise<boolean>
```

Each `saveLive` call does `getData() -> mutate copy -> setData()`. For N nodes, this is N getData/setData cycles. However, since `getData()` returns a fresh deep copy each time, subsequent calls see the previous mutations (setData already applied them to the canvas). The debounced `requestSave()` fires once at the end. This is safe. [VERIFIED: canvas-live-editor.ts lines 86-132]

### Anti-Patterns to Avoid
- **Calling vault.modify() on an open canvas:** Causes desync between in-memory canvas state and disk. Obsidian's canvas view does not auto-reload from disk. [VERIFIED: Standing Pitfall #1 in STATE.md]
- **Building a separate "live rewrite" function:** Would duplicate the mapping/matching logic already in `rewriteCanvasRefs`. Keep it in one place.
- **Skipping disk write for open canvases entirely:** Pattern B's `requestSave()` handles disk persistence, so `vault.modify()` must NOT also run for the same file -- that would cause a race.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas live mutation | Custom setData wrapper | `CanvasLiveEditor.saveLive()` | Handles rollback, debounced save, PROTECTED_FIELDS [VERIFIED: source] |
| Per-file write lock | Custom locking | `WriteMutex` (existing) | Already proven in canvas-ref-sync [VERIFIED: source] |
| Canvas open detection | Leaf iteration | `CanvasLiveEditor.isLiveAvailable()` | Already probes for Pattern B API [VERIFIED: source] |

## Common Pitfalls

### Pitfall 1: vault.modify() + saveLive() Race on Same File
**What goes wrong:** If both paths execute for the same canvas, `vault.modify()` writes stale data (pre-edit snapshot) to disk, then `requestSave()` writes the live-edited data, or vice versa. Either way, one write wins and the other is lost.
**Why it happens:** The "open" check and the write are not atomic.
**How to avoid:** For each canvas file, choose ONE path: if `isLiveAvailable()` returns true, use only `saveLive()`. If false, use only `vault.modify()`. Never both.
**Warning signs:** Canvas node appears to revert after rename, or disk JSON doesn't match in-memory state.

### Pitfall 2: saveLive() Returns false Mid-Iteration
**What goes wrong:** Canvas is closed between the `isLiveAvailable()` check and the actual `saveLive()` call (user closes canvas tab). `saveLive()` returns false for remaining nodes.
**Why it happens:** Race between user action and async code.
**How to avoid:** If first `saveLive()` returns false, fall back to `vault.modify()` for the entire file. Don't partially apply via live and partially via disk.
**Warning signs:** Some nodes updated, others not.

### Pitfall 3: Node ID Mismatch Between getCanvasJSON and Canvas State
**What goes wrong:** Reading canvas data via `getCanvasJSON()` to find matching nodes, then calling `saveLive()` with those IDs. If the canvas state changed between read and write, IDs might not match.
**Why it happens:** Very unlikely in practice (user renames folder, canvas is passive), but theoretically possible.
**How to avoid:** `saveLive()` already handles "node not found" gracefully (returns false). Treat per-node false as a skip, not an error.

### Pitfall 4: text Field Mapping Must Match subfolderPath Mapping
**What goes wrong:** The `text` field on canvas snippet nodes displays the folder path. If we update `radiprotocol_subfolderPath` but not `text`, or vice versa, the visual display diverges from the logical reference.
**Why it happens:** Forgetting to apply the same mapping to both fields.
**How to avoid:** The existing `rewriteCanvasRefs` already updates both `text` and `radiprotocol_subfolderPath` [VERIFIED: canvas-ref-sync.ts lines 82-90]. The live path must do the same.

## Code Examples

### Current rewriteCanvasRefs Flow (Strategy A only)
```typescript
// Source: src/snippets/canvas-ref-sync.ts [VERIFIED]
// For each canvas file:
const raw = await app.vault.read(file);
const parsed = JSON.parse(raw);
// Mutate matching nodes...
await canvasMutex.runExclusive(file.path, async () => {
  await app.vault.modify(file, JSON.stringify(parsed, null, 2));
});
```

### Proposed Live Path Addition
```typescript
// Pseudocode for the enhanced flow:
// If canvasLiveEditor provided AND canvas is open:
if (liveEditor && liveEditor.isLiveAvailable(file.path)) {
  const json = liveEditor.getCanvasJSON(file.path);
  if (json) {
    const parsed = JSON.parse(json);
    // Find matching snippet nodes, compute edits
    for (const node of matchingNodes) {
      const edits: Record<string, unknown> = {};
      edits['radiprotocol_subfolderPath'] = rewrittenPath;
      edits['text'] = rewrittenText;
      const ok = await liveEditor.saveLive(file.path, node.id, edits);
      if (!ok) {
        // Canvas closed mid-iteration -- fall back to vault.modify for this file
        break;
      }
    }
    // If all succeeded, skip vault.modify -- saveLive handles persistence
    continue;
  }
}
// Existing vault.modify path...
```

### Call Site in SnippetManagerView (commitInlineRename)
```typescript
// Source: src/views/snippet-manager-view.ts:945 [VERIFIED]
// Currently:
const result = await rewriteCanvasRefs(this.app, mapping);
// After Phase 41:
const result = await rewriteCanvasRefs(this.app, mapping, this.plugin.canvasLiveEditor);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| vault.modify() only (Strategy A) | Pattern B saveLive() for open canvas | Phase 17+ | Live updates without canvas close/reopen |
| rewriteCanvasRefs disk-only | Hybrid live+disk rewrite | Phase 41 (this phase) | Canvas nodes update in real-time on folder rename |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Multiple sequential saveLive() calls on different nodes in same canvas are safe (each getData() sees prior setData() mutations) | Architecture Patterns | Could cause node data loss if getData() returns pre-mutation snapshot -- but source code confirms getData() returns fresh copy from live state [LOW RISK] |
| A2 | Canvas snippet nodes store folder name in `text` field | Common Pitfalls | If `text` stores something else, visual update logic would target wrong field -- but verified in canvas-ref-sync.ts:82-90 [VERIFIED, not assumed] |

**All critical claims verified from source code. No user confirmation needed.**

## Open Questions

1. **Should performMove (DnD folder move) also get live update?**
   - What we know: `performMove` at line 700 also calls `rewriteCanvasRefs`. Same problem exists there.
   - What's unclear: Is this in scope for Phase 41?
   - Recommendation: Yes -- both call sites (inline rename AND drag-and-drop move) should benefit. The fix is in `rewriteCanvasRefs` itself, so both callers get it automatically.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest implicit (package.json) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P41-01 | Live canvas update on folder rename when canvas is open | unit | `npm test -- --run src/__tests__/canvas-ref-sync.test.ts` | Exists but needs new tests |
| P41-02 | Fallback to vault.modify when canvas is closed | unit | `npm test -- --run src/__tests__/canvas-ref-sync.test.ts` | Exists but needs new tests |
| P41-03 | Multiple snippet nodes in same canvas all update | unit | `npm test -- --run src/__tests__/canvas-ref-sync.test.ts` | Needs new test |

### Sampling Rate
- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New test cases in `canvas-ref-sync.test.ts` for live path (mock CanvasLiveEditor)
- [ ] Test: live path used when canvas is open, vault.modify skipped
- [ ] Test: fallback to vault.modify when isLiveAvailable returns false
- [ ] Test: graceful fallback if saveLive returns false mid-iteration

## Project Constraints (from CLAUDE.md)

- CSS files are append-only per phase (no CSS changes expected in this phase)
- Never remove existing code not added in this phase
- Shared files: only modify code relevant to Phase 41
- Build with `npm run build` after any changes
- No `innerHTML`, no `require('fs')`, no `console.log` in production
- Use `app.vault.*` exclusively for file I/O

## Sources

### Primary (HIGH confidence)
- `src/canvas/canvas-live-editor.ts` -- full CanvasLiveEditor implementation with saveLive(), isLiveAvailable(), getCanvasJSON()
- `src/snippets/canvas-ref-sync.ts` -- rewriteCanvasRefs implementation, applyMapping logic
- `src/views/snippet-manager-view.ts` -- commitInlineRename (line 923) and performMove (line 673) call sites
- `src/views/editor-panel-view.ts` -- saveNodeEdits Pattern B/Strategy A fork (line 168)
- `src/types/canvas-internal.d.ts` -- CanvasData, CanvasNodeData, CanvasViewInternal types

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` -- Standing Pitfall #1 confirms vault.modify on open canvas is dangerous

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code verified from source
- Architecture: HIGH -- Pattern B already proven in editor-panel-view, just extending to canvas-ref-sync
- Pitfalls: HIGH -- race conditions and dual-write risks are well-understood from prior phases

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable -- Obsidian internal API unlikely to change)
