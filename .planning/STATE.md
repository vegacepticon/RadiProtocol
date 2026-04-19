---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: UX Polish & Snippet Picker Overhaul
status: in_progress
stopped_at: Phase 48.1 complete — cosmetic toolbar-gap fix shipped; next is Phase 49
last_updated: "2026-04-19T07:50:00.000Z"
last_activity: 2026-04-19
resume_file: .planning/phases/48.1-toolbar-gap-tighten/
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 3
  completed_plans: 3
  percent: 25
---

# RadiProtocol — Project State

**Updated:** 2026-04-19
**Milestone:** v1.8 — UX Polish & Snippet Picker Overhaul
**Status:** In progress — Phase 48 + 48.1 shipped. Next is Phase 49.
**Stopped at:** Phase 48.1 complete (cosmetic toolbar-gap fix); next is /gsd-plan-phase 49

---

## Current Position

Phase: 48.1 (Toolbar Gap Tighten, INSERTED) — ✅ complete (2 commits)
Commits: 25ab41f (feat — margin-top:auto → var(--size-4-3)); f23b841 (fix — .rp-editor-panel height:100% → auto so form panel does not push toolbar off-screen).
Tests: 440 passed / 1 skipped (was 438 after Phase 48).
UAT: PASS 2026-04-19 (idle + form states; narrow sidebar unaffected).
Next: /gsd-plan-phase 49 (Loop Exit Edge Convention — EDGE-01).
Last activity: 2026-04-19 — Phase 48.1 shipped as direct 2-commit CSS fix (user opted out of full plan-phase workflow given trivial scope). Phase 48 UAT follow_up Test 7 marked resolved.

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

### Roadmap Evolution

- Phase 48.1 inserted after Phase 48: Toolbar Gap Tighten — cosmetic UAT follow-up to shrink the empty gap between Node Editor form content and the bottom-anchored quick-create toolbar (originated from Phase 48 UAT Test 7 feedback) (URGENT)

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

### v1.8 Execution Log

- **Phase 47 Plan 01 (2026-04-18):** RUNFIX-01 closed via single-line state-gate relaxation in `ProtocolRunner.syncManualEdit` (extended from `{at-node}` to `{at-node, awaiting-loop-pick}`) plus 4 RUNFIX-01 regression tests in `protocol-runner-loop-picker.test.ts`. Commits: 7603bc5 (test RED), bdb227f (fix GREEN). Decision: preferred gate relaxation over introducing a new sync method — keeps the capture-before-advance touch-point at the single call-site in `runner-view.ts:479`. No view changes, no other method touched. Summary: `.planning/phases/47-runner-regressions/47-01-SUMMARY.md`.
- **Phase 47 Plan 02 (2026-04-18):** RUNFIX-02 closed by introducing `pendingTextareaScrollTop` private field + `capturePendingTextareaScroll` helper on `RunnerView`; helper is called as the FIRST line of each choice-click handler (answer, snippet-branch, loop-body/exit, snippet-picker row) and consumed inside `renderPreviewZone`'s existing `requestAnimationFrame` callback after the height recompute — scrolls are now preserved across the render-triggered textarea rebuild. Commits: 126ee08 (test RED, 5 tests), 325f39d (fix GREEN). Diff strictly additive (+31/-0 in runner-view.ts); all four pre-existing BUG-01 `syncManualEdit(previewTextarea)` calls preserved verbatim. Summary: `.planning/phases/47-runner-regressions/47-02-SUMMARY.md`.
- **Phase 47 Plan 03 (2026-04-18):** RUNFIX-03 closed by appending three successive Phase 47 CSS blocks to `src/styles/runner-view.css` + `src/styles/loop-support.css` — strictly additive, CLAUDE.md append-only-per-phase compliant. Initial commit 3f7f628 (feat — typography: padding, line-height 1.55, min-height 44px on .rp-answer-btn / .rp-snippet-branch-btn / .rp-loop-body-btn / .rp-loop-exit-btn). UAT revision 1 — 84adf10 (fix — narrow-sidebar overflow: box-sizing:border-box, horizontal padding --size-4-3, overflow-wrap:anywhere, width:100% + min-width:0 on loop buttons). UAT revision 2 — d23aaff (fix — final: defeated Obsidian base `button { height: var(--input-height); align-items: center }` default with height:auto + align-items:flex-start + horizontal padding --size-4-4 ~16px). User approved in TEST-BASE vault with narrow sidebar + tab-mode layout after revision 2. Key-decision pattern: three-revision UAT loop on a CSS-only plan where each UAT rejection appends a new block below the previous one naming the DevTools-confirmed root cause. Zero TypeScript changes; full vitest suite stays at 428 passed / 1 skipped. Summary: `.planning/phases/47-runner-regressions/47-03-SUMMARY.md`. Phase-level gates (regression gate, code review, verify_phase_goal) still pending — orchestrator responsibility.

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
