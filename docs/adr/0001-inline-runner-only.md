# ADR 0001: Inline runner is the only protocol execution surface

## Status

Accepted — implemented in RadiProtocol 1.15.0.

## Context

Historically RadiProtocol exposed three protocol-runner hosts:

- `RunnerView` as an Obsidian sidebar/right-leaf view.
- `RunnerView` as a workspace tab.
- `InlineRunnerModal` as a draggable floating runner anchored to the active Markdown note.

All hosts consumed the same `ProtocolRunner` state machine, but the duplicated host lifecycle and rendering contracts created repeated maintenance cost:

- runner UI fixes had to be checked against sidebar, tab, and inline modes;
- `RunnerView` owned session recovery and selector chrome that did not match the note-anchored inline workflow;
- CSS and tests had mode-specific branches that kept drifting after each runner change;
- future protocol execution is expected to write directly into the target note while the user works in context.

By 1.15.0 the pure runner engine and inline host were mature enough to remove the sidebar/tab host instead of continuing to deduplicate it.

## Decision

RadiProtocol supports a single protocol execution surface: `InlineRunnerModal`.

The plugin keeps these boundaries:

- `ProtocolRunner` remains the pure traversal/state machine.
- `InlineRunnerModal` owns runtime UI, note insertion, floating layout, and per-instance lifecycle.
- Plugin-level registry keys inline runner instances by `canvasPath#notePath` and prevents duplicate runners for the same pair.
- Commands that start execution require an active Markdown note, then launch an inline runner against that note.
- Sidebar/tab `RunnerView`, canvas selector view chrome, and `RunnerView` session-recovery coordinator are not product surfaces.

## Consequences

Positive:

- one runtime host to test and maintain;
- less CSS and view-layer code;
- no sidebar/tab/inline parity matrix for future runner changes;
- runner behavior aligns with the product workflow: generate protocol text directly into the active note.

Negative / trade-offs:

- users who preferred a persistent sidebar/tab runner must use the inline command flow;
- old `RunnerView` session recovery is no longer part of the user contract;
- some historical comments, tests, and planning artifacts may still mention `RunnerView` until cleanup phases remove or reword them.

## Migration notes

- Public docs must not advertise sidebar/tab runner modes after 1.15.0.
- Agent instructions must not mention deleted CSS files such as `runner-view.css` or `canvas-selector.css`.
- `.planning/` remains local historical GSD context and is intentionally gitignored; architectural decisions that need to survive outside that local context belong in tracked ADRs under `docs/adr/`.
- Do not restore `RunnerView` to solve inline-runner issues. Fix the inline host or add a new explicitly scoped host behind a separate ADR.
- `SessionService` is retained as a legacy/future-compatible session utility while `start-from-node` still clears stale canvas sessions. Full removal or inline session recovery must be handled by a separate behavior phase.

## Alternatives considered

1. **Keep all three hosts and continue deduplication.** Rejected: Phase 75 reduced duplication but did not remove the parity burden.
2. **Keep sidebar/tab as deprecated hidden commands.** Rejected: hidden hosts still require tests, CSS, and bug fixes.
3. **Move all `.planning/` history into tracked docs.** Rejected: most phase artifacts are implementation history, not durable architecture. ADRs should capture live decisions only.
