# Phase 2: Core Protocol Runner Engine - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

The traversal engine correctly steps through all node types, accumulates protocol text, and reverts both navigation and text on step-back — verified entirely with unit tests, no Obsidian UI required. `ProtocolRunner`, `TextAccumulator`, and `RunnerState` are fully implemented and tested. No UI code in this phase.

</domain>

<decisions>
## Implementation Decisions

### Runner API Shape
- **D-01:** `ProtocolRunner` exposes separate methods per action — `start(graph)`, `chooseAnswer(answerId)`, `enterFreeText(text)`, `stepBack()`, `completeSnippet(renderedText)`, `getState()`. No polymorphic `advance()` method. Each call site is explicit about what action it represents; TypeScript enforces correct argument types.
- **D-02:** `getState()` returns a discriminated union snapshot — callers never access internal fields directly.

### Undo Granularity
- **D-03:** One undo entry = one user action (answer choice or free-text entry). Text-block auto-advances that happen after an answer are bundled into that answer's undo entry. `stepBack()` reverts to the state before the last user action — not to the last node visit.
- **D-04:** `TextAccumulator` stores full text snapshots (not diffs) per undo entry. Revert is O(1) and cannot partially corrupt text (RUN-07).

### Loop Node Handling in Phase 2
- **D-05:** When `ProtocolRunner` reaches a `loop-start` node, it immediately transitions to `error` state with message: `"Loop nodes are not yet supported — upgrade to Phase 6"`. This branch is the sole replacement point for Phase 6 loop implementation. No partial traversal of loop bodies in Phase 2.

### `awaiting-snippet-fill` Hook Design
- **D-06:** When runner reaches a `TextBlockNode` with a `snippetId`, it transitions to `awaiting-snippet-fill` state carrying `{ snippetId, nodeId }`. Phase 5 renders the snippet externally (modal + placeholder values) and calls `runner.completeSnippet(renderedText: string)`. Runner appends the ready string to accumulated text and advances. Runner has zero knowledge of snippet template format — stays pure.
- **D-07:** In Phase 2, the `awaiting-snippet-fill` state is reachable in tests by constructing a `TextBlockNode` with a `snippetId`. The method `completeSnippet(renderedText)` is implemented and tested; it simply accepts the pre-rendered string.

### Iteration Cap
- **D-08:** Hard maximum iteration count default: 50 (RUN-09). Configurable via `maxIterations` option passed to `ProtocolRunner` constructor. On hitting the cap, runner transitions to `error` state with a clear message.

### Claude's Discretion
- Internal undo stack data structure (array of snapshots vs. linked list)
- Exact shape of `RunnerState` discriminated union beyond what RUN-08 specifies
- How `start()` handles a graph that fails validation (error state vs. throw)
- Test fixture design for Phase 2 (extend existing fixtures or add new ones)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Runner Requirements
- `.planning/REQUIREMENTS.md` §RUN-01 through RUN-09 — all Phase 2 runner requirements
- `.planning/REQUIREMENTS.md` §NFR-01 — zero Obsidian API imports in engine modules

### Graph Model (Phase 1 output — already implemented)
- `src/graph/graph-model.ts` — `RPNode`, `RPEdge`, `ProtocolGraph`, `ParseResult` types; discriminated union on `kind` for 7 node types
- `src/runner/runner-state.ts` — `RunnerStatus` type already defined: `idle | at-node | awaiting-snippet-fill | complete | error`

### Architecture
- `.planning/research/ARCHITECTURE.md` §1 — component architecture; runner is a pure module in `src/runner/`

### Pitfalls
- `.planning/research/PITFALLS.md` — no `console.log`, no Obsidian imports, no floating promises

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/graph/graph-model.ts` — all 7 node types fully typed with discriminated union; ready to switch on `kind` in the runner
- `src/runner/runner-state.ts` — `RunnerStatus` union already defined; Phase 2 fills in the full `RunnerState` type around it
- `src/runner/protocol-runner.ts` — stub class with TODO comment; Phase 2 implements it
- `src/runner/text-accumulator.ts` — stub class with TODO comment; Phase 2 implements it
- `src/__tests__/fixtures/` — canvas fixtures from Phase 1 (`linear.canvas`, `branching.canvas`, `dead-end.canvas`, `cycle.canvas`); Phase 2 tests use parsed `ProtocolGraph` objects from these

### Established Patterns
- All engine modules: zero Obsidian API imports, pure TypeScript, fully Vitest-testable
- `noUncheckedIndexedAccess` enabled — all Map/array lookups return `T | undefined`; null-checks required throughout runner
- Node adjacency accessed via `graph.adjacency.get(nodeId)` — returns `string[] | undefined`

### Integration Points
- `CanvasParser.parse()` → `ProtocolGraph` — this is the runner's only input; no other integration in Phase 2
- Phase 3 (UI) will call `runner.start()`, `runner.chooseAnswer()`, `runner.enterFreeText()`, `runner.stepBack()`, `runner.getState()` — API shape locked by D-01/D-02
- Phase 5 (Snippets) will call `runner.completeSnippet(renderedText)` — hook locked by D-06/D-07

</code_context>

<specifics>
## Specific Ideas

- No specific UI or UX references — Phase 2 is pure engine code, no visible UI.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-core-protocol-runner-engine*
*Context gathered: 2026-04-06*
