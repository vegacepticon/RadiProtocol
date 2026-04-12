# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-12

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1–7 (shipped 2026-04-07)
- ✅ **v1.2 Runner UX & Bug Fixes** — Phases 12–19 (shipped 2026-04-10)
- 🔄 **v1.3 Node Editor Overhaul & Snippet Node** — Phases 20–27 (in progress)

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

<details>
<summary>✅ v1.2 Runner UX & Bug Fixes (Phases 12–19) — SHIPPED 2026-04-10</summary>

- [x] Phase 12: Runner Layout Overhaul — completed 2026-04-08
- [x] Phase 13: Sidebar Canvas Selector and Run Again — completed 2026-04-08
- [x] Phase 14: Node Editor Auto-Switch and Unsaved Guard — completed 2026-04-09
- [x] Phase 15: Text Separator Setting — completed 2026-04-09
- [x] Phase 16: Runner Textarea Edit Preservation — completed 2026-04-09
- [x] Phase 17: Node Type Read-Back and Snippet Placeholder Fixes — completed 2026-04-09
- [x] Phase 18: CSS Gap Fixes (INSERTED) — completed 2026-04-10
- [x] Phase 19: Phase 12–14 Formal Verification — completed 2026-04-10

Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>🔄 v1.3 Node Editor Overhaul & Snippet Node (Phases 20–27) — IN PROGRESS</summary>

- [x] Phase 20: Housekeeping Removals — completed 2026-04-11
- [x] Phase 21: Color Infrastructure — completed 2026-04-11
- [x] Phase 22: Snippet Node — Graph and Runner Layer — completed 2026-04-11
- [x] Phase 23: Node Editor Auto-Save and Color-on-Type-Change — completed 2026-04-11
- [x] Phase 24: Settings — Snippet Node Folder (1/1 plans) — completed 2026-04-11
- [x] Phase 25: Snippet Node Runner UI (2/2 plans) — completed 2026-04-11
- [ ] **Phase 26: Auto-Switch to Node Editor Tab** — revealLeaf() on canvas node click brings Node Editor tab to front
- [ ] **Phase 27: Interactive Placeholder Editor** — Drag-and-drop chip reorder in SnippetManagerView updates placeholder list order

</details>

---

## Phase Details

### Phase 26: Auto-Switch to Node Editor Tab
**Goal**: Clicking a canvas node while the Runner tab is active brings the Node Editor tab to the foreground automatically — no manual tab switch required
**Depends on**: Phase 23
**Requirements**: TAB-01
**Success Criteria** (what must be TRUE):
  1. Clicking a canvas node while the Protocol Runner tab is visible and active switches the sidebar to the Node Editor tab and loads that node's form
  2. If the Node Editor panel is not yet open (e.g. first launch), it is created and brought to front before loading the node form
**Plans**: 2 plans
Plans:
- [x] 26-01-PLAN.md — Add ensureEditorPanelVisible() to main.ts and wire into handleNodeClick()
- [x] 26-02-PLAN.md — Restore Phase 23 auto-save, remove NodeSwitchGuardModal, add CSS indicator
**UI hint**: yes

### Phase 27: Interactive Placeholder Editor
**Goal**: Placeholders in the Snippet Editor are displayed as coloured chips and can be reordered by dragging; reordering updates the tab order in SnippetFillInModal
**Depends on**: Phase 20
**Requirements**: CHIP-01, CHIP-02, CHIP-03
**Success Criteria** (what must be TRUE):
  1. Opening any snippet in Snippet Editor shows each placeholder as a distinct coloured chip — the raw `{{syntax}}` text is not visible in the chips list
  2. Dragging a placeholder chip to a new position in the list and releasing updates the visual order immediately
  3. After reordering chips, opening SnippetFillInModal for that snippet presents the input fields in the new order (tab key moves through fields in reordered sequence)
**Plans**: TBD
**UI hint**: yes

---

## Backlog

### Phase 999.1: Canvas selector dropdown in runner view (BACKLOG)

**Goal:** Let users choose which canvas/scenario to run from within the plugin panel via a dropdown or similar UX — without having to close the panel and invoke the command again on a different canvas.
**Plans:** 2/2 plans complete

### Phase 999.2: Full-tab runner view (BACKLOG)

**Goal:** Open the protocol runner as a full editor tab (like a new note) instead of a sidebar panel — full-width layout for better readability and UX.
**Plans:** 0 plans

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
| 12. Runner Layout Overhaul | v1.2 | 2/2 | Complete | 2026-04-08 |
| 13. Sidebar Canvas Selector and Run Again | v1.2 | 2/2 | Complete | 2026-04-08 |
| 14. Node Editor Auto-Switch and Unsaved Guard | v1.2 | 1/1 | Complete | 2026-04-09 |
| 15. Text Separator Setting | v1.2 | 2/2 | Complete | 2026-04-09 |
| 16. Runner Textarea Edit Preservation | v1.2 | 2/2 | Complete | 2026-04-09 |
| 17. Node Type Read-Back and Snippet Placeholder Fixes | v1.2 | 2/2 | Complete | 2026-04-09 |
| 18. CSS Gap Fixes (INSERTED) | v1.2 | 1/1 | Complete | 2026-04-10 |
| 19. Phase 12–14 Formal Verification | v1.2 | 3/3 | Complete | 2026-04-10 |
| 20. Housekeeping Removals | v1.3 | 3/3 | Complete | 2026-04-11 |
| 21. Color Infrastructure | v1.3 | 2/2 | Complete | 2026-04-11 |
| 22. Snippet Node — Graph and Runner Layer | v1.3 | 3/3 | Complete | 2026-04-11 |
| 23. Node Editor Auto-Save and Color-on-Type-Change | v1.3 | 2/2 | Complete | 2026-04-11 |
| 24. Settings — Snippet Node Folder | v1.3 | 1/1 | Complete | 2026-04-11 |
| 25. Snippet Node Runner UI | v1.3 | 2/2 | Complete | 2026-04-11 |
| 26. Auto-Switch to Node Editor Tab | v1.3 | 2/2 | Complete   | 2026-04-12 |
| 27. Interactive Placeholder Editor | v1.3 | 0/? | Planned | — |
