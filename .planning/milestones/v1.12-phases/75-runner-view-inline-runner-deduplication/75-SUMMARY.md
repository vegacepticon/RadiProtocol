# Phase 75 Summary — RunnerView ↔ InlineRunnerModal Deduplication

## Status

Completed.

## What changed

Phase 75 moved duplicated protocol-runner rendering out of the two host classes and into shared modules under `src/runner/render/`, using a strangler migration. `RunnerView` and `InlineRunnerModal` remain host shells for lifecycle, chrome, autosave/append policy, layout/position, and output-toolbar differences.

## Shared renderer modules

Created:

- `src/runner/runner-host.ts`
- `src/runner/runner-renderer.ts`
- `src/runner/runner-text.ts`
- `src/runner/snippet-label.ts`
- `src/runner/render/render-footer.ts`
- `src/runner/render/render-loop-picker.ts`
- `src/runner/render/render-question.ts`
- `src/runner/render/render-snippet-picker.ts`
- `src/runner/render/render-snippet-fill.ts`
- `src/runner/render/render-complete.ts`
- `src/runner/render/render-error.ts`

## Host files changed

- `src/views/runner-view.ts`
- `src/views/inline-runner-modal.ts`

The hosts now delegate rendering for:

- shared Back/Skip footer;
- `at-node` question/answer/snippet branch rendering;
- `awaiting-snippet-pick` / `SnippetTreePicker` mounting;
- `awaiting-loop-pick`;
- `awaiting-snippet-fill` loading/not-found helper logic;
- `complete` heading;
- error list rendering.

Host-specific behavior deliberately stayed in hosts:

- RunnerView manual-edit sync and autosave policy;
- InlineRunnerModal append-to-note delta policy;
- Inline detached-DOM guard;
- modal/sidebar chrome;
- output toolbar differences;
- SnippetFillInModal lifecycle gates;
- layout/position persistence.

## Tests

Created focused shared renderer tests:

- `src/__tests__/runner/runner-renderer-scaffold.test.ts`
- `src/__tests__/runner/render-loop-picker.test.ts`
- `src/__tests__/runner/render-question.test.ts`
- `src/__tests__/runner/render-snippet-picker.test.ts`
- `src/__tests__/runner/render-snippet-fill.test.ts`
- `src/__tests__/runner/render-complete.test.ts`
- `src/__tests__/runner/render-error.test.ts`

Created shared inline host fixture:

- `src/__tests__/runner/runner-renderer-host-fixtures.ts`

Consolidated duplicated inline test harness setup in:

- `src/__tests__/views/inline-runner-modal.test.ts`
- `src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts`
- `src/__tests__/views/inline-runner-modal-output-toolbar.test.ts`

## LOC metrics

View files:

```text
Before: runner-view.ts 1143 + inline-runner-modal.ts 1202 = 2345
After:  runner-view.ts  924 + inline-runner-modal.ts 1005 = 1929
Reduction: 416 LOC / 17.7%
```

DEDUP-02 test metric:

```text
Before inline test LOC: 2222
After consolidated LOC: 1555
Reduction: 667 LOC / 30.0%
Target: <=1555 — met exactly
```

## Notes

- Claude Code was used with `--dangerously-skip-permissions` after explicit user approval.
- No git commit was made.
- No push was made.
- No `ProtocolRunner` state machine, snippet service, canvas parser, or session persistence behavior was intentionally changed.
