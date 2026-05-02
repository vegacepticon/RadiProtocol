# Phase 75 Context — RunnerView ↔ InlineRunnerModal Deduplication

## Status

Planning complete; execution pending.

## Goal

Deduplicate runner step rendering between:

- `src/views/runner-view.ts` — sidebar/tab `ItemView` host.
- `src/views/inline-runner-modal.ts` — floating inline modal host.

The shared render logic should live under `src/runner/` and be consumed by both hosts. Host shells remain responsible only for host-specific chrome and lifecycle.

## Requirements

- `DEDUP-01`: single shared render module under `src/runner/` owns per-step UI rendering.
- `DEDUP-02`: runner-side test coverage is consolidated; zero behavior loss; inline-runner test LOC reduced by at least 30%.

## Baseline inventory

Source LOC before Phase 75 execution:

```text
1143 src/views/runner-view.ts
1202 src/views/inline-runner-modal.ts
2345 total
```

DEDUP-02 baseline inline test LOC:

```text
699 src/__tests__/views/inline-runner-modal.test.ts
511 src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts
420 src/__tests__/views/inline-runner-modal-output-toolbar.test.ts
361 src/__tests__/inline-runner-layout.test.ts
231 src/__tests__/views/inline-runner-position.test.ts
2222 total
```

30% reduction target for the DEDUP-02 file set: `<= 1555 LOC` after consolidation, including any new shared renderer test file counted as the replacement coverage.

Baseline targeted runner/inline test command:

```bash
npm test -- RunnerView inline-runner runner-snippet
```

Baseline result captured before planning:

```text
Test Files  11 passed (11)
Tests       92 passed (92)
EXIT:0
```

## Locked decisions

1. Use a strangler migration, not a big-bang rewrite.
2. Scaffold shared renderer and host interface first, then move states one-by-one.
3. Keep `ProtocolRunner` state machine unchanged.
4. Do not change snippet service, canvas parser, session persistence, or user-facing behavior.
5. Keep modal layout/drag/resize/position in `InlineRunnerModal`.
6. Keep selector bar, preview textarea, session autosave, close button, and output toolbar in `RunnerView`.
7. Do not consolidate tests until shared renderer behavior is stable.
8. Preserve existing test-visible/private host behavior during migration.
9. Opencode is not used until manually configured by the user.
10. Claude Code may be used for bounded planning/execution tasks; Hermes verifies every diff and test result.

## Architecture direction

Create shared modules under `src/runner/`:

```text
src/runner/runner-host.ts
src/runner/runner-renderer.ts
src/runner/snippet-label.ts
src/runner/runner-text.ts
src/runner/render/render-question.ts
src/runner/render/render-loop-picker.ts
src/runner/render/render-snippet-picker.ts
src/runner/render/render-snippet-fill.ts
src/runner/render/render-footer.ts
src/runner/render/render-complete.ts
src/runner/render/render-error.ts
```

The shared renderer receives a host adapter/callback interface. It must not own host chrome, modal layout, Obsidian `ItemView` state, or persistence concerns.

## Key host divergences to preserve

- `RunnerView` captures manual preview edits before runner mutations via `syncManualEdit` and autosaves sessions after mutations.
- `InlineRunnerModal` appends accumulator deltas to the target note after mutations.
- Snippet picker host class differs: `rp-stp-runner-host` vs `rp-stp-inline-host`.
- Snippet validation/not-found copy currently differs: RU in `RunnerView`, EN in inline modal. Preserve unless explicitly changed in a separate behavior phase.
- Inline modal has basename fallback scan and WR-03 double-prefix guard in snippet fill path resolution; keep as host responsibility.
- Back button double-click guard must remain synchronous.
- Output toolbar remains RunnerView-only.
- Modal drag/resize/layout/active-leaf behavior remains InlineRunnerModal-only.

## Execution policy

Execute plans sequentially: `75-01` → `75-07`.

After each code migration plan, run targeted tests plus build/lint. Final Phase 75 verification requires:

```bash
npm test
npm run build
npm run lint
git grep -nE "renderSnippetPicker|renderQuestion|renderAnswer|renderTextBlock|renderLoop" -- src/
wc -l src/views/runner-view.ts src/views/inline-runner-modal.ts
```
