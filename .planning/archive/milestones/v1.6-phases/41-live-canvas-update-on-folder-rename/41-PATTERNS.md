# Phase 41: Live Canvas Update on Folder Rename - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 2 modified, 1 test extended
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/snippets/canvas-ref-sync.ts` | utility | batch-transform | `src/views/editor-panel-view.ts` (Pattern B fork at line 168) | role-match |
| `src/views/snippet-manager-view.ts` | view (call site) | request-response | Same file, existing `rewriteCanvasRefs` calls at lines 945 and 700 | exact |
| `src/__tests__/canvas-ref-sync.test.ts` | test | unit | Same file, existing test structure | exact |

## Pattern Assignments

### `src/snippets/canvas-ref-sync.ts` (utility, batch-transform)

**What changes:** The `rewriteCanvasRefs` function signature gains an optional `CanvasLiveEditor` parameter. For each `.canvas` file, if the live editor is available, use `saveLive()` per-node instead of `vault.modify()` for the whole file.

**Analog: Pattern B/Strategy A fork in `src/views/editor-panel-view.ts`** (lines 168-182)

**Live-first, fallback-to-disk pattern:**
```typescript
// Source: src/views/editor-panel-view.ts lines 168-182
// LIVE-03: Attempt live save via internal Canvas API first (Pattern B).
// If saveLive() returns true, the canvas view owns the write — do not call vault.modify().
try {
  const savedLive = await this.plugin.canvasLiveEditor.saveLive(filePath, nodeId, enrichedEdits);
  if (savedLive) {
    return;
  }
} catch (err) {
  // D-03: requestSave() threw — canvas state has been rolled back by CanvasLiveEditor.
  console.error('[RadiProtocol] saveLive threw — canvas state rolled back:', err);
  new Notice('Save failed — close the canvas and try again.');
  return;
}
// saveLive() returned false: canvas is closed or Pattern B API unavailable.
// Fall through to Strategy A (vault.modify() with canvas closed requirement).
```

**Analog: Existing `rewriteCanvasRefs` node iteration** (lines 70-93 of `canvas-ref-sync.ts`)

**Node matching and field rewrite pattern:**
```typescript
// Source: src/snippets/canvas-ref-sync.ts lines 70-93
let mutated = false;
for (const node of parsed.nodes as Array<Record<string, unknown>>) {
  if (!node || typeof node !== 'object') continue;
  if (node['radiprotocol_nodeType'] !== 'snippet') continue;
  const current = node['radiprotocol_subfolderPath'];
  // WR-02: treat null/empty/missing as "root" — no rewrite possible
  if (typeof current !== 'string' || current === '') continue;

  const rewritten = applyMapping(current, mapping);
  if (rewritten !== null && rewritten !== current) {
    node['radiprotocol_subfolderPath'] = rewritten;
    // Phase 37 gap fix: also update text field so canvas displays new name.
    const currentText = node['text'];
    if (typeof currentText === 'string' && currentText !== '') {
      const rewrittenText = applyMapping(currentText, mapping);
      if (rewrittenText !== null && rewrittenText !== currentText) {
        node['text'] = rewrittenText;
      }
    }
    mutated = true;
  }
}
```

**Analog: `CanvasLiveEditor.isLiveAvailable` and `getCanvasJSON`** (lines 52-68 of `canvas-live-editor.ts`)

**Live availability check pattern:**
```typescript
// Source: src/canvas/canvas-live-editor.ts lines 52-68
isLiveAvailable(filePath: string): boolean {
  return this.getCanvasView(filePath) !== undefined;
}

getCanvasJSON(filePath: string): string | null {
  const view = this.getCanvasView(filePath);
  if (!view) return null;
  return JSON.stringify(view.canvas.getData());
}
```

**Analog: `CanvasLiveEditor.saveLive` signature** (lines 75-79 of `canvas-live-editor.ts`)

**Per-node edit call:**
```typescript
// Source: src/canvas/canvas-live-editor.ts lines 75-79
async saveLive(
  filePath: string,
  nodeId: string,
  edits: Record<string, unknown>
): Promise<boolean>
```

**Import pattern to add** (based on existing imports in `canvas-ref-sync.ts` lines 1-5):
```typescript
// Current imports:
import type { App, TFile } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
// New import to add:
import type { CanvasLiveEditor } from '../canvas/canvas-live-editor';
```

---

### `src/views/snippet-manager-view.ts` (view, call-site update)

**What changes:** Two call sites pass `this.plugin.canvasLiveEditor` as the third argument to `rewriteCanvasRefs`.

**Analog: Same file, existing calls at lines 945 and 700**

**Call site 1 -- commitInlineRename** (line 945):
```typescript
// Source: src/views/snippet-manager-view.ts line 945
// Before:
const result = await rewriteCanvasRefs(this.app, mapping);
// After:
const result = await rewriteCanvasRefs(this.app, mapping, this.plugin.canvasLiveEditor);
```

**Call site 2 -- performMove** (line 700):
```typescript
// Source: src/views/snippet-manager-view.ts line 700
// Before:
const result = await rewriteCanvasRefs(this.app, mapping);
// After:
const result = await rewriteCanvasRefs(this.app, mapping, this.plugin.canvasLiveEditor);
```

---

### `src/__tests__/canvas-ref-sync.test.ts` (test, unit)

**What changes:** Add new test cases for the live path. Existing tests remain unchanged (they don't pass a `CanvasLiveEditor`, so they exercise the fallback `vault.modify()` path).

**Analog: Same file, existing mock structure** (lines 20-51)

**MockApp factory pattern:**
```typescript
// Source: src/__tests__/canvas-ref-sync.test.ts lines 20-51
function makeApp(files: Record<string, string>): MockApp {
  const writes: Record<string, string> = {};
  const workingFiles = { ...files };
  const makeTFile = (p: string) => ({
    path: p,
    extension: p.split('.').pop() ?? '',
    basename: (p.split('/').pop() ?? '').replace(/\.[^.]+$/, ''),
  });
  const readSpy = vi.fn(async (f: { path: string }) => {
    if (!(f.path in workingFiles)) throw new Error('ENOENT: ' + f.path);
    return workingFiles[f.path];
  });
  const modifySpy = vi.fn(async (f: { path: string }, data: string) => {
    writes[f.path] = data;
    workingFiles[f.path] = data;
  });
  return {
    app: {
      vault: {
        getFiles: () => Object.keys(workingFiles).map(makeTFile),
        read: readSpy,
        modify: modifySpy,
        getAbstractFileByPath: (p: string) =>
          p in workingFiles ? makeTFile(p) : null,
      },
    } as unknown as import('obsidian').App,
    writes,
    files: workingFiles,
    readSpy,
    modifySpy,
  };
}
```

**Test assertion pattern** (lines 70-89):
```typescript
// Source: src/__tests__/canvas-ref-sync.test.ts lines 70-89
it('exact-match rename rewrites subfolderPath', async () => {
  const canvasPath = 'protocols/a.canvas';
  const app = makeApp({
    [canvasPath]: loadFixture('snippet-node-multi-a.canvas'),
  });
  const mapping = new Map<string, string>([['a/b', 'a/c']]);

  const result = await rewriteCanvasRefs(app.app, mapping);

  expect(result.updated).toEqual([canvasPath]);
  expect(result.skipped).toEqual([]);
  expect(app.modifySpy).toHaveBeenCalledTimes(1);
  // ... parse writes and assert field values
});
```

**New mock needed: CanvasLiveEditor stub.** Pattern for mock construction based on the interface:
```typescript
// New mock factory for tests (no existing analog -- derive from CanvasLiveEditor public API)
function makeLiveEditor(opts: {
  liveFiles?: Set<string>;                   // files where isLiveAvailable returns true
  canvasData?: Record<string, string>;       // filePath -> JSON string for getCanvasJSON
  saveLiveResult?: boolean;                  // what saveLive returns (default true)
}) {
  const saveLiveSpy = vi.fn(async (_fp: string, _nid: string, _edits: Record<string, unknown>) => {
    return opts.saveLiveResult ?? true;
  });
  return {
    editor: {
      isLiveAvailable: (fp: string) => opts.liveFiles?.has(fp) ?? false,
      getCanvasJSON: (fp: string) => opts.canvasData?.[fp] ?? null,
      saveLive: saveLiveSpy,
    },
    saveLiveSpy,
  };
}
```

## Shared Patterns

### Pattern B Live-First Fork
**Source:** `src/views/editor-panel-view.ts` lines 168-182
**Apply to:** `src/snippets/canvas-ref-sync.ts` (inside the per-file loop)

The established pattern in this codebase: try `saveLive()` first; if it returns `true`, skip `vault.modify()`. If it returns `false`, fall back to disk write. If it throws, log error and skip the file (in `editor-panel-view` it shows a Notice; in `canvas-ref-sync` it should push to `skipped` array for consistency with existing error handling).

### Error Handling in canvas-ref-sync
**Source:** `src/snippets/canvas-ref-sync.ts` lines 108-113
**Apply to:** New live path error handling in same file

```typescript
// Source: src/snippets/canvas-ref-sync.ts lines 108-113
} catch (e) {
  const reason = `read failed: ${(e as Error).message}`;
  console.error('[RadiProtocol] canvas-ref-sync:', file.path, reason);
  skipped.push({ path: file.path, reason });
  continue;
}
```

The live path should follow the same pattern: catch errors from `saveLive()`, push `{ path, reason }` to `skipped`, and `continue` to the next file.

### Mutex Usage
**Source:** `src/snippets/canvas-ref-sync.ts` lines 97-107
**Apply to:** Only the `vault.modify()` fallback path (NOT the live path)

The `canvasMutex.runExclusive()` wrapper is only needed for `vault.modify()`. The live path uses `saveLive()` which operates on in-memory canvas state and doesn't need file-level locking (the debounced `requestSave()` in `CanvasLiveEditor` handles persistence).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have close analogs in the existing codebase |

## Metadata

**Analog search scope:** `src/snippets/`, `src/canvas/`, `src/views/`, `src/__tests__/`
**Files scanned:** 5 source files read in full
**Pattern extraction date:** 2026-04-16
