# Requirements: RadiProtocol v1.1

**Milestone:** v1.1 UX & Community Release
**Last updated:** 2026-04-07

---

## v1.1 Requirements

### Runner Tab Mode

- [ ] **RUNTAB-01**: User can configure the runner view to open as a full editor tab (vs sidebar panel) via a toggle in Plugin Settings
- [ ] **RUNTAB-02**: When tab mode is active and user invokes the runner command, the runner opens as an editor tab in the main workspace area — not in the right sidebar
- [ ] **RUNTAB-03**: If a runner tab is already open when the command is invoked, Obsidian reveals the existing tab instead of creating a duplicate

### Canvas Selector

- [ ] **SELECTOR-01**: The runner panel (and tab) displays a dropdown listing all `.canvas` files in the vault
- [ ] **SELECTOR-02**: User can switch to a different canvas by selecting it in the dropdown — no command re-invocation needed
- [ ] **SELECTOR-03**: The canvas selector dropdown persists across runner state transitions (it is not cleared when the runner advances through steps)
- [ ] **SELECTOR-04**: Selecting a canvas in the dropdown that is already running prompts the user before discarding the current session

### Output: Insert Into Current Note

- [ ] **OUTPUT-01**: User can select "Insert into current note" as an output destination option in Plugin Settings (alongside existing clipboard and new note options)
- [ ] **OUTPUT-02**: When "Insert into current note" is the active destination, the runner shows an "Insert" button that places the completed protocol text at the cursor position in the currently active Markdown note
- [ ] **OUTPUT-03**: If no Markdown note is active when the user clicks Insert, the runner displays a clear notice ("Open a note first to insert the report")

### Live Canvas Editing

- [ ] **LIVE-01**: User can edit node properties (label, question text, answer options, snippet reference) in the Editor Panel while the canvas file is open — without needing to close the canvas first
- [ ] **LIVE-02**: Edits are saved to the `.canvas` file via the internal Canvas View API (`canvas.requestSave()`) and are reflected in the canvas view without requiring a file reload
- [ ] **LIVE-03**: If the internal Canvas View API is unavailable (e.g., future Obsidian update breaks the undocumented interface), the plugin falls back to v1.0 Strategy A behavior: shows a clear notice ("Close the canvas to save edits") instead of silently failing
- [ ] **LIVE-04**: Live canvas edits do not cause data loss or corruption when the user interacts with the canvas view within 2 seconds of a plugin save

---

## Future Requirements

*(Deferred from v1.1 — candidate for v1.2)*

- Node templates — save and insert frequently-used node structures (single-node, Strategy A)
- Community plugin submission — README, manifest.json fields, versions.json, example canvases, GitHub Actions release workflow, PR to obsidian-releases

---

## Out of Scope

- Multi-node / sub-graph templates — requires live Canvas API for edge insertion; too risky for v1.1
- Mobile support — desktop-first, deferred from v1.0
- AI/LLM-generated protocol text — manual authoring only
- PACS/RIS integration — clipboard/note output is sufficient

---

## Traceability

*Filled by roadmapper after roadmap is created.*

| REQ-ID | Phase |
|--------|-------|
| RUNTAB-01 | — |
| RUNTAB-02 | — |
| RUNTAB-03 | — |
| SELECTOR-01 | — |
| SELECTOR-02 | — |
| SELECTOR-03 | — |
| SELECTOR-04 | — |
| OUTPUT-01 | — |
| OUTPUT-02 | — |
| OUTPUT-03 | — |
| LIVE-01 | — |
| LIVE-02 | — |
| LIVE-03 | — |
| LIVE-04 | — |
