# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-07

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1–7 (shipped 2026-04-07)
- 🔵 **v1.1 UX & Community Release** — Phases 8–11 (in progress)

---

## Phases

<details>
<summary>✅ v1.0 Community Plugin Release (Phases 1–7) — SHIPPED 2026-04-07</summary>

- [x] Phase 1: Project Scaffold and Canvas Parsing Foundation (6/6 plans) — completed 2026-04-06
- [x] Phase 2: Core Protocol Runner Engine (3/3 plans) — completed 2026-04-06
- [x] Phase 3: Runner UI (ItemView) (5/5 plans) — completed 2026-04-06
- [x] Phase 4: Canvas Node Editor Side Panel (3/3 plans) — completed 2026-04-06
- [x] Phase 5: Dynamic Snippets (5/5 plans) — completed 2026-04-06
- [x] Phase 6: Loop Support (3/3 plans) — completed 2026-04-07
- [x] Phase 7: Mid-Session Save and Resume (3/3 plans) — completed 2026-04-07

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### v1.1 UX & Community Release

- [ ] **Phase 8: Settings + Full-Tab Runner View** - Toggle runner between sidebar panel and full editor tab
- [ ] **Phase 9: Canvas Selector Dropdown** - Choose and switch canvases from within the runner without re-invoking commands
- [ ] **Phase 10: Insert Into Current Note Output** - Place completed protocol text at cursor in any open Markdown note
- [ ] **Phase 11: Live Canvas Editing** - Edit node properties while the canvas file is open via internal Canvas View API

---

## Phase Details

### Phase 8: Settings + Full-Tab Runner View
**Goal**: Users can choose whether the protocol runner opens as a sidebar panel or a full editor tab, and the setting is respected every time the runner command is invoked
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: RUNTAB-01, RUNTAB-02, RUNTAB-03
**Success Criteria** (what must be TRUE):
  1. User can find and toggle a "Runner view mode" option (sidebar / tab) in the plugin Settings tab
  2. With tab mode on, invoking the runner command opens the runner as an editor tab in the main workspace — not the right sidebar
  3. With tab mode on, invoking the runner command a second time reveals the existing tab instead of opening a duplicate
  4. With sidebar mode on (default), runner behavior is identical to v1.0 — no regression
**Plans**: TBD
**UI hint**: yes

### Phase 9: Canvas Selector Dropdown
**Goal**: Users can select and switch between canvas files directly inside the runner view, without closing the panel or re-invoking any command
**Depends on**: Phase 8
**Requirements**: SELECTOR-01, SELECTOR-02, SELECTOR-03, SELECTOR-04
**Success Criteria** (what must be TRUE):
  1. A dropdown listing all vault `.canvas` files is visible at the top of the runner panel (and tab) at all times
  2. Selecting a different canvas from the dropdown loads that canvas into the runner — no command re-invocation needed
  3. The dropdown remains visible and functional while the runner is mid-session (stepping through questions)
  4. Selecting a canvas while a session is active shows a confirmation prompt before discarding the running session
**Plans**: TBD
**UI hint**: yes

### Phase 10: Insert Into Current Note Output
**Goal**: Users can send a completed protocol report directly into the note they have open, at the cursor position, as an alternative to clipboard or new-note output
**Depends on**: Phase 9
**Requirements**: OUTPUT-01, OUTPUT-02, OUTPUT-03
**Success Criteria** (what must be TRUE):
  1. Plugin Settings contains an "Insert into current note" option in the output destination selector, alongside existing clipboard and new-note options
  2. With that destination selected, the runner shows an "Insert" button after protocol completion that places the report text at the cursor in the active Markdown note
  3. Clicking Insert when no Markdown note is active shows the notice "Open a note first to insert the report" — no silent failure
**Plans**: TBD
**UI hint**: yes

### Phase 11: Live Canvas Editing
**Goal**: Users can edit node properties in the Editor Panel while the canvas file is open — without closing the canvas — and edits are immediately reflected in the canvas view
**Depends on**: Phase 10
**Requirements**: LIVE-01, LIVE-02, LIVE-03, LIVE-04
**Success Criteria** (what must be TRUE):
  1. User can open the Editor Panel on a node, edit its label or question text, and save — all while the canvas remains open in the editor
  2. The saved change is reflected in the canvas view immediately, without the user needing to close and reopen the file
  3. If the internal Canvas View API is unavailable, the Editor Panel shows "Close the canvas to save edits" and still allows Strategy A saves — no silent failure
  4. Editing a node and immediately interacting with the canvas (within 2 seconds) does not produce corrupted or duplicated content in the `.canvas` file
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Project Scaffold and Canvas Parsing Foundation | v1.0 | 6/6 | Complete | 2026-04-06 |
| 2. Core Protocol Runner Engine | v1.0 | 3/3 | Complete | 2026-04-06 |
| 3. Runner UI (ItemView) | v1.0 | 5/5 | Complete | 2026-04-06 |
| 4. Canvas Node Editor Side Panel | v1.0 | 3/3 | Complete | 2026-04-06 |
| 5. Dynamic Snippets | v1.0 | 5/5 | Complete | 2026-04-06 |
| 6. Loop Support | v1.0 | 3/3 | Complete | 2026-04-07 |
| 7. Mid-Session Save and Resume | v1.0 | 3/3 | Complete | 2026-04-07 |
| 8. Settings + Full-Tab Runner View | v1.1 | 0/? | Not started | - |
| 9. Canvas Selector Dropdown | v1.1 | 0/? | Not started | - |
| 10. Insert Into Current Note Output | v1.1 | 0/? | Not started | - |
| 11. Live Canvas Editing | v1.1 | 0/? | Not started | - |
