---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: Inline Runner Polish & Settings UX
status: shipped
stopped_at: "v1.9.0 published to GitHub Releases — SC-1 (local) and SC-2 (Release) verified; SC-3 (fresh-vault BRAT smoke test) optional manual check"
last_updated: "2026-04-25T02:00:00.000Z"
last_activity: 2026-04-25 — v1.9.0 released: tag 1.9.0 pushed, GitHub Release v1.9.0 published with 3 loose assets (main.js, manifest.json, styles.css); API smoke check PASS
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 17
  completed_plans: 17
  percent: 100
---

# RadiProtocol — Project State

**Updated:** 2026-04-25
**Milestone:** v1.9 — Inline Runner Polish & Settings UX
**Status:** SHIPPED. v1.9.0 published to GitHub Releases. SC-1 (local versioning + build) and SC-2 (Release with 3 loose assets, prerelease: false) verified. SC-3 (fresh-vault BRAT smoke test) is an optional manual confirmation.

---

## Current Position

Phase: 62 of 62 (BRAT Release v1.9.0) — SHIPPED
Plan: 3/3 plans complete; v1.9.0 published
Status: GitHub Release v1.9.0 live at https://github.com/vegacepticon/RadiProtocol/releases/tag/1.9.0 with 3 loose assets. API smoke check PASS (`tag_name=1.9.0`, `prerelease=false`, assets=main.js+manifest.json+styles.css). Tag `1.9.0` pushed. Local commits 9864c98..9c7bc8c synced to origin/main.
Last activity: 2026-04-25 — v1.9.0 RELEASED

Progress: [██████████] 100% (4/4 phases complete, 17/17 plans complete, milestone shipped)

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-24).

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

**Current focus:** v1.9 milestone shipped — v1.9.0 GitHub Release live. Next: optional `/gsd-complete-milestone` to archive v1.9 and prepare for v2.0 / next milestone scope.

---

## v1.9 Phase Map

| Phase | Name | Requirements | Plans | Status |
|-------|------|--------------|-------|--------|
| 59 | Inline Runner Feature Parity | INLINE-FIX-01, INLINE-FIX-04, INLINE-FIX-05 | 5 | Complete 2026-04-24 |
| 60 | Inline Runner Layout & Position Persistence | INLINE-FIX-02, INLINE-FIX-03 | 5 | Complete 2026-04-24 |
| 61 | Settings Folder Autocomplete | SETTINGS-01 | 4 | Complete 2026-04-24 |
| 62 | BRAT Release v1.9.0 | BRAT-02 | 3 | Shipped 2026-04-25 |

**Coverage:** 7/7 v1.9 requirements mapped. No orphans. Phases 59–61 are independent; Phase 62 depends on all three.

---

## v1.9 Scope Summary (confirmed 2026-04-24)

**Inline Runner fixes (5):**
1. Path resolution: nested `templates/ALGO`-style paths not found (but snippets nested paths work)
2. Position persistence: modal flies off-screen after tab switch, becomes un-draggable
3. Compact layout: modal overlaps note text — reduce default footprint
4. Snippet separator: ignored on insert (no space/newline between text and inserted snippet)
5. JSON snippet fill-in: modal with placeholder fields doesn't appear in inline mode

**Settings UX (1):**
6. Folder autocomplete: FolderSuggest dropdown (Templater-style) on all path fields (Protocols, Snippets, Output)

**Distribution (1):**
7. BRAT release v1.9.0 at end of milestone (single release, pattern repeats v1.8)

**Decisions locked during /gsd-new-milestone discuss:**
- Position persistence → save last drag-coords in workspace state (not always-default, not session-only)
- Overlap fix → compact layout by default (no resize handle, no auto-fade this iteration)
- Autocomplete → apply to ALL path fields in settings (not just Protocols)
- Release cadence → single 1.9.0 at end of milestone (no patch releases along the way)
- Seeds `duplicate-node.md` + `quick-node-creation.md` → stale (delivered in v1.6), excluded from v1.9
- Community plugin submission (deferred item in PROJECT.md) → NOT in v1.9; BRAT-only distribution

---

## Accumulated Context

### v1.0–v1.8 Shipped

- v1.0 (7 phases): foundation — parser, runner, UI, editor panel, snippets, loops, sessions.
- v1.2 (8 phases): runner UX and bug fixes (layout, selectors, separators, read-back).
- v1.3 (1 phase): interactive placeholder chip editor.
- v1.4 (4 phases): auto node coloring, snippet node (8th kind), mixed answer+snippet branching.
- v1.5 (4 phases): snippet editor refactoring (tree UI, modal create/edit, DnD, rename, MD snippets in runner).
- v1.6 (7 phases): dead-code audit, canvas node creation, node duplication, live canvas update.
- v1.7 (4 phases): unified loop node, runtime picker, editor form + picker-modal + start-from-node command, free-text-input removal.
- v1.8 (14 phases, 47–58): runner regressions closed, Node Editor UX polish, edge semantics (`+`-prefix exit, Answer↔edge sync), snippet picker overhaul + file-binding + button UX reversal, JSON placeholders → 2 types, Skip/Close buttons, Inline Protocol Display Mode, BRAT distribution (GitHub Release v1.8.0).

### Standing Pitfalls (carry-over from v1.8)

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

### v1.9-specific pitfalls (to validate during research/planning)

- **Inline modal position persistence** — must survive tab switch AND plugin reload; clamp to viewport bounds to avoid "flies off-screen" regression.
- **FolderSuggest** — Obsidian's `AbstractInputSuggest` is the standard pattern (used by Templater); avoid custom popup DOM.
- **Path resolver parity** — snippet resolver handles nested paths correctly; mirror its behavior in canvas/protocol folder lookup.
- **JSON fill-in in inline mode** — SnippetFillInModal must work over floating inline modal without z-index conflicts.

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
Stopped at: v1.9.0 SHIPPED — GitHub Release v1.9.0 published; SC-1/SC-2 verified
Resume file: None

---

## Repository

- Branch: `main`
- Main: `main`
- Last shipped: v1.9 (2026-04-25; GitHub Release v1.9.0 published)
- Starting phase number for v1.9: 59 (continues from Phase 58)
