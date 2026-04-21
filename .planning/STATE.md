---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: UX Polish & Snippet Picker Overhaul
status: executing
stopped_at: "v1.8 complete at plan-level — all 12 phases (47, 48, 48.1, 49, 50, 50.1, 51, 52, 53, 54, 55, 56) shipped across 48 plans. Phase 55 BRAT-01 fully closed: GitHub Release published by user via web-UI (2026-04-21); SC-2/SC-3 unblocked. Milestone ready for /gsd-complete-milestone v1.8. Phase-level orchestrator gates (regression / code-review / verify_phase_goal) skipped per user decision — equivalent coverage verified through per-phase human UAT."
last_updated: "2026-04-21T14:30:00.000Z"
last_activity: 2026-04-21 -- Phase 55 SC-2/SC-3 unblocked (v1.8.0 Release published); STATE.md trim + ROADMAP refresh + frontmatter counters updated in preparation for milestone closure
progress:
  total_phases: 12
  completed_phases: 12
  total_plans: 48
  completed_plans: 48
  percent: 100
---

# RadiProtocol — Project State

**Updated:** 2026-04-21
**Milestone:** v1.8 — UX Polish & Snippet Picker Overhaul
**Status:** Phase 55 complete at plan level; phase-level orchestrator gates (regression / code-review / verify_phase_goal) pending on several phases.

> **Note (2026-04-21):** Per-plan executive log trimmed to one-line references after forensic report `.planning/forensics/report-20260421-140424.md` identified STATE.md bloat as primary driver of GSD-command token cost. Full historical log preserved in `.planning/STATE.archive-2026-04-21.md`. Per-plan details always live in `{phase}-{plan}-SUMMARY.md`; per-phase gate details in `{phase}-UAT.md` / `{phase}-VALIDATION.md` / `{phase}-VERIFICATION.md`. Use `git log --oneline` for commit timeline.

---

## Current Position

**Active milestone:** v1.8 (85% complete — 34/40 plans across 15 phases).

**Most recent work (2026-04-21):**
- **Phase 55 — BRAT Distribution Readiness** — ✅ Complete. 4 plans + UAT PASS 7/7. BRAT-01 fully closed — GitHub Release v1.8.0 published by user via web-UI on 2026-04-21; SC-2/SC-3 verified. See `55-04-SUMMARY.md`.
- **Phase 54 — Inline Protocol Display Mode** — ✅ Complete (plan-level). 4 plans + 3 UAT fix rounds + post-landing code-review fix cycle (CR-01/CR-02, WR-01..WR-05). See `54-REVIEW-FIX.md`.
- **Phase 56 — Snippet Button UX Reversal** — ✅ Complete (plan-level). 4 plans + UAT PASS 5/5. Overturned Phase 51 D-13 (auto-insert on single-edge file-bound Snippet) and D-16 (sibling-button routes through picker). New rule: file-bound Snippet = direct insert (or placeholder modal for `.json`); directory-bound = picker. See `56-04-SUMMARY.md`.

**Still pending orchestrator phase-level gates** (regression / code-review / verify_phase_goal): multiple phases from 47 onwards landed at plan-level but haven't run the phase-complete pipeline. See individual SUMMARY files for exact state.

**Note on v1.8 Phase Map (below) and ROADMAP Progress section:** Both are stale — ROADMAP still lists Phase 51 as "0/6 Planned" and Phase 53 as "1/4 In progress", but git log shows 51/52/53/54/55/56 all shipped at plan level. Update those tables as part of next milestone closure.

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18).

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

---

## Accumulated Context

### v1.0–v1.7 Shipped

- v1.0 (7 phases): foundation — parser, runner, UI, editor panel, snippets, loops, sessions.
- v1.2 (8 phases): runner UX and bug fixes (layout, selectors, separators, read-back).
- v1.3 (1 phase): interactive placeholder chip editor.
- v1.4 (4 phases): auto node coloring, snippet node (8th kind), mixed answer+snippet branching.
- v1.5 (4 phases): snippet editor refactoring (tree UI, modal create/edit, DnD, rename, MD snippets in runner).
- v1.6 (7 phases): dead-code audit, canvas node creation, node duplication, live canvas update.
- v1.7 (4 phases): unified loop node, runtime picker, editor form + picker-modal + start-from-node command, free-text-input removal.

### v1.8 Roadmap Evolution

- **Phase 48.1** inserted after 48 — Toolbar Gap Tighten (cosmetic UAT follow-up). (URGENT)
- **Phase 50.1** inserted after 50 — Loop Exit `+` Prefix Convention. Supersedes Phase 49 D-07 alias so loop nodes can carry multiple labeled body edges unambiguously. Originated from conflict surfaced during Phase 50 UAT. (URGENT)
- **Phase 54** added mid-milestone — Inline Protocol Display Mode (third Runner display mode). Locked via `/gsd-explore` 2026-04-20, 4 decisions in `.planning/notes/inline-protocol-mode.md`.
- **Phase 56** added to v1.8 — Snippet Button UX Reversal. Overturns Phase 51 D-13/D-16 per user UAT verdict (2026-04-20).

### v1.8 Design Decisions (locked during /gsd-explore on 2026-04-18)

1. **Loop exit edge convention** — one labeled edge among loop-node outgoing = exit-button caption; unlabeled = body. (Originally "exactly one labeled"; Phase 50.1 relaxed to `+`-prefix convention.) See `.planning/notes/loop-node-exit-edge-convention.md`.
2. **Answer displayLabel ↔ edge label sync is bi-directional** — `Answer.displayLabel` is source of truth; multi-incoming shares label (accepted trade-off). See `.planning/notes/answer-label-edge-sync.md`.
3. **Snippet node binding** — node binds to a directory (existing) or specific snippet file (new). **Post-Phase-56 rule:** file-bound Snippet always renders a button + click = direct insert (or placeholder modal for `.json` with placeholders); directory-bound = button→picker. See `.planning/notes/snippet-node-binding-and-picker.md`.
4. **Hierarchical snippet picker with search** — unified picker replaces flat folder list; folder drill-down, breadcrumb, tree-wide search.
5. **JSON snippet placeholder types** — collapsed to `free-text` + unified `choice`. `choice` always multi-select in UI; single pick inserts one value, multi pick joins by separator (default `", "`, per-placeholder override). `number` / `multichoice` removed. Hard validation error on legacy types. See `.planning/notes/json-snippet-placeholder-rework.md`.
6. **BRAT distribution requires GitHub Releases with assets** — manifest must align with release tags; `manifest.json` / `main.js` / `styles.css` attached as assets.
7. **Inline protocol display mode (Phase 54)** — third Runner mode; floating non-blocking modal, appends answers to end of source note; command-palette launch only. See `.planning/notes/inline-protocol-mode.md`.

### Standing Pitfalls

1. Never modify `.canvas` while open in Canvas view (Strategy A) unless Pattern B live-editor is used.
2. `vault.modify()` race conditions — use `WriteMutex` (async-mutex) per file path.
3. No `innerHTML` — use DOM API and Obsidian helpers.
4. No `require('fs')` — use `app.vault.*` exclusively.
5. `loadData()` returns null on first install — always merge with defaults.
6. `console.log` forbidden in production — use `console.debug()` during dev.
7. CSS files are append-only per phase — edit only the relevant feature file in `src/styles/`.
8. Shared files (`main.ts`, `editor-panel-view.ts`, `snippet-manager-view.ts`) — only modify code relevant to the current phase.
9. Real-DOM vs mock-DOM parent lookup: `parentElement` first, `.parent` mock fallback second.
10. v1.7 excised `maxIterations` — do not reintroduce a per-loop or global iteration cap in v1.8.
11. v1.8: preserve backward compatibility of stored canvas shape — directory-bound Snippet nodes must keep working unchanged when specific-snippet binding is added.

### v1.8 Execution Log (compact)

One line per plan. For full detail read `{phase}/{phase}-{plan}-SUMMARY.md` or `git show {commit}`.

- **Phase 47** — Runner Regressions — Plans 01/02/03 shipped 2026-04-18. Plan 01: RUNFIX-01 (`ProtocolRunner.syncManualEdit` state-gate relaxation). Plan 02: RUNFIX-02 (`pendingTextareaScrollTop` + `capturePendingTextareaScroll`). Plan 03: RUNFIX-03 (Phase 47 CSS block in `runner-view.css` + `loop-support.css`; 3-revision UAT loop on narrow-sidebar overflow).
- **Phase 48** — Node Editor UX Polish — complete. NODEUI-01..05.
- **Phase 48.1** — Toolbar Gap Tighten — complete 2026-04-19 (URGENT insert).
- **Phase 49** — Loop Exit Edge Convention — Plans 01–05 shipped 2026-04-19. Plan 01: `src/graph/node-label.ts` + 23 tests. Plan 02: GraphValidator LOOP-04 rewrite with Russian error strings. Plan 03: Runner + RunnerView rewired to `isExitEdge`. Plan 04: fixture corpus aligned (4 fixtures stripped + 1 new). Plan 05: integration gate + human UAT. EDGE-01 closed. Tests 466/1/0.
- **Phase 50** — Answer ↔ Edge Label Sync — Plans 01–05 shipped 2026-04-19. Plan 01: `CanvasEdgeData` type-lift. Plan 02: `edge-label-reconciler.ts` + 11 tests + 2 fixtures. Plan 03: `canvas-live-editor.saveLiveEdges` + `saveLiveBatch` extension (D-14 atomicity). Plan 04: `EdgeLabelSyncService` + vault.on('modify') subscription + editor-panel Pattern B routing. Plan 05: gate + UAT PASS 5/5. EDGE-02 closed. Tests 484/1/0.
- **Phase 50.1** — Loop Exit `+` Prefix — complete 2026-04-19 (URGENT insert; supersedes Phase 49 D-07).
- **Phase 51** — Snippet Picker Overhaul — Plans 01–06 complete. PICKER-01/02. Note: D-13/D-16 later reversed by Phase 56.
- **Phase 52** — JSON Placeholder Rework — Plans 01–05 shipped 2026-04-20. Plan 01: Wave 0 TDD RED (4 test files + 6 fixture updates + 20 tests). Plan 02: model narrowed to 2 placeholder types. Plan 03: chip + fill-in GREEN. Plan 04: validation banner + runner guards. Plan 05: gate + UAT PASS 5/5 (includes mid-UAT gap closure `9900a56` for pre-Phase-33 chip-click-guard bug). PHLD-01 closed. Tests 642/1/0.
- **Phase 53** — Runner Skip & Close Buttons — Plans 01–04 shipped 2026-04-20/21. Plan 01: `ProtocolRunner.skip()` engine + TDD. Plan 02: Skip UI + Phase 53 CSS block. Plan 03: Close UI + `handleClose()` + D-14 teardown. Plan 04: integration gate + UAT PASS 3/3. 6 RUNNER-* requirements landed. Tests 648/1/0.
- **Phase 54** — Inline Protocol Display Mode — Plans 01–04 shipped 2026-04-21. Plan 01: `InlineRunnerModal` class + CSS shell. Plan 02: command registration + canvas picker + guards. Plan 03: `renderSnippet` import fix. Plan 04: UAT (3 fix rounds: 5+3+2 fixes) + post-code-review fix cycle (CR-01/CR-02/WR-01..WR-05 in commit `cd2baa3`). See `54-REVIEW-FIX.md`.
- **Phase 55** — BRAT Distribution Readiness — Plans 01–04 shipped 2026-04-21. Plan 01: 1.8.0 manifest/versions/package alignment. Plan 02: release preflight script. Plan 03: v1.8.0 release runbook. Plan 04: runbook polish. UAT PASS 7/7. BRAT-01 fully closed — v1.8.0 GitHub Release published by user via web-UI (2026-04-21); SC-2/SC-3 verified.
- **Phase 56** — Snippet Button UX Reversal — Plans 01–04 shipped 2026-04-21. Plan 01: runner-core file-bound dispatch. Plan 02: editor modal unsaved-dot. Plan 03: tree-picker committed-state. Plan 04: runner-view click dispatch + tests. UAT PASS 5/5.

### Open Tech Debt Carried Over from v1.7

- 3 Nyquist VALIDATION.md gaps (Phase 43/44/46 — tests green, frontmatter not promoted).
- 2 stale verification frontmatters (Phase 44/45 — UAT completed, frontmatter `human_needed`).
- 1 legacy debug session (phase-27-regressions — `awaiting_human_verify`).
- 6 code-review informational items (43-REVIEW WR-02/WR-03, 45-REVIEW IN-01/IN-02, 46-REVIEW IN-01/IN-02).
- `@deprecated` `LoopStartNode` / `LoopEndNode` retained for Migration Check enumeration.
- Nyquist VALIDATION.md draft for phases 12–19, 28–31, 32–35, 36–42.

Non-blocking for v1.8 delivery; clean up opportunistically during relevant phases.

### Open v1.8 tracking hygiene

- `ROADMAP.md § Progress` rows for Phases 51/52/53/54/55/56 are stale (show "Planned"/"In progress"/"Not started" for plans that already shipped). Refresh on milestone closure.
- 4 untracked `.planning/phases/*/*.md` files in `git status` (51-HUMAN-UAT, 53-PATTERNS, 54-CONTEXT, 54-REVIEW). Decide whether to commit or remove.

---

## v1.8 Phase Map

> **Stale — original scope snapshot as of 2026-04-18.** Phases 54/55/56 added mid-milestone; numbering shifted. For authoritative list see `ROADMAP.md`.

| Phase | Name | Requirements | Depends on |
|-------|------|--------------|------------|
| 47 | Runner Regressions | RUNFIX-01, RUNFIX-02, RUNFIX-03 | — |
| 48 | Node Editor UX Polish | NODEUI-01..05 | — |
| 49 | Loop Exit Edge Convention | EDGE-01 | Phase 43/44 (v1.7) |
| 50 | Answer ↔ Edge Label Sync | EDGE-02 | — |
| 51 | Snippet Picker Overhaul | PICKER-01, PICKER-02 | — |
| 52 | JSON Placeholder Rework | PHLD-01 | — |
| 53 | Runner Skip & Close | RUNNER-SKIP-01..03, RUNNER-CLOSE-01..03 | — |
| 54 | Inline Protocol Display Mode | (inline-mode reqs) | — |
| 55 | BRAT Distribution Readiness | BRAT-01 | Phases 47–54 |
| 56 | Snippet Button UX Reversal | overturns Phase 51 D-13/D-16 | Phase 51 |

---

## Repository

- Branch: `main`
- Main: `main`
- Last shipped: v1.7 (2026-04-18)
- Starting phase number for v1.8: 47 (continues from Phase 46).
