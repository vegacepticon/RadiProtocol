# Phase 44: Unified Loop Runtime - Research

**Researched:** 2026-04-17
**Domain:** Runtime state machine + Runner view UI + Session persistence (LoopNode picker)
**Confidence:** HIGH (all artifacts verified in-repo; zero external-framework uncertainty)

## Summary

Phase 44 wires **runtime behaviour for the unified `LoopNode`** that Phase 43 introduced. The Phase 43 work already completed the hard "plumbing" half:
- `LoopNode { kind: 'loop', headerText: string }` exists and parses cleanly [VERIFIED: src/graph/graph-model.ts:67-70, src/graph/canvas-parser.ts:160-164].
- `LoopContext.loopNodeId` (renamed from `loopStartId`) persists through runtime and sessions [VERIFIED: src/graph/graph-model.ts:107-116, src/sessions/session-model.ts:13-17].
- Validator enforces exactly-one `«выход»` edge + at least one body edge and produces a Russian migration error for legacy `loop-start`/`loop-end` canvases [VERIFIED: src/graph/graph-validator.ts:39-124].
- `ProtocolRunner.advanceThrough()` already has a `case 'loop':` arm that currently does `transitionToError('Loop runtime ещё не реализован ... Phase 44')` — Phase 44's job is to replace that stub with a real frame-push + halt [VERIFIED: src/runner/protocol-runner.ts:554-563].
- 11 tests are `it.skip`/`describe.skip`-ed with `TODO Phase 44` markers — they are the historical test corpus Phase 44 must rewrite against `unified-loop-valid.canvas` [VERIFIED: src/__tests__/runner/protocol-runner.test.ts:260, 458; protocol-runner-session.test.ts:50, 66, 88, 113, 133, 159, 336].

The new work falls into five tight surfaces:

1. **Runner state machine** — new `awaiting-loop-pick` status with picker state; new `chooseLoopBranch(edgeLabel)` method; dead-end detection in `advanceThrough` that returns to the owning `LoopNode`; loop-frame push at entry, pop on «выход» with correct undo-before-mutate semantics.
2. **RunnerView picker UI** — new `case 'awaiting-loop-pick':` render arm producing one button per body-branch edge label + one «выход» button, rendered under the `LoopNode.headerText`. Existing `.rp-loop-*` CSS classes from Phase 6 are reusable.
3. **Step-back** — existing `stepBack()` machinery already snapshots `loopContextStack` on every undo push; Phase 44 only needs to guarantee the loop-entry push uses `textBeforeLoop` correctly and that the picker itself does NOT push a second undo (RUN-05).
4. **Session round-trip** — `PersistedLoopContext` shape already matches, and `getSerializableState`/`restoreFrom` already handle `loopContextStack` deep-copy. The only new work: extend the `runnerStatus` union to include `'awaiting-loop-pick'` and carry the "current picker node id" through serialization (RUN-06).
5. **`maxIterations` excision** — delete `DEFAULT_SETTINGS.maxLoopIterations`, the settings-tab "Max loop iterations" control, the D-10 unit test (`settings-tab.test.ts:13-15`), and the `LoopStartNode.maxIterations` field from `graph-model.ts`. Also strip the legacy `LoopStartNode`/`LoopEndNode` editor-panel forms that still reference those fields (RUN-07).

**Primary recommendation:** introduce a sixth `RunnerState` variant `AwaitingLoopPickState` (discriminated union exhaustiveness will force each switch-site to handle it), add one public method `chooseLoopBranch(edgeId)`, and render the picker by iterating `graph.edges` where `fromNodeId === loopNodeId` (exact same pattern the validator already uses). Do NOT reintroduce a global iteration cap — `ProtocolRunner.maxIterations` (the auto-advance anti-infinite-recursion guard, default 50) is not `settings.maxLoopIterations` and must remain.

## User Constraints (from ROADMAP + STATE locked decisions)

### Locked Decisions (from STATE.md → v1.7 Design Decisions, carried forward)

1. **Break-compatibility chosen over auto-migration** — old `loop-start`/`loop-end` canvases already fail the validator; Phase 44 must NOT resurrect any legacy loop runtime.
2. **Exit edge identified by edge label «выход»** — six Cyrillic characters, exact match, case-sensitive, no trim. Already enforced in validator (Phase 43 D-08.1); runtime picker uses the same literal.
3. **Multiple body branches allowed; each iteration re-presents the picker** — after a dead-end, runner returns to the same `LoopNode` and re-renders the picker (RUN-02).
4. **One-step picker combining body-branch labels + «выход»** — no separate "Loop again?" prompt; all choices are one click (RUN-01).
5. **`maxIterations` removed entirely; no per-loop or global cap** — kills the setting, the D-10 test, the `LoopStartNode.maxIterations` field, and the editor-panel "Max iterations" control (RUN-07).
6. **Nested loops keep working via the existing `LoopContext` stack** — no new nested-loop data structure; the existing stack is proven (v1.0 SESSION-05 tests).
7. **Loop node owns an editable `headerText` rendered above the picker** — `headerText` is already a field on `LoopNode` (LOOP-02); Phase 44 just renders it.

### Claude's Discretion

- New runner status name: `'awaiting-loop-pick'` (recommended — mirrors `'awaiting-snippet-pick'` naming).
- New public method name: `chooseLoopBranch(edgeId: string)` vs. `chooseLoopBranch(targetNodeId: string)` — see Open Question Q1.
- Picker UI — single button list (answers-list pattern, recommended) vs. button row.
- Whether to delete `chooseLoopAction` stub immediately vs. keep through Phase 44 and delete in Phase 45 (see Open Question Q2).
- Whether to introduce a loop-iteration counter label (`"Lesion 2"`) in Phase 44 or defer — RUN-01 doesn't require it; the existing skipped tests assumed `loopIterationLabel`. Recommended: skip the label (cannot be derived without `loopLabel`, which is gone) and let the `headerText` alone suffice.

### Deferred Ideas (OUT OF SCOPE)

From CONTEXT-43 Deferred section + v1.7 ROADMAP:
- **Phase 45:** Node Editor form for `loop` (LOOP-05), NodePickerModal `loop` entry (LOOP-06). Phase 44 MUST NOT touch `editor-panel-view.ts` except to delete the legacy `loop-start`/`loop-end` form arms (RUN-07 necessity) and let the default fallback take over until Phase 45 fills the gap.
- **Phase 46:** `free-text-input` excision. Phase 44 ignores `free-text-input` entirely.
- **i18n:** mixed Russian/English validator messages tracked as post-v1.7. Phase 44 picker button «выход» label stays Cyrillic to match the canvas contract.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUN-01 | Loop picker — when runtime reaches a `loop` node, show a single picker listing every body-branch edge label plus «выход», rendered under the node's `headerText` | New `awaiting-loop-pick` status + `AwaitingLoopPickState` + RunnerView render arm; `headerText` already on `LoopNode` (Phase 43 D-02) |
| RUN-02 | Dead-end return — choosing a body branch walks that branch; when the branch dead-ends (no outgoing edges), automatically return to the same loop's picker for another iteration | Modify `advanceThrough()` — when `firstNeighbour()` returns `undefined` AND a `LoopContext` frame is active, redirect to `frame.loopNodeId` and halt at `awaiting-loop-pick`; otherwise fall through to current `transitionToComplete()` |
| RUN-03 | «выход» advance + frame pop — choosing «выход» advances along the «выход» edge and removes the loop frame from the internal context stack | `chooseLoopBranch` with `edge.label === 'выход'` → pop `loopContextStack`, then `advanceThrough(edge.toNodeId)` |
| RUN-04 | Nested loops — a nested-loop protocol ends with each outer loop's «выход» still reachable in order | Existing `loopContextStack: LoopContext[]` array — push on enter, pop on exit; the stack naturally preserves outer-loop frames while inner loops run. Dead-end return uses the TOP-OF-STACK loop frame, not a global (nested-safe by construction) |
| RUN-05 | Step-back — step-back from the loop picker restores the node and accumulated text that existed immediately before the loop was entered | `textBeforeLoop` already on `LoopContext`; loop-entry pushes undo BEFORE pushing the loop frame, snapshotting pre-loop accumulator and pre-loop `loopContextStack`. Existing `stepBack()` implementation already restores both |
| RUN-06 | Session resume — closing and reopening Obsidian mid-loop resumes the session at the same picker with the same accumulated text | Extend `getSerializableState()` / `restoreFrom()` to include `awaiting-loop-pick` in the status union and carry `currentNodeId` (= loop node id); `PersistedLoopContext.loopNodeId` already in place (Phase 43 D-04) |
| RUN-07 | No iteration cap — no loop run is capped by `maxIterations`; settings tab no longer exposes "max loop iterations" control and `LoopStartNode.maxIterations` field no longer exists | Delete: `RadiProtocolSettings.maxLoopIterations` + `DEFAULT_SETTINGS.maxLoopIterations` + "Max loop iterations" Setting in settings-tab display() + D-10 test + `LoopStartNode.maxIterations` field + editor-panel `case 'loop-start'`/`case 'loop-end'` form arms (which still reference `radiprotocol_maxIterations`/`radiprotocol_loopStartId`). Keep `ProtocolRunner.maxIterations` constructor option (it is the auto-advance cycle guard, RUN-09, NOT the loop cap) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Loop frame push/pop on enter / «выход» | `src/runner/protocol-runner.ts` (pure state machine) | — | State-machine tier owns all transitions; zero-Obsidian-imports rule applies |
| Dead-end detection + return to loop picker | `src/runner/protocol-runner.ts` | — | Dead-end is a graph-traversal decision, not UI |
| Picker rendering (buttons, headerText display) | `src/views/runner-view.ts` | — | View tier maps runner state → DOM; mirrors existing question/snippet render arms |
| Session serialization of awaiting-loop-pick | `src/runner/protocol-runner.ts` (getSerializableState/restoreFrom) + `src/sessions/session-model.ts` (PersistedSession.runnerStatus union) | — | Session types already cross both tiers; Phase 43 D-13 set the pattern |
| Runtime state type definition | `src/runner/runner-state.ts` (new `AwaitingLoopPickState`) | — | Discriminated-union exhaustiveness forces RunnerView + getSerializableState to handle |
| Legacy `maxIterations` excision | `src/settings.ts` + `src/graph/graph-model.ts` + `src/views/editor-panel-view.ts` + `src/__tests__/settings-tab.test.ts` | — | Settings tier owns the control; model tier owns the field; tests enforce its absence |
| CSS for picker | `src/styles/loop-support.css` (append-only per CLAUDE.md) | — | Existing phase-owned file |
| Test corpus rewrite | `src/__tests__/runner/protocol-runner.test.ts` + `protocol-runner-session.test.ts` | — | Unskip and rewrite `describe.skip('loop support')` and `describe.skip('Loop context stack survives session round-trip')` |

## Standard Stack

### Core (already in place)

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| TypeScript | ^5.0 | All runtime code typed | Project-wide (VERIFIED: tsconfig.json) |
| Vitest | ^4.1.2 | All unit tests | [VERIFIED: .planning/codebase/TESTING.md:7] |
| Obsidian API | 1.12.3 | `ItemView` for RunnerView only — `src/runner/`, `src/graph/`, `src/sessions/` are zero-Obsidian | [VERIFIED: src/runner/protocol-runner.ts:2 comment `Pure module — zero Obsidian API imports (NFR-01)`] |
| esbuild | (project-local) | Concatenates `src/styles/*.css` → `styles.css` in `CSS_FILES` order | [VERIFIED: esbuild.config.mjs:31-38] |
| vanilla DOM via Obsidian helpers (`createEl`, `createDiv`, `registerDomEvent`) | — | Picker UI rendering | No `innerHTML` permitted (CLAUDE.md + STATE Standing Pitfall #3) |

### Supporting — all internal

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `TextAccumulator` (src/runner/text-accumulator.ts) | Append-only buffer with O(1) `snapshot()`/`restoreTo()` — already used for step-back | Loop-entry undo snapshot; no new API needed |
| `WriteMutex` (src/utils/write-mutex.ts) | Serializes vault writes per path | Session auto-save already wraps in mutex; Phase 44 inherits unchanged |
| `GraphValidator` | Rejects legacy canvases + enforces LOOP-04 | Phase 44 runtime only runs on already-validated graphs — no new validation needed |
| Existing `.rp-loop-*` CSS classes (`rp-loop-iteration-label`, `rp-loop-btn-row`, `rp-loop-again-btn`, `rp-loop-done-btn`) | Phase 6 styling, preserved across Phase 43 | Picker buttons; see CSS Plan below |

### Alternatives Considered (all rejected)

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| Discriminated union extension (`AwaitingLoopPickState`) | Overload `AtNodeState` with an `isLoopPicker: boolean` flag | Exhaustiveness is load-bearing across this codebase (runner-view `switch(state.status)`, getSerializableState, getState). A new variant forces every consumer to handle; a flag is invisible |
| New `chooseLoopBranch(edgeId)` method | Reuse `chooseAnswer(answerId)` when the "answer" is the exit edge | `chooseAnswer` asserts `node.kind === 'answer'`; a loop-picker click is NOT hitting an answer node. Conflating the two breaks undo semantics |
| Walk through the loop body via `adjacency.get()` | Walk via `graph.edges.filter(e => e.fromNodeId === loopId)` | `adjacency.get()` loses edge labels — we MUST see the `label` to know which branch the user chose. Validator already uses the `edges.filter` pattern (graph-validator.ts:98) |
| Iteration counter label (`"Lesion 2"`) | Keep the Phase 6 `loopIterationLabel: string` field | `LoopNode` has no `loopLabel` field (Phase 43 D-02 kept only `headerText`); computing `"<headerText> <iteration>"` is ambiguous UX. The `headerText` alone is the header (RUN-01 spec) |
| Separate exit button row + body-branch row | Unified single button list | CONTEXT-43 STATE.md Design Decision #4: "One-step picker combining body-branch labels + «выход»" |

**Installation:** No new npm packages. All work is internal TypeScript refactoring.

**Version verification:** N/A — no new dependencies.

## Architecture Patterns

### System Architecture Diagram

```
                       Canvas file (.canvas JSON)
                                  |
                                  v
              +-------------------------------------+
              |  CanvasParser.parse(json, path)     |
              |   radiprotocol_nodeType = "loop"   |
              |   -> LoopNode{kind:'loop',          |
              |       headerText}                   |
              +-------------------------------------+
                                  |
                                  v
              +-------------------------------------+
              | GraphValidator.validate(graph)      |
              | -- LOOP-04: «выход» + >=1 body     |
              | -- MIGRATE-01: rejects legacy       |
              +-------------------------------------+
                                  |
                        (errors empty)
                                  v
              +-------------------------------------+
              | RunnerView.openCanvas()             |
              |   runner.start(graph)               |
              +-------------------------------------+
                                  |
                                  v
                 ProtocolRunner.advanceThrough(cursor)
                                  |
         +------------------------+-------------------------+
         |                        |                         |
         v                        v                         v
   case 'start'            case 'loop'   [NEW]        case 'question'
   case 'answer'           case 'snippet'              case 'free-text-input'
   case 'text-block'       (others...)                 (halt, await user)
         |                        |
         v                        v
    auto-advance       Loop-entry sequence:
      to next           1. undoStack.push({
      neighbour              nodeId: currentNodeId,
                             textSnapshot,
                             loopContextStack: [...current]})
                          2. loopContextStack.push({
                             loopNodeId: cursor,
                             iteration: 1,
                             textBeforeLoop: accumulator})
                          3. currentNodeId = cursor
                          4. runnerStatus = 'awaiting-loop-pick'
                          5. return (halt)
                                  |
                                  v
               RunnerView.render() state.status === 'awaiting-loop-pick'
                     |
                     +-- renders headerText as <h3>
                     +-- for each graph.edges where fromNodeId === loopNodeId:
                     |     <button data-edge-id>{edge.label}</button>
                     |     (if label === 'выход' -> pop frame; else -> enter body)
                     +-- renders Step-back button (canStepBack true)
                                  |
                    User clicks body-branch button
                                  v
                 runner.chooseLoopBranch(edgeId)
                     |
                     +-- edge.label === 'выход':
                     |     loopContextStack.pop()
                     |     advanceThrough(edge.toNodeId)
                     |     -> exits loop
                     |
                     +-- edge.label !== 'выход':
                     |     iteration++ on top frame
                     |     advanceThrough(edge.toNodeId)
                     |     -> walks body branch
                                  |
                                  v
      Body branch terminates at a node with no outgoing edges:
                     |
                     +-- in advanceThrough(): firstNeighbour returns undefined
                         if loopContextStack.length > 0:
                           cursor = topFrame.loopNodeId
                           runnerStatus = 'awaiting-loop-pick'
                           return  (-> dead-end return, RUN-02)
                         else:
                           transitionToComplete()  (-> existing behavior)
                                  |
                                  v
                 [picker re-renders on next iteration]
```

### Project Structure (unchanged)

```
src/
├── runner/
│   ├── protocol-runner.ts     # State machine — adds awaiting-loop-pick status + chooseLoopBranch
│   ├── runner-state.ts        # Types — adds AwaitingLoopPickState variant
│   └── text-accumulator.ts    # (unchanged)
├── graph/
│   ├── graph-model.ts         # Remove LoopStartNode.maxIterations field (keep @deprecated interface shell)
│   └── ...                    # (validator + parser unchanged — Phase 43 complete)
├── sessions/
│   ├── session-model.ts       # Extend PersistedSession.runnerStatus union to include 'awaiting-loop-pick'
│   └── session-service.ts     # (unchanged — validateSessionNodeIds already works on loopNodeId)
├── views/
│   ├── runner-view.ts         # Add case 'awaiting-loop-pick' render arm
│   └── editor-panel-view.ts   # Delete legacy case 'loop-start' / 'loop-end' arms (RUN-07 cleanup)
├── settings.ts                # Delete maxLoopIterations field + settings-tab control
├── styles/loop-support.css    # Append Phase 44 picker styles (CSS append-only rule)
└── __tests__/
    ├── runner/
    │   ├── protocol-runner.test.ts         # Unskip + rewrite describe.skip('loop support (LOOP-01..05, RUN-09)') — 7 tests
    │   └── protocol-runner-session.test.ts # Unskip + rewrite describe.skip('Loop context stack survives session round-trip (SESSION-05)') — 6 skips
    └── settings-tab.test.ts                # Delete D-10 test asserting maxLoopIterations === 50
```

### Pattern 1: Undo-before-mutate (LOOP-05 / RUN-05 / Pitfall 3)

**What:** Every user action that mutates runner state pushes an `UndoEntry` snapshotting `nodeId`, `textSnapshot`, and a shallow-copy of `loopContextStack` BEFORE any mutation.
**When to use:** Loop entry (push frame), `chooseLoopBranch` body selection (iteration increment), `chooseLoopBranch`-«выход» (frame pop). The picker halt state itself should NOT push an undo entry — that's covered by the entry push (same pattern as the snippet picker).
**Example:**
```typescript
// Source: existing pattern at src/runner/protocol-runner.ts:84-88 (chooseAnswer)
this.undoStack.push({
  nodeId: this.currentNodeId,
  textSnapshot: this.accumulator.snapshot(),
  loopContextStack: [...this.loopContextStack],  // shallow copy — critical (LOOP-05)
});
// ... mutation happens AFTER push
```

### Pattern 2: Discriminated-union exhaustiveness (compile-time enforcement)

**What:** `RunnerState` is a 6-case discriminated union; every `switch(state.status)` is closed by a `const _exhaustive: never = state` assertion that makes TypeScript fail if a new variant is introduced without handling.
**When to use:** Adding `'awaiting-loop-pick'` to the union forces exhaustiveness fixes in `ProtocolRunner.getState()` (src/runner/protocol-runner.ts:309-358), `RunnerView.render()` switch (src/views/runner-view.ts:309-495), and any test helper that switches on status.
**Example:**
```typescript
// Source: src/runner/protocol-runner.ts:352-357 (existing pattern)
default: {
  const _exhaustive: never = this.runnerStatus;
  void _exhaustive;
  return { status: 'error', message: 'Unknown runner status.' };
}
```

### Pattern 3: Auto-save-session fire-and-forget after mutations

**What:** `RunnerView` calls `void this.autoSaveSession()` after every click handler that mutates runner state. No `await`; floating promise marked with `void`.
**When to use:** After `runner.chooseLoopBranch(...)` click handler; after `stepBack()` click handler in the picker state.
**Example:**
```typescript
// Source: src/views/runner-view.ts:356-360 (chooseAnswer pattern)
this.registerDomEvent(btn, 'click', () => {
  this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
  this.runner.chooseLoopBranch(edgeId);     // NEW
  void this.autoSaveSession();
  void this.renderAsync();
});
```

### Pattern 4: Per-phase CSS marker + append-only discipline

**What:** CSS rules added in a phase get a `/* Phase N: description */` comment marker. Existing rules are never rewritten or removed — CLAUDE.md rule.
**When to use:** Any new picker button styles land at the bottom of `src/styles/loop-support.css` under `/* Phase 44: Unified loop picker ... */`. The Phase 6 classes (`rp-loop-iteration-label`, `rp-loop-btn-row`, etc.) remain untouched — some may be reused, but we do NOT edit their rules.
**Example:**
```css
/* Source: existing pattern at src/styles/loop-support.css:1 */
/* Phase 6: Loop Support ─────────────────────────────────────────────────── */
```

### Pattern 5: Edge filter over adjacency for labeled traversal

**What:** When edge labels matter (as with «выход» vs. body branches), filter `graph.edges` by `fromNodeId` — do NOT use `graph.adjacency.get()` (which loses labels).
**When to use:** Picker rendering AND `chooseLoopBranch` dispatch.
**Example:**
```typescript
// Source: existing pattern at src/graph/graph-validator.ts:98
const outgoing = graph.edges.filter(e => e.fromNodeId === id);
const exitEdges = outgoing.filter(e => e.label === 'выход');
const bodyEdges = outgoing.filter(e => e.label !== 'выход');
```

### Anti-Patterns to Avoid

- **Using `adjacency.get()` for picker dispatch** — loses edge labels; the picker MUST know each branch's label.
- **Pushing an undo entry on picker render** — the entry was already pushed on loop-entry; double-pushing breaks step-back (user would need two clicks).
- **Re-pushing a loop frame on every iteration** — the frame is pushed ONCE on entry; iteration count increments in-place on the top-of-stack frame.
- **Synchronous `await` in DOM click handlers** — must be `void this.autoSaveSession()` pattern (floating promise; NFR-09).
- **Editing rules in `src/styles/loop-support.css` you didn't add** — CLAUDE.md; Phase 6 rules stay verbatim.
- **Renaming `loopNodeId` back to `loopStartId`** — Phase 43 D-04 already broke compat; reverting would cascade into `session-service.ts`, `graph-model.ts`, both runner files, and 6+ test files.
- **Reintroducing `maxIterations` anywhere** — STATE Standing Pitfall #10: "LOOP rework must delete the old iteration cap (RUN-07) — do not carry the `maxIterations` field forward for any reason." `ProtocolRunner.maxIterations` (the auto-advance cycle guard constructor option, default 50) is NOT the loop cap; it stays.
- **Deleting `chooseLoopAction` stub without checking `.skip` tests** — the stub compiles the 7 skipped tests in `protocol-runner.test.ts` describe block. If you delete it, you must also delete/rewrite those tests in the same task.
- **Hard-coding «выход» in multiple places** — define `const EXIT_LABEL = 'выход';` once in runner (or import a shared constant); validator uses literal `'выход'` today (graph-validator.ts:99) — either extract to a shared constant or keep literal both places. Pick one and be consistent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loop frame stack | Custom `Map<loopId, frame>` | Existing `loopContextStack: LoopContext[]` | Already proven, already serializable, already handled by stepBack |
| Undo snapshot | Deep-copy with recursive clone | Spread copy `[...loopContextStack]` + `f => ({...f})` | Frames contain only primitives; shallow works (validated in Phase 6 tests; LOOP-05) |
| Edge lookup | `for (const e of graph.edges) if e.fromNodeId === id` | `graph.edges.filter(e => e.fromNodeId === id)` | Concise + consistent with validator |
| Exit-label matching | `e.label?.trim().toLowerCase() === 'выход'` | `e.label === 'выход'` | Validator is strict exact-match (Phase 43 D-08.1 contract); runtime MUST match or the picker will show «выход» but the dispatch won't recognize it |
| Session round-trip | New serialization helpers | Existing `getSerializableState` / `restoreFrom` — just extend the status union | Both already use deep-copy via `.map(f => ({...f}))`; just need to add `'awaiting-loop-pick'` to status union |
| Dead-end detection | New "is-terminal" flag on nodes | `firstNeighbour(cursor) === undefined` check already in `advanceThrough` | The auto-advance cases (start/answer/text-block) ALREADY detect dead-ends via this helper; only the branch-action is different (return to loop vs. complete) |
| Picker button labels | Translate/format edge labels | `edge.label ?? '(unlabeled body)'` — raw | The label is the author's contract text; displaying it verbatim is correct |
| Iteration counter | Reintroduce `loopLabel` + compute `"<label> <i>"` | `headerText` alone (no counter) | `LoopNode` has no `loopLabel` (Phase 43 D-02); counter without a noun is confusing UX; discretion per ROADMAP Phase 44 |

**Key insight:** Phase 43 deliberately left the runtime surface small — it removed a bunch of plumbing (`chooseLoopAction`, `isAtLoopEnd`, `loopIterationLabel`, `LoopStartNode` fields) but did NOT add placeholders. Phase 44 adds exactly the minimum: one new status, one new method, one new render arm. Do not expand beyond that.

## Runtime State Inventory

**This is a refactor phase — the LoopNode model is already in place from Phase 43. Runtime state audit below.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Sessions in `.radiprotocol/sessions/*.json`** (per-canvas session files). Format: `PersistedSession` with `loopContextStack: PersistedLoopContext[]` carrying `loopNodeId` (Phase 43 D-04 already renamed from `loopStartId`). Any pre-Phase-43 session would have `loopStartId` instead — but Phase 43 D-13 already handles this: missing/legacy fields surface as missing ID via `validateSessionNodeIds`, RunnerView calls `sessionService.clear()`, runner starts fresh | **No new data migration needed for Phase 44.** Session format is already forward-compatible. Phase 44 only adds a new `runnerStatus: 'awaiting-loop-pick'` literal to the union — existing on-disk sessions never contained this value, so there's no backward-compat concern (they resume into old status values just fine) |
| Live service config | **None** — plugin is purely client-side Obsidian; no n8n/Datadog/external services | None |
| OS-registered state | **None** — no OS-level registrations (no Windows Task Scheduler, no systemd, no launchd) | None |
| Secrets/env vars | **None** — no secrets in plugin | None |
| Build artifacts / installed packages | `main.js` + `styles.css` are generated by `npm run build`. Pre-Phase-43 `styles.css` may contain stale Phase 6 `rp-loop-*` rules — those are preserved (Phase 43 did NOT touch loop-support.css) and Phase 44 will re-use them. `src/styles.css` is also a generated copy (esbuild writes both — esbuild.config.mjs:56-57). Both are in `.gitignore`? → **Verify:** `src/styles.css` is NOT in `.gitignore` and is tracked (see `git status` at session start: `M src/styles.css`, `M styles.css`) | Run `npm run build` after every CSS change (CLAUDE.md). Do NOT commit hand-edits to `styles.css` or `src/styles.css` — only commit after the build regenerates them |

**Summary:** Phase 44 is a pure code-edit phase from a runtime-state perspective. No database migration, no external-service reconfiguration, no OS-level re-registration. The only "runtime state" that matters is the session JSON format, and Phase 43 already forward-compat-proofed it.

## Common Pitfalls

### Pitfall 1: Undo push-order inversion at loop entry
**What goes wrong:** If the loop-entry sequence snapshots the undo entry AFTER pushing the `LoopContext` frame, the stored `loopContextStack` in the entry already includes the new frame. Then step-back "restores" to a stack that still has the new frame — doesn't actually unwind.
**Why it happens:** Easy to get backwards — you "naturally" want to set up the frame first, then record "here's where we were." But the undo snapshot must capture the pre-loop state.
**How to avoid:**
```typescript
// CORRECT ORDER for loop-entry:
this.undoStack.push({
  nodeId: ..., // node BEFORE the loop (previous cursor)
  textSnapshot: this.accumulator.snapshot(),   // text BEFORE loop
  loopContextStack: [...this.loopContextStack], // stack BEFORE new frame
});
// THEN mutate:
this.loopContextStack.push({ loopNodeId: cursor, iteration: 1, textBeforeLoop: this.accumulator.snapshot() });
this.currentNodeId = cursor;
this.runnerStatus = 'awaiting-loop-pick';
```
**Warning signs:** Step-back from the picker lands on the loop node itself instead of the node before the loop; or step-back reveals a loopContextStack with duplicate frames.

### Pitfall 2: Dead-end return from `advanceThrough` does not land at picker
**What goes wrong:** When a body branch dead-ends (e.g., terminal answer or text-block with no outgoing edge), the auto-advance loop currently calls `transitionToComplete()`. If Phase 44 adds the loop-return logic INSIDE the switch cases (case 'answer' / case 'text-block'), it duplicates code in 4+ places.
**Why it happens:** Each "halt with no next neighbour" branch is currently written inline.
**How to avoid:** Introduce a single private helper like `private advanceOrReturnToLoop(next: string | undefined): 'continue' | 'halted'` that centralises the decision:
```typescript
// pseudocode
if (next === undefined) {
  if (this.loopContextStack.length > 0) {
    const frame = this.loopContextStack[this.loopContextStack.length - 1];
    this.currentNodeId = frame.loopNodeId;
    this.runnerStatus = 'awaiting-loop-pick';
    return;
  }
  this.transitionToComplete();
  return;
}
cursor = next;
continue;
```
**Warning signs:** Body-branch test passes for terminal answer but not for terminal text-block; nested loop exits to "complete" instead of the outer loop's picker.

### Pitfall 3: Nested loops — picking «выход» pops the wrong frame
**What goes wrong:** On nested loops, the picker for the INNER loop should pop the INNER frame on «выход». If you accidentally pop by searching the stack for matching `loopNodeId`, you'll work — but if you pop `[0]` or iterate from the bottom, you'll pop the outer frame.
**Why it happens:** JavaScript array operations — `.shift()` removes from the head; `.pop()` removes from the tail. The top-of-stack IS the most recent loop entered = `.pop()`.
**How to avoid:** Always use `this.loopContextStack.pop()` — never `.shift()`, never `.splice(0, 1)`. The top-of-stack frame is the loop the user is currently inside, so pop() is correct by construction.
**Warning signs:** RUN-04 test fails — outer loop's «выход» edge is not offered after the inner loop's «выход» is chosen.

### Pitfall 4: Picker dispatch uses `adjacency.get()` and loses edge labels
**What goes wrong:** `adjacency: Map<string, string[]>` stores only target node IDs, not edges. If you build the picker by reading `adjacency.get(loopNodeId)` you get node IDs with no way to know which is «выход» and which is a body branch.
**Why it happens:** `adjacency` is the standard "give me neighbours" API everywhere else in the runner.
**How to avoid:** Use `graph.edges.filter(e => e.fromNodeId === loopNodeId)` — matches validator's approach (graph-validator.ts:98).
**Warning signs:** Picker shows unlabeled buttons, or body branches claim `label === undefined`, or the exit branch isn't distinguishable.

### Pitfall 5: Session runnerStatus union not widened → runtime TypeScript break on restoreFrom
**What goes wrong:** `PersistedSession.runnerStatus` is typed as `'at-node' | 'awaiting-snippet-pick' | 'awaiting-snippet-fill'`. `ProtocolRunner.getSerializableState()` returns the same union. If you add `'awaiting-loop-pick'` to `RunnerState` but forget to widen `PersistedSession.runnerStatus`, the TypeScript will fail at the `runnerStatus: this.runnerStatus` assignment inside `getSerializableState()`.
**Why it happens:** The session type is defined in `src/sessions/session-model.ts` (separate file from the runner types); easy to forget.
**How to avoid:** Widen BOTH unions together:
- `src/runner/protocol-runner.ts:373, 430` — `getSerializableState` return type + `restoreFrom` parameter type
- `src/sessions/session-model.ts:51` — `PersistedSession.runnerStatus` literal union
**Warning signs:** Build fails with `Type '"awaiting-loop-pick"' is not assignable to type '"at-node" | "awaiting-snippet-pick" | "awaiting-snippet-fill"'`.

### Pitfall 6: CSS file edited from wrong feature
**What goes wrong:** Adding picker styles to `runner-view.css` instead of `loop-support.css`, or editing Phase 6 rules verbatim.
**Why it happens:** `runner-view.css` is the "obvious" choice when looking at `runner-view.ts`.
**How to avoid:** CLAUDE.md is explicit — per-feature CSS files; loop-support.css owns loop-related styles. Phase 44 appends to loop-support.css only.
**Warning signs:** `regression.test.ts` contains regressions that fail because a rule moved between files.

### Pitfall 7: Forgetting `syncManualEdit` before `chooseLoopBranch`
**What goes wrong:** The user manually edits the preview textarea before clicking a picker button. The runner-view pattern is: `syncManualEdit(preview.value)` → runner action → autoSave. If you skip the sync, the manual edit is lost and the undo snapshot is stale.
**Why it happens:** Easy to omit when authoring a new button handler.
**How to avoid:** Mirror the existing `chooseAnswer`/`chooseSnippetBranch` pattern (src/views/runner-view.ts:356-357, 376-377 — always `syncManualEdit` first).
**Warning signs:** Step-back after a picker click fails to restore manually-edited text.

### Pitfall 8: Deleting `chooseLoopAction` without handling the skipped tests
**What goes wrong:** `chooseLoopAction` is a Phase 43 D-14 deprecated stub that exists solely to keep the `.skip`-ed tests in `protocol-runner.test.ts` compiling. If Phase 44 deletes the method, those 7 tests (which were to be unskipped anyway) will fail to compile.
**Why it happens:** Obvious-seeming cleanup.
**How to avoid:** Sequence: (1) rewrite / unskip each `.skip` test to use `chooseLoopBranch` instead of `chooseLoopAction`; (2) remove any remaining test references; (3) only then delete the stub method. Handle this in one task or plan it as two sequential tasks.
**Warning signs:** `tsc --noEmit` fails after deleting `chooseLoopAction`.

### Pitfall 9: `isAtLoopEnd` / `loopIterationLabel` fields on AtNodeState
**What goes wrong:** Phase 43 D-14 left `isAtLoopEnd?: boolean` and `loopIterationLabel?: string` as @deprecated fields on `AtNodeState` (both always `undefined`). If Phase 44 doesn't clean them up, the new `AwaitingLoopPickState` variant is in confused coexistence with these stale fields.
**Why it happens:** They compile, so easy to overlook.
**How to avoid:** Remove both fields from `AtNodeState` in `runner-state.ts:23-33`. Cross-check `runner-view.ts` — `case 'at-node'` currently does NOT reference them (Phase 43 already removed the `case 'loop-end'` render arm where they were used), so deletion is safe. Update `getState()` in `protocol-runner.ts:315-323` to stop populating them.
**Warning signs:** Dead fields persist in the serialized state; the AtNodeState interface has stale @deprecated JSDoc.

### Pitfall 10: Cycle guard interference — `ProtocolRunner.maxIterations` hit by tight loop
**What goes wrong:** `ProtocolRunner` constructor option `maxIterations` (default 50) caps the auto-advance step counter in `advanceThrough()`. A loop body with e.g. `loop → body-q → body-answer → loop` (back-edge) adds 3 steps per iteration. On iteration 17 the counter overflows 50 and the runner transitions to error.
**Why it happens:** The counter is a cycle-guard, but it is NOT reset between loop iterations. The Phase 6 loop-end runtime used to halt at loop-end (user interaction), which naturally reset the counter. The unified-loop picker halt at `awaiting-loop-pick` ALSO resets the counter (because `advanceThrough` returns when halting), so this might not be a problem in practice — but verify.
**How to avoid:** Verify via test: build a fixture with a long loop body (e.g. 5 nodes) and iterate 20+ times via the picker. If the counter overflows, reset `steps = 0` at every picker halt, OR exempt loop-body traversal from the counter. RUN-07 says "no iteration cap" — but the cycle guard is a different safety net.
**Warning signs:** Long-running loop in integration test transitions to error with `/Iteration cap reached/` after many iterations.

## Code Examples

### Loop-entry in `advanceThrough` (new `case 'loop':`)

```typescript
// Source: to write in src/runner/protocol-runner.ts, replacing current lines 554-563 stub

case 'loop': {
  // Undo-before-mutate (Pitfall 1): snapshot pre-loop state FIRST
  if (this.currentNodeId !== null) {
    this.undoStack.push({
      nodeId: this.currentNodeId,
      textSnapshot: this.accumulator.snapshot(),
      loopContextStack: [...this.loopContextStack],  // shallow copy — frames are primitive-only
    });
  }
  // Push a new loop frame (LoopContext.loopNodeId from Phase 43 D-04)
  this.loopContextStack.push({
    loopNodeId: cursor,
    iteration: 1,
    textBeforeLoop: this.accumulator.snapshot(),
  });
  // Halt at picker
  this.currentNodeId = cursor;
  this.runnerStatus = 'awaiting-loop-pick';
  return;
}
```

### `chooseLoopBranch(edgeId: string)` — new public method

```typescript
// Source: to write in src/runner/protocol-runner.ts after chooseSnippetBranch

/**
 * Phase 44 (RUN-01, RUN-03): user picks a branch at the loop picker.
 * Valid only in 'awaiting-loop-pick'. Dispatches by edge label:
 *   - 'выход'  -> pop the current loop frame, advance along the exit edge
 *   - other    -> increment iteration on top frame, advance along the body edge
 */
chooseLoopBranch(edgeId: string): void {
  if (this.runnerStatus !== 'awaiting-loop-pick') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const edge = this.graph.edges.find(e => e.id === edgeId);
  if (edge === undefined || edge.fromNodeId !== this.currentNodeId) {
    this.transitionToError(`Loop picker edge '${edgeId}' not found or does not originate at current loop node.`);
    return;
  }

  // Undo-before-mutate
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });

  if (edge.label === 'выход') {
    // RUN-03: pop frame
    this.loopContextStack.pop();
  } else {
    // Body branch: increment iteration on top frame (RUN-04 nested-safe: .pop() not needed, mutate in place)
    const top = this.loopContextStack[this.loopContextStack.length - 1];
    if (top !== undefined) top.iteration += 1;
  }

  this.runnerStatus = 'at-node';
  this.advanceThrough(edge.toNodeId);
}
```

### Dead-end return in `advanceThrough` helper

```typescript
// Source: to refactor in src/runner/protocol-runner.ts — replace firstNeighbour usages
// inside switch cases that currently call transitionToComplete() on undefined

// pseudocode for 'answer', 'text-block', 'start' branches:
const next = this.firstNeighbour(cursor);
if (next === undefined) {
  // RUN-02: inside a loop -> return to the owning loop's picker
  if (this.loopContextStack.length > 0) {
    const frame = this.loopContextStack[this.loopContextStack.length - 1];
    if (frame !== undefined) {
      this.currentNodeId = frame.loopNodeId;
      this.runnerStatus = 'awaiting-loop-pick';
      return;
    }
  }
  this.transitionToComplete();
  return;
}
cursor = next;
```

### Picker render arm in RunnerView

```typescript
// Source: to add to src/views/runner-view.ts render() switch after case 'awaiting-snippet-fill'

case 'awaiting-loop-pick': {
  if (this.graph === null) {
    this.renderError(['Internal error: graph not loaded.']);
    return;
  }
  const node = this.graph.nodes.get(state.currentNodeId);
  if (node === undefined || node.kind !== 'loop') {
    this.renderError([`Loop node "${state.currentNodeId}" not found in graph.`]);
    return;
  }

  // RUN-01: render headerText above picker
  if (node.headerText !== '') {
    questionZone.createEl('p', {
      text: node.headerText,
      cls: 'rp-loop-header-text',        // new class (Phase 44)
    });
  }

  // Picker: every outgoing edge becomes a button
  const outgoing = this.graph.edges.filter(e => e.fromNodeId === state.currentNodeId);
  const list = questionZone.createDiv({ cls: 'rp-loop-picker-list' });  // new class (Phase 44)
  for (const edge of outgoing) {
    const label = edge.label ?? '(unlabeled)';
    const isExit = edge.label === 'выход';
    const btn = list.createEl('button', {
      cls: isExit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',             // new classes (Phase 44)
      text: label,
    });
    this.registerDomEvent(btn, 'click', () => {
      this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
      this.runner.chooseLoopBranch(edge.id);
      void this.autoSaveSession();
      void this.renderAsync();
    });
  }

  // Step-back (RUN-05) — exact same pattern as at-node arm
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

  this.renderPreviewZone(previewZone, state.accumulatedText);
  this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);
  break;
}
```

### CSS for picker (append to loop-support.css)

```css
/* Phase 44: Unified loop picker (RUN-01) ────────────────────────────────── */

.rp-loop-header-text {
  font-size: var(--font-ui-medium);
  font-weight: var(--font-semibold);
  color: var(--text-normal);
  margin-bottom: var(--size-2-3);
}

.rp-loop-picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--size-2-2);
  margin-top: var(--size-2-3);
}

.rp-loop-body-btn,
.rp-loop-exit-btn {
  text-align: left;
  padding: var(--size-2-3) var(--size-4-2);
  border-radius: var(--radius-s);
  border: none;
  cursor: pointer;
  font-size: var(--font-ui-small);
}

.rp-loop-body-btn {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
}

.rp-loop-body-btn:hover {
  background: var(--interactive-accent-hover);
}

.rp-loop-exit-btn {
  background: var(--background-modifier-border);
  color: var(--text-normal);
}

.rp-loop-exit-btn:hover {
  background: var(--background-modifier-border-hover, var(--background-modifier-border));
  opacity: 0.9;
}
```

### `RadiProtocolSettings` maxLoopIterations excision (RUN-07)

```typescript
// Source: src/settings.ts — DELETE lines 9 (interface field), 27 (default), 127-143 (UI Setting)
// Before:
export interface RadiProtocolSettings {
  // ...
  maxLoopIterations: number;   // DELETE THIS LINE
  // ...
}
export const DEFAULT_SETTINGS: RadiProtocolSettings = {
  // ...
  maxLoopIterations: 50,       // DELETE THIS LINE
  // ...
};
// display() method:
new Setting(containerEl).setName('Protocol engine').setHeading();   // DELETE heading + entire Setting block
new Setting(containerEl).setName('Max loop iterations')...          // DELETE

// Delete corresponding test: src/__tests__/settings-tab.test.ts:13-15 (D-10 test)
```

### Editor-panel cleanup (RUN-07 cascade)

```typescript
// Source: src/views/editor-panel-view.ts:556-608 — DELETE both case blocks
// case 'loop-start' and case 'loop-end' both reference radiprotocol_maxIterations / radiprotocol_loopStartId
// These are @deprecated legacy kinds; validator rejects any canvas containing them.
// Deletion cascade:
// - TypeScript exhaustiveness will force either (a) adding stub cases, or (b) letting default take over.
// - Option (a): minimal stub — return nothing, let default 'Node has no editable properties' fall through.
// - Option (b): the RPNodeKind union still has 'loop-start' and 'loop-end' (Phase 43 D-CL-05 variant b, @deprecated).
//   -> switch must still handle them. Recommend keeping minimal `case 'loop-start': case 'loop-end': return;` or
//      informational `new Setting(container).setName('Legacy loop node — rebuild with unified loop node.').setHeading();`
// - Do NOT add a case 'loop' form in Phase 44 — that's Phase 45 LOOP-05.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two-node loop (`loop-start` + `loop-end` + `loopStartId` back-ref) | Single `LoopNode` with `headerText`, edges labelled `«выход»` vs. body | Phase 43 (2026-04-17) | Phase 44 builds runtime on this model; old runtime (`chooseLoopAction('again'/'done')`) is now a `@deprecated` no-op stub |
| `LoopContext.loopStartId: string` | `LoopContext.loopNodeId: string` | Phase 43 D-04 (2026-04-17) | Field renamed; all session persistence, `validateSessionNodeIds`, `getSerializableState`/`restoreFrom` already updated |
| Global `settings.maxLoopIterations: number` (default 50) + per-loop `LoopStartNode.maxIterations` field | No iteration cap | Phase 44 RUN-07 (this phase) | Settings-tab control removed, D-10 test deleted, `LoopStartNode.maxIterations` field deleted from graph model |
| `RunnerState.AtNodeState.isAtLoopEnd?: boolean` flag driving "Loop again / Done" buttons | New discriminated variant `AwaitingLoopPickState` with explicit picker contents | Phase 44 (this phase) | `isAtLoopEnd` (Phase 43 @deprecated) deleted; new variant forces exhaustiveness across all `switch(state.status)` sites |
| Global auto-save of `settings.maxLoopIterations` to data.json | N/A | Phase 44 RUN-07 | Existing stored settings with `maxLoopIterations: 50` are harmless — `Object.assign({}, DEFAULT_SETTINGS, await loadData())` at `main.ts:26` still accepts extra fields; they just stop being used. No data migration required |

**Deprecated/outdated (MUST die in Phase 44):**
- `ProtocolRunner.chooseLoopAction(action: 'again' | 'done'): void` — the entire method body.
- `RunnerState.AtNodeState.loopIterationLabel?: string` — always undefined in Phase 43; remove.
- `RunnerState.AtNodeState.isAtLoopEnd?: boolean` — always undefined in Phase 43; remove.
- `RadiProtocolSettings.maxLoopIterations: number` — field.
- `DEFAULT_SETTINGS.maxLoopIterations: 50` — default.
- Settings-tab "Max loop iterations" Setting block (settings.ts:127-143).
- Settings-tab test D-10 (settings-tab.test.ts:13-15 asserting `DEFAULT_SETTINGS.maxLoopIterations === 50`).
- Editor-panel `case 'loop-start'` / `case 'loop-end'` form arms (editor-panel-view.ts:556-608) — they reference `radiprotocol_maxIterations` / `radiprotocol_loopStartId` which are legacy.
- `LoopStartNode.maxIterations: number` field on the `@deprecated` legacy interface (graph-model.ts:81).
- Parser fallback `getNumber(props, 'radiprotocol_maxIterations', 50)` at canvas-parser.ts:247 — vestigial, never reached at runtime (validator rejects the canvas first).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The existing `ProtocolRunner.maxIterations` constructor option is the auto-advance cycle guard (RUN-09), NOT the loop iteration cap — RUN-07 says "no loop run capped by `maxIterations`," which refers to the per-loop cap that existed via `LoopStartNode.maxIterations` and `settings.maxLoopIterations`. | RUN-07 scope | [ASSUMED] If RUN-07 is interpreted to mean ALSO removing `ProtocolRunner.maxIterations`, then: (a) the `iteration cap (RUN-09)` test at src/__tests__/runner/protocol-runner.test.ts:273-306 breaks; (b) text-block chain cycles become infinite loops. Recommend user confirm: "RUN-07 removes the LOOP cap (`settings.maxLoopIterations` + `LoopStartNode.maxIterations`) but keeps the auto-advance cycle guard (`ProtocolRunner.maxIterations` / RUN-09). Confirm?" |
| A2 | The picker should render ONE button per outgoing edge, even if two edges share a label. | RUN-01 picker UI | [ASSUMED] If two edges have identical labels (e.g. two bodies both unlabeled), the picker shows two buttons; the user cannot distinguish them. Alternative: deduplicate by label or show `edge.id` suffix. Risk: confusing UX in edge cases. Recommend: per-edge buttons (straightforward; the author's intent is what it is) |
| A3 | No iteration counter UI — the `headerText` alone serves as the picker header. | RUN-01 picker UI | [ASSUMED] Phase 6 showed `"Lesion 2"` (loopLabel + iteration). ROADMAP RUN-01 says "single picker ... rendered underneath the node's `headerText`" — no mention of iteration counter. Risk: users want visibility into iteration count. Mitigation: easy to add later as an additional element if authors request it |
| A4 | The loop picker DOES push an undo entry at loop entry (inside `case 'loop':` in advanceThrough), so step-back from the picker is always possible when the loop was reached by auto-advance from a prior user action. | RUN-05 step-back | [VERIFIED via pattern match] The snippet-pick state follows the exact same pattern: loop-entry = snippet-node-entry; picker click = pickSnippet(); undo push happens at entry not at halt. See Pattern 1 above and src/runner/protocol-runner.ts:233-247 |
| A5 | `PersistedSession.runnerStatus` literal union MUST be widened in Phase 44 — this is not optional. | RUN-06 session resume | [VERIFIED via TypeScript] Without widening, `getSerializableState()` fails to compile when `this.runnerStatus === 'awaiting-loop-pick'` is assigned to `PersistedSession.runnerStatus` |
| A6 | Existing Phase 6 CSS classes (`.rp-loop-iteration-label`, `.rp-loop-btn-row`, `.rp-loop-again-btn`, `.rp-loop-done-btn`) are NOT reused — Phase 44 introduces new classes (`.rp-loop-header-text`, `.rp-loop-picker-list`, `.rp-loop-body-btn`, `.rp-loop-exit-btn`) — OR they ARE reused. | CSS plan | [ASSUMED] Recommend new classes for Phase 44 because: (a) picker UX is different (single list vs. two buttons), (b) avoids editing existing rules (CLAUDE.md append-only). But the old classes are still present in `loop-support.css` — Phase 45 may decide to garbage-collect them when it owns the full loop UI |

**Resolution of A1 (critical):** The `ProtocolRunner.maxIterations` constructor option (src/runner/protocol-runner.ts:8, 28, 44) is explicitly tied to the "iteration cap (RUN-09, D-08)" — a defence against cycles in auto-advance between user halts. It protects ALL auto-advance cases: `start → text-block → text-block → ...` chains; `answer → text-block → answer → ...` chains. Removing it would make any cycle non-terminating. The Phase 43 CONTEXT.md PATTERNS.md explicitly calls this out: "oставить: это общий cap auto-advance, не loop-specific (см. тест `iteration cap (RUN-09)`). НЕ путать с `settings.maxLoopIterations` (которое уходит в Phase 44 RUN-07)." This reduces A1's risk to LOW, but surface this to the user in discuss-phase anyway: "Confirm: RUN-07 removes the user-configurable loop cap but keeps the auto-advance cycle guard (RUN-09 default 50)."

## Open Questions

1. **`chooseLoopBranch(edgeId)` vs. `chooseLoopBranch(targetNodeId)` vs. `chooseLoopBranch(label)`?**
   - What we know: The picker enumerates edges; each button knows its `edge.id`. `edge.id` is globally unique, stable across canvas edits (unless author deletes the edge), and unambiguous.
   - What's unclear: `targetNodeId` would let the picker dispatch go through `adjacency.get()` (consistent with other parts of runner). But two body edges may target the same node — `targetNodeId` alone wouldn't identify the button. `label` has the same collision problem. `edgeId` is the robust choice.
   - Recommendation: use `edgeId`. Cite the body/exit classification as `this.graph.edges.find(e => e.id === edgeId).label === 'выход'`.

2. **Delete `chooseLoopAction` stub in Phase 44, or leave it for Phase 45/46?**
   - What we know: The stub exists because the 7 `describe.skip('loop support')` tests in `protocol-runner.test.ts` call `chooseLoopAction` inside their bodies. Phase 44 rewrites those tests against `chooseLoopBranch`, so the references go away.
   - What's unclear: Phase 44 could do a clean delete. But there's a risk a test was missed; leaving the stub `@deprecated` through Phase 45 is safer.
   - Recommendation: delete in Phase 44 AFTER rewriting/unskipping all 7 tests in the same task. Run `tsc --noEmit` to verify zero usages before delete.

3. **Do we display the iteration counter anywhere?**
   - What we know: `LoopContext.iteration` is tracked and incremented on each body-branch pick. RUN-01 does not require a counter.
   - What's unclear: Authors may want it. Phase 6 had `"Lesion 2"`. Phase 44 dropping it is a UX regression relative to Phase 6 — but is consistent with the Phase 43 D-02 decision to have `headerText` as the single UI element.
   - Recommendation: do NOT display a counter. Keep `LoopContext.iteration` as internal state (needed for later per-iteration logic) but don't render it. Authors who want iteration visibility can include `"(iteration #)"` in their `headerText` — or Phase 45 LOOP-05 can add an optional toggle.

4. **Should the picker render differently when `loopContextStack.length > 1` (nested)?**
   - What we know: Nested loops keep both pickers live — inner loop is the "top" one rendering now; outer only renders when its body branch auto-returns to it.
   - What's unclear: Should there be a visual indicator like "Iteration N of parent loop '...'" breadcrumb? RUN-04 says nested loops "continue to work" — no explicit breadcrumb requirement.
   - Recommendation: no breadcrumb in Phase 44. `headerText` alone. Easy addition later.

5. **`edge.label === undefined` case — is this even reachable?**
   - What we know: LOOP-04 validator rejects a canvas with a `loop` node that has 0 body edges or a missing «выход». It does NOT require non-«выход» edges to have labels.
   - What's unclear: An unlabeled body edge is valid per the validator. The picker button for it reads `undefined` — bad UX.
   - Recommendation: fallback `edge.label ?? '(no label)'` — show a placeholder. Optionally add a validator warning (Phase 45/46 scope; out for Phase 44).

## Environment Availability

No external dependencies. Phase 44 is pure TypeScript + CSS code edits inside the existing plugin. `npm run build` + `npm test` suffice.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/npm | build + test | ✓ | project-local | — |
| Vitest | test runner | ✓ | 4.1.2 | — |
| TypeScript | type check | ✓ | project-local | — |
| esbuild | bundler | ✓ | project-local | — |
| Obsidian 1.12.3 | runtime target | ✓ | (plugin dep) | — |

**Missing dependencies:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (VERIFIED: .planning/codebase/TESTING.md:66-80) |
| Quick run command | `npx vitest run src/__tests__/runner/ -t "loop"` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUN-01 | Running reaches a `loop` node, picker appears with body-branch labels + «выход», headerText rendered above | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts -t "loop picker renders"` | ✅ (rewrite `describe.skip('loop support')`) |
| RUN-02 | Choose body branch, branch dead-ends (answer terminal), runner returns to picker on same loop with iteration=2 | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts -t "dead-end returns to picker"` | ✅ |
| RUN-03 | Choose «выход», runner pops loop frame, advances along exit edge, transitions to complete/next node | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts -t "выход pops frame"` | ✅ |
| RUN-04 | Nested-loop fixture: outer loop body contains inner loop; enter outer→enter inner→pick inner «выход»→outer picker is active→pick outer «выход»→complete | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts -t "nested loops"` | ❌ Wave 0 (new `unified-loop-nested.canvas` fixture) |
| RUN-05 | Step-back from picker restores pre-loop currentNodeId and pre-loop accumulatedText; step-back twice unwinds the undo chain | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts -t "step-back from loop picker"` | ✅ |
| RUN-06 | `getSerializableState()` → `JSON.stringify` → `JSON.parse` → `restoreFrom()` at `awaiting-loop-pick` status restores: runnerStatus, currentNodeId (loop node), accumulatedText, loopContextStack, iteration | unit | `npx vitest run src/__tests__/runner/protocol-runner-session.test.ts -t "loop picker survives session round-trip"` | ✅ (rewrite `describe.skip('Loop context stack survives session round-trip')`) |
| RUN-07 | (a) `DEFAULT_SETTINGS` has no `maxLoopIterations`; (b) `LoopStartNode` legacy interface has no `maxIterations`; (c) Settings class type has no `maxLoopIterations` | contract test | `npx vitest run src/__tests__/settings-tab.test.ts` (delete D-10 test) + new test `maxLoopIterations field is absent from DEFAULT_SETTINGS` | ✅ (existing tests to delete/modify) |
| RUN-07 | Settings tab `display()` does not render "Max loop iterations" control | manual smoke | Open plugin settings, confirm no "Max loop iterations" Setting | N/A (manual UAT) |
| RUN-07 | Editor-panel does not show "Max iterations" field for legacy loop-start nodes (they should show nothing or an informational message) | manual smoke | Select a legacy loop-start node (from an archived fixture), confirm no field | N/A (manual UAT) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/runner/ src/__tests__/settings-tab.test.ts`
- **Per wave merge:** `npm test` (full suite) + `npm run build` (tsc + esbuild)
- **Phase gate:** Full suite green AND manual UAT covering RUN-01 through RUN-06 end-to-end in Obsidian + RUN-07 absence check in settings tab

### Wave 0 Gaps
- [ ] `src/__tests__/fixtures/unified-loop-nested.canvas` — nested-loop fixture for RUN-04 (inner loop inside outer loop's body branch, both with «выход» edges)
- [ ] Rewrite `describe.skip('loop support (LOOP-01 through LOOP-05, RUN-09)')` block in `src/__tests__/runner/protocol-runner.test.ts:458-539` — 7 tests → rewrite against `chooseLoopBranch` and `unified-loop-valid.canvas`
- [ ] Rewrite `describe.skip('Loop context stack survives session round-trip (SESSION-05)')` in `src/__tests__/runner/protocol-runner-session.test.ts:336-365`
- [ ] Unskip the 3 `it.skip('returns non-null ...')` / `it.skip('serialized state has all required...')` / `it.skip('restores currentNodeId ...')` / `it.skip('restores accumulatedText ...')` / `it.skip('canStepBack is true...')` / `it.skip('getSerializableState()...JSON round-trip...')` tests in `protocol-runner-session.test.ts:50, 66, 88, 113, 133, 159` — all reference `loop-body.canvas`; rewrite to use `unified-loop-valid.canvas`
- [ ] Unskip `it.skip('transitions to error state when loop-start has no continue edge')` (protocol-runner.test.ts:261) — this test is now obsolete (legacy kind rejected by validator); either delete it or rewrite into "new LOOP-04 fixture throws migration error before runner starts" (already covered in graph-validator.test.ts — delete is fine)
- [ ] Delete D-10 test `it('D-10: DEFAULT_SETTINGS.maxLoopIterations is 50')` in `src/__tests__/settings-tab.test.ts:13-15`
- [ ] Add new test: `it('DEFAULT_SETTINGS has no maxLoopIterations field (RUN-07)', () => { expect('maxLoopIterations' in DEFAULT_SETTINGS).toBe(false); })`
- [ ] Add new test: `it('LoopStartNode legacy interface has no maxIterations field (RUN-07)', () => { ... })` — or, if the Phase 43 legacy interface is deleted entirely, assert the deletion via a compile-time check / code-grep regression test in `regression.test.ts`

## Project Constraints (from CLAUDE.md)

### Build & Test
- Source TypeScript in `src/`; `main.js` is esbuild output — do NOT edit directly.
- CSS source in `src/styles/*.css`; `styles.css` root file is generated — do NOT edit directly.
- Always run `npm run build` after CSS changes (regenerates `styles.css`).
- Run `npm test` to verify — vitest only, no other test frameworks.

### Shared-File Discipline (MOST IMPORTANT for Phase 44)
- **Never remove existing code you didn't add.** Phase 44 edits `main.ts`, `runner-view.ts`, `editor-panel-view.ts`, `loop-support.css`, `protocol-runner.ts` — all shared / accumulated files.
- ONLY add or modify code relevant to THIS phase.
- If unsure whether a rule/function belongs to a previous phase, leave it alone.
- This rule exists because recurring regressions were caused by executor agents silently deleting CSS rules and TypeScript functions while editing unrelated sections.

### CSS append-only discipline
- Edit only the relevant feature file (Phase 44 → `src/styles/loop-support.css`).
- Add new rules at the BOTTOM of the file with a phase comment: `/* Phase 44: ... */`.
- Never rewrite existing sections (Phase 6's `.rp-loop-btn-row` etc. stay verbatim).

### Other Standing Pitfalls (from STATE.md)
- No `innerHTML`; use DOM API + Obsidian helpers (`createEl`, `createDiv`, `registerDomEvent`).
- No `require('fs')`; use `app.vault.*` exclusively (RunnerView already follows this).
- `loadData()` returns null on first install — always merge with defaults (`main.ts:26` does this correctly, unchanged).
- No `console.log` in production — use `console.debug()`.
- Real-DOM vs mock-DOM parent lookup: always `parentElement` first, `.parent` mock fallback second (not relevant for picker since picker renders into `questionZone` directly).
- v1.7-specific: **LOOP rework must delete the old iteration cap (RUN-07) — do not carry the `maxIterations` field forward for any reason.**

## Sources

### Primary (HIGH confidence)
- `src/graph/graph-model.ts` (Phase 43 D-01..D-04 — unified LoopNode, LoopContext rename)
- `src/runner/protocol-runner.ts` (Phase 43 D-14 — loop-entry stub, chooseLoopAction deprecated)
- `src/runner/runner-state.ts` (Phase 43 D-14 — deprecated fields on AtNodeState)
- `src/sessions/session-model.ts` (Phase 43 D-04/D-13 — loopNodeId in PersistedLoopContext)
- `src/sessions/session-service.ts` (Phase 43 D-20 — graceful reject of legacy loop IDs)
- `src/graph/graph-validator.ts` (Phase 43 D-07/D-08/D-09/D-10/D-11 — migration check, LOOP-04, cycle through loop)
- `src/views/runner-view.ts` (Phase 43 D-14 — case 'loop-end' block removed)
- `src/views/editor-panel-view.ts:556-608` (legacy loop-start/loop-end form arms — pending Phase 44 RUN-07 excision)
- `src/settings.ts:9, 27, 127-143` (maxLoopIterations field + UI — pending Phase 44 RUN-07 excision)
- `src/__tests__/fixtures/unified-loop-valid.canvas` (Phase 43 D-17 — happy-path LoopNode fixture with «выход» + body back-edge)
- `src/__tests__/fixtures/loop-body.canvas` (Phase 43 D-16 — legacy, reassigned as MIGRATE-01 test fixture)
- `src/__tests__/runner/protocol-runner.test.ts:458-539` (Phase 43 D-18 — skipped tests to rewrite)
- `src/__tests__/runner/protocol-runner-session.test.ts:336-365` (Phase 43 D-18 — skipped session round-trip test)
- `.planning/phases/43-.../43-PATTERNS.md` (full pattern map covering every Phase 43 touchpoint, many patterns reusable in Phase 44)
- `.planning/REQUIREMENTS.md:21-28` (RUN-01..RUN-07 spec)
- `.planning/ROADMAP.md:123-133` (Phase 44 goal + success criteria)
- `.planning/STATE.md:91-99, 102-114` (v1.7 design decisions + Standing Pitfalls)
- `.planning/codebase/TESTING.md` (framework + patterns + fixtures)
- `.planning/codebase/CONCERNS.md` (tech debt + known fragile areas)
- CLAUDE.md (build/CSS/shared-file rules)

### Secondary (MEDIUM confidence)
- `src/__tests__/graph-validator.test.ts` (Phase 43 D-19 tests for LOOP-04, MIGRATE-01 — demonstrates assertion style for Russian validator messages)
- `src/styles/loop-support.css` (Phase 6 CSS — classes preserved, Phase 44 appends new classes at bottom)
- `esbuild.config.mjs:31-38` (CSS concatenation order — loop-support.css is last in `CSS_FILES`)

### Tertiary (LOW confidence)
- None — all claims in this research are backed by direct code reads or locked-in CONTEXT/ROADMAP/REQUIREMENTS entries.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — internal codebase inspected; zero external dependencies
- Architecture: HIGH — new work mirrors existing patterns (snippet picker, chooseAnswer, stepBack) verbatim
- Pitfalls: HIGH — each pitfall is either (a) a Phase 6 bug already captured in code comments, (b) a Phase 43 discovery in PATTERNS.md, or (c) a TypeScript consequence derived from the type definitions
- RUN-07 excision scope: MEDIUM — A1 open question (scope of "maxIterations" — per-loop cap vs. auto-advance cycle guard) should be confirmed in discuss-phase before executing

**Research date:** 2026-04-17
**Valid until:** 2026-04-24 (stable — feature is fully internal; no external-API dependencies that could drift in a week)
