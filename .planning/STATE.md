---
gsd_state_version: 1.0
milestone: none
milestone_name: null
status: between-milestones
stopped_at: "v1.9 milestone archived — ROADMAP/REQUIREMENTS/phases moved to milestones/v1.9-*. Next milestone TBD via /gsd-new-milestone."
last_updated: "2026-04-25T03:00:00.000Z"
last_activity: 2026-04-25 — v1.9 archived (milestone close); v1.9.0 GitHub Release live
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# RadiProtocol — Project State

**Updated:** 2026-04-25
**Milestone:** None — between milestones after v1.9 close
**Status:** v1.9 (Inline Runner Polish & Settings UX) shipped and archived. GitHub Release v1.9.0 live with 3 loose assets. Ready for next milestone definition via `/gsd-new-milestone`.

---

## Current Position

No active milestone. v1.9 archived to `.planning/milestones/`:
- `v1.9-ROADMAP.md` — full phase details (59–62)
- `v1.9-REQUIREMENTS.md` — 7/7 requirements satisfied with outcomes
- `v1.9-phases/` — all phase directories (17 plans, summaries, verification artifacts)

Last activity: 2026-04-25 — milestone close performed (archive + ROADMAP reorg + PROJECT evolution)

Progress: N/A — no active milestone

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-25 after v1.9 milestone).

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

**Current focus:** Planning next milestone. Use `/gsd-new-milestone` to define scope, requirements, and roadmap for v2.0 (or v1.10).

---

## Accumulated Context

### v1.0–v1.9 Shipped

- v1.0 (7 phases): foundation — parser, runner, UI, editor panel, snippets, loops, sessions.
- v1.2 (8 phases): runner UX and bug fixes (layout, selectors, separators, read-back).
- v1.3 (1 phase): interactive placeholder chip editor.
- v1.4 (4 phases): auto node coloring, snippet node (8th kind), mixed answer+snippet branching.
- v1.5 (4 phases): snippet editor refactoring (tree UI, modal create/edit, DnD, rename, MD snippets in runner).
- v1.6 (7 phases): dead-code audit, canvas node creation, node duplication, live canvas update.
- v1.7 (4 phases): unified loop node, runtime picker, editor form + picker-modal + start-from-node command, free-text-input removal.
- v1.8 (14 phases, 47–58): runner regressions closed, Node Editor UX polish, edge semantics (`+`-prefix exit, Answer↔edge sync), snippet picker overhaul + file-binding + button UX reversal, JSON placeholders → 2 types, Skip/Close buttons, Inline Protocol Display Mode, BRAT distribution (GitHub Release v1.8.0).
- v1.9 (4 phases, 59–62): Inline Runner feature parity (nested path resolution, separator on snippet insert, JSON fill-in modal), position persistence + compact layout, folder autocomplete on settings path fields, BRAT Release v1.9.0.

### Standing Pitfalls (carry-over from v1.9)

1. Never modify `.canvas` while open in Canvas view (Strategy A) unless Pattern B live-editor is used.
2. `vault.modify()` race conditions — use `WriteMutex` (async-mutex) per file path.
3. No `innerHTML` — use DOM API and Obsidian helpers.
4. No `require('fs')` — use `app.vault.*` exclusively.
5. `loadData()` returns null on first install — always merge with defaults.
6. `console.log` forbidden in production — use `console.debug()` during dev.
7. CSS files are append-only per phase — edit only the relevant feature file in `src/styles/`.
8. Shared files (`main.ts`, `editor-panel-view.ts`, `snippet-manager-view.ts`) — only modify code relevant to the current phase.
9. Real-DOM vs mock-DOM parent lookup: `parentElement` first, `.parent` mock fallback second.
10. v1.7 excised `maxIterations` — do not reintroduce a per-loop or global iteration cap.
11. v1.8: preserve backward compatibility of stored canvas shape — directory-bound Snippet nodes must keep working unchanged.

### v1.9 validated patterns (learned this milestone)

- **Inline modal position persistence** — workspace-state storage + clamp-on-restore (not clamp-on-save) survives monitor/resolution changes between sessions (Phase 60).
- **FolderSuggest** — Obsidian's `AbstractInputSuggest` via `app.vault.getAllFolders(false)`; single reusable class attached to multiple fields (Phase 61).
- **Path resolver parity** — trailing-slash + backslash normalization + `vault.getFiles()` prefix-scan fallback when `getAbstractFileByPath` returns null (Phase 59).
- **Inline JSON fill-in** — real `SnippetFillInModal` above floating inline modal with `isFillModalOpen` D1 gate + `close()` disposal (Phase 59 D6 reversal of Phase 54).
- **Accumulator-diff snippet append** — `appendDeltaFromAccumulator(beforeText)` mirrors sidebar `handleAnswerClick` pattern; zero drift between modes (Phase 59).

### Open Tech Debt (deferred to future)

- 3 Nyquist VALIDATION.md gaps (Phase 43/44/46 — tests green, frontmatter not promoted) — carried from v1.7.
- Nyquist VALIDATION.md draft for phases 12–19, 28–31, 32–35, 36–42.
- 1 legacy debug session (phase-27-regressions — `awaiting_human_verify`) — carried from v1.7.
- `@deprecated` `LoopStartNode` / `LoopEndNode` retained for Migration Check enumeration.
- 5 stale todo files for v1.8-delivered work in `.planning/todos/pending/` — cleanup opportunistically.
- 2 stale seeds (`duplicate-node.md`, `quick-node-creation.md`) for v1.6-delivered work in `.planning/seeds/`.

---

## Session Continuity

Last session: 2026-04-25
Stopped at: v1.9 milestone archived — between milestones
Resume file: None

---

## Repository

- Branch: `main`
- Main: `main`
- Last shipped: v1.9 (2026-04-25; GitHub Release v1.9.0 published)
- Starting phase number for next milestone: 63 (continues from Phase 62)

---

## Deferred Items

Items acknowledged and deferred at v1.9 milestone close on 2026-04-25:

| Category | Item | Status | Notes |
|----------|------|--------|-------|
| debug | phase-27-regressions | awaiting_human_verify | v1.7 carryover — color regression root cause found in canvas-live-editor.ts PROTECTED_FIELDS; not blocking |
| uat | Phase 59 UAT status field | passed / 0 open | Auditor noise — 0 pending scenarios, phase verified green |
| uat | Phase 61 UAT status field | unknown / 0 open | Status-field oversight — 0 pending scenarios, phase shipped |
| todo | bug-runner-textarea-edits-lost-on-loop-transition.md | high | Delivered in v1.8 Phase 47 (RUNFIX-01); stale file |
| todo | hierarchical-snippet-picker.md | high | Delivered in v1.8 Phase 51 (PICKER-01/02); stale file |
| todo | json-snippet-placeholder-rework.md | high | Delivered in v1.8 Phase 52 (PHLD-01); stale file |
| todo | loop-node-exit-from-edge-label.md | high | Delivered in v1.8 Phase 49/50.1 (EDGE-01/03); stale file |
| todo | new-nodes-placed-below-last.md | medium | Delivered in v1.8 Phase 48 (NODEUI-02); stale file |
| todo | 9 additional pending todos | mixed | Most reference already-delivered v1.6–v1.8 work; opportunistic cleanup |

**Triage outcome:** All 8 items non-blocking. Most pending todos are stale (work already shipped but file not deleted). Cleanup opportunity for next housekeeping pass; not a v2.0 prerequisite.
