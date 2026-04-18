---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: UX Polish & Snippet Picker Overhaul
status: planning
stopped_at: Phase 47 planned (3 plans, 1 wave) — ready to execute
last_updated: "2026-04-18T00:00:00.000Z"
last_activity: 2026-04-18
resume_file: .planning/phases/47-runner-regressions/
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
  percent: 0
---

# RadiProtocol — Project State

**Updated:** 2026-04-18
**Milestone:** v1.8 — UX Polish & Snippet Picker Overhaul
**Status:** Ready to execute — Phase 47 planned (3 plans, 1 wave)
**Stopped at:** Phase 47 plans verified (RUNFIX-01/02/03 all covered); next step is `/gsd-execute-phase 47`

---

## Current Position

Phase: 47 (Runner Regressions) — planned, ready to execute
Plans: 47-01, 47-02, 47-03 (all Wave 1, parallel)
Status: Planning complete; verification passed; awaiting execution
Last activity: 2026-04-18 — Phase 47 planned and verified

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-18)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.
**Current focus:** Closing runner regressions, polishing Node Editor UX, overhauling Snippet picker, unifying JSON placeholders, and enabling BRAT distribution.

---

## Accumulated Context

### v1.0–v1.7 Shipped

- v1.0: 7 phases — foundation (parser, runner, UI, editor panel, snippets, loops, sessions)
- v1.2: 8 phases — runner UX and bug fixes (layout, selectors, separators, read-back fixes)
- v1.3: 1 phase — interactive placeholder chip editor
- v1.4: 4 phases — auto node coloring, snippet node (8th kind), mixed answer+snippet branching
- v1.5: 4 phases — snippet editor refactoring (tree UI, modal create/edit, DnD, rename, MD snippets in runner)
- v1.6: 7 phases — dead-code audit, canvas node creation, node duplication, live canvas update
- v1.7: 4 phases — unified loop node, runtime picker, editor form + picker-modal + start-from-node command, free-text-input removal

### v1.8 Design Decisions (locked during /gsd-explore on 2026-04-18)

1. **Loop exit edge convention** — among a loop-node's outgoing edges, exactly one must be labeled; its label becomes the exit-button caption in Runner. Unlabeled edges are body branches. Zero or ≥2 labeled edges → validation error. (See `.planning/notes/loop-node-exit-edge-convention.md`.)
2. **Answer displayLabel ↔ edge label sync is bi-directional** — `Answer.displayLabel` is the single source of truth; every incoming edge label renders from it and edits to either side update the other. Multi-incoming answers share the same label (accepted trade-off — user has no current multi-incoming topologies). (See `.planning/notes/answer-label-edge-sync.md`.)
3. **Snippet node binding** — node may bind to a directory (existing) or a specific snippet file (new). Specific-bound node auto-inserts when it's the sole option at the step; clickable choice when siblings exist. Placeholder modal still runs before insertion for `.json` with placeholders. (See `.planning/notes/snippet-node-binding-and-picker.md`.)
4. **Hierarchical snippet picker with search** — a single unified picker replaces the flat folder list; supports folder drill-down, breadcrumb, and tree-wide search. Used wherever a snippet or folder is picked. Pure UI-layer change; stored path shape is unchanged.
5. **JSON snippet placeholder types** — collapse to exactly two (`free text`, unified `choice`). `choice` always multi-select in UI; single pick inserts one value, multi pick joins by separator (default `", "`, per-placeholder `separator` override). `number` and `multichoice` removed; legacy snippets declaring removed types are a hard validation error (user confirmed no legacy snippets exist). Fix the existing bug where the `choice` options list cannot be edited. (See `.planning/notes/json-snippet-placeholder-rework.md`.)
6. **BRAT distribution requires GitHub Releases with assets** — no releases currently exist (only bare tags v1.0–v1.7); manifest version must align with release tags; `manifest.json` / `main.js` / `styles.css` attached as assets.

### Standing Pitfalls

1. Never modify `.canvas` while open in Canvas view (Strategy A) unless Pattern B live-editor is used.
2. `vault.modify()` race conditions — use `WriteMutex` (async-mutex) per file path.
3. No `innerHTML` — use DOM API and Obsidian helpers.
4. No `require('fs')` — use `app.vault.*` exclusively.
5. `loadData()` returns null on first install — always merge with defaults.
6. `console.log` forbidden in production — use `console.debug()` during dev.
7. CSS files are append-only per phase — edit only the relevant feature file in `src/styles/`.
8. Shared files (`main.ts`, `editor-panel-view.ts`, `snippet-manager-view.ts`) — only modify code relevant to the current phase.
9. Real-DOM vs mock-DOM parent lookup: always use `parentElement` first, `.parent` mock fallback second.
10. v1.7 excised `maxIterations`; do not reintroduce a per-loop or global iteration cap in v1.8.
11. v1.8-specific: preserve backward compatibility of stored canvas shape — directory-bound Snippet nodes must keep working unchanged when the specific-snippet binding is added.

### Open Tech Debt Carried Over from v1.7

- 3 Nyquist VALIDATION.md gaps (Phase 43/44/46 — tests green, frontmatter not promoted)
- 2 stale verification frontmatters (Phase 44/45 — UAT completed, frontmatter `human_needed`)
- 1 legacy debug session (phase-27-regressions — `awaiting_human_verify`)
- 6 code-review informational items (43-REVIEW WR-02/WR-03, 45-REVIEW IN-01/IN-02, 46-REVIEW IN-01/IN-02)
- `@deprecated` `LoopStartNode` / `LoopEndNode` retained for Migration Check enumeration
- Nyquist VALIDATION.md draft for phases 12–19, 28–31, 32–35, 36–42

These are non-blocking for v1.8 delivery but may be cleaned up opportunistically during relevant phases.

---

## v1.8 Phase Map

| Phase | Name | Requirements | Depends on |
|-------|------|--------------|------------|
| 47 | Runner Regressions | RUNFIX-01, RUNFIX-02, RUNFIX-03 | Nothing |
| 48 | Node Editor UX Polish | NODEUI-01, NODEUI-02, NODEUI-03, NODEUI-04, NODEUI-05 | Nothing |
| 49 | Loop Exit Edge Convention | EDGE-01 | Phase 43 (v1.7 LoopNode model), Phase 44 (v1.7 loop picker) |
| 50 | Answer ↔ Edge Label Sync | EDGE-02 | Nothing |
| 51 | Snippet Picker Overhaul | PICKER-01, PICKER-02 | Nothing (builds on v1.4 Snippet node + v1.5 tree primitives) |
| 52 | JSON Placeholder Rework | PHLD-01 | Nothing |
| 53 | BRAT Distribution Readiness | BRAT-01 | Phases 47–52 (release artifact must be shippable) |

**Coverage:** 14/14 v1.8 requirements mapped; no orphans, no duplicates.

**Suggested execution order:** 47 → 48 → 49 → 50 → 51 → 52 → 53. Phases 47/48/50/52 are independent and may be executed in any order between 47 and 53; 49 requires v1.7 scaffolding already shipped; 53 is scheduled last because it packages the final build.

---

## Repository

- Branch: `main`
- Main: `main`
- Last shipped: v1.7 (2026-04-18)
- Starting phase number for v1.8: **47** (continues from Phase 46)
