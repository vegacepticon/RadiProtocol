---
phase: 45-loop-editor-form-picker-color-map
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/views/node-picker-modal.ts
  - src/__tests__/node-picker-modal.test.ts
  - src/views/editor-panel-view.ts
  - src/styles/editor-panel.css
  - src/__tests__/editor-panel-loop-form.test.ts
  - src/runner/protocol-runner.ts
  - src/views/runner-view.ts
  - src/main.ts
  - src/__tests__/runner-commands.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 45 delivers three coherent slices: (1) a new `NodePickerModal` +
`buildNodeOptions` module driving the four-kind picker, (2) a unified-loop
lock-in test suite and a quick-create loop button, (3) a `start-from-node`
command in `main.ts` that parses / validates the active canvas, opens the
picker, and calls `RunnerView.openCanvas(path, startNodeId)`.

The delta is small, well-commented, and cross-tested. All additions to
accumulated files (`editor-panel-view.ts`, `editor-panel.css`, `main.ts`,
`runner-view.ts`) respect the CLAUDE.md "append-only per phase" rule — only
Phase 45 comments/sections were added; no previous-phase logic was deleted.

Two warnings worth looking at before merge:

1. **WR-01** — `handleStartFromNode` calls `activateRunnerView()`, which
   internally fires a fire-and-forget `openCanvas(filePath)` without the
   `startNodeId`. That call can race with the subsequent
   `openCanvas(path, opt.id)` triggered from the picker callback, and (when a
   stale session file exists) surface `ResumeSessionModal` on top of /
   underneath `NodePickerModal`. This is a realistic UX regression for users
   who resume sessions frequently.
2. **WR-02** — The sort comparator in `buildNodeOptions` silently sends
   unknown kinds to index `-1`, clustering them ahead of every known group
   without any compile-time guard. Today the exhaustive type makes this
   unreachable; tomorrow (adding a fifth kind to `NodeOption['kind']` but
   forgetting `KIND_ORDER`) it will regress sort order without any test
   failure. A trivial compile-time safeguard removes the foot-gun.

Info-level items are minor: a dead third-fallback operand in the snippet
label chain, a missing ellipsis on truncated text-block previews, and a
noteworthy but not actionable asymmetry in the "start from a `start` node"
behaviour (deliberately excluded — documented).

## Warnings

### WR-01: start-from-node command can race ResumeSessionModal with NodePickerModal

**File:** `src/main.ts:361-369`
**Issue:** `handleStartFromNode` calls `await this.activateRunnerView()` before
opening `NodePickerModal`. When `activateRunnerView()` is the one that
actually creates the runner leaf (first invocation, or when `runnerViewMode`
just changed), it dispatches a fire-and-forget
`void view.openCanvas(filePath)` at `main.ts:239` — **without** the
`startNodeId` argument. That implicit call will:

- Load any persisted session via `sessionService.load(filePath)`
  (`runner-view.ts:117`)
- If a session exists, open `ResumeSessionModal` (`runner-view.ts:141`)

Immediately afterwards, `handleStartFromNode` opens `NodePickerModal`
(`main.ts:367-369`). Both modals are then in flight at the same time against
the same canvas. Depending on Obsidian's modal-stacking order, the user sees
either the wrong modal, both stacked, or a "start over" click from
`ResumeSessionModal` that silently clears the session the
picker-driven-openCanvas was about to bypass anyway.

The Phase 45 `openCanvas(filePath, startNodeId?)` signature (`runner-view.ts:61`)
explicitly states that the `startNodeId` path "bypasses session resume" —
which means the outer race window completely defeats that contract.

**Fix:** Skip the implicit openCanvas in the activateRunnerView code path
when the caller only wants a leaf, not a full reload. Two low-risk options:

Option A — short-circuit inside `handleStartFromNode` by calling
`activateRunnerView` and then immediately calling `openCanvas(path, id)`
without relying on the auto-open (already happens via the picker callback).
Guard against the race by clearing the session **before** activateRunnerView:

```typescript
// Phase 45 fix: clear the session BEFORE activating the runner view so the
// implicit openCanvas() inside activateRunnerView() does not open ResumeSessionModal.
await this.sessionService.clear(canvasPath);

await this.activateRunnerView();
const runnerLeaves = this.app.workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
const runnerLeaf = runnerLeaves[0];
if (runnerLeaf === undefined) return;
const runnerView = runnerLeaf.view as RunnerView;

new NodePickerModal(this.app, options, (opt) => {
  void runnerView.openCanvas(canvasPath, opt.id);
}).open();
```

Option B — refactor `activateRunnerView` to accept a `{ autoOpenCanvas?: boolean }`
flag so the start-from-node path can pass `false`. Slightly larger surface
change, but cleaner.

### WR-02: sort comparator silently accepts unknown kinds

**File:** `src/views/node-picker-modal.ts:70-75`
**Issue:** The comparator uses `KIND_ORDER.indexOf(a.kind)` / `indexOf(b.kind)`.
`Array.prototype.indexOf` returns `-1` for a missing element — so any future
`NodeOption['kind']` value that is added without also being listed in
`KIND_ORDER` silently maps to index `-1` and gets sorted **before** every
known kind (because `-1 < 0`). There is no compile-time check that
`KIND_ORDER` enumerates the full `NodeOption['kind']` union, and no unit
test guards against an unknown-kind regression.

Today this is unreachable (the exhaustive `NodeOption['kind']` union matches
`KIND_ORDER` entries), but the comment at the top of `KIND_LABELS`
(`node-picker-modal.ts:14-16`) correctly notes exhaustiveness is enforced for
`KIND_LABELS`, while `KIND_ORDER` gets no such guard.

**Fix:** Either (a) make `KIND_ORDER` a `Record<kind, number>` so TypeScript
enforces exhaustiveness the same way `KIND_LABELS` does, or (b) keep the
array but add a one-line type-level check:

```typescript
// Option (a) — Record keyed by kind, value = sort priority.
const KIND_ORDER: Record<NodeOption['kind'], number> = {
  'question':   0,
  'loop':       1,
  'text-block': 2,
  'snippet':    3,
};

// ...inside sort()
const kaIdx = KIND_ORDER[a.kind];
const kbIdx = KIND_ORDER[b.kind];
if (kaIdx !== kbIdx) return kaIdx - kbIdx;
return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
```

Adding a fifth kind to the union then fails the TS build at the
`KIND_ORDER` declaration, not silently at runtime.

## Info

### IN-01: dead trailing fallback operand in snippet label chain

**File:** `src/views/node-picker-modal.ts:61`
**Issue:** The expression

```typescript
options.push({ id, label: s.subfolderPath || '(корень snippets)' || id, kind: 'snippet' });
```

has an unreachable final operand: `'(корень snippets)'` is a non-empty
string and therefore always truthy, so `|| id` can never execute. The
JSDoc comment above explicitly acknowledges this as "defense-in-depth" /
"не должен срабатывать". Keeping dead defensive operands is harmless but
muddies the code — a future reader has to re-derive that the tail is
unreachable.

**Fix:** Drop the redundant trailing `|| id`:

```typescript
options.push({ id, label: s.subfolderPath || '(корень snippets)', kind: 'snippet' });
```

Or keep the three-step fallback only if the empty-string sentinel is
intentional — but then document the rationale more forcefully (e.g. as a
TODO for a future kind where the middle operand actually becomes optional).

### IN-02: text-block preview truncation has no ellipsis

**File:** `src/views/node-picker-modal.ts:55`
**Issue:** `const preview = tb.content.slice(0, 60);` silently cuts off the
preview with no visual indicator. A text-block whose 60th char is mid-word
looks indistinguishable from a short text-block, which matters slightly
more now that text-blocks are pickable (Phase 45 D-06). Not a bug — the
tests pass with exact-substring matching — but a trivial UX polish.

**Fix:**

```typescript
const preview = tb.content.length > 60
  ? tb.content.slice(0, 60).trimEnd() + '…'
  : tb.content;
```

### IN-03: `start` nodes are excluded from picker — documented but worth confirming with UAT

**File:** `src/views/node-picker-modal.ts:38` (comment) + `src/runner/protocol-runner.ts:61-73`
**Issue:** Phase 45 D-06 explicitly excludes `start` nodes from the picker
(NodePickerModal comment at `node-picker-modal.ts:37-41`). That is a
reasonable default for the "start from a specific node" command — but
`ProtocolRunner.start(graph, startNodeId?)` does NOT reject a `start`-kind
target if one were ever passed in (at `protocol-runner.ts:570`, `case 'start'`
auto-advances through the start node normally). In other words, the policy
is enforced by the picker only, not by the runner.

This is fine today (picker is the only call site), but if a future feature
wires start-from-node to a hotkey / ribbon / command that bypasses the
picker (e.g. "run from currently selected canvas node"), a `start`-kind
selection will work by accident. Worth noting in RESEARCH / future-phase
planning, not fixing now.

**Fix:** No code change required. Add a comment near
`ProtocolRunner.start(graph, startNodeId?)` noting that `startNodeId`
callers are expected to have already filtered via `buildNodeOptions`, and
that `start`-kind targets are accepted only because the picker cannot
supply one.

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
