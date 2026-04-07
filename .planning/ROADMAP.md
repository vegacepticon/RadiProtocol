# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-07

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1–7 (shipped 2026-04-07)

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

---

## v1.1 — UX & Community Release

### Phase 8: Settings + Full-Tab Runner View

**Goal:** Add a "Runner view mode" setting (Sidebar panel / Editor tab) to the plugin settings tab, and make `activateRunnerView()` respect that setting on every invocation. Also fully implement the settings tab stub with all existing controls.
**Requirements:** RUNTAB-01, RUNTAB-02, RUNTAB-03
**Plans:** 2 plans

### Phase 9: Canvas Selector Dropdown

**Goal:** Let users choose which canvas/scenario to run from within the plugin panel via a dropdown — without having to close the panel and invoke the command again on a different canvas.
**Requirements:** SELECTOR-01, SELECTOR-02, SELECTOR-03, SELECTOR-04
**Plans:** 0 plans

### Phase 10: Insert Into Current Note Output

**Goal:** Add an output destination option that inserts protocol results directly into the currently active note at the cursor position, in addition to the existing dedicated output file option.
**Requirements:** OUTPUT-01, OUTPUT-02, OUTPUT-03
**Plans:** 0 plans

### Phase 11: Live Canvas Editing

**Goal:** Allow users to edit canvas nodes while the canvas is open in the editor, using the internal Canvas View API with Strategy A fallback. Eliminates the requirement to close the canvas before making node edits.
**Requirements:** LIVE-01, LIVE-02, LIVE-03, LIVE-04
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
| 8. Settings + Full-Tab Runner View | v1.1 | 2/2 | Needs Review | — |
| 9. Canvas Selector Dropdown | v1.1 | 0/? | Pending | — |
| 10. Insert Into Current Note Output | v1.1 | 0/? | Pending | — |
| 11. Live Canvas Editing | v1.1 | 0/? | Pending | — |
