---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: Maintenance & Tech Debt
status: Closed (internal-only — no GitHub Release)
stopped_at: v1.12 closed 2026-05-02 — awaiting next milestone definition
last_updated: "2026-05-02T00:00:00.000Z"
last_activity: 2026-05-02 — v1.12 audited (7/7 requirements satisfied) and closed; archive under .planning/milestones/v1.12-*
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 28
  completed_plans: 28
---

# RadiProtocol — Project State

**Updated:** 2026-05-02
**Milestone:** v1.12 Maintenance & Tech Debt — **CLOSED 2026-05-02**
**Status:** Closed (internal-only milestone — no GitHub Release; v1.11.0 remains the latest user-facing release)

---

## Current Position

Milestone: v1.12 — closed 2026-05-02
Audit: `.planning/MILESTONE-AUDIT.md` (Path A — close with documented tech debt, no blockers)
Last shipped user-facing release: v1.11.0 (2026-04-30)
Next action: define next milestone (v1.13 scope TBD), or commit Phase 75 atomic per-plan commits if continuing on v1.12 housekeeping

## Project Reference

See: `.planning/PROJECT.md` (last updated 2026-04-29).
See: `.planning/REQUIREMENTS.md` (v1.12 requirements — all 7 satisfied per audit).
See: `.planning/ROADMAP.md` (v1.12 phase blocks at lines 274–376; progress table at lines 385–407 still shows Phase 75/76 as "Not started" — documentation drift, see Tech Debt below).
See: `.planning/MILESTONES.md` (v1.12 closing entry prepended 2026-05-02).
See: `.planning/MILESTONE-AUDIT.md` (full audit findings).
See: `.planning/milestones/v1.12-ROADMAP.md` (snapshot at close).
See: `.planning/milestones/v1.12-phases/` (archived 75/76/77/78 artifacts).

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

**Current focus:** v1.12 closed — awaiting next milestone definition.

---

## v1.12 Phase Map (closed)

| Phase | Goal (one-line) | Requirements | Status |
|-------|-----------------|--------------|--------|
| 75 | RunnerView ↔ InlineRunnerModal Deduplication — shared `src/runner/render/*` consumed by both host shells; inline test family merged onto shared fixtures | DEDUP-01, DEDUP-02 | ✅ Complete (verification GREEN; **artifacts in working tree, not yet committed** — see Deferred Items) |
| 76 | editor-panel-view.ts Decomposition — per-kind form modules + helper extraction; dispatcher under 400 LOC | SPLIT-01, SPLIT-02 | ✅ Complete (commit `0406c98`; 393 LOC) |
| 77 | Eslint Findings Cleanup — 517 errors → 0; 6 warnings → 2 documented | LINT-01 | ✅ Complete (12 commits `681f82d`..`99f8afa`) |
| 78 | Lint + Test Automation Gate — pre-commit hook + GitHub Actions workflow | CI-01, CI-02 | ✅ Complete (commits `8dee957`, `907cec1`; CI-04/05 live red-status verification deferred to first natural PR) |

---

## Accumulated Context

### v1.0–v1.12 Shipped

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
- **v1.12 (4 phases, 75–78): RunnerView/InlineRunnerModal renderer extraction, editor-panel-view decomposition, ESLint findings cleanup (517 → 0), pre-commit + GitHub Actions automation gate. Internal-only — no GitHub Release.**

### Standing Pitfalls (carry-over)

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
15. **v1.12 / Phase 75: shared protocol-runner rendering now lives in `src/runner/render/*.ts` with `runner-host.ts` providing the host abstraction. New per-step UI MUST be added to the shared renderer, NOT duplicated into the host shells. The hosts (`runner-view.ts`, `inline-runner-modal.ts`) are thin wrappers responsible only for chrome, lifecycle, autosave/append policy, layout/position, and output-toolbar differences.**
16. **v1.12 / Phase 76: `src/views/editor-panel-view.ts` is a <400-LOC dispatcher. Per-kind form bodies live under `src/views/editor-panel/forms/`; helpers under `src/views/editor-panel/`. Adding form-rendering logic back into the dispatcher is a regression — extract to a helper or form module instead. Spyable private surface (`renderNodeForm`, `renderForm`, `buildKindForm`, `applyCanvasPatch`, `pendingEdits`, `formFieldRefs`, etc.) is preserved by routing through wrapper methods on `EditorPanelView`; do not bypass these wrappers when extracting further.**
17. **v1.12 / Phase 77: per-feature `src/styles/*.css` files are the home for previously-inline styles. New visual rules belong in the matching feature file, append-only per phase, with a `/* Phase N: description */` header. Inline `el.style.foo = ...` assignments are an ESLint error (`obsidianmd/no-static-styles-assignment`) — use class toggles or `setCssProps` with custom properties instead.**
18. **v1.12 / Phase 78: pre-commit hook `.githooks/pre-commit` runs eslint on staged `*.ts` and `npm test` before allowing commits. Wired via `core.hooksPath`. `--no-verify` is the intentional escape hatch (CI is the safety net). GitHub Actions workflow at `.github/workflows/ci.yml` runs `npm ci && npm run build && npm run lint && npm test` on push to `main` and on every PR.**

### Open Tech Debt at v1.12 close

- **Phase 75 atomic-commit gap (introduced 2026-05-02; HIGH-priority closeout)** — verification GREEN but source deltas, new modules under `src/runner/`, new shared tests under `src/__tests__/runner/`, and `.planning/phases/75-runner-view-inline-runner-deduplication/` exist only in the working tree. ROADMAP.md progress table still labels Phase 75 as "Not started". Mechanical cleanup pending.
- **CI-04 / CI-05 live red-status verification (introduced 2026-05-02)** — workflow structurally valid; observation of red ✕ on a real PR with deliberate eslint or test failure happens on the first natural PR.
- **2 lint warnings remaining** — `obsidianmd/prefer-file-manager-trash-file` in `src/snippets/snippet-service.ts:240,283`. Documented out-of-scope in REQUIREMENTS.md "Future Requirements"; safe in a future phase.
- **MEDIUM-5 from CONCERNS.md (deferred per REQUIREMENTS.md)** — `protocol-runner.ts` (819 LOC) and `snippet-manager-view.ts` (1037 LOC) remain large. Re-evaluate now that DEDUP-01 has shipped a renderer-extraction template.
- Verification documentation backfill — Phases 64, 66, 67 lack formal `gsd-verifier` `VERIFICATION.md` (UAT-PASS evidence exists). Pattern: v1.8 Phase 58 backfill.
- Nyquist `VALIDATION.md` — Phase 63 draft, Phases 64–78 missing entirely; project-wide tech debt.
- 3 open debug sessions — `inline-runner-drag-resets-size` and `inline-runner-tab-switch-resets-size` resolved by gap-closure `92a1269` but not formally closed; `phase-27-regressions` carryover from v1.7.
- 2 stale seeds (`duplicate-node.md`, `quick-node-creation.md`) for v1.6-delivered work in `.planning/seeds/`.
- `@deprecated` `LoopStartNode` / `LoopEndNode` retained for Migration Check enumeration (carry-over from v1.7).

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-05-02:

| Category | Item | Status |
|----------|------|--------|
| commit | Phase 75 atomic per-plan commits + ROADMAP.md status flip | pending — verification GREEN; mechanical cleanup |
| ci_verification | CI-04/CI-05 live red-status check on real PR | deferred to next natural PR |
| lint | 2 × `obsidianmd/prefer-file-manager-trash-file` warnings in `snippet-service.ts` | documented out-of-scope |
| refactor | MEDIUM-5 — `protocol-runner.ts` (819 LOC) and `snippet-manager-view.ts` (1037 LOC) decomposition | deferred per REQUIREMENTS.md |
| debug | inline-runner-drag-resets-size | unknown — resolved by gap-closure 92a1269 but not formally closed |
| debug | inline-runner-tab-switch-resets-size | unknown — resolved by gap-closure 92a1269 but not formally closed |
| debug | phase-27-regressions | awaiting_human_verify — color regression root cause found in canvas-live-editor.ts PROTECTED_FIELDS |
| verification_backfill | Phases 64/66/67 formal `VERIFICATION.md` | carry-over from v1.10 |
| nyquist | `VALIDATION.md` for Phases 63–78 | project-wide tech debt |

---

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260430-s48 | Settings — Donate moved to bottom + wallet addresses collapsed behind `<details>` | 2026-04-30 | f1ae8fe | [260430-s48-settings-donate-collapse](./quick/260430-s48-settings-donate-collapse/) |
| 260430-sxo | Cleanup quick-wins from CONCERNS.md (untrack build artifacts, drop duplicate CSS write, delete dead FolderPickerModal, archive shipped milestones) | 2026-04-30 | 4e69205 | [260430-sxo-cleanup-quick-wins-from-concerns-md](./quick/260430-sxo-cleanup-quick-wins-from-concerns-md/) |
| 260430-uas | LOW-cleanup batch from CONCERNS.md (archive misplaced docs, drop unused exports, fix devDeps, backfill versions.json) | 2026-04-30 | 5b2fd2d | [260430-uas-low-cleanup-batch-from-concerns-md](./quick/260430-uas-low-cleanup-batch-from-concerns-md/) |

---

## Session Continuity

Last session: 2026-05-02T00:00:00.000Z
Stopped at: v1.12 closed (audit + archive complete; Phase 75 atomic commits pending)
Resume file: `.planning/MILESTONES.md` (v1.12 closing entry) and `.planning/MILESTONE-AUDIT.md` (audit findings)
Next action: define next milestone scope (v1.13 TBD) OR run Phase 75 atomic per-plan commit pass + flip ROADMAP.md status.

---

## Repository

- Branch: `main`
- Main: `main`
- Last user-facing release: v1.11 (2026-04-30; GitHub Release `1.11.0` published)
- Last internal milestone: v1.12 (2026-05-02; closed, no release)
- Active phase: none — v1.12 closed
