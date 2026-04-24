# Requirements: RadiProtocol v1.9

**Defined:** 2026-04-24
**Milestone:** v1.9 — Inline Runner Polish & Settings UX
**Core Value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

## v1.9 Requirements

Requirements for milestone v1.9 — close the Inline Runner UX gaps uncovered in v1.8 production usage, add folder autocomplete to all settings path fields, ship BRAT release v1.9.0.

### Inline Runner Fixes

- [ ] **INLINE-FIX-01**: Inline Runner correctly resolves multi-segment Protocols folder paths (e.g. `templates/ALGO`) — canvas files inside a nested folder are found and listed identically to canvas files in a root-level folder
- [ ] **INLINE-FIX-02**: Inline Runner persists drag-position in workspace state — after tab switch (or plugin reload), modal reappears at the last user-set coordinates, clamped to current viewport bounds (never clipped off-screen)
- [ ] **INLINE-FIX-03**: Inline Runner uses a compact default layout — base modal footprint reduced (tighter padding / reduced preview height) so it does not visually overlap the active note text area at default Obsidian window size
- [ ] **INLINE-FIX-04**: Inline Runner applies the configured separator when inserting snippet content (matches sidebar-runner behavior — no glued concatenation between prior text and inserted snippet)
- [ ] **INLINE-FIX-05**: Inline Runner opens SnippetFillInModal for JSON snippets with placeholders — fill-in fields + live preview + tab navigation work identically to sidebar-runner behavior

### Settings UX

- [x] **SETTINGS-01**: All path input fields in plugin settings (Protocols folder, Snippets folder, Output folder) render a folder autocomplete dropdown of existing vault folders as the user types — Templater-style via Obsidian `AbstractInputSuggest` pattern

### Distribution

- [ ] **BRAT-02**: v1.9.0 GitHub Release published with `manifest.json` / `main.js` / `styles.css` assets attached; `manifest.json` + `versions.json` + `package.json` version aligned to 1.9.0; BRAT install verified end-to-end on a clean test vault

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

- **RUN-F01**: Canvas selector dropdown in runner view — choose protocol without reopening the command
- **RUN-F02**: Full-tab runner view — open as editor tab instead of sidebar panel
- **DOCS-F01**: Protocol authoring documentation / example canvases for community submission
- **DIST-F01**: Community plugin submission checklist (README, LICENSE, manifest review, plugin review)
- **CANVAS-F03**: Node templates — save frequently-used node structures for reuse
- **OUT-F01**: Configurable output destination: insert into current note
- **UX-F01**: UI hint when global separator change requires canvas reopen to take effect
- **VAL-F01**: Retroactive Nyquist VALIDATION.md for phases 12–19 (tech debt)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Inline Runner resize handle (drag-to-resize) | Deferred — compact layout by default solves the overlap concern first; resize is additive polish |
| Inline Runner auto-fade on cursor proximity | Deferred — non-obvious UX trade-off; revisit if compact layout insufficient |
| Patch releases along the way (1.8.1, 1.8.2) | Decided during discuss: single 1.9.0 at end of milestone, matches v1.8 cadence |
| Obsidian Community Plugin submission (store listing) | Out of scope for v1.9 — BRAT distribution is sufficient; submission is its own milestone |
| Folder autocomplete *beyond* settings path fields (e.g. in modals) | Settings-only scope for v1.9; modal autocomplete revisited if needed |
| AI/LLM-generated text | Manual algorithm authoring only; not in v1 |
| PACS/RIS direct integration | Clipboard/note output is sufficient for v1 |
| Mobile support (Obsidian mobile) | Desktop-first; mobile later |
| Multi-user / shared vaults | Single-user local vault only for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INLINE-FIX-01 | Phase 59 | Planned |
| INLINE-FIX-02 | Phase 60 | Planned |
| INLINE-FIX-03 | Phase 60 | Planned |
| INLINE-FIX-04 | Phase 59 | Planned |
| INLINE-FIX-05 | Phase 59 | Planned |
| SETTINGS-01 | Phase 61 | Complete |
| BRAT-02 | Phase 62 | Planned |

## Coverage Summary

- **Total v1.9 requirements:** 7
- **Inline Runner Fixes:** 5 (INLINE-FIX-01..05)
- **Settings UX:** 1 (SETTINGS-01)
- **Distribution:** 1 (BRAT-02)
- **Mapped to phases:** 7 / 7 (roadmap complete — Phases 59–62)
