# Phase 30: Snippet Node — Runner Integration — Research

**Researched:** 2026-04-14
**Domain:** Runner state machine + UI integration for snippet nodes
**Confidence:** HIGH (all facts extracted directly from current source)

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-23)
See `30-CONTEXT.md` — 23 locked decisions covering picker UI (D-01..D-05), runner state machine (D-06..D-10), step-back (D-11..D-12), skip/cancel (D-13..D-14), empty/missing folders (D-15..D-17), SnippetService (D-18..D-21), session persistence (D-22..D-23). This research assumes all D-01..D-23 are locked and not re-litigated.

### Claude's Discretion
- CSS class names (must live in `src/styles/runner-view.css`, append-only, `/* Phase 30: ... */`).
- Breadcrumb presentation (single string vs chips).
- Folder-row vs snippet-row visual distinction.
- `listFolder` location (SnippetService preferred).

### Deferred (OUT OF SCOPE)
- Search/filter in picker.
- Persisting drill-down breadcrumb position across resume.
- Recently-used shortcut row.
- "Skip snippet" affordance.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNIPPET-NODE-03 | Runner presents snippet as selectable list from configured subfolder | `advanceThrough` case 'snippet' replacement + new `awaiting-snippet-pick` render in `runner-view.ts:286 switch` |
| SNIPPET-NODE-04 | User can navigate into subfolders from Runner picker | New `SnippetService.listFolder` + local picker state (no undo) per D-05 |
| SNIPPET-NODE-05 | After picking snippet with placeholders, SnippetFillInModal opens; result appended | Reuse `handleSnippetFill` shape (runner-view.ts:475) — modal unchanged |
| SNIPPET-NODE-06 | No-placeholder snippets skip modal | RunnerView checks `snippet.placeholders.length === 0` and calls `runner.completeSnippet(snippet.template)` directly (D-09) |
| SNIPPET-NODE-07 | Snippet with outgoing edge advances; without edge terminates | Delegated to existing `completeSnippet` → `firstNeighbour` logic (D-10) — no new branching |

---

## Current Code State

### 1. `src/runner/runner-state.ts` — RunnerStatus / RunnerState union

Lines 6-11: current status union (5 members — missing `'awaiting-snippet-pick'`):
```ts
export type RunnerStatus =
  | 'idle'
  | 'at-node'
  | 'awaiting-snippet-fill'
  | 'complete'
  | 'error';
```

Lines 42-48: existing AwaitingSnippetFillState — new AwaitingSnippetPickState will mirror this shape:
```ts
export interface AwaitingSnippetFillState {
  status: 'awaiting-snippet-fill';
  snippetId: string;
  nodeId: string;
  accumulatedText: string;
  canStepBack: boolean;
}
```

Lines 66-71: discriminated union — new interface must be added:
```ts
export type RunnerState =
  | IdleState
  | AtNodeState
  | AwaitingSnippetFillState
  | CompleteState
  | ErrorState;
```

Lines 80-88: `UndoEntry` shape — `pickSnippet` must push identical structure (deep-copy loopContextStack via spread):
```ts
export interface UndoEntry {
  nodeId: string;
  textSnapshot: string;
  loopContextStack: LoopContext[];
}
```

### 2. `src/runner/protocol-runner.ts` — placeholder `case 'snippet'`

Lines 513-518 — the Phase 29 placeholder to be REPLACED (D-07):
```ts
case 'snippet': {
  // Phase 29: snippet node halts here — Runner Integration in Phase 30
  this.currentNodeId = cursor;
  this.runnerStatus = 'at-node';
  return;
}
```

**Replacement target:** set `runnerStatus = 'awaiting-snippet-pick'`, `currentNodeId = cursor`, return. Note: `advanceThrough` NEVER pushes undo (line 416 contract).

Lines 147-158 — `stepBack()` — existing reset of `snippetId`/`snippetNodeId` (D-12 mandates clearing these when stepping back from `'awaiting-snippet-pick'` too — already unconditional in current code, so no change required):
```ts
stepBack(): void {
  const entry = this.undoStack.pop();
  if (entry === undefined) return;

  this.currentNodeId = entry.nodeId;
  this.accumulator.restoreTo(entry.textSnapshot);
  this.loopContextStack = [...entry.loopContextStack];
  this.runnerStatus = 'at-node';
  this.errorMessage = null;
  this.snippetId = null;
  this.snippetNodeId = null;
}
```

Lines 160-187 — `completeSnippet` — reused as-is for the no-placeholder and placeholder paths after `pickSnippet` sets state to `'awaiting-snippet-fill'`:
```ts
completeSnippet(renderedText: string): void {
  if (this.runnerStatus !== 'awaiting-snippet-fill') return;
  if (this.graph === null || this.snippetNodeId === null) return;

  const pendingNodeId = this.snippetNodeId;
  const snippetNode = this.graph.nodes.get(pendingNodeId);
  const snippetSep = (snippetNode?.kind === 'text-block')
    ? this.resolveSeparator(snippetNode)
    : this.defaultSeparator;
  this.accumulator.appendWithSeparator(renderedText, snippetSep);
  this.snippetId = null;
  this.snippetNodeId = null;
  this.runnerStatus = 'at-node';

  const neighbors = this.graph.adjacency.get(pendingNodeId);
  const next = neighbors !== undefined ? neighbors[0] : undefined;
  if (next === undefined) {
    this.transitionToComplete();
    return;
  }
  this.advanceThrough(next);
}
```

**Gotcha:** the `snippetSep` check keys on `kind === 'text-block'`. For snippet nodes the fallback to `this.defaultSeparator` applies. `SnippetNode` has no `radiprotocol_separator` field (graph-model.ts:67-70) — accept the default, do not extend.

`firstNeighbour` already handles outgoing-vs-terminal (line 530) — satisfies SNIPPET-NODE-07 with zero new branching.

Lines 264-306 — `getState()` switch must gain a new case returning the full `AwaitingSnippetPickState`, and the TS `never` check at line 302 will enforce exhaustiveness.

Lines 320-346 — `getSerializableState()` whitelist (line 329):
```ts
if (this.runnerStatus !== 'at-node' && this.runnerStatus !== 'awaiting-snippet-fill') {
  return null;
}
```
**Must extend:** add `this.runnerStatus !== 'awaiting-snippet-pick'` to the guard. Extend return type union:
```ts
runnerStatus: 'at-node' | 'awaiting-snippet-fill';
```
→ add `'awaiting-snippet-pick'`. No new payload fields required (D-22: subfolderPath re-derived from graph at restore via `nodes.get(currentNodeId)`).

Lines 372-395 — `restoreFrom` — widen the `session.runnerStatus` union identically. Assignment `this.runnerStatus = session.runnerStatus` already carries through.

### 3. `src/views/runner-view.ts` — render switch and snippet-fill handler

Line 286: `switch (state.status) { ... }` — all 5 cases + `default: never` at line 461. Must add new `case 'awaiting-snippet-pick':`. Existing cases for reference pattern:

Lines 314-330 — answer-list rendering (template for picker row rendering):
```ts
const answerList = questionZone.createDiv({ cls: 'rp-answer-list' });
const neighborIds = this.graph.adjacency.get(state.currentNodeId) ?? [];
for (const answerId of neighborIds) {
  const answerNode = this.graph.nodes.get(answerId);
  if (answerNode === undefined || answerNode.kind !== 'answer') continue;
  const btn = answerList.createEl('button', {
    cls: 'rp-answer-btn',
    text: answerNode.displayLabel ?? answerNode.answerText,
  });
  this.registerDomEvent(btn, 'click', () => {
    this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
    this.runner.chooseAnswer(answerNode.id);
    void this.autoSaveSession();
    void this.renderAsync();
  });
}
```

Lines 405-415 — step-back button pattern (reuse verbatim inside new picker case):
```ts
if (state.canStepBack) {
  const stepBackBtn = questionZone.createEl('button', {
    cls: 'rp-step-back-btn',
    text: 'Step back',
  });
  this.registerDomEvent(stepBackBtn, 'click', () => {
    this.runner.stepBack();
    void this.autoSaveSession();
    this.render();
  });
}
```

Lines 422-432 — existing `case 'awaiting-snippet-fill'`:
```ts
case 'awaiting-snippet-fill': {
  questionZone.createEl('p', {
    text: 'Loading snippet...',
    cls: 'rp-empty-state-body',
  });
  this.renderPreviewZone(previewZone, state.accumulatedText);
  this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
  void this.handleSnippetFill(state.snippetId, questionZone);
  break;
}
```

Lines 474-498 — `handleSnippetFill` (reused as the post-pick flow with minor changes or as reference for a new `handleSnippetPick` helper):
```ts
private async handleSnippetFill(snippetId: string, questionZone: HTMLElement): Promise<void> {
  const snippet = await this.plugin.snippetService.load(snippetId);
  if (snippet === null) {
    questionZone.empty();
    questionZone.createEl('p', { text: `Snippet '${snippetId}' not found. ...` });
    return;
  }
  const modal = new SnippetFillInModal(this.app, snippet);
  modal.open();
  const rendered = await modal.result;
  if (rendered !== null) {
    this.runner.completeSnippet(rendered);
  } else {
    // D-11: Cancel = skip — advance runner with empty string
    this.runner.completeSnippet('');
  }
  void this.autoSaveSession();
  this.render();
}
```

Line 230 — `handleSelectorSelect` in-progress check — must also treat `'awaiting-snippet-pick'` as needing confirmation (parallel to `'awaiting-snippet-fill'`):
```ts
const needsConfirmation =
  state.status === 'at-node' || state.status === 'awaiting-snippet-fill';
```

Line 461 — TS exhaustiveness never-check: `const _exhaustive: never = state;` — widening the union without a new case here is a compile error. Mandatory insertion point.

### 4. `src/snippets/snippet-service.ts` — existing `list()` pattern for `listFolder`

Lines 29-50 — the pattern to mirror for `listFolder(folderPath)`:
```ts
async list(): Promise<SnippetFile[]> {
  const folderPath = this.settings.snippetFolderPath;
  const folderExists = await this.app.vault.adapter.exists(folderPath);
  if (!folderExists) return [];

  // vault.adapter.list() returns { files, folders }
  const listing = await this.app.vault.adapter.list(folderPath);
  const snippets: SnippetFile[] = [];

  for (const filePath of listing.files) {
    if (!filePath.endsWith('.json')) continue;
    try {
      const raw = await this.app.vault.adapter.read(filePath);
      const parsed = JSON.parse(raw) as SnippetFile;
      snippets.push(parsed);
    } catch {
      // Corrupt file — skip silently
    }
  }
  return snippets;
}
```

Note: `list()` iterates only `listing.files` — it does NOT recurse into `listing.folders`. Therefore today `list()` only sees root-level `.json` files (confirmed — no recursion). `listFolder` must return BOTH direct `.json` files parsed as `SnippetFile[]` AND direct folder names from `listing.folders`.

### 5. `src/views/editor-panel-view.ts` — Phase 29 `listSnippetSubfolders` (listing pattern + cycle guard)

Lines 678-709 — reference implementation showing (a) vault.adapter.list returns full vault-relative paths, (b) cycle-guard via visited Set, (c) relative-path computation via `slice(basePath.length + 1)`:
```ts
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
      continue; // Skip inaccessible directories silently
    }

    for (const folder of listing.folders) {
      if (visited.has(folder)) continue;
      visited.add(folder);
      // vault.adapter.list returns full vault-relative paths
      // (e.g. .radiprotocol/snippets/CT/adrenal)
      const rel = folder.slice(basePath.length + 1);
      if (rel) results.push(rel);
      queue.push(folder);
    }
  }
  return results;
}
```

**Key facts extracted:**
- `vault.adapter.list(path)` returns `{ files: string[], folders: string[] }` with **full vault-relative paths** (e.g. `.radiprotocol/snippets/CT/adrenal`), NOT basenames.
- To get basenames for display: `folder.slice(basePath.length + 1)` relative to the queried folder (single segment when only direct children are needed).
- Cycle guard (visited Set) is mandatory for any recursive/BFS walk — Phase 29 WR-01. For `listFolder` (non-recursive, direct children only) this is not strictly needed, but the path-safety check (D-20) still applies.

### 6. `src/graph/canvas-parser.ts` — SnippetNode parsing

Lines 261-270 (from grep):
```ts
case 'snippet': {
  const rawPath = props['radiprotocol_subfolderPath'];
  const node: SnippetNode = {
    ...base,
    kind: 'snippet',
    // WR-02: treat JSON null and empty string identically to undefined
    subfolderPath: (typeof rawPath === 'string' && rawPath !== '')
      ? rawPath
      : undefined,
  };
}
```
So `SnippetNode.subfolderPath` is either a non-empty string or `undefined`. Picker initial folder per D-02/D-16:
- `subfolderPath` defined → root = `${settings.snippetFolderPath}/${node.subfolderPath}`
- `subfolderPath` undefined → root = `settings.snippetFolderPath`

### 7. `src/snippets/snippet-model.ts` — `SnippetFile`

```ts
export interface SnippetFile {
  id: string;
  name: string;
  template: string;
  placeholders: SnippetPlaceholder[];
}
```
Empty-placeholder detection for D-09: `snippet.placeholders.length === 0`. In that case skip modal and call `runner.completeSnippet(snippet.template)` directly (template contains no `{{...}}` tokens when placeholders is empty — `renderSnippet` would return `template` unchanged anyway).

### 8. `src/graph/graph-model.ts:67-70` — SnippetNode

```ts
export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  subfolderPath?: string;
}
```
No separator field — `completeSnippet` falls through to `defaultSeparator` via the `kind === 'text-block'` check in protocol-runner.ts:171.

### 9. `src/settings.ts` — snippet root

Line 11: `snippetFolderPath: string;`
Line 26: default `'.radiprotocol/snippets'`.
This is the path-safety root for D-20.

---

## Type Signatures

### New types to add

```ts
// runner-state.ts
export type RunnerStatus =
  | 'idle'
  | 'at-node'
  | 'awaiting-snippet-pick'      // NEW — D-06
  | 'awaiting-snippet-fill'
  | 'complete'
  | 'error';

export interface AwaitingSnippetPickState {
  status: 'awaiting-snippet-pick';
  nodeId: string;                 // the snippet node
  subfolderPath: string | undefined;  // re-derived from node at render time
  accumulatedText: string;
  canStepBack: boolean;
}

export type RunnerState =
  | IdleState
  | AtNodeState
  | AwaitingSnippetPickState       // NEW
  | AwaitingSnippetFillState
  | CompleteState
  | ErrorState;
```

### New method signatures

```ts
// protocol-runner.ts
pickSnippet(snippetId: string): void;
// Guard: only valid in 'awaiting-snippet-pick'.
// Body order: (1) push UndoEntry from current state; (2) this.snippetId = snippetId;
// (3) this.snippetNodeId = this.currentNodeId; (4) this.runnerStatus = 'awaiting-snippet-fill'.
// Does NOT append text, does NOT advance — completeSnippet does both.

// snippet-service.ts
async listFolder(folderPath: string): Promise<{ folders: string[]; snippets: SnippetFile[] }>;
// folderPath convention: full vault-relative path (D-19).
// MUST validate resolved path is inside settings.snippetFolderPath (D-20).
// Returns direct children only — folder basenames and parsed SnippetFile objects.
// Corrupt .json files skipped silently (mirrors list()).
// Missing folder → returns { folders: [], snippets: [] } — no throw.
```

### Extended `getSerializableState` / `restoreFrom` return/param

```ts
runnerStatus: 'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill';
```
No new fields. `currentNodeId` carries the snippet node id; picker re-derives `subfolderPath` from the graph.

### vault.adapter.list return shape

```ts
{ files: string[]; folders: string[] }  // both arrays contain full vault-relative paths
```

---

## Patterns to Mirror

### Pattern A: Undo-before-mutate (Phase 2 Pitfall 1)

`chooseAnswer` lines 83-88 — the canonical shape `pickSnippet` must copy:
```ts
this.undoStack.push({
  nodeId: this.currentNodeId,
  textSnapshot: this.accumulator.snapshot(),
  loopContextStack: [...this.loopContextStack],   // spread — not live ref
});
```
Spread of `loopContextStack` is MANDATORY (LOOP-05). Apply this before touching `runnerStatus`, `snippetId`, or `snippetNodeId`.

### Pattern B: autoSave after every mutation

Every click handler in runner-view.ts that mutates runner state calls `void this.autoSaveSession()` (e.g. line 327, 344, 382, 412). New picker click handlers MUST follow suit. Step-back branch already calls it (line 412).

### Pattern C: getSerializableState whitelist

Lines 329-330 show the canonical guard pattern — copy verbatim and extend:
```ts
if (this.runnerStatus !== 'at-node'
    && this.runnerStatus !== 'awaiting-snippet-fill'
    && this.runnerStatus !== 'awaiting-snippet-pick') {
  return null;
}
```

### Pattern D: restoreFrom union widening

Lines 372-381 — only the type union on `session.runnerStatus` changes; the body assignment `this.runnerStatus = session.runnerStatus` already flows through. No new field handling.

### Pattern E: async render helper pattern

Lines 474-498 `handleSnippetFill` — kicked off via `void this.handleSnippetFill(state.snippetId, questionZone)` from inside the switch case. Same shape applies for `void this.handleSnippetPickerRender(state, questionZone)` — load folder listing async, then populate DOM once resolved.

### Pattern F: exhaustiveness check

Lines 459-464 in `render()` and lines 300-305 in `getState()` both have `const _exhaustive: never = ...`. Adding a new RunnerStatus WILL cause TS errors there until a new case is added — the compiler is the enforcement.

### Pattern G: handleSelectorSelect in-progress widening

Line 231: extend to include `'awaiting-snippet-pick'` as a confirmation-requiring status, so switching canvases mid-pick prompts the user.

---

## listFolder Implementation Notes

### Return shape (D-18)
```ts
{ folders: string[]; snippets: SnippetFile[] }
```
- `folders`: **basenames only** (strip `folderPath + '/'` prefix) — picker displays them as-is.
- `snippets`: fully-parsed `SnippetFile` objects (parse every direct-child `.json`). Corrupt JSON skipped silently.

### Path-safety (D-20, T-30-01)
Standard vault-relative path-traversal defense:

1. Strip leading `/` from `folderPath`.
2. Split on `/`, filter out `.` and `..` segments, and any empty segments.
3. Re-join; this is the normalized path.
4. Assert `normalized === settings.snippetFolderPath || normalized.startsWith(settings.snippetFolderPath + '/')`.
5. On failure return `{ folders: [], snippets: [] }` (silent reject).

Threat: a `.canvas` file authored maliciously or typoed could set `radiprotocol_subfolderPath` to `../../etc` — the runner would otherwise list arbitrary vault folders. ASVS V5 applicable control.

### Direct children only (D-18)
Unlike Phase 29 `listSnippetSubfolders` which BFS-recurses, `listFolder` is one-level: single `vault.adapter.list(folderPath)` call, no queue, no visited Set needed (D-05: drill-down is per-click, state lives in picker UI not in the service).

### Missing folder
`vault.adapter.exists(folderPath)` → false → return `{ folders: [], folders: [], snippets: [] }` (empty). D-15: missing subfolder is VALID, no error transition.

### Empty folder (D-17)
`exists === true` but `listing.files` has no `.json` and `listing.folders` is empty → return empty arrays. Picker renders empty state.

### Sort order (D-03)
`listFolder` returns unsorted — sorting is presentation (picker responsibility). Or sort inside service: folders alphabetical, snippets alphabetical. Either works; CONTEXT.md says "Picker renders folders first (alphabetical), then snippets (alphabetical)" — safest to sort inside service to keep picker dumb.

### Composition convention (D-19)
Caller must compose: `folderPath = node.subfolderPath ? ${settings.snippetFolderPath}/${node.subfolderPath} : settings.snippetFolderPath`. Do not accept relative fragments in `listFolder` itself.

---

## Existing Tests

**Files touching runner snippet handling:**

1. `src/__tests__/runner/protocol-runner.test.ts` — contains `describe('awaiting-snippet-fill state (RUN-08, D-06, D-07)', ...)` block (lines 229+). Existing assertions:
   - Line 230: "transitions to awaiting-snippet-fill when reaching a text-block with snippetId"
   - Line 244: "completeSnippet advances to the next node after snippet fill"
   - Line 435: separator joining test via `snippet-block.canvas` fixture

2. `src/__tests__/runner/protocol-runner-session.test.ts` — tests `getSerializableState` / `restoreFrom`. Uses real `CanvasParser` + fixture files (`linear.canvas`). Pattern: load fixture via `loadGraph()`, drive runner, assert on `getState()`.

3. `src/__tests__/snippet-service.test.ts` — presence tests only (line 25-49): asserts `typeof svc.list === 'function'` etc. Uses mocked vault adapter:
   ```ts
   function makeVaultMock(existsResult = false) {
     return {
       adapter: {
         exists: vi.fn().mockResolvedValue(existsResult),
         read: vi.fn().mockResolvedValue('{}'),
         write: vi.fn().mockResolvedValue(undefined),
       },
       ...
     };
   }
   ```
   New `listFolder` tests should extend this mock with `list: vi.fn().mockResolvedValue({ files: [...], folders: [...] })`.

4. `src/__tests__/RunnerView.test.ts` — exists but NO matches for 'snippet' (grep confirmed). Phase 30 picker rendering is currently untested at the view layer; Phase 30 may need to add RunnerView-level tests if feasible, or rely on runner-state tests + manual UAT.

5. `src/__tests__/fixtures/snippet-node.canvas` — Phase 29 fixture for a `snippet` node already exists. Can be reused or extended for Phase 30 runner traversal tests.

**Test harness pattern:**
- Unit tests for protocol-runner live under `src/__tests__/runner/` and parse real `.canvas` fixtures via `CanvasParser`.
- Service tests mock vault adapter with `vi.fn().mockResolvedValue(...)`.
- No existing test loads SnippetService via the real App — all mocked.

**Missing fixture:** none of the existing fixtures has a `snippet` node with outgoing edge AND another fixture with a `snippet` node as terminal. Both will be needed for SNIPPET-NODE-07 coverage. Model after `snippet-node.canvas` (Phase 29).

---

## Threat Surface

| Threat ID | Description | STRIDE | Mitigation (locked) |
|-----------|-------------|--------|---------------------|
| T-30-01 | Malicious or typoed `radiprotocol_subfolderPath` escapes snippet root via `../` traversal → runner lists arbitrary vault folders | Tampering / Information Disclosure | D-20: `listFolder` normalizes path and rejects anything outside `settings.snippetFolderPath` |
| T-30-02 | Serialization schema skew: new `awaiting-snippet-pick` sessions written by new version, read by old version → silent no-op or crash | Tampering | Extend `runnerStatus` union in both `getSerializableState` and `restoreFrom` — TS compiler enforces. PersistedSession `version: 1` unchanged; acceptable since only status strings differ |
| T-30-03 | Undo desync: `pickSnippet` mutates state before pushing UndoEntry → step-back reverts to wrong node or loses text | Tampering (logical) | Pattern A (undo-before-mutate) — mirror `chooseAnswer` exactly. Enforced by VALIDATION tests |
| T-30-04 | Race between `render()` repainting picker and in-flight `listFolder` promise: user clicks old DOM after folder changed | Logical correctness | Render "Loading..." placeholder first; only populate DOM when promise resolves; drop stale results if `runner.getState().status` has changed by resolution time (check inside the async fn before mutating DOM) |
| T-30-05 | SnippetFillInModal double-resolve if user picks a snippet while a previous modal is still open | Tampering | Existing `safeResolve` guard in SnippetFillInModal (line 76-81) already defends. No new work |
| T-30-06 | Corrupt `.json` file in subfolder crashes `listFolder` | Availability | Wrap per-file parse in try/catch, skip silently — mirror `list()` lines 40-46 |
| T-30-07 | Step-back from `'awaiting-snippet-pick'` fails to clear `snippetId`/`snippetNodeId` — subsequent state appears polluted | Logical correctness | Existing `stepBack` already unconditionally resets both (lines 156-157); no change. Add regression test |
| T-30-08 | Terminal snippet node (no outgoing edge) hits `completeSnippet` → `firstNeighbour` returns `undefined` → transitionToComplete — verify this works when `pendingNodeId` points at a `snippet` (not `text-block`) node | Logical | Exists by construction: `neighbors = adjacency.get(pendingNodeId)` works for any node kind. Covered by SNIPPET-NODE-07 test |

**ASVS mapping:**
- V5 Input Validation → T-30-01 (path traversal)
- V5 → T-30-06 (corrupt JSON)
- No V2/V3/V4/V6 surface (no auth, no crypto, no access control in local plugin scope)

---

## Validation Architecture (Nyquist)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (confirmed `package.json` scripts, existing `src/__tests__/`) |
| Config | `vitest` entry in repo root |
| Quick run | `npm test -- src/__tests__/runner/protocol-runner.test.ts` |
| Full suite | `npm test` |
| Phase gate | Full suite green before `/gsd-verify-work` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Command | File Exists? |
|-----|----------|-----------|---------|-------------|
| SNIPPET-NODE-03 | Runner halts at snippet node in `'awaiting-snippet-pick'` status | unit (runner) | `npm test -- protocol-runner.test.ts -t "awaiting-snippet-pick"` | ❌ Wave 0 — extend `snippet-node.canvas` fixture |
| SNIPPET-NODE-04 | listFolder returns direct children (folders + snippets) | unit (service) | `npm test -- snippet-service.test.ts -t listFolder` | ❌ Wave 0 |
| SNIPPET-NODE-04 | listFolder rejects path traversal (`..`, outside root) | unit (service) | `npm test -- snippet-service.test.ts -t "path safety"` | ❌ Wave 0 |
| SNIPPET-NODE-05 | After pickSnippet with placeholders, runner is in `'awaiting-snippet-fill'` with correct snippetId + nodeId | unit (runner) | `npm test -- protocol-runner.test.ts -t "pickSnippet"` | ❌ Wave 0 |
| SNIPPET-NODE-05 | pickSnippet pushes UndoEntry BEFORE mutation (stepBack reverts to at-node at snippet node's predecessor) | unit (runner) | `npm test -- protocol-runner.test.ts -t "pickSnippet undo"` | ❌ Wave 0 |
| SNIPPET-NODE-06 | Snippet with empty placeholders: RunnerView calls completeSnippet(template) without opening modal | integration (view, mocked) or manual UAT | `npm test -- RunnerView.test.ts -t "no-placeholder snippet"` — or UAT | ❌ Wave 0 (view-level) |
| SNIPPET-NODE-07 | Snippet with outgoing edge advances to next node after completeSnippet | unit (runner) | `npm test -- protocol-runner.test.ts -t "snippet terminal"` | ❌ Wave 0 |
| SNIPPET-NODE-07 | Terminal snippet (no outgoing edge) transitions to `'complete'` | unit (runner) | `npm test -- protocol-runner.test.ts -t "snippet terminal"` | ❌ Wave 0 |
| D-15/D-16/D-17 | listFolder empty/missing/root fallback all yield `{folders:[],snippets:[]}` | unit (service) | `npm test -- snippet-service.test.ts -t "listFolder empty"` | ❌ Wave 0 |
| D-22 | `getSerializableState` includes `'awaiting-snippet-pick'`; `restoreFrom` round-trips | unit (runner-session) | `npm test -- protocol-runner-session.test.ts -t "awaiting-snippet-pick"` | ❌ Wave 0 |
| D-11 | stepBack from `'awaiting-snippet-pick'` reverts to prior at-node, clears snippet fields | unit (runner) | `npm test -- protocol-runner.test.ts -t "stepBack from pick"` | ❌ Wave 0 |
| D-14 | SnippetFillInModal cancel → `completeSnippet('')` advances normally (covered by Phase 5 existing test) | unit (existing) | already green | ✅ |

### Sampling Rate
- **Per task commit:** `npm test -- src/__tests__/runner/protocol-runner.test.ts src/__tests__/snippet-service.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green.

### Wave 0 Gaps
- [ ] Extend `src/__tests__/runner/protocol-runner.test.ts` with `describe('awaiting-snippet-pick state')` block covering pickSnippet, undo-before-mutate, stepBack clearing.
- [ ] Extend `src/__tests__/runner/protocol-runner-session.test.ts` with serialize/restore tests for the new status.
- [ ] Extend `src/__tests__/snippet-service.test.ts` with listFolder unit tests (empty, missing, with-files, with-folders, path-traversal rejection, corrupt-json-skipped).
- [ ] New fixture: `src/__tests__/fixtures/snippet-node-with-exit.canvas` (start → snippet → text-block) and `snippet-node-terminal.canvas` (start → snippet, no outgoing) — or extend existing `snippet-node.canvas`.
- [ ] Optional: `src/__tests__/RunnerView.test.ts` — add a picker-rendering test using the existing Obsidian mock infra if it exists; otherwise defer to UAT.

### Observability Hooks
- `console.error('[RadiProtocol] listFolder rejected unsafe path:', folderPath)` on path-traversal reject (T-30-01 audit trail).
- No new log needed for state transitions — existing `autoSaveSession` persistence serves as implicit audit.

### Mocks
- `vault.adapter.list` → `vi.fn().mockResolvedValue({ files: [...], folders: [...] })` — reuse existing pattern from `snippet-service.test.ts:4-17`.
- `vault.adapter.exists` → `vi.fn().mockResolvedValue(true/false)`.
- `vault.adapter.read` → per-path response (one per `.json` fixture).
- `SnippetService.listFolder` in RunnerView tests → `vi.fn().mockResolvedValue({ folders: [...], snippets: [...] })`.
- `SnippetFillInModal` in RunnerView tests → stub with a pre-resolved `result` promise (no Obsidian Modal runtime).

---

## Project Constraints (from CLAUDE.md)

- CSS changes MUST land in `src/styles/runner-view.css` (the only runner CSS file). Append-only, with `/* Phase 30: ... */` comment block. Never edit `styles.css` at repo root.
- Run `npm run build` after any CSS edit to regenerate `styles.css`.
- NEVER delete existing code in `src/styles/runner-view.css`, `src/main.ts`, or `src/views/editor-panel-view.ts`. Only add Phase 30 code; leave prior-phase rules/functions untouched.
- `src/views/runner-view.ts` is likewise accumulated — touch only the switch/new-case insertion points and the `needsConfirmation` check at line 231.

## Assumptions Log

| # | Claim | Section | Risk |
|---|-------|---------|------|
| A1 | Vitest is the test runner (inferred from existing `src/__tests__/*.test.ts` + project layout) | Validation Architecture | LOW — confirmed by existing test files using `vi`, `describe`, `it` imports |
| A2 | `npm test` runs the full vitest suite | Validation Architecture | LOW — standard convention; planner should verify `package.json` |
| A3 | No existing RunnerView view-layer test for snippet rendering paths — grep returned zero matches | Existing Tests | LOW — explicitly grepped |

All other claims are [VERIFIED: direct file read].

## Sources

### Primary (HIGH)
- `src/runner/runner-state.ts` (full read)
- `src/runner/protocol-runner.ts` (full read — lines 1-556)
- `src/views/runner-view.ts` (full read — lines 1-638)
- `src/snippets/snippet-service.ts` (full read)
- `src/snippets/snippet-model.ts` (full read)
- `src/views/snippet-fill-in-modal.ts` (full read)
- `src/views/editor-panel-view.ts` (full read — Phase 29 `listSnippetSubfolders` lines 678-709)
- `src/graph/graph-model.ts` (full read)
- `src/graph/canvas-parser.ts` (grep — lines 259-270)
- `src/settings.ts` (grep — lines 11, 26)
- `.planning/phases/30-snippet-node-runner-integration/30-CONTEXT.md` (full read)
- `.planning/REQUIREMENTS.md` (full read)
- `CLAUDE.md` (full read)
- Existing test files: `src/__tests__/runner/protocol-runner.test.ts`, `protocol-runner-session.test.ts`, `snippet-service.test.ts`, `RunnerView.test.ts` (grepped for snippet)

---

## RESEARCH COMPLETE
