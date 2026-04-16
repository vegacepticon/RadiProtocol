# Requirements: RadiProtocol v1.6

**Defined:** 2026-04-16
**Core Value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

## v1.6 Requirements

Requirements for milestone v1.6 — Polish & Canvas Workflow.

### Cleanup & Polish

- [x] **CLEAN-01**: Dead code audit identifies and removes all unused TypeScript exports, functions, and CSS rules across the project
- [ ] **CLEAN-02**: The snippet create/edit modal displays "Тип JSON" with a space (not "ТипJSON")
- [ ] **CLEAN-03**: User can create a new folder via a button next to the "Create snippet" button in snippet editor

### Data Sync

- [ ] **SYNC-01**: When a directory is renamed in snippet editor, all canvas SnippetNode `subfolderPath` references update to the new directory name

### Canvas Node Creation

- [ ] **CANVAS-01**: `CanvasNodeFactory` service provides programmatic node creation via Canvas internal API (Pattern B) with runtime API probing
- [ ] **CANVAS-02**: User can create a new question node from the node editor sidebar — node appears on canvas adjacent to the selected node with auto-positioning
- [ ] **CANVAS-03**: User can create a new answer node linked to the current question node from the node editor sidebar
- [ ] **CANVAS-04**: Newly created nodes receive correct `radiprotocol_nodeType` and auto-color
- [ ] **CANVAS-05**: UI shows clear Notice when canvas is not open (creation requires live canvas)

### Node Duplication

- [ ] **DUP-01**: User can duplicate the selected canvas node — copy preserves all `radiprotocol_*` properties, generates new ID, offsets position
- [ ] **DUP-02**: Duplicated node does NOT copy edges (user draws connections manually)

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

- **CANVAS-F01**: Obsidian command palette commands for node creation (in addition to sidebar buttons)
- **CANVAS-F02**: Edge creation/duplication between nodes
- **CANVAS-F03**: Node templates — save frequently-used node structures for reuse

## Out of Scope

| Feature | Reason |
|---------|--------|
| Alternative protocol format (non-canvas) | Canvas format works well, not changing in v1.6 |
| Edge duplication | Architecturally ambiguous — user draws connections manually |
| Canvas node creation via Strategy A (canvas closed) | Pattern B (live canvas) required for immediate visual feedback |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 36 | Complete |
| CLEAN-02 | Phase 36 | Pending |
| CLEAN-03 | Phase 37 | Pending |
| SYNC-01 | Phase 37 | Pending |
| CANVAS-01 | Phase 38 | Pending |
| CANVAS-02 | Phase 39 | Pending |
| CANVAS-03 | Phase 39 | Pending |
| CANVAS-04 | Phase 38 | Pending |
| CANVAS-05 | Phase 38 | Pending |
| DUP-01 | Phase 40 | Pending |
| DUP-02 | Phase 40 | Pending |

**Coverage:**
- v1.6 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-04-16*
*Last updated: 2026-04-16 after roadmap creation*
