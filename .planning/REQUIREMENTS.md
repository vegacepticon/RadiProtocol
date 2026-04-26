# Requirements: RadiProtocol v1.10

**Defined:** 2026-04-25
**Milestone:** v1.10 — Editor Sync & Runner UX Polish
**Core Value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

## v1.10 Requirements

### Node Editor

- [x] **EDITOR-03**: Snippet node's Node Editor "branch label" field drives the outgoing edge label on canvas — when author sets a custom branch label, the edge displays that label (mirroring the Answer↔edge bidirectional sync established in Phase 50). The canvas node's own text continues to display the selected directory or file path, unchanged. Editing the edge label directly on canvas updates the branch label field in Node Editor in real time.

- [x] **EDITOR-04**: Every text input field on every node kind uses the Question-node's auto-grow textarea behavior — Answer text, Text block text, Snippet node branch label, Loop headerText, and any other multi-line text fields grow with content instead of showing a fixed-height box with an inner scrollbar. Implemented 2026-04-25 in Phase 64; UAT 7/7 PASS (scenarios 1–5 cover auto-grow across every multi-line field).

- [x] **EDITOR-05**: Bidirectional live synchronization between canvas node text and Node Editor form fields — when the author edits text directly on a canvas node, the corresponding field in the open Node Editor form updates in real time (current behavior: form → canvas only). Applies to Question text, Answer text, Text block text, Snippet node label, Loop headerText.

- [x] **EDITOR-06**: Node Editor toolbar exposes a fifth quick-create button "Create text block" alongside the existing four (Question, Answer, Snippet, Loop) — one click creates a text-block node on canvas with correct `radiprotocol_nodeType`, color, and default placement using the same `CanvasNodeFactory` pattern as the other quick-create buttons. Implemented 2026-04-25 in Phase 64; UAT 7/7 PASS (scenarios 6–7 cover button + narrow-width flex-wrap).

### Runner UX

- [x] **RUNNER-02**: Runner footer layout — the "step back" button is renamed to "back"; the Skip button is rendered as a labeled button reading "skip" (no icon-only variant) placed to the right of Back on the same horizontal row; Skip is never rendered between answer-branch buttons and snippet-branch buttons when a question node has mixed outgoing edges. Applies to all three runner modes (sidebar, tab, inline). Implemented 2026-04-25 in Phase 65; focused/full tests, build, and human visual verification passed.

- [x] **RUNNER-03**: Step-back operates reliably under all conditions — a single click advances the runner back exactly one step; no "Processing" text is ever shown in place of the action buttons longer than the natural re-render; repeated step-back clicks inside a loop never corrupt the accumulated protocol text or leave the runner in an inconsistent state. Applies to all three runner modes. Implemented 2026-04-25 in Phase 66 (Plans 01/03/04); UAT 9/9 PASS (scenarios 4–7 cover one-click Back, no Processing placeholder, loop-boundary correctness).

- [x] **RUNNER-04**: Scroll position stays pinned to the bottom of the preview textarea when (a) a file-bound Snippet node inserts its content, and (b) step-back is invoked — matching the existing correct behavior for Answer insert and directory-bound Snippet insert. No upward scroll jump; the most recently inserted (or revealed after step-back) line is always visible at the bottom of the preview. Implemented 2026-04-25 in Phase 66 Plan 02; UAT 9/9 PASS (scenarios 1–3 cover sidebar+tab scroll-to-bottom). Inline mode is NA-by-design per Phase 66 D-12 (inline writes directly to the Obsidian editor; no preview textarea exists).

### Inline Runner

- [x] **INLINE-FIX-06**: Inline Runner modal is user-resizable via drag on its edges/corners; chosen width and height persist in workspace state alongside position (established in Phase 60) and survive tab switch + plugin reload. If saved dimensions would exceed current viewport, clamp-on-restore applies (mirroring the Phase 60 position clamp pattern). Implemented 2026-04-25 in Phase 67 Plan 01; UAT 8/8 PASS after gap-closure 92a1269 (drag/tab-switch no longer reset size).

- [x] **INLINE-FIX-07**: A Snippet node bound to a specific file (as opposed to a directory) correctly appends the configured file's content when triggered in Inline Runner — matching sidebar runner behavior for file-bound Snippet nodes established in Phase 56. No fallback to the snippets root folder listing; the file-binding is honoured in all three runner modes.

## Out of Scope (v1.10)

Explicitly excluded for this milestone. Can be reconsidered for a future milestone.

| Feature | Reason |
|---------|--------|
| New node kinds | v1.10 is regression/polish + two-way sync; no graph-model additions |
| Community plugin submission | Deferred to dedicated future milestone (README/LICENSE/manifest review + plugin review process) |
| Full-tab runner view | Deferred backlog item (PROJECT.md Deferred section) |
| Canvas selector dropdown in runner | Deferred backlog item |
| Node templates / reuse of common structures | Deferred backlog item |
| Insert into current note output destination | Deferred backlog item |
| Retroactive Nyquist VALIDATION.md for phases 12–19 | Tech debt; not scoped into v1.10 |
| Mobile support | Out of scope since v1.0 |
| AI/LLM-generated text | Out of scope since v1.0 |

## Traceability

Phase mappings established by roadmapper on 2026-04-25 during ROADMAP.md creation (Phases 63–67).

| Requirement | Phase | Status |
|-------------|-------|--------|
| EDITOR-03 | Phase 63 | Complete 2026-04-25 — Phase 63 gap-closure Plan 04 GREEN, 63-UAT 9/9 PASS |
| EDITOR-04 | Phase 64 | Complete 2026-04-25 — Phase 64 Plans 01+02, 64-UAT 7/7 PASS |
| EDITOR-05 | Phase 63 | Complete 2026-04-25 — Phase 63 gap-closure Plan 04 GREEN, 63-UAT 9/9 PASS |
| EDITOR-06 | Phase 64 | Complete 2026-04-25 — Phase 64 Plans 01+03, 64-UAT 7/7 PASS |
| RUNNER-02 | Phase 65 | Complete 2026-04-25 — Phase 65 Plan 02 GREEN, human-approved |
| RUNNER-03 | Phase 66 | Complete 2026-04-25 — Phase 66 Plans 01/03/04, 66-UAT 9/9 PASS |
| RUNNER-04 | Phase 66 | Complete 2026-04-25 — Phase 66 Plan 02, 66-UAT 9/9 PASS (inline NA per D-12) |
| INLINE-FIX-06 | Phase 67 | Complete 2026-04-25 — Phase 67 Plan 01 + gap-closure 92a1269, 67-UAT 8/8 PASS |
| INLINE-FIX-07 | Phase 67 | Complete 2026-04-25 — Phase 67 Plan 02 (D-14 root-cause fix in shared runner-core), 67-UAT 8/8 PASS |

**Coverage:**
- v1.10 requirements: 9 total
- Mapped to phases: 9 ✅
- Unmapped: 0 ✅

**Phase distribution:**
- Phase 63 (Bidirectional Canvas ↔ Node Editor Sync): EDITOR-03, EDITOR-05 (2)
- Phase 64 (Node Editor Polish — Auto-grow & Text Block Quick-Create): EDITOR-04, EDITOR-06 (2)
- Phase 65 (Runner Footer Layout — Back/Skip Row): RUNNER-02 (1)
- Phase 66 (Runner Step-Back Reliability & Scroll Pinning): RUNNER-03, RUNNER-04 (2)
- Phase 67 (Inline Runner Resizable Modal & File-Bound Snippet Parity): INLINE-FIX-06, INLINE-FIX-07 (2)

---
*Requirements defined: 2026-04-25*
*Last updated: 2026-04-26 — milestone close: all 9/9 requirements satisfied; checkboxes flipped, traceability marked complete; archived to milestones/v1.10-REQUIREMENTS.md*
