# Phase 2: Core Protocol Runner Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 02-core-protocol-runner-engine
**Mode:** discuss
**Areas discussed:** Runner API Shape, Undo Granularity, Loop Node Handling, Snippet Hook Design

---

## Gray Areas Presented

### Runner API Shape
| Option | Description |
|--------|-------------|
| Separate methods (chosen) | `chooseAnswer()`, `enterFreeText()`, `stepBack()`, `completeSnippet()` — explicit per-action |
| Single `advance(input?)` | Polymorphic — more compact but less explicit |

### Loop Node Handling in Phase 2
| Option | Description |
|--------|-------------|
| Error state (chosen) | Transition to `error` with "not yet supported" message |
| Basic traversal + cap | Follow continue edge, enforce maxIterations — partial support |

### `awaiting-snippet-fill` Resume Hook
| Option | Description |
|--------|-------------|
| `completeSnippet(renderedText)` (chosen) | Phase 5 renders externally, passes ready string — runner stays pure |
| `fillSnippet(snippetId, values)` | Runner renders — couples runner to snippet format |

---

## Confident Assumptions (Not Discussed — Locked from Requirements)

| Assumption | Source |
|------------|--------|
| TextAccumulator uses full snapshots, not diffs | RUN-07 |
| Undo is per-answer/free-text action, not per node visit | Success criterion 3 |
| Text-block auto-advances bundle into preceding answer's undo entry | Implied by SC-3 |
| Max iterations default: 50 | RUN-09 |
| Zero Obsidian API imports | NFR-01 |

---

## User Decisions

All three gray areas — user confirmed first option in each case.

### Runner API
- **Chosen:** Separate methods per action
- **Reason:** Explicit, easy to test, TypeScript enforces correct types at call sites

### Loop Handling
- **Chosen:** Error state
- **Reason:** Clean, honest, minimal Phase 2 scope; single replacement point for Phase 6

### Snippet Hook
- **Chosen:** `completeSnippet(renderedText)`
- **Reason:** Runner stays pure — no snippet template knowledge; Phase 5 owns rendering

---

## No Corrections — All Recommendations Confirmed
