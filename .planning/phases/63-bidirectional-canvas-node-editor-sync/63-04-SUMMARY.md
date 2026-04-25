---
phase: 63-bidirectional-canvas-node-editor-sync
plan: 04
subsystem: canvas-sync
tags: [canvas, node-editor, bidirectional-sync, edge-label, snapshot-diff]

requires:
  - phase: 63-01
    provides: reconciler + EdgeLabelSyncService foundation
  - phase: 63-02
    provides: EdgeLabelSyncService dispatch bus + snapshot diff
  - phase: 63-03
    provides: EditorPanelView subscribes to canvas-changed-for-node

provides:
  - collectIncomingSnippetEdgeEdits helper for outbound Snippet branch label → edge sync
  - saveNodeEdits Pattern B + Strategy A paths extended for snippetLabel
  - NodeFieldsSnapshot captures raw Obsidian text property
  - diffSnapshot synthesizes canonical radiprotocol field key from text changes
  - Duplicate-dispatch prevention when both text and radiprotocol_* change simultaneously
  - Test coverage for both gaps (10 new tests)

affects:
  - 63-VALIDATION.md (gap closure verification)
  - 63-UAT.md (mark gaps resolved)
  - Phase 64 (Node Editor Polish — builds on established sync contract)

tech-stack:
  added: []
  patterns:
    - "Symmetric helper pattern: collectIncomingSnippetEdgeEdits mirrors collectIncomingEdgeEdits"
    - "Canonical key synthesis: map raw text diff to radiprotocol_* field by RPNodeKind"
    - "Duplicate suppression: !(canonicalKey in fieldUpdates) guard prevents redundant dispatches"

key-files:
  created: []
  modified:
    - src/canvas/edge-label-sync-service.ts
    - src/views/editor-panel-view.ts
    - src/__tests__/edge-label-sync-service.test.ts
    - src/__tests__/views/editor-panel-canvas-sync.test.ts

key-decisions:
  - "Snippet node text changes are intentionally ignored for inbound sync (no canonical mapping)"
  - "Loop node text changes map to radiprotocol_headerText (consistent with existing outbound contract)"
  - "Duplicate-prevention guard uses in-operator check against fieldUpdates already collected in same pass"

patterns-established:
  - "Gap closure plan: atomic deviation-fix after 3-plan phase completes, preserving prior commits"
  - "Bidirectional sync completeness: outbound (form→canvas) and inbound (canvas→form) now cover all field kinds"

requirements-completed: [EDITOR-03, EDITOR-05]

duration: 15min
completed: 2026-04-25
---

# Phase 63 Plan 04: Gap Closure — Bidirectional Canvas ↔ Node Editor Sync

**Snippet branch label outbound writes incoming edge labels; canvas text edits inbound sync to form fields via canonical key synthesis**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-25T09:55:00Z
- **Completed:** 2026-04-25T10:01:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Closed Gap 1 (EDITOR-03): `collectIncomingSnippetEdgeEdits` enables atomic Snippet branch label → incoming Question→Snippet edge label writes in both Pattern B (live canvas) and Strategy A (vault.modify) paths.
- Closed Gap 2 (EDITOR-05): `EdgeLabelSyncService` now captures raw `text` in snapshots and diffs it; when `text` changes independently of `radiprotocol_*`, the service synthesizes the correct canonical field key based on `RPNodeKind` and dispatches a `fieldUpdates` event to the open Node Editor form.
- Full suite green: 764 passed (up from 754), 1 skipped, 0 regressions.
- Build green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Gap 1 — Outbound Snippet branch label → incoming edge sync** — `841d26a` (feat)
2. **Task 2: Gap 2 — Inbound canvas text → form field sync** — `624aad6` (feat)

**Plan metadata:** *(pending final docs commit)*

## Files Created/Modified
- `src/canvas/edge-label-sync-service.ts` — Added `collectIncomingSnippetEdgeEdits` helper; extended `NodeFieldsSnapshot` with `text`; added canonical key synthesis in `diffSnapshot`
- `src/views/editor-panel-view.ts` — Extended `saveNodeEdits` Pattern B and Strategy A paths to handle `radiprotocol_snippetLabel`; updated import
- `src/__tests__/views/editor-panel-canvas-sync.test.ts` — Added 4 Gap 1 tests (Pattern B, Strategy A, undefined deletion, Answer regression guard)
- `src/__tests__/edge-label-sync-service.test.ts` — Added 6 Gap 2 tests (Question, Answer, Text-block, Loop text diff, duplicate suppression, Snippet ignore)

## Decisions Made
- Snippet node `text` (directory/file path) is intentionally not mapped to any canonical radiprotocol field for inbound sync; `snippetLabel` is the only synced snippet field. This preserves the existing semantic separation between visual card text and branch label.
- The duplicate-prevention guard (`!(canonicalKey in fieldUpdates)`) ensures that when both `text` and `radiprotocol_*` change in the same reconcile pass, only one dispatch is emitted. This is preferred over merging values because the canonical field diff already carries the authoritative value.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

No new stubs introduced. The bidirectional sync contract is now complete for all field kinds.

## Threat Flags

No new threat surface introduced beyond the planned snapshot diff extension. The canonical key is derived from `snap.kind` (parser-validated `RPNodeKind`), not from user-controlled `text` content, satisfying T-63-04-01 mitigation.

## Next Phase Readiness

- Phase 64 (Node Editor Polish — Auto-grow & Text Block Quick-Create) can proceed. It builds on the same `formFieldRefs` + `registerFieldRef` infrastructure established in Phase 63.
- Phase 63 manual UAT checklist (3 items in 63-VALIDATION.md) should still be run to verify the full bidirectional sync end-to-end in Obsidian.

---
*Phase: 63-bidirectional-canvas-node-editor-sync*
*Completed: 2026-04-25*
