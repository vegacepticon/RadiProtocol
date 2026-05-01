---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: Maintenance & Tech Debt
status: Ready to execute
stopped_at: Phase 77 planned (14 plans, 9 waves)
last_updated: "2026-05-01T00:00:00.000Z"
last_activity: 2026-05-01 — Phase 77 planned (14 plans across 9 waves)
progress:
  total_phases: 10
  completed_phases: 0
  total_plans: 14
  completed_plans: 0
---

# RadiProtocol — Project State

**Updated:** 2026-05-01
**Milestone:** v1.12 Maintenance & Tech Debt — Phase 77 planned, ready to execute
**Status:** Ready to execute

---

## Current Position

Phase: 77 — eslint-findings-cleanup (planned)
Plan: 14 plans across 9 waves
Status: Ready to execute
Last activity: 2026-05-01 — Phase 77 planned (research → patterns → 14 plans → 2 verification iterations passed)

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-29 — v1.11 milestone opened, current state section refreshed).
See: `.planning/REQUIREMENTS.md` (updated 2026-04-29 — traceability table filled with phase mappings 69–74).
See: `.planning/ROADMAP.md` (updated 2026-04-29 — v1.10 details collapsed into archive, v1.11 phases 69–74 added with full success criteria).
See: `.planning/MILESTONES.md` (updated 2026-04-26 — v1.10 entry; v1.11 entry will be appended at milestone close).

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

**Current focus:** v1.11 milestone complete — awaiting next milestone definition

---

## v1.11 Phase Map

| Phase | Goal (one-line) | Requirements | Depends on |
|-------|-----------------|--------------|------------|
| 69 | Inline Runner — Hide Result-Export Buttons in Complete State | INLINE-CLEAN-01 | Nothing |
| 70 | Loop-Exit Picker Visual Hint | LOOP-EXIT-01 | Nothing |
| 71 | Settings — Donate Section | DONATE-01 | Nothing |
| 72 | Canvas Library — Full Algorithmic Canvases (ГМ, ОБП, ОЗП, ОМТ, ПКОП) | CANVAS-LIB-01..05 | Nothing (content-authoring track in author's vault; not bundled, not committed) |
| 73 | Canvas Library — Short Algorithmic Canvases (ОГК, ОБП, ОМТ short) | CANVAS-LIB-06..08 | Phase 72 (short ОБП and short ОМТ pair with full versions) |
| 74 | GitHub Release v1.11.0 | BRAT-03 | Phases 69, 70, 71 UAT-accepted (72/73 are not release-blocking) |

---

## v1.12 Phase Map

| Phase | Goal (one-line) | Requirements | Depends on |
|-------|-----------------|--------------|------------|
| 75 | RunnerView ↔ InlineRunnerModal Deduplication — shared `RunnerRenderer` under `src/runner/` consumed by both host shells; collapse parallel `inline-runner-*.test.ts` trees into shared fixtures | DEDUP-01, DEDUP-02 | Nothing |
| 76 | editor-panel-view.ts Decomposition — per-node-kind form modules under `src/views/editor-panel/forms/`; remaining `editor-panel-view.ts` < 400 LOC dispatcher; all six existing test files pass | SPLIT-01, SPLIT-02 | Nothing |
| 77 | Eslint Findings Cleanup — `npm run lint` exits 0 on `main`; 517 errors + 6 warnings cleared (dominant `obsidianmd/no-static-styles-assignment` converted to CSS class toggles per CLAUDE.md per-feature CSS architecture) | LINT-01 | Nothing |
| 78 | Lint + Test Automation Gate — pre-commit hook (`.githooks/pre-commit`) + GitHub Actions workflow (`.github/workflows/ci.yml`) running `npm ci && npm run build && npm run lint && npm test` on push/PR | CI-01, CI-02 | Phase 77 (gate unworkable until existing findings cleared) |

---

## Accumulated Context

### v1.0–v1.11 Shipped

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
- v1.11 (6 phases, 69–74): Inline Runner redundant-button cleanup, loop-exit picker visual hint, Settings donate section (9 wallet rows), 8 hand-authored algorithmic canvases (5 full + 3 short, in author's vault — not bundled), GitHub Release `1.11.0`.

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

### v1.11 Phase-Specific Domain Notes

- **Phase 69 (INLINE-CLEAN-01)** is Inline-mode-only. The buttons live in `InlineRunnerModal` (the same file Phase 65 RUNNER-02 modified for the shared `.rp-runner-footer-row`). Sidebar `RunnerView` and tab Runner View are unaffected — guard against accidental cross-mode regression. Confirm Inline mode appends every answer/snippet directly to the active note as the protocol runs (the existing Phase 54 contract) — that's why the result-export buttons are redundant in Inline only.
- **Phase 70 (LOOP-EXIT-01)** is purely CSS — the `+`-prefix loop-exit edge label convention is from Phase 50.1; the picker rendering is in `RunnerView.renderLoopPicker` and the inline equivalent. Tag the exit button with a CSS hook (e.g. a class like `is-loop-exit`) and add a rule in the appropriate `src/styles/*.css` file using existing Obsidian theme variables — no new colour tokens. Per CLAUDE.md, append-only per phase, do not edit existing rules.
- **Phase 71 (DONATE-01)** is a Settings-tab UI feature. Closest existing analog is Phase 61 (Settings folder autocomplete on `AbstractInputSuggest`) — same file (`src/main.ts` settings tab class), same DOM patterns (`createEl`/`createDiv`, `registerDomEvent`). Wallet addresses are hard-coded constants — no persistence, no user input. Copy-to-clipboard control is `navigator.clipboard.writeText` + `new Notice(...)`.
- **Phase 72 / 73 (CANVAS-LIB-01..08)** are content-authoring deliverables — eight `.canvas` files hand-built by the author in a local vault. They do NOT modify `src/`, do NOT change build output, do NOT need vitest tests. Each canvas is verified by running it end-to-end in the live Runner against the corresponding `.md` text template at `Z:\projects\references\` (and the SNIPPETS folder structure there). NOT bundled with the plugin. NOT committed to this repository.
- **Phase 74 (BRAT-03)** is the standard release phase — must depend on all preceding code-side phases (69, 70, 71) being complete and UAT-accepted. Mirror Phase 68's runbook structure (D10 UAT-gate-as-first-section pattern, three loose-asset GitHub Release, unprefixed annotated tag `1.11.0`, BRAT smoke install on clean vault). Phases 72/73 ship via author's local vault and are NOT release-blocking.

### Open Tech Debt (carried from v1.10 close)

- Verification documentation backfill — Phases 64, 66, 67 lack formal `gsd-verifier` VERIFICATION.md (UAT-PASS evidence exists). Pattern: v1.8 Phase 58 backfill.
- Nyquist `VALIDATION.md` — Phase 63 draft, Phases 64–68 missing entirely; project-wide tech debt also covers Phases 12–19, 28–31, 32–35, 36–42, 43, 44, 46.
- 3 open debug sessions — `inline-runner-drag-resets-size` and `inline-runner-tab-switch-resets-size` both resolved by gap-closure `92a1269` but not formally closed; `phase-27-regressions` carryover from v1.7.
- 2 stale seeds (`duplicate-node.md`, `quick-node-creation.md`) for v1.6-delivered work in `.planning/seeds/`.
- `@deprecated` `LoopStartNode` / `LoopEndNode` retained for Migration Check enumeration (carry-over from v1.7).

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-04-30:

| Category | Item | Status |
|----------|------|--------|
| debug | inline-runner-drag-resets-size | unknown — resolved by gap-closure 92a1269 but not formally closed |
| debug | inline-runner-tab-switch-resets-size | unknown — resolved by gap-closure 92a1269 but not formally closed |
| debug | phase-27-regressions | awaiting_human_verify — color regression root cause found in canvas-live-editor.ts PROTECTED_FIELDS |
| uat_gap | Phase 72 HUMAN-UAT | resolved — 0 pending scenarios |

---

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260430-s48 | Settings — Donate moved to bottom + wallet addresses collapsed behind `<details>` | 2026-04-30 | f1ae8fe | [260430-s48-settings-donate-collapse](./quick/260430-s48-settings-donate-collapse/) |
| 260430-sxo | Cleanup quick-wins from CONCERNS.md (untrack build artifacts, drop duplicate CSS write, delete dead FolderPickerModal, archive shipped milestones) | 2026-04-30 | 4e69205 | [260430-sxo-cleanup-quick-wins-from-concerns-md](./quick/260430-sxo-cleanup-quick-wins-from-concerns-md/) |
| 260430-uas | LOW-cleanup batch from CONCERNS.md (archive misplaced docs, drop unused exports, fix devDeps, backfill versions.json) | 2026-04-30 | 5b2fd2d | [260430-uas-low-cleanup-batch-from-concerns-md](./quick/260430-uas-low-cleanup-batch-from-concerns-md/) |

---

## Session Continuity

Last session: 2026-05-01T00:00:00.000Z
Stopped at: Phase 77 planned (14 plans, 9 waves; 2 verification iterations passed)
Resume file: .planning/phases/77-eslint-findings-cleanup/77-01-PLAN.md (start of Wave 1)
Next action: Run `/gsd-execute-phase 77` to execute Wave 1 (config baseline) → Waves 2-9 (per-file static-styles + residual rule fixes + final gate).

---

## Repository

- Branch: `main`
- Main: `main`
- Last shipped: v1.11 (2026-04-30; GitHub Release `1.11.0` published)
- Active phase: 77 (planned, ready to execute)
