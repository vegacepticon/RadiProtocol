---
status: complete
phase: 22-snippet-node-graph-and-runner-layer
source: [22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md]
started: 2026-04-11T13:05:00Z
updated: 2026-04-11T13:25:00Z
---

## Current Test

[testing complete]

## Tests

### 1. TypeScript compiles with zero project-source errors
expected: Run `npx tsc --noEmit`. Zero errors from src/ files. (node_modules vitest/vite type noise is pre-existing — not counted.)
result: pass

### 2. Test suite — 142 pass, 3 pre-existing RED
expected: Run `npx vitest run`. Output shows 142 tests passed and exactly 3 failures in runner-extensions.test.ts (pre-existing RED stubs). No new failures.
result: pass

### 3. Canvas with deprecated free-text-input node loads silently
expected: Open (or run the parser on) a canvas file that contains a node with `radiprotocol_type: free-text-input`. The node should be silently skipped — no error thrown, no crash, and the rest of the graph loads normally.
result: pass

### 4. Canvas with snippet node parses into ProtocolGraph
expected: Open a canvas file containing a snippet-type node (e.g., `radiprotocol_type: snippet`). The graph is parsed successfully: the node appears in ProtocolGraph with `kind === 'snippet'`, and optional `folderPath` / `buttonLabel` fields are populated if present in the canvas file.
result: pass

### 5. Graph validator accepts snippet terminal node
expected: A snippet node at the end of a protocol (no outgoing edges) does NOT trigger a "dead-end" validation error. The graph validates cleanly.
result: pass

### 6. Runner halts at snippet node in at-node state
expected: Run a protocol that ends with a snippet node. The runner stops at the snippet node — status is `at-node`, it does NOT auto-advance, and no error is thrown.
result: pass

### 7. isAtSnippetNode signal is true when halted at snippet
expected: After the runner halts at a snippet node, `getState().isAtSnippetNode` is `true`. (Verifiable via the test suite or by inspecting runner state in code.)
result: pass

### 8. canStepBack is false immediately after halting at snippet
expected: Immediately after the runner halts at a snippet node, `getState().canStepBack` is `false` — the undo stack was not pushed (no mutation occurred at halt time).
result: pass
note: Unit test confirmed — snippet halt itself does not push to undo stack. In a real protocol run, Step Back is present due to prior answer choices (correct UX — avoids dead-end trap).

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
