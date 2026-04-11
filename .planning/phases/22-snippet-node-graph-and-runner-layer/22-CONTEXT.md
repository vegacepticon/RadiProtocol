# Phase 22: Snippet Node — Graph and Runner Layer — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the `snippet` node kind to the pure graph layer only: `RPNodeKind` union, `SnippetNode` interface, canvas parser (`validKinds` + `parseNode()` case), graph validator rules, and protocol runner halt (`advanceThrough()` case). No Obsidian API, no file picker, no UI wiring.

This phase also restores Phase 20 engine changes that were lost in the Phase 21 worktree merge (see D-05). Phase 23 depends on a clean HEAD — Phase 22 must deliver one.

Phase 25 handles all runner UI (file picker button, `SnippetFillInModal` integration).

</domain>

<decisions>
## Implementation Decisions

### SnippetNode Model Shape
- **D-01:** `SnippetNode` interface carries two `radiprotocol_*` fields:
  - `radiprotocol_snippetFolderPath` → `folderPath?: string` — per-node folder override (SNIPPET-07). `undefined` when not set; global setting from Phase 24 applies instead.
  - `radiprotocol_buttonLabel` → `buttonLabel?: string` — display label for the file-picker button in Phase 25. Falls back to the canvas node's `text` field if absent, then to a hardcoded default ("Select file") if both are empty.
- **D-02:** `SnippetNode` does NOT carry `prefix`/`suffix` fields in Phase 22. If needed later, they are a Phase 25+ concern.
- **D-03:** `RPNodeKind` union gains `| 'snippet'`. The `NODE_COLOR_MAP` in `node-color-map.ts` is already pre-declared for `'snippet'`; its type annotation should be strengthened from `Record<string, string>` to `Record<RPNodeKind, string>` once `'snippet'` joins the union.

### Graph Validator Rules for Snippet
- **D-04:** A snippet node with **no outgoing edges is valid** — by analogy with `text-block`, it is a legal terminal node. The runner completes the protocol after the user selects a file (Phase 25 handles the advance). The validator does NOT emit a dead-end error for snippet nodes.
- Dead-end reachability errors still apply (a snippet node that is unreachable from start is still flagged by the existing reachability check).

### Runner Halt and AtNodeState Signal
- **D-05 (AtNodeState):** Add `isAtSnippetNode?: boolean` to `AtNodeState` (consistent with the `isAtLoopEnd` pattern). Set to `true` when `currentNodeId` refers to a snippet node. Phase 25 reads this flag to render the file-picker button instead of answer buttons.
- **D-06 (Runner halt):** The runner halts at a snippet node in `at-node` state — does NOT auto-advance, does NOT error. The `advanceThrough()` switch gains a `case 'snippet':` block identical in structure to `case 'loop-end':` (halt with `this.currentNodeId = cursor; this.runnerStatus = 'at-node'; return;`).
- **D-07 (Undo):** Halting at a snippet node does NOT push an undo entry — no mutation has occurred yet. The undo invariant ("push before mutation") is maintained: Phase 25 will push the undo entry when the user selects a file and the runner appends text.

### Phase 20 Regression Recovery
- **D-08:** Phase 20 engine changes were lost when the Phase 21 worktree was merged into HEAD. Phase 22 **re-applies** these as its first plan (Wave 0):
  1. Add `DEPRECATED_KINDS = new Set<string>(['free-text-input'])` to `canvas-parser.ts` — silently skip deprecated nodes in `parseNode()`.
  2. Remove `'free-text-input'` from `validKinds` array and delete `case 'free-text-input':` from `parseNode()` switch.
  3. Remove `FreeTextInputNode` from `graph-model.ts` `RPNode` union (keep the interface for reference only, or delete it — Claude's discretion based on whether tests reference it).
  4. Delete `enterFreeText()` and `completeSnippet()` from `protocol-runner.ts`.
  5. Remove `awaiting-snippet-fill` from `RunnerStatus` union and `AtNodeState`-adjacent interfaces in `runner-state.ts`.
  6. Remove `case 'free-text-input':` from `advanceThrough()` halt block and `case 'awaiting-snippet-fill':` from `getState()`.
  7. Update `getSerializableState()` and `restoreFrom()` — remove snippetId/snippetNodeId fields.
  - This recovery plan mirrors commit `9861db2` + `a633de8` exactly — use those commits as the reference implementation.

### Claude's Discretion
- Whether to keep `FreeTextInputNode` interface in `graph-model.ts` for historical reference or delete it entirely (no external consumers remain after Phase 20 recovery).
- Exact error message wording for the validator if any snippet-specific errors are added in future phases.
- Test file naming and assertion count for `SnippetNode` parse tests.
- Whether to add a `nodeLabel()` case for `'snippet'` in `graph-validator.ts` (used for error message display).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/ROADMAP.md` — Phase 22 goal, success criteria, and dependency on Phase 20

### Source files to modify
- `src/graph/graph-model.ts` — `RPNodeKind` union (add `'snippet'`); add `SnippetNode` interface; add to `RPNode` union
- `src/graph/canvas-parser.ts` — `validKinds` array; `parseNode()` switch (add `case 'snippet':`); add `DEPRECATED_KINDS` (D-08)
- `src/graph/graph-validator.ts` — no new error for dead-end snippet; optionally add `nodeLabel()` case
- `src/runner/runner-state.ts` — `RunnerStatus` union (remove `awaiting-snippet-fill` per D-08); `AtNodeState` (add `isAtSnippetNode?: boolean` per D-05); remove `AwaitingSnippetFillState`
- `src/runner/protocol-runner.ts` — `advanceThrough()` switch (add `case 'snippet':` per D-06); remove `enterFreeText()`, `completeSnippet()`, `case 'free-text-input':` per D-08

### Phase 20 regression reference
- `git show 9861db2` — feat(20-02): DEPRECATED_KINDS + dead code removal (exact diff to re-apply)
- `git show a633de8` — feat(20-02): purge free-text-input from type model files

### Color map
- `src/canvas/node-color-map.ts` — `NODE_COLOR_MAP`; type annotation to strengthen from `Record<string, string>` to `Record<RPNodeKind, string>` after D-03

### Tests to update/create
- `src/__tests__/canvas-parser.test.ts` — add `case 'snippet':` parse tests; verify `DEPRECATED_KINDS` silently skips `free-text-input`
- `src/__tests__/graph-validator.test.ts` — verify snippet dead-end is NOT a validation error
- `src/__tests__/protocol-runner.test.ts` — verify runner halts at snippet in `at-node` state with `isAtSnippetNode: true`; verify `canStepBack` is false immediately after halt

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Patterns
- `case 'loop-end':` in `advanceThrough()` — exact pattern for `case 'snippet':` halt (D-06)
- `isAtLoopEnd?: boolean` in `AtNodeState` — exact pattern for `isAtSnippetNode?: boolean` (D-05)
- `DEPRECATED_KINDS` in commit `9861db2` — copy verbatim for D-08

### Integration Points
- `RPNode` union in `graph-model.ts` — add `| SnippetNode`
- `NODE_COLOR_MAP` in `node-color-map.ts` — type annotation tightening (D-03), no logic change
- `graph-validator.ts` `nodeLabel()` switch — add `case 'snippet':` returning `node.buttonLabel || node.id`

### TypeScript Exhaustiveness
- After D-08 removes `free-text-input` from the union and D-03 adds `snippet`, the `default: never` blocks in `advanceThrough()` and `getState()` will enforce exhaustiveness automatically — no extra work needed.

</code_context>

<specifics>
## Specific Notes from Discussion

- Snippet dead-end is valid terminal — "по аналогии с text-block"
- Phase 20 regression: повторно удалить в составе Phase 22 (Plan 0 / Wave 0)
- `isAtSnippetNode` добавить уже в Phase 22 по аналогии с `isAtLoopEnd` — Phase 25 получает чистый сигнал без обращения к графу

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-snippet-node-graph-and-runner-layer*
*Context gathered: 2026-04-11*
