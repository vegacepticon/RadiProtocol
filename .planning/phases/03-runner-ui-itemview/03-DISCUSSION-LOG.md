# Phase 3: Runner UI (ItemView) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 03-runner-ui-itemview
**Mode:** discuss
**Areas discussed:** Panel layout, Should-have scope, Answer button style

---

## Gray Areas Presented

| Area | Description | Prior decisions applied |
|------|-------------|------------------------|
| Panel layout | How to split RunnerView between question zone and live preview | No prior — first UI phase |
| Should-have scope | Which of RUN-10, RUN-11, UI-12 to include in Phase 3 | No prior |
| Answer button style | How to handle 8+ answer options in the narrow sidebar | No prior |

---

## Decisions Made

### Panel layout
- **Selected:** Вопрос сверху, превью снизу (Question top, preview bottom)
- **Detail:** Fixed question zone at top, scrollable preview below; independent scroll areas

### Should-have scope
- **Selected:** All three — RUN-11 (inline text editing), RUN-10 (start from node), UI-12 (color legend)
- **All three included in Phase 3 scope**

### Answer button style
- **Selected:** Вертикальный список (Vertical list)
- **Detail:** Full-width buttons, one per row, no grid, supports long anatomical labels

---

## Corrections Applied

None — all options chosen directly.

---

## Notes

- User requested discussion in Russian.
- RUN-11 (inline editing) requires adding `setAccumulatedText(text)` to `ProtocolRunner` — small
  extension to Phase 2 code; captured as D-04/D-05 in CONTEXT.md.
- RUN-10 (start from node) requires `start(graph, startNodeId?)` optional parameter — captured as D-07.
- `getState()`/`setState()` simplified for Phase 3: stores only `canvasFilePath` (no `sessionId`
  until Phase 7 SessionService is built) — captured as D-09.
