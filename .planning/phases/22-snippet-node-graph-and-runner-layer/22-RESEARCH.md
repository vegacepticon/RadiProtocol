# Phase 22: Snippet Node — Graph and Runner Layer - Research

**Researched:** 2026-04-11
**Domain:** TypeScript pure-graph layer — node model, canvas parser, graph validator, protocol runner, runner state
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `SnippetNode` interface carries two `radiprotocol_*` fields:
  - `radiprotocol_snippetFolderPath` → `folderPath?: string` — per-node folder override. `undefined` when not set.
  - `radiprotocol_buttonLabel` → `buttonLabel?: string` — display label for file-picker button in Phase 25. Falls back to canvas node's `text` field if absent, then to "Select file" if both empty.
- **D-02:** `SnippetNode` does NOT carry `prefix`/`suffix` fields in Phase 22.
- **D-03:** `RPNodeKind` union gains `| 'snippet'`. `NODE_COLOR_MAP` type annotation strengthened from `Record<string, string>` to `Record<RPNodeKind, string>` once `'snippet'` joins the union.
- **D-04:** A snippet node with no outgoing edges is valid (legal terminal node, by analogy with `text-block`). Validator does NOT emit dead-end error for snippet nodes. Reachability check still applies.
- **D-05:** Add `isAtSnippetNode?: boolean` to `AtNodeState` (consistent with `isAtLoopEnd` pattern). Set to `true` when `currentNodeId` refers to a snippet node.
- **D-06:** Runner halts at snippet node in `at-node` state — does NOT auto-advance, does NOT error. `advanceThrough()` gains `case 'snippet':` identical in structure to `case 'loop-end':`.
- **D-07:** Halting at snippet node does NOT push undo entry — no mutation occurred yet.
- **D-08:** Phase 20 engine changes re-applied as Wave 0 (see details below).

### Claude's Discretion

- Whether to keep `FreeTextInputNode` interface in `graph-model.ts` for historical reference or delete it entirely.
- Exact error message wording for any future snippet-specific validator errors.
- Test file naming and assertion count for `SnippetNode` parse tests.
- Whether to add a `nodeLabel()` case for `'snippet'` in `graph-validator.ts`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNIPPET-01 | Snippet node type exists in pure graph layer — model, parser, validator, runner — with TypeScript exhaustive-switch coverage and correct undo behaviour; no UI wiring | All five sections below directly enable implementation: model shape (D-01–D-03), parser case, validator rule (D-04), runner halt (D-05–D-07), and Phase 20 recovery (D-08) |
</phase_requirements>

---

## Summary

Phase 22 is a pure-TypeScript surgery on five files with no Obsidian API contact. All decisions are fully locked in CONTEXT.md. There is no external library research needed — the work is extending existing discriminated-union patterns already proven in the codebase.

The work has two distinct parts. **Wave 0** re-applies Phase 20 engine changes that were lost in the Phase 21 worktree merge. These changes are exactly specified in commits `9861db2` and `a633de8` and in `session-model.ts` (which still contains `awaiting-snippet-fill` and `snippetId`/`snippetNodeId` fields that must be cleaned up). **Wave 1** adds the `snippet` node kind to the union and propagates it through all layers.

The biggest risk is incomplete Wave 0 cleanup. The current HEAD contains dead code from old Phase 5/20 that was re-introduced during Phase 21 merge: `awaiting-snippet-fill` in `RunnerStatus`, `AwaitingSnippetFillState` in `runner-state.ts`, `snippetId`/`snippetNodeId` in `PersistedSession`, `enterFreeText()`, `completeSnippet()`, private `snippetId`/`snippetNodeId` fields in `protocol-runner.ts`, and `FreeTextInputNode` in `graph-model.ts`. The planner must treat Wave 0 as a prerequisite gate — all files listed below must be clean before the `snippet` union member is added.

**Primary recommendation:** Execute Wave 0 cleanup first as a single atomic commit that mirrors `9861db2 + a633de8`. Only after `tsc --noEmit` is clean and `vitest run` is green (except the 3 pre-existing RED tests in `runner-extensions.test.ts`) should Wave 1 begin.

---

## Current Codebase State (VERIFIED)

### Files that contain Phase 20 regression debt

[VERIFIED: direct file read]

| File | Regression Present | Evidence |
|------|-------------------|----------|
| `src/graph/graph-model.ts` | YES | `'free-text-input'` in `RPNodeKind` union; `FreeTextInputNode` interface; `FreeTextInputNode` in `RPNode` union |
| `src/graph/canvas-parser.ts` | YES | `'free-text-input'` in `validKinds[]`; `case 'free-text-input':` in `parseNode()`; no `DEPRECATED_KINDS`; imports `FreeTextInputNode` |
| `src/graph/graph-validator.ts` | YES | `case 'free-text-input':` in `nodeLabel()` switch |
| `src/runner/runner-state.ts` | YES | `'awaiting-snippet-fill'` in `RunnerStatus`; `AwaitingSnippetFillState` interface; `AwaitingSnippetFillState` in `RunnerState` union |
| `src/runner/protocol-runner.ts` | YES | `private snippetId`; `private snippetNodeId`; `enterFreeText()` method; `completeSnippet()` method; `case 'awaiting-snippet-fill':` in `getState()`; `runnerStatus: 'at-node' \| 'awaiting-snippet-fill'` in `getSerializableState()` / `restoreFrom()` |
| `src/sessions/session-model.ts` | YES | `runnerStatus: 'at-node' \| 'awaiting-snippet-fill'`; `snippetId: string \| null`; `snippetNodeId: string \| null` |

### Files that are CORRECT (no changes needed in Wave 0)

[VERIFIED: direct file read]

| File | Status |
|------|--------|
| `src/canvas/node-color-map.ts` | Already pre-declares `'snippet': '6'`. Type annotation is `Record<string, string>` — will be tightened in Wave 1 (D-03). |
| `src/__tests__/canvas-parser.test.ts` | Does NOT currently have DEPRECATED_KINDS tests — Wave 0 must add them. |
| `src/__tests__/runner-extensions.test.ts` | Has 3 RED tests that are pre-existing (RUN-11, D-04, D-07 from Phase 23). They are NOT regressions. Do not fix them in Phase 22. |

### Test suite current state

[VERIFIED: `npx vitest run`]

- 138 tests PASS, 3 tests FAIL (all in `runner-extensions.test.ts`, pre-existing RED for Phase 23).
- `tsc --noEmit` produces errors only in `node_modules/` (vitest/vite type resolution issue with `moduleResolution`). Project source files compile without errors when tested via `npx vitest run` (vitest handles transpilation independently).

---

## Standard Stack

### Core (no new dependencies needed)

[VERIFIED: direct file read — all are already present in codebase]

| Library | Purpose | Notes |
|---------|---------|-------|
| TypeScript discriminated unions | Type-safe node kind routing | `switch (node.kind)` with `default: never` exhaustiveness |
| Vitest | Unit testing | Already configured; pure Node.js environment |

**No new npm packages required.** This phase is purely additive TypeScript surgery on existing files.

---

## Architecture Patterns

### Pattern 1: Adding a new RPNodeKind — the complete checklist

[VERIFIED: direct file read of existing `loop-end` addition as reference]

Every new node kind requires changes in exactly these locations (in dependency order):

1. **`graph-model.ts`**: Add `| 'kind-name'` to `RPNodeKind`. Add interface `KindNameNode extends RPNodeBase`. Add `| KindNameNode` to `RPNode` union.
2. **`canvas-parser.ts`**: Add `'kind-name'` to `validKinds[]`. Add `case 'kind-name':` to `parseNode()` switch. Add interface to import list.
3. **`graph-validator.ts`**: Add `case 'kind-name':` to `nodeLabel()` switch (optional but recommended for error messages).
4. **`runner-state.ts`**: Add optional flag to `AtNodeState` if the runner needs to signal this node kind to UI (D-05).
5. **`protocol-runner.ts`**: Add `case 'kind-name':` to `advanceThrough()` switch. Update `resolveSeparator()` union if the node produces text (snippet does NOT produce text automatically — skip this).
6. **`node-color-map.ts`**: Type annotation tightened from `Record<string, string>` to `Record<RPNodeKind, string>` (D-03). No logic change — `'snippet'` key already present.

### Pattern 2: Halt-at-node (the `loop-end` template for `snippet`)

[VERIFIED: direct file read of `protocol-runner.ts` lines 507-511]

```typescript
// Source: src/runner/protocol-runner.ts — case 'loop-end' (exact template)
case 'loop-end': {
  // Halt here — RunnerView will render "loop again / done" prompt (LOOP-02)
  this.currentNodeId = cursor;
  this.runnerStatus = 'at-node';
  return;
}
```

`case 'snippet':` is identical in structure — halt, set `currentNodeId`, set `runnerStatus = 'at-node'`, return. No undo push (D-07).

### Pattern 3: AtNodeState optional flag (the `isAtLoopEnd` template for `isAtSnippetNode`)

[VERIFIED: direct file read of `runner-state.ts` line 34 and `protocol-runner.ts` line 285]

```typescript
// Source: src/runner/runner-state.ts — existing AtNodeState
isAtLoopEnd?: boolean;  // template for:
isAtSnippetNode?: boolean;  // D-05

// Source: src/runner/protocol-runner.ts — getState() at-node case
isAtLoopEnd: this.graph?.nodes.get(this.currentNodeId ?? '')?.kind === 'loop-end',
// becomes additionally:
isAtSnippetNode: this.graph?.nodes.get(this.currentNodeId ?? '')?.kind === 'snippet',
```

### Pattern 4: DEPRECATED_KINDS silent skip

[VERIFIED: commit `9861db2` diff — exact code to add]

```typescript
// Source: commit 9861db2 — add at module scope in canvas-parser.ts, before class CanvasParser
/** Node types that existed in older plugin versions but are no longer supported.
 * Nodes with these types are silently excluded from the ProtocolGraph (NTYPE-01, NTYPE-02). */
const DEPRECATED_KINDS = new Set<string>(['free-text-input']);
```

In `parseNode()`, immediately after the `typeof kind !== 'string'` check:

```typescript
// Source: commit 9861db2
if (DEPRECATED_KINDS.has(kind)) return null; // silently skip deprecated node type (NTYPE-01)
```

### Pattern 5: SnippetNode interface shape

[VERIFIED: CONTEXT.md D-01, D-02; pattern from LoopEndNode and TextBlockNode in graph-model.ts]

```typescript
// Follows LoopEndNode / TextBlockNode pattern
export interface SnippetNode extends RPNodeBase {
  kind: 'snippet';
  /** Per-node override for the folder from which the file picker opens.
   *  undefined means use the global setting (Phase 24). */
  folderPath?: string;
  /** Label for the file-picker button rendered in Phase 25.
   *  Falls back to canvas node text, then to "Select file". */
  buttonLabel?: string;
}
```

### Pattern 6: canvas-parser `case 'snippet':` construction

[VERIFIED: pattern from `case 'text-block':` and `case 'loop-end':` in canvas-parser.ts]

```typescript
case 'snippet': {
  const node: SnippetNode = {
    ...base,
    kind: 'snippet',
    folderPath: props['radiprotocol_snippetFolderPath'] !== undefined
      ? getString(props, 'radiprotocol_snippetFolderPath')
      : undefined,
    buttonLabel: props['radiprotocol_buttonLabel'] !== undefined
      ? getString(props, 'radiprotocol_buttonLabel')
      : undefined,
  };
  return node;
}
```

### Pattern 7: `session-model.ts` narrowing (Wave 0)

[VERIFIED: commit `a633de8` diff + direct read of `session-model.ts`]

`PersistedSession.runnerStatus` must be narrowed from `'at-node' | 'awaiting-snippet-fill'` to `'at-node'` only. Fields `snippetId` and `snippetNodeId` must be removed. This mirrors the `restoreFrom()` / `getSerializableState()` change in `protocol-runner.ts`.

---

## Wave Execution Order

### Wave 0 — Phase 20 Recovery (prerequisite gate)

[VERIFIED: commit diffs `9861db2` + `a633de8` + direct file reads]

Execute all items before proceeding to Wave 1. Gate: `tsc --noEmit` clean on project source + vitest 138 pass / 3 pre-existing RED.

**Files to change in Wave 0:**

| File | Changes |
|------|---------|
| `src/graph/graph-model.ts` | Remove `\| 'free-text-input'` from `RPNodeKind`. Remove `FreeTextInputNode` interface (Claude's discretion: delete or keep as comment). Remove `\| FreeTextInputNode` from `RPNode` union. |
| `src/graph/canvas-parser.ts` | Add `DEPRECATED_KINDS` set at module scope. Add `if (DEPRECATED_KINDS.has(kind)) return null;` check. Remove `'free-text-input'` from `validKinds[]`. Remove `case 'free-text-input':` from `parseNode()`. Remove `FreeTextInputNode` from import list. Remove `radiprotocol_snippetId` line from `case 'text-block':` (the `snippetId` field is gone from `TextBlockNode`). |
| `src/graph/graph-validator.ts` | Remove `case 'free-text-input':` from `nodeLabel()` switch. |
| `src/runner/runner-state.ts` | Remove `\| 'awaiting-snippet-fill'` from `RunnerStatus`. Remove `AwaitingSnippetFillState` interface. Remove `\| AwaitingSnippetFillState` from `RunnerState` union. Update comment from "Five runner statuses" to "Four runner statuses". Update `AtNodeState` JSDoc. |
| `src/runner/protocol-runner.ts` | Remove `private snippetId` and `private snippetNodeId` fields. Remove assignments to them in `start()` and `stepBack()`. Delete `enterFreeText()` method. Delete `completeSnippet()` method. Remove `case 'awaiting-snippet-fill':` from `getState()`. Narrow `getSerializableState()` return type to `runnerStatus: 'at-node'` only; remove `snippetId`/`snippetNodeId` from returned object. Narrow `restoreFrom()` parameter type similarly; remove `snippetId`/`snippetNodeId` assignments. Remove `FreeTextInputNode` from `resolveSeparator()` union. Update JSDoc on `syncManualEdit()` to remove `enterFreeText()` reference. |
| `src/sessions/session-model.ts` | Narrow `runnerStatus` to `'at-node'` only. Remove `snippetId` and `snippetNodeId` fields. |
| `src/__tests__/canvas-parser.test.ts` | Add `DEPRECATED_KINDS` tests from commit `9861db2` (inline JSON fixture for `free-text-input` silent skip + edge drop tests). |
| `src/__tests__/runner/protocol-runner.test.ts` | Remove any tests that reference `enterFreeText`, `completeSnippet`, or `awaiting-snippet-fill` status (mirror commit `9861db2` test fix). |
| `src/__tests__/runner/protocol-runner-session.test.ts` | Remove `snippetId`/`snippetNodeId` from session fixtures (mirror commit `9861db2`). |

### Wave 1 — Add Snippet Node Kind

[VERIFIED: all patterns from CONTEXT.md and direct file reads]

**Files to change in Wave 1:**

| File | Changes |
|------|---------|
| `src/graph/graph-model.ts` | Add `\| 'snippet'` to `RPNodeKind`. Add `SnippetNode` interface. Add `\| SnippetNode` to `RPNode` union. |
| `src/graph/canvas-parser.ts` | Add `SnippetNode` to imports. Add `'snippet'` to `validKinds[]`. Add `case 'snippet':` to `parseNode()`. |
| `src/graph/graph-validator.ts` | Add `case 'snippet':` to `nodeLabel()` switch returning `node.buttonLabel \|\| node.id`. No dead-end check addition (D-04). |
| `src/runner/runner-state.ts` | Add `isAtSnippetNode?: boolean` to `AtNodeState`. |
| `src/runner/protocol-runner.ts` | Add `case 'snippet':` to `advanceThrough()`. Update `getState()` at-node branch to set `isAtSnippetNode`. |
| `src/canvas/node-color-map.ts` | Change type annotation from `Record<string, string>` to `Record<RPNodeKind, string>`. No logic change. |
| `src/__tests__/canvas-parser.test.ts` | Add parse tests for snippet node (field mapping for `folderPath`, `buttonLabel`; terminal snippet node parses without error). |
| `src/__tests__/graph-validator.test.ts` | Add test: snippet node with no outgoing edges does NOT produce validator error. |
| `src/__tests__/runner/protocol-runner.test.ts` | Add test: runner halts at snippet in `at-node` state with `isAtSnippetNode: true`. Add test: `canStepBack` is false immediately after halt at snippet. |
| `src/__tests__/fixtures/` | Add `snippet-node.canvas` fixture (start → question → answer → snippet node, no outgoing edge from snippet). |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Type exhaustiveness | Manual null checks on `node.kind` | `default: never` pattern already in `advanceThrough()` and `getState()` — adding cases restores exhaustiveness automatically |
| Deprecated node backward compat | Return error for unknown kind | `DEPRECATED_KINDS` set with `return null` — exact code from commit `9861db2` |
| Graph terminal detection | Custom "has no outgoing edges" validator for snippet | Reuse existing reachability check; simply do NOT add a dead-end error for snippet (D-04) |

---

## Common Pitfalls

### Pitfall 1: Partial Wave 0 — adding `snippet` before removing `free-text-input`

**What goes wrong:** TypeScript exhaustiveness checks in `advanceThrough()` and `getState()` will produce wrong errors — the compiler sees both the old dead code AND the new cases.
**Why it happens:** Files are modified in wrong order; Wave 0 items missed.
**How to avoid:** Complete ALL Wave 0 file changes and verify `tsc --noEmit` passes before touching Wave 1.

### Pitfall 2: Forgetting `session-model.ts` in Wave 0

**What goes wrong:** `PersistedSession` still has `snippetId`/`snippetNodeId` and `awaiting-snippet-fill` even after `runner-state.ts` is cleaned. Type mismatch between `PersistedSession.runnerStatus` and `protocol-runner.ts` `restoreFrom()` parameter.
**Why it happens:** `session-model.ts` is not in the `src/graph/` or `src/runner/` directories — easy to miss.
**How to avoid:** Include `src/sessions/session-model.ts` explicitly in Wave 0 file list.

### Pitfall 3: Removing `snippetId` from `TextBlockNode` but not from `snippet-block.canvas` fixture handling

**What goes wrong:** `snippet-block.canvas` test fixture contains `radiprotocol_snippetId` field. After removing `snippetId` from `TextBlockNode`, the parser's `case 'text-block':` no longer reads it, but the fixture file still has it — silently ignored (correct behavior, no fix needed).
**Why it happens:** Concern about the existing fixture.
**Resolution:** The fixture is fine as-is. `radiprotocol_snippetId` in the JSON becomes an unread field after the `snippetId` property is removed from `TextBlockNode`. The parser uses index signature `[key: string]: unknown` on `RawCanvasNode` so no parse error occurs.

### Pitfall 4: Adding `isAtSnippetNode` to `getState()` but not setting it

**What goes wrong:** `isAtSnippetNode` is always `undefined` even at a snippet node.
**Why it happens:** Pattern copy from `isAtLoopEnd` is incomplete.
**How to avoid:** The `getState()` at-node return must include `isAtSnippetNode: this.graph?.nodes.get(this.currentNodeId ?? '')?.kind === 'snippet'` alongside the existing `isAtLoopEnd` line.

### Pitfall 5: Undo entry pushed at snippet halt (violates D-07)

**What goes wrong:** Runner pushes undo entry when halting at snippet, but no mutation occurred. Undo stack grows incorrectly.
**Why it happens:** Copy-pasting from `chooseAnswer()` flow instead of from `case 'loop-end':` flow.
**How to avoid:** `case 'snippet':` in `advanceThrough()` must NOT call `this.undoStack.push(...)`. Undo is only pushed by the caller methods (`chooseAnswer`, `chooseLoopAction`) before mutation. Phase 25 will push undo when file is selected.

---

## Test Fixture Design

[VERIFIED: existing fixture patterns in `src/__tests__/fixtures/`]

New fixture needed: `snippet-node.canvas`

Minimum viable shape:
```json
{
  "nodes": [
    { "id": "n-start", "type": "text", "text": "Start", "x": 0, "y": 0, "width": 200, "height": 60, "radiprotocol_nodeType": "start" },
    { "id": "n-q1", "type": "text", "text": "Q1", "x": 0, "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "question", "radiprotocol_questionText": "Insert report?" },
    { "id": "n-a1", "type": "text", "text": "Yes", "x": 0, "y": 240, "width": 200, "height": 60, "radiprotocol_nodeType": "answer", "radiprotocol_answerText": "Yes" },
    { "id": "n-snip1", "type": "text", "text": "Select file", "x": 0, "y": 360, "width": 200, "height": 60, "radiprotocol_nodeType": "snippet", "radiprotocol_buttonLabel": "Select template", "radiprotocol_snippetFolderPath": "Templates" }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-q1" },
    { "id": "e2", "fromNode": "n-q1", "toNode": "n-a1" },
    { "id": "e3", "fromNode": "n-a1", "toNode": "n-snip1" }
  ]
}
```

This fixture covers: snippet node with both optional fields set, snippet as terminal node (no outgoing edge).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (configured in `vitest.config.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/__tests__/canvas-parser.test.ts src/__tests__/graph-validator.test.ts src/__tests__/runner/protocol-runner.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SNIPPET-01 | `tsc --noEmit` passes after adding `snippet` to `RPNodeKind` | type-check | `npx tsc --noEmit` (on source only) | N/A — compiler check |
| SNIPPET-01 | Canvas file with snippet-type node parses without errors | unit | `npx vitest run src/__tests__/canvas-parser.test.ts` | ❌ new test needed |
| SNIPPET-01 | Graph validator accepts snippet node in valid graph, rejects unreachable snippet | unit | `npx vitest run src/__tests__/graph-validator.test.ts` | ❌ new test needed |
| SNIPPET-01 | Runner halts at snippet in `at-node` state (does not auto-advance, does not error) | unit | `npx vitest run src/__tests__/runner/protocol-runner.test.ts` | ❌ new test needed |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/canvas-parser.test.ts src/__tests__/graph-validator.test.ts src/__tests__/runner/protocol-runner.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (138+ tests, 3 pre-existing RED in `runner-extensions.test.ts` are acceptable) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/canvas-parser.test.ts` — add DEPRECATED_KINDS tests (inline fixture, no file needed)
- [ ] `src/__tests__/fixtures/snippet-node.canvas` — fixture for Wave 1 tests
- [ ] `src/__tests__/canvas-parser.test.ts` — add `case 'snippet':` parse tests
- [ ] `src/__tests__/graph-validator.test.ts` — add snippet dead-end valid test
- [ ] `src/__tests__/runner/protocol-runner.test.ts` — add snippet halt + `isAtSnippetNode` + `canStepBack` false tests

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — purely TypeScript source file changes).

---

## Security Domain

Step skipped — no security-relevant operations. This phase adds a node type to a pure in-memory graph model with no I/O, no authentication, no user input processing, and no external service calls.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `src/__tests__/runner/protocol-runner.test.ts` currently has no tests referencing `enterFreeText` or `completeSnippet` that would break after Wave 0 | Wave 0 file list | Commit `9861db2` already fixed these tests — but if HEAD has re-introduced them, Wave 0 must re-remove them |

All other claims in this research are [VERIFIED] by direct file reads or git diff inspection.

---

## Open Questions

1. **FreeTextInputNode interface deletion (Claude's Discretion)**
   - What we know: No external consumers remain after Wave 0. The interface is used only within `graph-model.ts` itself (in the `RPNode` union).
   - What's unclear: Whether a JSDoc comment or tombstone comment would aid future readers.
   - Recommendation: Delete the interface entirely — keeping it would create confusion about why it's not in `RPNodeKind`. A git history is sufficient tombstone.

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `src/graph/graph-model.ts` — current RPNodeKind union, FreeTextInputNode presence confirmed
- Direct file read: `src/graph/canvas-parser.ts` — DEPRECATED_KINDS absence, free-text-input in validKinds confirmed
- Direct file read: `src/graph/graph-validator.ts` — nodeLabel switch, dead-end check logic confirmed
- Direct file read: `src/runner/runner-state.ts` — awaiting-snippet-fill, AwaitingSnippetFillState presence confirmed
- Direct file read: `src/runner/protocol-runner.ts` — enterFreeText, completeSnippet, snippetId/snippetNodeId presence confirmed; loop-end halt pattern confirmed
- Direct file read: `src/sessions/session-model.ts` — awaiting-snippet-fill and snippetId/snippetNodeId fields confirmed
- Direct file read: `src/canvas/node-color-map.ts` — snippet pre-declared, type annotation confirmed
- `git show 9861db2` — exact diff for Phase 20 engine recovery (DEPRECATED_KINDS + dead code removal)
- `git show a633de8` — exact diff for Phase 20 type model purge
- Direct file read: `src/__tests__/canvas-parser.test.ts`, `src/__tests__/graph-validator.test.ts`, `src/__tests__/runner/protocol-runner.test.ts` — existing test coverage baseline
- `npx vitest run` output — 138 pass, 3 pre-existing RED confirmed

---

## Metadata

**Confidence breakdown:**
- Wave 0 recovery scope: HIGH — exact diffs available from git history
- Wave 1 snippet implementation: HIGH — all patterns directly visible in existing codebase
- Test coverage design: HIGH — fixture patterns and test structure directly observable

**Research date:** 2026-04-11
**Valid until:** Until any of the five target files are modified outside this phase
