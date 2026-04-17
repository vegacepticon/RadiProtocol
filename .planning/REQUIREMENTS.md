# Requirements: RadiProtocol — Milestone v1.7

**Defined:** 2026-04-17
**Milestone:** v1.7 Loop Rework & Regression Cleanup
**Core Value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code to build that algorithm.

> Earlier milestones' requirements (v1.0, v1.2–v1.6) are recorded as **Validated** in `.planning/PROJECT.md`. This file tracks only the scope accepted for v1.7.

## v1.7 Requirements

### Loop Node Unification (LOOP)

- [x] **LOOP-01**: Graph model exposes a single `loop` node kind; `loop-start` and `loop-end` are removed from the `RPNodeKind` discriminated union
- [x] **LOOP-02**: `LoopNode` carries an editable `headerText` field shown as the prompt header in the runner
- [x] **LOOP-03**: Canvas parser recognizes `radiprotocol_nodeType = "loop"` and materializes a `LoopNode` with `headerText` from canvas JSON
- [x] **LOOP-04**: `GraphValidator` requires each `loop` node to have exactly one outgoing edge labelled «выход» and at least one additional outgoing (body) edge
- [ ] **LOOP-05**: Node Editor form for the loop node lets the author edit `headerText` and removes any `maxIterations` control
- [ ] **LOOP-06**: Node color map and `NodePickerModal` list `loop` as a first-class node kind

### Loop Runtime (RUN)

- [x] **RUN-01**: On entering a `loop` node the runner renders a single picker combining all body-branch edge labels plus «выход», displayed above the node's `headerText`
- [x] **RUN-02**: Selecting a body branch advances into that branch; when the branch dead-ends (current node has no outgoing edges) the runner returns to the same loop node and re-prompts
- [x] **RUN-03**: Selecting «выход» advances along the «выход» edge and pops the current loop context from the stack
- [x] **RUN-04**: Nested loops continue to work — the existing `LoopContext` stack behaviour is preserved
- [x] **RUN-05**: Step-back from the loop picker unwinds to the last node before the loop entry and restores the accumulated text captured before the loop
- [x] **RUN-06**: Session save/resume preserves loop-node state across Obsidian restarts (loop frames, pending picker, accumulated text)
- [x] **RUN-07**: `LoopStartNode.maxIterations` field and the global "max loop iterations" setting are removed; there is no runtime iteration cap on the new loop

### Migration (MIGRATE)

- [x] **MIGRATE-01**: A canvas containing any `loop-start` or `loop-end` node fails `GraphValidator` with a plain-language rebuild instruction; the protocol cannot be run until the author reconstructs the loop with the unified node
- [x] **MIGRATE-02**: The migration error surfaces in the existing RunnerView error panel using the same layout as other `GraphValidator` error classes

### Free-Text-Input Removal (CLEAN)

- [ ] **CLEAN-01**: `free-text-input` is removed from `RPNodeKind`; `FreeTextInputNode` interface is deleted from the graph model
- [ ] **CLEAN-02**: Canvas parser no longer recognizes `radiprotocol_nodeType = "free-text-input"`; encountering one produces a `GraphValidator` error
- [ ] **CLEAN-03**: Runner, Node Editor (`EditorPanelView`), `NodePickerModal`, and `NODE_COLOR_MAP` no longer reference free-text-input
- [ ] **CLEAN-04**: Fixture `src/__tests__/fixtures/free-text.canvas` and free-text-input related tests are removed or rewritten to reflect the deletion

## Future Requirements

Items carried over from earlier milestones' deferred list (see `.planning/PROJECT.md` for full context):

- Canvas selector dropdown in runner view
- Full-tab runner view
- Protocol authoring documentation / example canvases
- Community plugin submission checklist
- Node templates — save frequently-used node structures
- Configurable output destination: insert into current note
- UI hint when global separator change requires canvas reopen
- Retroactive Nyquist VALIDATION.md for phases 12–19, 28–31, 32–35, 36–42

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatic migration of existing `loop-start`/`loop-end` pairs into a new `loop` node | Break-compatibility was explicitly chosen over auto-migration during discussion; authors rebuild loops manually with clear guidance |
| Free-text-input replacement | Original v1 decision — considered redundant; restoring a regression, not replacing functionality |
| Configurable iteration cap for the new loop | `maxIterations` was judged redundant; no per-loop or global cap in v1.7 |
| Mixed answer + loop-body branching from a single question node | Out of scope for v1.7; current mixed-branching applies to answer + snippet only |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOOP-01 | Phase 43 | Complete |
| LOOP-02 | Phase 43 | Complete |
| LOOP-03 | Phase 43 | Complete |
| LOOP-04 | Phase 43 | Complete |
| LOOP-05 | Phase 45 | Pending |
| LOOP-06 | Phase 45 | Pending |
| RUN-01 | Phase 44 | Complete |
| RUN-02 | Phase 44 | Complete |
| RUN-03 | Phase 44 | Complete |
| RUN-04 | Phase 44 | Complete |
| RUN-05 | Phase 44 | Complete |
| RUN-06 | Phase 44 | Complete |
| RUN-07 | Phase 44 | Complete |
| MIGRATE-01 | Phase 43 | Complete |
| MIGRATE-02 | Phase 43 | Complete |
| CLEAN-01 | Phase 46 | Pending |
| CLEAN-02 | Phase 46 | Pending |
| CLEAN-03 | Phase 46 | Pending |
| CLEAN-04 | Phase 46 | Pending |

**Coverage:**
- v1.7 requirements: 19 total
- Mapped to phases: 19 ✓
- Unmapped: 0

**Phase breakdown:**
- Phase 43: 6 requirements (LOOP-01, LOOP-02, LOOP-03, LOOP-04, MIGRATE-01, MIGRATE-02)
- Phase 44: 7 requirements (RUN-01..RUN-07)
- Phase 45: 2 requirements (LOOP-05, LOOP-06)
- Phase 46: 4 requirements (CLEAN-01..CLEAN-04)

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 — traceability filled by /gsd-roadmap*
