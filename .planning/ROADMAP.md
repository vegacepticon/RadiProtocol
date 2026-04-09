# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-09

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1–7 (shipped 2026-04-07)
- ✅ **v1.1 UX & Community Release** — Phases 8–11 (shipped 2026-04-08)
- 🔄 **v1.2 Runner UX & Bug Fixes** — Phases 12–17 (active)

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
<summary>✅ v1.1 UX & Community Release (Phases 8–11) — SHIPPED 2026-04-08</summary>

- [x] Phase 8: Settings + Full-Tab Runner View (2/2 plans) — completed 2026-04-07
- [x] Phase 9: Canvas Selector Dropdown (3/3 plans) — completed 2026-04-07
- [x] Phase 10: Insert Into Current Note (1/1 plans) — completed 2026-04-08
- [x] Phase 11: Live Canvas Editing (3/3 plans) — completed 2026-04-08

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### v1.2 Runner UX & Bug Fixes (Phases 12–17)

- [ ] **Phase 12: Runner Layout Overhaul** — Auto-grow textarea, questions below output, equal buttons, remove legend
- [x] **Phase 13: Sidebar Canvas Selector and Run Again** — Canvas selector parity in sidebar mode, restart after completion (completed 2026-04-08)
- [x] **Phase 14: Node Editor Auto-Switch and Unsaved Guard** — Auto-load node on click, guard unsaved edits on switch (completed 2026-04-09)
- [ ] **Phase 15: Text Separator Setting** — Global newline/space setting in Settings tab, per-node override in EditorPanel
- [ ] **Phase 16: Runner Textarea Edit Preservation** — Manual textarea edits survive step advances
- [ ] **Phase 17: Node Type Read-Back and Snippet Placeholder Fixes** — free-text-input/text-block nodes appear correctly, placeholder Add works

---

## Phase Details

### Phase 12: Runner Layout Overhaul
**Goal**: The runner text area and controls are laid out correctly — output grows with content, controls stay below it, action buttons are uniform, and the node legend is gone
**Depends on**: Phase 11 (v1.1 complete)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04
**Success Criteria** (what must be TRUE):
  1. The protocol text area expands vertically as text accumulates — no fixed height, no scrollbar clipping content
  2. Question prompt and answer buttons always appear below the text area, never above or interleaved
  3. Copy, Save, and Insert buttons are visually equal in size (same width/height)
  4. No node type legend is visible in runner view in either tab mode or sidebar mode
**Plans**: 1 plan
Plans:
- [ ] 12-00-PLAN.md — TDD: write LAYOUT tests (RED) then implement all four layout changes (GREEN)
**UI hint**: yes

### Phase 13: Sidebar Canvas Selector and Run Again
**Goal**: Users can select a canvas from the runner while in sidebar mode, and can restart the same protocol immediately after it completes
**Depends on**: Phase 12
**Requirements**: SIDEBAR-01, RUNNER-01
**Success Criteria** (what must be TRUE):
  1. Opening the runner in sidebar mode shows the same canvas selector dropdown available in tab mode
  2. Selecting a canvas from the sidebar runner loads and starts that protocol correctly
  3. After a protocol completes, a "Run again" button is visible and clicking it restarts the same canvas from the beginning
**Plans**: 1 plan
Plans:
- [x] 13-01-PLAN.md — Add rp-selector-* CSS, "Run again" button, and structural tests
**UI hint**: yes

### Phase 14: Node Editor Auto-Switch and Unsaved Guard
**Goal**: The Node Editor panel responds to canvas node clicks automatically and protects unsaved edits before switching
**Depends on**: Phase 11 (EditorPanelView exists)
**Requirements**: EDITOR-01, EDITOR-02
**Success Criteria** (what must be TRUE):
  1. When EditorPanel is open, clicking a canvas node immediately loads that node's settings without any additional action
  2. Clicking a different node while edits are unsaved presents a confirmation prompt before discarding
  3. Choosing to stay on the current node in the prompt leaves the editor unchanged and the unsaved edits intact
**Plans**: 2 plans
Plans:
- [x] 14-01-PLAN.md — TDD: NodeSwitchGuardModal + tests (RED then GREEN) + canvas-internal.d.ts selection field
- [x] 14-02-PLAN.md — Wire auto-switch + unsaved guard into EditorPanelView + UAT checkpoint
**UI hint**: yes

### Phase 15: Text Separator Setting
**Goal**: Users can control how the runner joins node output text — globally via Settings and per-node in the EditorPanel
**Depends on**: Phase 14
**Requirements**: SEP-01, SEP-02
**Success Criteria** (what must be TRUE):
  1. Settings tab contains a text separator option with "Newline" (default) and "Space" choices
  2. Changing the global setting affects how output text is joined when no per-node override is set
  3. EditorPanel shows a per-node separator override field for each node type that produces text output
  4. A node with a per-node override joins its text with that separator regardless of the global setting
**Plans**: 3 plans
Plans:
- [x] 15-01-PLAN.md — Type contracts: radiprotocol_separator on graph-model nodes; textSeparator in settings + Settings tab Runner section
- [x] 15-02-PLAN.md — Runner separator injection: appendWithSeparator on TextAccumulator, all 5 append sites in ProtocolRunner, RunnerView wiring
- [ ] 15-03-PLAN.md — EditorPanel separator dropdown for answer, free-text-input, text-block node kinds
**UI hint**: yes

### Phase 16: Runner Textarea Edit Preservation
**Goal**: Manual edits made to the runner text area are not lost when the user advances to the next protocol step
**Depends on**: Phase 12 (textarea layout established)
**Requirements**: BUG-01
**Success Criteria** (what must be TRUE):
  1. Typing directly into the runner text area and then pressing an answer button does not discard the typed text
  2. The accumulated protocol text after advancing includes both the runner-appended content and any manual edits made before that step
  3. Pressing the back (undo) button restores the text area to the state it was in before the last advance, including any manual edits from that step
**Plans**: TBD
**UI hint**: yes

### Phase 17: Node Type Read-Back and Snippet Placeholder Fixes
**Goal**: Nodes configured via the Node Editor appear correctly in the runner, and placeholders can be added in the snippet creator
**Depends on**: Phase 15
**Requirements**: BUG-02, BUG-03, BUG-04
**Success Criteria** (what must be TRUE):
  1. A free-text-input node created on canvas and configured via Node Editor prompts for text input when the runner reaches it
  2. A text-block node created on canvas and configured via Node Editor auto-advances with its text appended when the runner reaches it
  3. In the snippet creator, clicking "Add" after entering a placeholder label appends that placeholder to the list and clears the label field
**Plans**: TBD

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
| 8. Settings + Full-Tab Runner View | v1.1 | 2/2 | Complete | 2026-04-07 |
| 9. Canvas Selector Dropdown | v1.1 | 3/3 | Complete | 2026-04-07 |
| 10. Insert Into Current Note | v1.1 | 1/1 | Complete | 2026-04-08 |
| 11. Live Canvas Editing | v1.1 | 3/3 | Complete | 2026-04-08 |
| 12. Runner Layout Overhaul | v1.2 | 0/1 | Not started | — |
| 13. Sidebar Canvas Selector and Run Again | v1.2 | 2/2 | Complete   | 2026-04-08 |
| 14. Node Editor Auto-Switch and Unsaved Guard | v1.2 | 2/1 | Complete   | 2026-04-09 |
| 15. Text Separator Setting | v1.2 | 2/3 | In Progress|  |
| 16. Runner Textarea Edit Preservation | v1.2 | 0/? | Not started | — |
| 17. Node Type Read-Back and Snippet Placeholder Fixes | v1.2 | 0/? | Not started | — |
