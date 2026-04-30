---
phase: 29-snippet-node-model-editor-validator
reviewed: 2026-04-13T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/graph/graph-model.ts
  - src/canvas/node-color-map.ts
  - src/graph/canvas-parser.ts
  - src/graph/graph-validator.ts
  - src/runner/protocol-runner.ts
  - src/views/editor-panel-view.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-04-13
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 29 adds the eighth node kind (`snippet`) across the graph model, parser, validator, color map, runner stub, and editor panel. The type-system integration is correct and exhaustive: `NODE_COLOR_MAP` is typed as `Record<RPNodeKind, string>` so any missing kind causes a compile error, the `nodeLabel()` switch in `graph-validator.ts` is exhaustive, and `advanceThrough()` in `protocol-runner.ts` is guarded by a `default: never` exhaustiveness check. The runner stub correctly halts at-node without corrupting state, and the runner-view `default` branch handles the stub transparently ("Processing..." display).

Two warnings are raised: a missing visited-set in `listSnippetSubfolders` that can produce an infinite BFS on cyclic symlinks, and a `null`-coercion gap in `canvas-parser.ts` that stores an empty string instead of `undefined` when `radiprotocol_subfolderPath` is JSON `null`. Two info items cover UX edge cases with low practical impact.

---

## Warnings

### WR-01: BFS in `listSnippetSubfolders` has no visited set — hangs on cyclic symlinks

**File:** `src/views/editor-panel-view.ts:683-703`

**Issue:** The BFS loop pushes `folder` paths onto `queue` without checking whether the path has already been visited. In a vault that contains symlinked directories forming a cycle (e.g. `.radiprotocol/snippets/a` → `.radiprotocol/snippets/b` → `.radiprotocol/snippets/a`), `vault.adapter.list()` will keep returning the same child folders, the queue will grow without bound, and the async IIFE will never resolve. On Windows (the target platform per the env) NTFS junction points can produce exactly this scenario.

**Fix:** Add a `visited` set and skip already-seen paths:

```typescript
private async listSnippetSubfolders(basePath: string): Promise<string[]> {
  const exists = await this.plugin.app.vault.adapter.exists(basePath);
  if (!exists) return [];

  const results: string[] = [];
  const queue: string[] = [basePath];
  const visited = new Set<string>([basePath]); // WR-01: cycle guard

  while (queue.length > 0) {
    const current = queue.shift()!;
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await this.plugin.app.vault.adapter.list(current);
    } catch {
      continue;
    }

    for (const folder of listing.folders) {
      if (visited.has(folder)) continue; // WR-01: skip already-seen
      visited.add(folder);
      const rel = folder.slice(basePath.length + 1);
      if (rel) results.push(rel);
      queue.push(folder);
    }
  }

  return results;
}
```

---

### WR-02: `canvas-parser.ts` stores `''` (empty string) instead of `undefined` when `radiprotocol_subfolderPath` is JSON `null`

**File:** `src/graph/canvas-parser.ts:265-267`

**Issue:** The guard `props['radiprotocol_subfolderPath'] !== undefined` passes when the canvas JSON contains `"radiprotocol_subfolderPath": null` (null !== undefined). `getString()` then returns its fallback `''`. The resulting `SnippetNode` has `subfolderPath: ''` instead of `subfolderPath: undefined`. The model contract (D-02, D-03) defines absence of `subfolderPath` (i.e. `undefined`) as "root folder". An empty string is an invalid value that Phase 30's runner code will need to handle defensively, or it will pass `''` as a path suffix and produce a malformed path.

Note: the same pattern exists for `displayLabel`, `prefix`, `suffix`, and `snippetId` — this is a pre-existing codebase pattern — but `subfolderPath` is uniquely load-bearing as a path component, making the empty-string case more dangerous than for purely display-level optional fields.

**Fix:** Normalize `null` the same way as `undefined`, or strengthen the guard:

```typescript
case 'snippet': {
  const rawPath = props['radiprotocol_subfolderPath'];
  const node: SnippetNode = {
    ...base,
    kind: 'snippet',
    // Treat null and '' identically to undefined — all mean "root"
    subfolderPath: (typeof rawPath === 'string' && rawPath !== '')
      ? rawPath
      : undefined,
  };
  return node;
}
```

---

## Info

### IN-01: `case 'snippet'` in `runner-view.ts` falls to `default` — renders "Processing..." as the stub UI

**File:** `src/views/runner-view.ts:394-402` (not modified in Phase 29, but directly affected)

**Issue:** When the runner halts at a snippet node, `RunnerView`'s inner `switch (node.kind)` has no `case 'snippet'` branch and falls to `default`, which renders "Processing..." indefinitely. This is the documented Phase 29 stub behavior and is not a regression. However, the Step Back button is rendered (line 405) if the undo stack is non-empty, so the user is not permanently stuck. This will need a `case 'snippet'` branch in Phase 30 when the runner integration lands.

**Fix:** No action needed in Phase 29. Track as a Phase 30 prerequisite.

---

### IN-02: Selecting root in the snippet subfolder dropdown sets canvas node `text` field to empty string

**File:** `src/views/editor-panel-view.ts:603`

**Issue:** When the user selects the root option (`v = ''`), `pendingEdits['text'] = v` stores an empty string. In `saveNodeEdits`, the empty string is not `undefined`, so `node['text'] = ''` is written to the canvas JSON, clearing the node's visible label on the canvas. The D-10 decision explicitly mirrors `subfolderPath` into `text`, so this is intentional per the plan. The practical effect is that a snippet node configured to the root folder will show no label on the canvas, which may be confusing to protocol authors.

**Fix:** Consider using a sentinel display value for the root case, consistent with how D-09 labels the root option in the dropdown:

```typescript
drop.onChange(v => {
  this.pendingEdits['radiprotocol_subfolderPath'] = v || undefined;
  // IN-02: use descriptive label for root rather than empty string
  this.pendingEdits['text'] = v || 'snippet (root)';
  this.scheduleAutoSave();
});
```

This change would need to be evaluated against Phase 30 runner behavior — if Phase 30 reads `text` back into `subfolderPath` on parse, it would introduce a mismatch. Defer to Phase 30 design.

---

_Reviewed: 2026-04-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
