---
gsd_state_version: 1.0
milestone: v1.11
milestone_name: Inline Polish, Loop Hint, Donate & Canvas Library
status: planning
last_updated: "2026-04-29T09:58:01.899Z"
last_activity: 2026-04-29
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# RadiProtocol — Project State

**Updated:** 2026-04-26
**Milestone:** v1.10 Editor Sync & Runner UX Polish — ✅ SHIPPED 2026-04-26
**Status:** Milestone closed and archived. GitHub Release `1.10.0` live with three loose BRAT assets; clean-vault BRAT smoke verified. Awaiting next milestone (run `/gsd-new-milestone`).

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-29 — Milestone v1.11 started

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-26 — v1.10 milestone closed, requirements moved to Validated, Key Decisions extended).
See: `.planning/ROADMAP.md` (updated 2026-04-26 — v1.10 collapsed under details, Backlog preserved).
See: `.planning/MILESTONES.md` (updated 2026-04-26 — v1.10 entry added).

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

**Current focus:** Awaiting next milestone definition.

---

## Accumulated Context

### v1.0–v1.10 Shipped

- v1.0 (7 phases): foundation — parser, runner, UI, editor panel, snippets, loops, sessions.
- v1.2 (8 phases): runner UX and bug fixes (layout, selectors, separators, read-back).
- v1.3 (1 phase): interactive placeholder chip editor.
- v1.4 (4 phases): auto node coloring, snippet node (8th kind), mixed answer+snippet branching.
- v1.5 (4 phases): snippet editor refactoring (tree UI, modal create/edit, DnD, rename, MD snippets in runner).
- v1.6 (7 phases): dead-code audit, canvas node creation, node duplication, live canvas update.
- v1.7 (4 phases): unified loop node, runtime picker, editor form + picker-modal + start-from-node command, free-text-input removal.
- v1.8 (14 phases, 47–58): runner regressions closed, Node Editor UX polish, edge semantics (`+`-prefix exit, Answer↔edge sync), snippet picker overhaul + file-binding + button UX reversal, JSON placeholders → 2 types, Skip/Close buttons, Inline Protocol Display Mode, BRAT distribution (GitHub Release v1.8.0).
- v1.9 (4 phases, 59–62): Inline Runner feature parity, position persistence + compact layout, folder autocomplete on settings path fields, BRAT Release v1.9.0.
- v1.10 (6 phases, 63–68): bidirectional Canvas ↔ Node Editor sync, auto-grow textareas + Text block quick-create, Back/Skip footer layout, step-back reliability + scroll pinning, Inline Runner resizable modal + file-bound Snippet parity, BRAT Release `1.10.0`.

### Standing Pitfalls (carry-over from v1.10)

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
12. v1.9: Inline Runner position persistence uses clamp-on-restore (not clamp-on-save) — survives monitor/resolution changes.
13. v1.10 / Phase 67: file-bound Snippet parity (INLINE-FIX-07) root-cause was in shared `src/runner/protocol-runner.ts` `advanceThrough` case `'snippet'`, NOT inline-only. Phase 56 fixed only the sibling-button click path; loop-body and direct-edge traversals remained broken until Phase 67 D-14 + D-15. Going forward, runner-core dispatch for any new node-kind extension MUST consider all traversal paths (sibling-button click, loop-body edge, direct edge) — not just the click path.
14. v1.10 / Phase 63: Node Editor canvas → form sync subscribes to `EdgeLabelSyncService`'s `canvas-changed-for-node` event bus and patches DOM via `registerFieldRef`; future Node-Editor work that adds new fields MUST register them through this helper or they will not receive inbound canvas patches.

### Open Tech Debt (carried from v1.10 close)

- Verification documentation backfill — Phases 64, 66, 67 lack formal `gsd-verifier` VERIFICATION.md (UAT-PASS evidence exists). Pattern: v1.8 Phase 58 backfill.
- Nyquist `VALIDATION.md` — Phase 63 draft, Phases 64–68 missing entirely; project-wide tech debt also covers Phases 12–19, 28–31, 32–35, 36–42, 43, 44, 46.
- 3 open debug sessions — `inline-runner-drag-resets-size` and `inline-runner-tab-switch-resets-size` both resolved by gap-closure `92a1269` but not formally closed; `phase-27-regressions` carryover from v1.7.
- 2 stale seeds (`duplicate-node.md`, `quick-node-creation.md`) for v1.6-delivered work in `.planning/seeds/`.
- `@deprecated` `LoopStartNode` / `LoopEndNode` retained for Migration Check enumeration (carry-over from v1.7).

---

## Session Continuity

Last session: 2026-04-26
Stopped at: `/gsd-complete-milestone 1.10` finished; ready for next milestone.
Resume file: none
Next action: `/clear` then `/gsd-new-milestone` to define the next milestone.

---

## Repository

- Branch: `main`
- Main: `main`
- Last shipped: v1.10 (2026-04-26; GitHub Release `1.10.0` published)
- Active phase: none
