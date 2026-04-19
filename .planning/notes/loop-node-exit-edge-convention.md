---
title: "Loop-node exit edge convention (+-prefix)"
date: 2026-04-19
context: design
supersedes:
  - "v1.7 literal-«выход» convention"
  - "Phase 49 labeled-edge convention (any non-empty label == exit)"
---

## Supersedes

This note supersedes the Phase 49 convention (the sole labeled outgoing edge of a loop
node is the exit) and the earlier v1.7 convention (the exit edge is whatever edge carries
the literal label «выход»). See Phase 50.1 CONTEXT for the rationale — Phase 49's «one
labeled edge == exit» rule conflicted with Phase 50's automatic sync of an Answer node's
`displayLabel` onto every incoming edge, because a loop body branch pointing to an
Answer with a displayLabel now legitimately carries a label.

## Rule

For a loop-node, outgoing edges are interpreted by their label prefix:

- The exit edge is the outgoing edge whose label, after trim, starts with `+`.
  The caption shown on the Runner exit button is the text after the `+` (with any
  following whitespace stripped).
- All other outgoing edges are body branches. They may be unlabeled or carry any label
  that does not start with `+` — including labels placed there by Phase 50's
  Answer.displayLabel sync.

Exactly one +-prefixed outgoing edge is allowed per loop node.

## Validation

GraphValidator LOOP-04 emits five distinct Russian error texts (see
`.planning/phases/50.1-loop-exit-plus-prefix/50.1-CONTEXT.md` D-04..D-08 for the
verbatim strings):

- D-04: zero +-edges AND zero other labeled edges — clean zero-exit; author is told to
  mark exactly one outgoing edge with a `+` prefix.
- D-05: zero +-edges AND at least one labeled non-+ edge — legacy-hint; the error lists
  the candidate edge ids so the author can pick which to prefix.
- D-06: two or more +-edges — error lists offending edge ids; author removes `+` from
  all but one.
- D-07: zero non-+ outgoing edges — no body; author adds at least one body edge.
- D-08: a +-edge whose label has empty caption after stripping (for example the bare
  `+` or `+ `) — emitted once per offending edge.

Error-check order inside LOOP-04 is D-04/D-05 then D-06 then D-08 then D-07. Multiple
errors per loop node accumulate and are all shown in the Runner Error panel.

## Why

Phase 49 used «the sole labeled outgoing edge is the exit» as the exit discriminator.
Phase 50 then introduced automatic two-way sync between an Answer node's `displayLabel`
and the label on every incoming edge. On a multi-incoming topology where the same
Answer is reached both from a Question and from a loop body branch, Phase 50 would
legitimately place a label on the loop body edge — and Phase 49 would then misclassify
that body edge as a second exit, breaking validation. The +-prefix convention resolves
the conflict: the exit discriminator is no longer «does this edge have any label» but
«does the label start with `+`». Body edges may freely carry labels (including ones
written by Phase 50) without ambiguity.

Keeping the prefix in the source label (rather than a separate property) preserves the
property that the canvas `.canvas` JSON is the single source of truth: no migration
step, no `isExit` boolean, no separate export of «which edge is the exit». The author
sees «+выход» on the canvas edge and knows exactly what it means.

## How to apply

- Node Editor / canvas validation: LOOP-04 runs on save and before starting a Runner
  session. The five error texts above direct the author to the specific fix.
- Runner: for a loop-node, the picker renders one exit button per +-prefixed outgoing
  edge (uniqueness enforced by validator, so exactly one) and one body button per
  non-+ outgoing edge (labeled or unlabeled — both are bodies under this convention).
  Exit button caption uses `stripExitPrefix(label)`; body button caption uses
  `nodeLabel(targetNode)` per the shared `src/graph/node-label.ts` module.
- Legacy canvases using a bare `label: "выход"` (no `+`): no auto-migration. Validator
  emits D-05 directing the author to add `+` manually.

## Implementation anchors

- `src/graph/node-label.ts` — `isExitEdge` (D-10) and `stripExitPrefix` (D-09).
- `src/graph/graph-validator.ts` — LOOP-04 block with D-04..D-08 Russian error copy.
- `src/runner/protocol-runner.ts` — `chooseLoopBranch` dispatches via `isExitEdge`.
- `src/views/runner-view.ts` — awaiting-loop-pick arm; exit caption via
  `stripExitPrefix`; body caption via `nodeLabel`.
