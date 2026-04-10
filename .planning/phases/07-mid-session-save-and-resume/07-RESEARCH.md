# Phase 7: Mid-Session Save and Resume — Research

**Researched:** 2026-04-07
**Domain:** TypeScript serialization, Obsidian Vault API (mtime, adapter.stat), session persistence, resume UX modal pattern
**Confidence:** HIGH (all key findings verified directly from codebase and Obsidian type definitions)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESSION-01 | `SessionService` auto-saves a `PersistedSession` JSON file in `.radiprotocol/sessions/` after every step | `SessionService` stub exists in `src/sessions/session-service.ts`; pattern matches `SnippetService` exactly |
| SESSION-02 | On protocol launch, check for existing incomplete session and offer to resume | Hook point is `RunnerView.openCanvas()` — called when protocol launches; modal pattern confirmed by `SnippetFillInModal` |
| SESSION-03 | Validate all saved node IDs still exist in current canvas graph before restoring | `ProtocolGraph.nodes` is a `Map<string, RPNode>` — O(1) `.has()` per node ID |
| SESSION-04 | Check canvas file `mtime` against saved timestamp; warn if modified | `TFile.stat.mtime` is a Unix ms timestamp in `FileStats` — confirmed from `obsidian.d.ts` |
| SESSION-05 | Snippet content snapshotted at save time (not referenced by ID) | Snapshot the rendered text already in `accumulatedText`; `awaiting-snippet-fill` requires special handling |
| SESSION-06 | Graceful degradation — "Start fresh" or "Try to resume with warning" choices on validation failure | Two-button modal pattern; SESSION-03/04 produce distinct failure messages |
| SESSION-07 | `Array` serialization for any `Set` values in session state | Audit result: **no `Set` fields exist in runner state** — `ProtocolGraph` uses `Map`, runner uses arrays and strings |
</phase_requirements>

---

## Summary

Phase 7 adds session persistence layered on top of the fully-implemented Phase 6 runner. The runner state machine (`ProtocolRunner`) holds all session state as ordinary TypeScript primitives and arrays — no `Set` values are present anywhere in the runner's internal fields. This means SESSION-07's `Set`-to-`Array` conversion, while required by spec, has **no actual conversion work** in the current runner: the requirement is satisfied trivially by verifying no `Set` leaks into the JSON payload.

The state to serialize is small and flat. The `ProtocolRunner` internal state consists of: `currentNodeId` (string), `accumulatedText` (string via `TextAccumulator.current`), `undoStack` (`UndoEntry[]`), `loopContextStack` (`LoopContext[]`), `runnerStatus` (string discriminant), `snippetId` (string|null), and `snippetNodeId` (string|null). Every field is a JSON-native type. `UndoEntry` contains `nodeId` (string), `textSnapshot` (string), and `loopContextStack` (`LoopContext[]`). `LoopContext` contains three fields: `loopStartId` (string), `iteration` (number), `textBeforeLoop` (string). All are primitives.

The implementation has three distinct layers: (1) `SessionService` — a pure module mirroring `SnippetService` with `save/load/clear/validate` using `WriteMutex` and `ensureFolderPath`; (2) `ProtocolRunner` extensions — a `restoreFrom(session)` method and a `getSerializableState()` method to extract everything needed without exposing private fields; (3) `RunnerView` integration — calling `SessionService.save()` after every user action (`chooseAnswer`, `enterFreeText`, `chooseLoopAction`, `completeSnippet`) and checking for existing sessions at `openCanvas()` time.

The resume UX follows the same promise-based modal pattern as `SnippetFillInModal`. A `ResumeSessionModal` extends `Modal` and resolves `Promise<'resume' | 'start-over'>`. The `awaiting-snippet-fill` state is the one edge case: if the session was saved while the runner was waiting for a snippet, the session file captures that state but resume must re-open the snippet modal — the rendered text was not yet appended, so the session cannot store a "completed" snapshot for that step.

**Primary recommendation:** Implement `SessionService` first as a pure module (unit-testable), then add `getSerializableState()` / `restoreFrom()` to `ProtocolRunner`, then wire `RunnerView`. Test the serialization round-trip and `restoreFrom()` with Vitest before writing any UI code.

---

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.2 | Primary language | [VERIFIED: package.json] |
| async-mutex | ^0.5.0 | `WriteMutex` for session file writes | [VERIFIED: package.json — already used by SnippetService] |
| obsidian | 1.12.3 | `Modal`, `TFile.stat.mtime`, `vault.adapter` | [VERIFIED: package.json and obsidian.d.ts] |
| Vitest | ^4.1.2 | Unit tests for pure engine modules | [VERIFIED: package.json] |

**No new npm packages are required for Phase 7.** [VERIFIED: codebase inspection — session service mirrors snippet service pattern; no new serialization libraries needed]

**Installation:** Nothing to install.

---

## Architecture Patterns

### Recommended Project Structure (no new top-level directories)
```
src/
├── sessions/
│   └── session-service.ts     # Phase 7: implement from stub
├── runner/
│   ├── protocol-runner.ts     # Add getSerializableState() and restoreFrom()
│   └── runner-state.ts        # No changes needed
├── views/
│   ├── runner-view.ts         # Wire save-on-step and resume prompt
│   └── resume-session-modal.ts  # NEW: two-button resume/start-over modal
└── __tests__/
    └── session-service.test.ts  # NEW: pure unit tests
```

### Pattern 1: PersistedSession JSON Shape

The canonical shape for the session file. All fields are JSON-native — no conversion needed.

```typescript
// Source: derived from ProtocolRunner private fields [VERIFIED: src/runner/protocol-runner.ts lines 27-38]
export interface PersistedSession {
  /** Schema version — increment if shape changes to allow migration */
  version: 1;
  /** Vault-relative path of the canvas file this session belongs to */
  canvasFilePath: string;
  /** Unix ms timestamp from TFile.stat.mtime at the time the session was saved */
  canvasMtimeAtSave: number;
  /** Unix ms timestamp when this session file was last written */
  savedAt: number;
  /** Runner status at save time — 'at-node' or 'awaiting-snippet-fill' only (never idle/complete/error) */
  runnerStatus: 'at-node' | 'awaiting-snippet-fill';
  /** currentNodeId from the runner */
  currentNodeId: string;
  /** accumulatedText at time of save */
  accumulatedText: string;
  /** Full undo stack — each entry is already JSON-serializable */
  undoStack: PersistedUndoEntry[];
  /** Full loop context stack at time of save */
  loopContextStack: PersistedLoopContext[];
  /** snippetId if status is 'awaiting-snippet-fill', otherwise null */
  snippetId: string | null;
  /** snippetNodeId if status is 'awaiting-snippet-fill', otherwise null */
  snippetNodeId: string | null;
}

export interface PersistedUndoEntry {
  nodeId: string;
  textSnapshot: string;
  loopContextStack: PersistedLoopContext[];
}

export interface PersistedLoopContext {
  loopStartId: string;
  iteration: number;
  textBeforeLoop: string;
}
```

These interfaces are identical in shape to the runtime types (`UndoEntry`, `LoopContext`) — they are defined separately in `sessions/session-service.ts` to make the serialization boundary explicit and to keep `sessions/` independent of `runner/` types.

### Pattern 2: SessionService — Mirror of SnippetService

```typescript
// Source: mirrors src/snippets/snippet-service.ts [VERIFIED: lines 14-120]
// sessions/session-service.ts
import type { App } from 'obsidian';
import { WriteMutex } from '../utils/write-mutex';
import { ensureFolderPath } from '../utils/vault-utils';
import type { PersistedSession } from './session-model';

export class SessionService {
  private readonly app: App;
  private readonly sessionFolderPath: string; // '.radiprotocol/sessions'
  private readonly mutex = new WriteMutex();

  constructor(app: App, sessionFolderPath: string) {
    this.app = app;
    this.sessionFolderPath = sessionFolderPath;
  }

  /** Derive session file path from canvas file path — one session file per canvas */
  private sessionFilePath(canvasFilePath: string): string {
    // Replace slashes and dots with dashes to flatten to a single filename
    // e.g., 'protocols/chest.canvas' → '.radiprotocol/sessions/protocols-chest-canvas.json'
    const slug = canvasFilePath.replace(/[\\/]/g, '-').replace(/\./g, '-');
    return `${this.sessionFolderPath}/${slug}.json`;
  }

  /** Save a session. Idempotent — overwrites any existing file for this canvas. */
  async save(session: PersistedSession): Promise<void> {
    const path = this.sessionFilePath(session.canvasFilePath);
    const payload = JSON.stringify(session, null, 2);
    await this.mutex.runExclusive(path, async () => {
      await ensureFolderPath(this.app.vault, this.sessionFolderPath);
      const exists = await this.app.vault.adapter.exists(path);
      if (exists) {
        await this.app.vault.adapter.write(path, payload);
      } else {
        await this.app.vault.create(path, payload);
      }
    });
  }

  /** Load a session for the given canvas path. Returns null if none exists or JSON is invalid. */
  async load(canvasFilePath: string): Promise<PersistedSession | null> {
    const path = this.sessionFilePath(canvasFilePath);
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) return null;
    try {
      const raw = await this.app.vault.adapter.read(path);
      const parsed = JSON.parse(raw) as PersistedSession;
      // Validate minimum required fields to detect truncated/corrupt JSON
      if (typeof parsed.version !== 'number' || typeof parsed.canvasFilePath !== 'string') {
        return null;
      }
      return parsed;
    } catch {
      // JSON.parse failure — corrupt or merged file (sync conflict)
      return null;
    }
  }

  /** Delete session file for the given canvas path. No-op if it does not exist. */
  async clear(canvasFilePath: string): Promise<void> {
    const path = this.sessionFilePath(canvasFilePath);
    const exists = await this.app.vault.adapter.exists(path);
    if (!exists) return;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file !== null) {
      await this.app.vault.delete(file as import('obsidian').TFile);
    }
  }

  /** Check if an incomplete session exists for the given canvas path. */
  async hasSession(canvasFilePath: string): Promise<boolean> {
    const path = this.sessionFilePath(canvasFilePath);
    return this.app.vault.adapter.exists(path);
  }
}
```

### Pattern 3: ProtocolRunner Extensions

Two new public methods added to `ProtocolRunner`. Both are pure (no Obsidian API calls).

```typescript
// Source: inferred from ProtocolRunner private fields [VERIFIED: src/runner/protocol-runner.ts lines 27-38]

/** Extract serializable snapshot of runner state (called by SessionService.save). */
getSerializableState(): {
  runnerStatus: 'at-node' | 'awaiting-snippet-fill';
  currentNodeId: string;
  accumulatedText: string;
  undoStack: UndoEntry[];
  loopContextStack: LoopContext[];
  snippetId: string | null;
  snippetNodeId: string | null;
} | null {
  // Only serialize saveable states; complete/error/idle are not resumed
  if (this.runnerStatus !== 'at-node' && this.runnerStatus !== 'awaiting-snippet-fill') {
    return null;
  }
  return {
    runnerStatus: this.runnerStatus,
    currentNodeId: this.currentNodeId ?? '',
    accumulatedText: this.accumulator.current,
    undoStack: this.undoStack.map(e => ({ ...e, loopContextStack: [...e.loopContextStack] })),
    loopContextStack: [...this.loopContextStack],
    snippetId: this.snippetId,
    snippetNodeId: this.snippetNodeId,
  };
}

/** Restore runner from a persisted session (called after resume validation passes). */
restoreFrom(session: {
  runnerStatus: 'at-node' | 'awaiting-snippet-fill';
  currentNodeId: string;
  accumulatedText: string;
  undoStack: UndoEntry[];
  loopContextStack: LoopContext[];
  snippetId: string | null;
  snippetNodeId: string | null;
}): void {
  this.runnerStatus = session.runnerStatus;
  this.currentNodeId = session.currentNodeId;
  this.accumulator.restoreTo(session.accumulatedText);
  this.undoStack = session.undoStack.map(e => ({ ...e, loopContextStack: [...e.loopContextStack] }));
  this.loopContextStack = [...session.loopContextStack];
  this.snippetId = session.snippetId;
  this.snippetNodeId = session.snippetNodeId;
  // errorMessage is always null after a valid restore
  this.errorMessage = null;
}
```

Note: `restoreFrom()` does NOT call `start()`. It directly sets the private fields. The `graph` field must already be set before `restoreFrom()` is called — `RunnerView` sets it when it parses the canvas file.

### Pattern 4: ResumeSessionModal

```typescript
// Source: mirrors SnippetFillInModal promise pattern [VERIFIED: src/views/snippet-fill-in-modal.ts lines 23-43]
// views/resume-session-modal.ts
import { Modal, App } from 'obsidian';

export type ResumeChoice = 'resume' | 'start-over';

export class ResumeSessionModal extends Modal {
  private resolve!: (choice: ResumeChoice) => void;
  private resolved = false;
  readonly result: Promise<ResumeChoice>;

  constructor(
    app: App,
    private readonly warningLines: string[],  // empty = no warnings, just resume offer
  ) {
    super(app);
    this.result = new Promise<ResumeChoice>(res => { this.resolve = res; });
  }

  onOpen(): void {
    this.titleEl.setText('Resume session?');
    // Render warning lines if any
    for (const line of this.warningLines) {
      this.contentEl.createEl('p', { text: line, cls: 'rp-session-warning' });
    }
    const btnRow = this.contentEl.createDiv({ cls: 'rp-session-btn-row' });
    const resumeBtn = btnRow.createEl('button', { text: 'Resume session', cls: 'mod-cta' });
    const startOverBtn = btnRow.createEl('button', { text: 'Start over' });
    resumeBtn.addEventListener('click', () => { this.settle('resume'); });
    startOverBtn.addEventListener('click', () => { this.settle('start-over'); });
  }

  onClose(): void { this.settle('start-over'); } // Escape = start over

  private settle(choice: ResumeChoice): void {
    if (this.resolved) return;
    this.resolved = true;
    this.close();
    this.resolve(choice);
  }
}
```

Note: use `registerDomEvent` in `RunnerView` for any click handlers wired there; the modal's own internal buttons can use `addEventListener` since the modal owns their lifecycle.

### Pattern 5: Canvas mtime Access

```typescript
// Source: verified from obsidian.d.ts [VERIFIED: FileStats interface, TFile.stat.mtime]
// Two equivalent approaches:

// Option A — via TFile.stat (synchronous, uses in-memory metadata):
const file = this.app.vault.getAbstractFileByPath(canvasFilePath);
if (file instanceof TFile) {
  const mtime: number = file.stat.mtime; // Unix ms timestamp
}

// Option B — via vault.adapter.stat() (async, reads from disk):
const stat = await this.app.vault.adapter.stat(canvasFilePath);
if (stat !== null) {
  const mtime: number = stat.mtime;
}
```

**Use Option A** (`TFile.stat.mtime`) for the mtime check in `RunnerView.openCanvas()`. It is synchronous, already in memory, and consistent with how the rest of the codebase accesses file metadata. `vault.adapter.stat()` is the fallback if the file is not yet in Obsidian's in-memory file tree (e.g., very first load).

### Pattern 6: Node ID Validation on Resume

Walk every node ID referenced in the saved session and confirm each exists in `graph.nodes`:

```typescript
// Source: derived from ProtocolGraph type [VERIFIED: src/graph/graph-model.ts lines 94-101]
function validateSessionNodeIds(
  session: PersistedSession,
  graph: ProtocolGraph,
): string[] {
  const missing: string[] = [];

  // Check current node
  if (!graph.nodes.has(session.currentNodeId)) {
    missing.push(session.currentNodeId);
  }

  // Check all node IDs in the undo stack
  for (const entry of session.undoStack) {
    if (!graph.nodes.has(entry.nodeId)) {
      missing.push(entry.nodeId);
    }
    // Check loop context loopStartId references
    for (const frame of entry.loopContextStack) {
      if (!graph.nodes.has(frame.loopStartId)) {
        missing.push(frame.loopStartId);
      }
    }
  }

  // Check current loop context stack
  for (const frame of session.loopContextStack) {
    if (!graph.nodes.has(frame.loopStartId)) {
      missing.push(frame.loopStartId);
    }
  }

  // Remove duplicates
  return [...new Set(missing)];
}
```

Note: `snippetNodeId` does not need to be validated against `graph.nodes` separately because it will always equal `currentNodeId` when `runnerStatus === 'awaiting-snippet-fill'`.

### Pattern 7: openCanvas() Integration — Full Resume Flow

```typescript
// Pseudocode showing where to hook session logic in RunnerView.openCanvas()
// Source: src/views/runner-view.ts lines 40-72 [VERIFIED]
async openCanvas(filePath: string): Promise<void> {
  this.canvasFilePath = filePath;
  // ... parse canvas, validate graph (existing code) ...

  // NEW: check for existing session
  const session = await this.plugin.sessionService.load(filePath);

  if (session !== null) {
    const warnings: string[] = [];

    // SESSION-03: validate node IDs
    const missingIds = validateSessionNodeIds(session, graph);
    if (missingIds.length > 0) {
      // Hard failure — cannot resume; offer start-over only
      this.renderSessionError([
        `Session references ${missingIds.length} node(s) that no longer exist in the canvas.`,
        'The canvas may have been edited. Starting over.',
      ]);
      await this.plugin.sessionService.clear(filePath);
      return;
    }

    // SESSION-04: mtime check
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file !== null) {
      const mtime = (file as TFile).stat.mtime;
      if (mtime > session.canvasMtimeAtSave) {
        warnings.push('The canvas file has been modified since this session was saved.');
        warnings.push('Resuming may produce unexpected results if nodes were changed.');
      }
    }

    // Present modal
    const modal = new ResumeSessionModal(this.app, warnings);
    modal.open();
    const choice = await modal.result;

    if (choice === 'resume') {
      this.graph = graph;
      // Set graph on runner without calling start()
      this.runner.setGraph(graph);  // new method — see below
      this.runner.restoreFrom(session);
      this.render();
      return;
    }
    // 'start-over' — fall through to normal start
    await this.plugin.sessionService.clear(filePath);
  }

  // Normal start
  this.graph = graph;
  this.runner.start(graph);
  this.render();
}
```

`ProtocolRunner` needs a `setGraph(graph: ProtocolGraph): void` method (one line: `this.graph = graph;`) so `RunnerView` can prime the graph reference before calling `restoreFrom()` without triggering the full `start()` reset.

### Pattern 8: Auto-Save Hook Points in RunnerView

Auto-save must happen after every user action that mutates runner state. The hook sites are:

| User Action | RunnerView Method | Hook Location |
|-------------|-------------------|---------------|
| Choose answer | click handler on answer button | After `runner.chooseAnswer(id)`, before `renderAsync()` |
| Enter free text | click handler on submit button | After `runner.enterFreeText(text)`, before `renderAsync()` |
| Step back | click handler on step-back button | After `runner.stepBack()`, before `render()` — save the reverted state |
| Loop action | click handler on loop-end buttons | After `runner.chooseLoopAction(action)`, before `renderAsync()` |
| Complete snippet | `handleSnippetFill()` | After `runner.completeSnippet(rendered)`, before `render()` |

Session is **cleared** (not saved) when:
- The runner reaches `complete` state (session finished — no resume needed)
- User explicitly starts over
- Node ID validation fails

Session is **NOT saved** when:
- Runner enters `error` state (an error is not a valid resume point)
- `idle` state (nothing to save)

### Anti-Patterns to Avoid

- **Restoring by calling `start()` then replaying actions:** Do not replay the full action history. Restore the state snapshot directly with `restoreFrom()`. Replay is fragile (non-deterministic for free-text) and defeats the purpose of snapshots.
- **Saving the `ProtocolGraph` itself in the session file:** The graph is re-parsed from the canvas file on resume. Only node IDs are stored, not node content. This keeps session files small.
- **Saving session in `plugin.saveData()` / `data.json`:** Per architecture decision, session files are stored vault-visible in `.radiprotocol/sessions/`, not hidden in plugin data. This makes them syncable and inspectable.
- **Using `vault.modify()` on a file just created with `vault.create()`:** Follow `SnippetService.save()` exactly — check `exists` first, then branch to `adapter.write` (existing) or `vault.create` (new).
- **Floating save promises:** Every `void this.saveSession()` call must be explicitly `void`-marked per NFR-09.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-file write serialization | Custom lock | `WriteMutex` (already exists in `src/utils/write-mutex.ts`) | Prevents race conditions when auto-save and another write overlap |
| Folder creation guard | Inline exists check | `ensureFolderPath()` (already exists in `src/utils/vault-utils.ts`) | Guards against `createFolder()` throwing on existing path |
| Promise-based modal | Custom event emitter | Extend `Modal`, expose `result: Promise<T>` | Pattern proven by `SnippetFillInModal` — consistent with codebase |
| JSON Set serialization | Custom replacer/reviver | None needed — no `Set` in session state (see Set Audit below) | Complexity with no actual benefit here |

**Key insight:** The entire infrastructure (mutex, folder guard, vault adapter) already exists. `SessionService` is structurally a one-for-one clone of `SnippetService` with different path logic.

---

## Set Serialization Audit (SESSION-07)

SESSION-07 mandates `Array` serialization for any `Set` values. The following is a complete audit of all runner internal fields:

| Field | Type | JSON-safe? | Action |
|-------|------|-----------|--------|
| `currentNodeId` | `string \| null` | Yes | None |
| `accumulator.current` | `string` | Yes | None |
| `undoStack` | `UndoEntry[]` | Yes (all fields are string/number/array) | None |
| `loopContextStack` | `LoopContext[]` | Yes (all fields are string/number) | None |
| `runnerStatus` | string union | Yes | None |
| `snippetId` | `string \| null` | Yes | None |
| `snippetNodeId` | `string \| null` | Yes | None |
| `errorMessage` | `string \| null` | Yes (not saved) | Not saved |
| `graph` (ProtocolGraph) | Contains `Map<string, RPNode>` and `Map<string, string[]>` | **No** | **Not saved** — graph is re-parsed from canvas |

[VERIFIED: src/runner/protocol-runner.ts lines 27-38, src/graph/graph-model.ts lines 94-101]

**Result:** SESSION-07 is satisfied trivially. No `Set`-to-`Array` conversion is needed because no `Set` appears anywhere in the saved state. The `ProtocolGraph` uses `Map` values but is intentionally excluded from the session file. The `version: 1` field in `PersistedSession` documents this for future reference.

---

## Common Pitfalls

### Pitfall 1: `awaiting-snippet-fill` Resume Edge Case
**What goes wrong:** The session is saved while `runnerStatus === 'awaiting-snippet-fill'`. On resume, `runner.restoreFrom()` sets this status. The `RunnerView.render()` switch case for `awaiting-snippet-fill` calls `handleSnippetFill()` — this is correct behavior. The snippet modal will open immediately after resume.
**Why it happens:** The auto-save after `chooseAnswer()` / `completeSnippet()` captures intermediate states.
**How to avoid:** The `PersistedSession` stores `snippetId` and `snippetNodeId` so `RunnerView` can open the correct modal. The rendered text is NOT in `accumulatedText` yet at save time — the text gets appended only when `completeSnippet()` is called after the modal resolves. This is correct: the user must re-fill the snippet on resume.
**Warning signs:** If the user completes the snippet modal after resume and the text is duplicated in the output, it means `completeSnippet` was called twice.

### Pitfall 2: `restoreFrom()` Called Before Graph is Set
**What goes wrong:** `ProtocolRunner.advanceThrough()` and most other methods guard with `if (this.graph === null)`. If `restoreFrom()` is called before `setGraph()`, subsequent calls like `chooseAnswer()` will silently no-op.
**Why it happens:** The restored state contains `currentNodeId` but the runner won't traverse without a graph reference.
**How to avoid:** In `RunnerView.openCanvas()`, always call `runner.setGraph(graph)` before `runner.restoreFrom(session)`. The correct order is: (1) parse canvas, (2) set graph, (3) restore session, (4) render.

### Pitfall 3: Session File for a Completed Session
**What goes wrong:** A lingering session file from a completed run gets offered as a resume prompt.
**Why it happens:** The session file was not cleared after the runner transitioned to `complete`.
**How to avoid:** In `RunnerView.render()`, when `state.status === 'complete'`, call `void this.plugin.sessionService.clear(this.canvasFilePath)` to delete the session file.

### Pitfall 4: Session File Slug Collision
**What goes wrong:** Two canvas files at different paths produce the same session file slug (e.g., `a/b.canvas` and `a-b.canvas` both become `a-b-canvas.json`).
**Why it happens:** The simple slug replacement `replace(/[\\/]/g, '-').replace(/\./g, '-')` is not collision-free.
**How to avoid:** Prefix the slug with a hash of the full path, or use a URL-safe encoding (encodeURIComponent). Alternatively, accept the collision as a known limitation for v1 and document it — two canvas files at the same directory level will never have the same basename in normal use. The simplest safe approach: use `encodeURIComponent(canvasFilePath)` as the filename.

### Pitfall 5: Double-resolve in ResumeSessionModal
**What goes wrong:** Clicking a button AND pressing Escape both resolve the promise, causing a second `.resolve()` call.
**Why it happens:** `onClose()` fires when `this.close()` is called from the button handler, and also when Escape is pressed.
**How to avoid:** Use the same `private resolved = false` guard pattern as `SnippetFillInModal` [VERIFIED: src/views/snippet-fill-in-modal.ts line 27].

### Pitfall 6: Auto-Save on Every Render vs. Every Step
**What goes wrong:** Wiring auto-save to `render()` instead of individual user-action handlers causes saves during non-mutating re-renders (e.g., after `renderAsync()` is called for display-only updates).
**Why it happens:** `render()` is called for all state updates including display refreshes.
**How to avoid:** Wire save explicitly to each mutation site: after `chooseAnswer`, `enterFreeText`, `chooseLoopAction`, `completeSnippet`, `stepBack`. Never save inside `render()` itself.

### Pitfall 7: JSON.parse on Corrupted Sync-Conflict File
**What goes wrong:** Obsidian Sync or iCloud merges two session JSON files producing invalid JSON (conflict markers or concatenated content). `JSON.parse()` throws and the plugin surfaces an unhandled error.
**Why it happens:** Session files modified on two devices between syncs.
**How to avoid:** Wrap `JSON.parse()` in try/catch in `SessionService.load()` and return `null`. The null path in `RunnerView` falls through to normal `start()` — graceful degradation.

---

## Code Examples

### Deriving session file path safely (anti-collision)
```typescript
// Source: pattern from SnippetService.filePath() [VERIFIED: src/snippets/snippet-service.ts line 24-26]
private sessionFilePath(canvasFilePath: string): string {
  // encodeURIComponent avoids all filesystem-unsafe chars and is collision-free
  return `${this.sessionFolderPath}/${encodeURIComponent(canvasFilePath)}.json`;
}
```

### Reading canvas mtime
```typescript
// Source: obsidian.d.ts FileStats interface [VERIFIED]
import type { TFile } from 'obsidian';

function getCanvasMtime(app: App, canvasFilePath: string): number | null {
  const file = app.vault.getAbstractFileByPath(canvasFilePath);
  if (file === null) return null;
  return (file as TFile).stat.mtime;
}
```

### Saving session after user action (inside RunnerView click handler)
```typescript
// Source: pattern from RunnerView.render() click handlers [VERIFIED: src/views/runner-view.ts lines 134-139]
this.registerDomEvent(btn, 'click', () => {
  this.runner.chooseAnswer(answerNode.id);
  void this.autoSaveSession();   // fire-and-forget, explicitly marked void
  void this.renderAsync();
});

private async autoSaveSession(): Promise<void> {
  const state = this.runner.getSerializableState();
  if (state === null || this.canvasFilePath === null) return;
  const mtime = getCanvasMtime(this.app, this.canvasFilePath) ?? 0;
  const session: PersistedSession = {
    version: 1,
    canvasFilePath: this.canvasFilePath,
    canvasMtimeAtSave: mtime,
    savedAt: Date.now(),
    ...state,
  };
  await this.plugin.sessionService.save(session);
}
```

### Integration on plugin load (settings addition)
```typescript
// src/settings.ts — add sessionFolderPath field alongside snippetFolderPath
sessionFolderPath: string;  // default: '.radiprotocol/sessions'
```

```typescript
// src/main.ts — instantiate SessionService like SnippetService
this.sessionService = new SessionService(this.app, this.settings.sessionFolderPath);
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Storing full object graph in plugin data.json | Vault-visible JSON files per canvas in `.radiprotocol/sessions/` | Sync-friendly, inspectable, one file per canvas |
| `JSON.stringify(obj)` with Sets | `Array.from(set)` before stringify, `.map(v => new Set(v))` after parse | Mandatory for any `Set` in state — but **not needed here** |
| Re-parsing the entire canvas on resume validation | Re-parse normally, then run `validateSessionNodeIds()` before restoring | Keeps canvas parser stateless and reusable |

---

## Open Questions (RESOLVED)

1. **`awaiting-snippet-fill` auto-save timing** — RESOLVED
   - What we know: The runner is in `awaiting-snippet-fill` while the snippet modal is open. The auto-save hook fires after `chooseAnswer/enterFreeText/chooseLoopAction` but NOT while the modal is open.
   - What's unclear: Should we save when transitioning INTO `awaiting-snippet-fill`, or only AFTER `completeSnippet()` resolves?
   - Recommendation: Save when entering `awaiting-snippet-fill` (i.e., after the `handleSnippetFill` path sets status). If Obsidian is closed while the modal is open, a save with `awaiting-snippet-fill` status means the modal re-opens on resume — acceptable. The alternative (only saving after `completeSnippet`) would lose the session if Obsidian crashes mid-modal.
   - **Decision:** Save on transition INTO `awaiting-snippet-fill` (inside `handleSnippetFill()` before `modal.open()`). Implemented in Plan 07-02 Task T1.

2. **`ProtocolRunner.setGraph()` method placement** — RESOLVED
   - What we know: `restoreFrom()` needs the graph to be set without calling `start()` (which resets all state).
   - What's unclear: Whether to add a `setGraph()` method to `ProtocolRunner` or have `RunnerView` call `start()` and then immediately call `restoreFrom()`.
   - Recommendation: Add `setGraph(graph: ProtocolGraph): void` as a minimal public method. Calling `start()` then overriding with `restoreFrom()` works but is semantically confusing and triggers unnecessary `advanceThrough()`.
   - **Decision:** Add `setGraph()` as a public method on `ProtocolRunner`. Implemented in Plan 07-01 Task T2.

3. **Session file retention after complete** — RESOLVED
   - What we know: A completed session should not be offered for resume.
   - What's unclear: Whether to delete immediately on `complete` or keep for debugging.
   - Recommendation: Delete immediately on `complete` state transition in `RunnerView.render()`. The session is no longer useful once the protocol is done.
   - **Decision:** Delete in `render()` when state is `complete`. Implemented in Plan 07-02 Task T1.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — session persistence uses existing Obsidian Vault API, no new CLIs or services required).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose src/__tests__/session-service.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESSION-01 | `SessionService.save()` writes valid JSON to correct path | unit | `npm test -- src/__tests__/session-service.test.ts` | ❌ Wave 0 |
| SESSION-01 | `SessionService.save()` overwrites existing session (idempotent) | unit | same | ❌ Wave 0 |
| SESSION-02 | `SessionService.hasSession()` returns true after save, false before | unit | same | ❌ Wave 0 |
| SESSION-03 | `validateSessionNodeIds()` returns empty array when all IDs present | unit | same | ❌ Wave 0 |
| SESSION-03 | `validateSessionNodeIds()` returns missing IDs when node removed | unit | same | ❌ Wave 0 |
| SESSION-04 | mtime comparison logic returns true when mtime > canvasMtimeAtSave | unit | same | ❌ Wave 0 |
| SESSION-05 | `accumulatedText` in session captures text at save time, not at resume | unit | `npm test -- src/__tests__/runner/protocol-runner.test.ts` | ❌ Wave 0 |
| SESSION-06 | `SessionService.load()` returns null for corrupt JSON | unit | `npm test -- src/__tests__/session-service.test.ts` | ❌ Wave 0 |
| SESSION-07 | JSON output of `PersistedSession` contains no `Set` objects (all arrays) | unit | same | ❌ Wave 0 |
| SESSION-01 | `ProtocolRunner.getSerializableState()` returns null in idle/complete/error | unit | `npm test -- src/__tests__/runner/protocol-runner.test.ts` | ❌ Wave 0 |
| SESSION-01 | `ProtocolRunner.restoreFrom()` then `getState()` returns same node+text | unit | same | ❌ Wave 0 |
| SESSION-01 | Round-trip: `getSerializableState()` → JSON.stringify → JSON.parse → `restoreFrom()` → `getState()` matches original | unit | same | ❌ Wave 0 |
| SESSION-01 | Loop context stack survives round-trip serialization | unit | same | ❌ Wave 0 |
| SESSION-02/03/04/06 | Resume flow UX (modal, mtime warning, start-over choice) | manual UAT | n/a — Obsidian UI required | manual only |

### Sampling Rate
- **Per task commit:** `npm test -- src/__tests__/session-service.test.ts src/__tests__/runner/protocol-runner.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/session-service.test.ts` — covers SESSION-01 through SESSION-07 (pure unit tests using vault mock pattern from `snippet-service.test.ts`)
- [ ] `src/__tests__/runner/protocol-runner-session.test.ts` — covers `getSerializableState()`, `restoreFrom()`, round-trip, loop context stack serialization

*(Existing test infrastructure — `vitest.config.ts`, `src/__mocks__/obsidian.ts`, vault mock factory — covers all new tests with no additional setup)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | yes | Session files are scoped per canvas path; no cross-session data leakage possible |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `JSON.parse()` result must be type-guarded before use; corrupt/malicious session files must not crash the plugin |
| V6 Cryptography | no | Session files contain no secrets — plain text medical protocol output |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Corrupt session JSON (sync conflict) | Tampering | `try/catch` around `JSON.parse()`, return `null` on failure |
| Session referencing node IDs from a different canvas | Tampering | `validateSessionNodeIds()` against the currently loaded graph |
| Malformed `accumulatedText` with control characters | Tampering | Session text is read-only on resume — rendered in `<textarea readOnly>`, never eval'd |

---

## Sources

### Primary (HIGH confidence)
- `src/runner/protocol-runner.ts` — complete source, all private fields verified
- `src/runner/runner-state.ts` — `UndoEntry`, `RunnerState` discriminated union
- `src/graph/graph-model.ts` — `LoopContext`, `ProtocolGraph`, all node types
- `src/sessions/session-service.ts` — existing stub (one class, no methods)
- `src/snippets/snippet-service.ts` — pattern source for `SessionService` implementation
- `src/utils/write-mutex.ts` — `WriteMutex.runExclusive()` signature
- `src/utils/vault-utils.ts` — `ensureFolderPath()` signature
- `src/views/snippet-fill-in-modal.ts` — promise-based modal pattern
- `src/views/runner-view.ts` — all hook points verified
- `src/__mocks__/obsidian.ts` — confirmed vault mock factory pattern for new tests
- `src/__tests__/snippet-service.test.ts` — vault mock pattern for `SessionService` tests
- `node_modules/obsidian/obsidian.d.ts` — `FileStats.mtime`, `TFile.stat`, `vault.adapter.stat()`
- `package.json` — confirmed dependency versions

### Secondary (MEDIUM confidence)
- None required — all claims verified from codebase and type definitions

### Tertiary (LOW confidence)
- None

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TFile.stat.mtime` is always populated for canvas files loaded via `getAbstractFileByPath()` | Pattern 5 | mtime would return 0; mtime check would incorrectly conclude canvas is unmodified. Use `adapter.stat()` as fallback | 

**All other claims in this research were verified against the codebase or `obsidian.d.ts`.**

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed from package.json
- Architecture: HIGH — derived directly from existing SnippetService pattern and ProtocolRunner source
- Set serialization audit: HIGH — verified all runner fields from source
- Pitfalls: HIGH — derived from existing modal guard patterns and codebase inspection
- mtime API: HIGH — verified from obsidian.d.ts

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable Obsidian API; fast-moving ecosystem not involved)
