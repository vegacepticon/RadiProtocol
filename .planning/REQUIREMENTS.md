# Requirements: RadiProtocol

**Defined:** 2026-04-08
**Milestone:** v1.2 — Runner UX & Bug Fixes
**Core Value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code to build that algorithm.

## v1.2 Requirements

### Runner UX

- [ ] **SIDEBAR-01**: User can select a canvas from the runner in sidebar mode (same selector widget available in tab mode)
- [ ] **RUNNER-01**: User can restart the same protocol immediately after completion without re-opening the canvas
- [ ] **LAYOUT-01**: Protocol text area auto-grows in height as text accumulates (full width, height determined by content)
- [ ] **LAYOUT-02**: Question and answer controls appear below the text area (never above or interleaved)
- [ ] **LAYOUT-03**: Copy to clipboard, Save to note, and Insert into note buttons are equal in size
- [ ] **LAYOUT-04**: Node type legend is removed from runner view (both tab and sidebar modes)

### Node Editor

- [ ] **EDITOR-01**: When EditorPanel is open, clicking a canvas node automatically loads that node's settings
- [ ] **EDITOR-02**: When switching nodes with unsaved edits, user is prompted to confirm (discard changes vs. stay on current node)

### Settings

- [ ] **SEP-01**: Settings tab provides a global text separator option — newline (default) or space (new sentence)
- [ ] **SEP-02**: Each node can override the global text separator individually in EditorPanel

### Bug Fixes

- [ ] **BUG-01**: Manual edits made to the runner text area are preserved when the user advances to the next protocol step
- [ ] **BUG-02**: free-text-input nodes configured via Node Editor appear and behave correctly in the protocol runner
- [ ] **BUG-03**: text-block nodes configured via Node Editor appear and behave correctly in the protocol runner
- [ ] **BUG-04**: User can add placeholders in snippet creator — clicking Add appends the placeholder and clears the label field

## Future Requirements

### Community

- Community plugin submission checklist (README, LICENSE, manifest review, plugin review)
- Protocol authoring documentation / example canvases for community submission

### Features

- Node templates — save frequently-used node structures for reuse
- Fix 3 pre-existing RED test stubs in `runner-extensions.test.ts`

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI/LLM-generated text | Manual algorithm authoring only |
| PACS/RIS direct integration | Clipboard/note output sufficient |
| Mobile support | Desktop-first |
| Multi-user / shared vaults | Single-user local vault only |
| Auto-open EditorPanel on node click | Only switches when panel already open |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 12 | Pending |
| LAYOUT-02 | Phase 12 | Pending |
| LAYOUT-03 | Phase 12 | Pending |
| LAYOUT-04 | Phase 12 | Pending |
| SIDEBAR-01 | Phase 13 | Pending |
| RUNNER-01 | Phase 13 | Pending |
| EDITOR-01 | Phase 14 | Pending |
| EDITOR-02 | Phase 14 | Pending |
| SEP-01 | Phase 15 | Pending |
| SEP-02 | Phase 15 | Pending |
| BUG-01 | Phase 16 | Pending |
| BUG-02 | Phase 17 | Pending |
| BUG-03 | Phase 17 | Pending |
| BUG-04 | Phase 17 | Pending |

**Coverage:**
- v1.2 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 — traceability mapped to phases 12–17*
