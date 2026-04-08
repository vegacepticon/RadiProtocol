# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-08

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

### Phase 8: Full-Tab Runner View

**Goal:** Open the protocol runner as a full editor tab (like a new note) instead of a sidebar panel — full-width layout for better readability and UX.
**Requirements:** RUNTAB-01, RUNTAB-02, RUNTAB-03
**Status:** ✅ Complete

---

### Phase 9: Canvas Selector Dropdown

**Goal:** Let users switch which canvas/scenario to run from within the runner view via a dropdown — without closing the panel and re-invoking the command.
**Requirements:** SELECTOR-01, SELECTOR-02, SELECTOR-03, SELECTOR-04
**Status:** ✅ Complete

---

### Phase 10: Insert Into Current Note

**Goal:** Add "insert into current note" as an output destination — when the runner completes, the generated protocol text is appended to the currently active note in the editor.
**Requirements:** OUTPUT-01, OUTPUT-02, OUTPUT-03
**Canonical refs:** `src/views/runner-view.ts`, `src/main.ts`
**Plans:** 1/1 plans complete

Plans:
- [x] 10-01-PLAN.md — Add insertIntoCurrentNote() to main.ts and Insert into note button with active-leaf-change listener to runner-view.ts

---

### Phase 11: Live Canvas Editing

**Goal:** Allow canvas nodes to be edited while the canvas is open in Canvas view, using the internal Canvas View API with Strategy A fallback.
**Requirements:** LIVE-01, LIVE-02, LIVE-03, LIVE-04
**Plans:** 3 plans

Plans:
- [ ] 11-00-PLAN.md — Wave 0: Create failing RED test stubs (canvas-live-editor.test.ts + canvas-write-back.test.ts updates)
- [ ] 11-01-PLAN.md — Wave 1: Implement CanvasLiveEditor module and canvas-internal.d.ts type declarations
- [ ] 11-02-PLAN.md — Wave 2: Wire CanvasLiveEditor into EditorPanelView.saveNodeEdits() and main.ts; remove Strategy A guard

---

## Backlog

### Phase 999.1: Canvas selector dropdown in runner view (BACKLOG)

**Goal:** Let users choose which canvas/scenario to run from within the plugin panel via a dropdown or similar UX — without having to close the panel and invoke the command again on a different canvas.
**Plans:** 0 plans

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
