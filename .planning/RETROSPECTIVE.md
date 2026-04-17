# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — Community Plugin Release

**Shipped:** 2026-04-07  
**Phases:** 7 | **Plans:** 28 | **Timeline:** 3 days (2026-04-05 → 2026-04-07)

### What Was Built

- Complete Obsidian plugin scaffold: TypeScript + esbuild + Vitest + ESLint (23 obsidianmd rules), zero warnings
- Pure traversal state machine (ProtocolRunner) with discriminated union, snapshot undo, and full loop context stack
- End-to-end RunnerView ItemView: live preview, all 7 node types rendered, copy/save output, start-from-node picker
- Canvas Node Editor side panel: per-node forms for all 7 kinds, write-back with canvas-closed guard, context menu integration
- Snippet system: full CRUD, 4 placeholder types, fill-in modal with live preview, WriteMutex per-file locking
- Loop support: loop-start/loop-end parsing + validation, multi-iteration tracking, undo across loop boundaries, UI with iteration label
- Mid-session persistence: auto-save after every step, resume detection with mtime check, snippet content snapshot, onLayoutReady deferral

### What Worked

- **Wave-based plan structure** (Wave 0 = RED stubs, Wave N = GREEN implementation) made every plan verifiable before the next began — zero blind spots
- **Pure engine modules** with no Obsidian imports paid off immediately: fast Vitest loops, no mocking overhead
- **Human UAT checkpoint per phase** caught real bugs (startup hang, missing auto-save triggers, readonly textarea) before they compounded
- **Snapshot undo** was the right call — simpler than diffs and handles all edge cases including loop boundaries
- **Strategy A** (require canvas closed for write-back) resolved the highest-risk Phase 4 decision cleanly without undocumented API fragility
- **WriteMutex** caught a real race condition in Phase 7 code review — the pattern was worth establishing in Phase 5

### What Was Inefficient

- ROADMAP.md progress table was not updated by executor for phases 1, 3, 5, 7 — required manual fix at milestone completion
- REQUIREMENTS.md traceability table remained mostly "Pending" throughout — was never updated incrementally; required full update at milestone close
- Phase 6 had no `06-03-PLAN.md` (plan file was missing, but SUMMARY was created) — minor planning artifact gap

### Patterns Established

- `radiprotocol_*` property namespace on canvas nodes — never collides with Obsidian native fields
- `WriteMutex` per file path using `async-mutex` — required for any feature with concurrent `vault.modify()` calls
- `onLayoutReady` deferral for any plugin UI that reads workspace state at startup
- `Set` → `Array` serialization before `JSON.stringify()` — any serialized state must convert all `Set` fields
- Snapshot undo stack pattern: push full `{currentNodeId, accumulatedText, loopContextStack}` snapshot per UndoEntry

### Key Lessons

1. **Plan the undo model before touching the loop engine** — loop context stack must be snapshotted in UndoEntry or step-back produces silent cross-boundary failures
2. **Session restore must be deferred to `onLayoutReady`** — plugin `onload()` fires before the workspace is ready; calling `getLeaf()` there hangs startup
3. **`vault.adapter.remove()` not `vault.delete()`** for session file deletion — path normalisation differences caused test failures when using the wrong API
4. **Human UAT per phase is non-negotiable** for UI phases — automated tests don't catch DOM ordering bugs or missing event wire-ups

### Cost Observations

- Model mix: quality profile (Sonnet 4.6 primary throughout)
- Sessions: ~8 sessions over 3 days
- Notable: Parallel wave execution in Phases 5–7 (multiple plans per wave) significantly reduced total session count

---

## Milestone: v1.2 — Runner UX & Bug Fixes

**Shipped:** 2026-04-10  
**Phases:** 8 (12–19) | **Plans:** 11 | **Timeline:** 3 days (2026-04-07 → 2026-04-10)

### What Was Built

- Runner layout overhaul: auto-grow textarea, correct zone ordering, equal-size buttons, legend removed (LAYOUT-01–04)
- Canvas selector widget in sidebar + Run Again button after completion (SIDEBAR-01, RUNNER-01)
- Click-to-load node auto-switch in EditorPanel + unsaved edit guard modal (EDITOR-01, EDITOR-02)
- Global + per-node text separator settings wired through resolveSeparator() (SEP-01, SEP-02)
- Manual textarea edits preserved via capture-before-advance syncManualEdit() pattern (BUG-01)
- Live getCanvasJSON() read path fixes for free-text-input and text-block node type read-back (BUG-02, BUG-03)
- Add button fix in snippet placeholder mini-form via explicit type="button" (BUG-04)
- Phase 18: 3 CSS gaps closed (rp-insert-btn flex:1, full rp-selector-* block, rp-run-again-btn rule)
- Phase 19: retroactive VERIFICATION.md for Phases 12–14; comprehensive 8/8 UAT in live Obsidian

### What Worked

- **Retroactive verification pattern (Phase 19):** When planning artifacts were missing, reconstructing VERIFICATION.md from current source code + git log produced credible, auditable evidence — a reusable recovery pattern
- **CSS-only insertion phase (Phase 18):** Treating CSS gap closure as a standalone inserted phase kept scope clear and produced a clean audit trail
- **Milestone audit before completion:** Running `/gsd-audit-milestone` surfaced the 3 CSS gaps and missing verification artifacts before archiving — saved retroactive rework
- **capture-before-advance pattern:** syncManualEdit() before every advance action elegantly solved BUG-01 without complex state management

### What Was Inefficient

- Phases 12–13 had no planning artifacts preserved (COMPLETED.md only) — required Phase 19 to reconstruct VERIFICATION.md from source code; future phases should always write SUMMARY.md
- Nyquist VALIDATION.md was not enforced for any v1.2 phase — left as tech debt; next milestone should enforce this from Phase 1
- gsd-tools `milestone complete` CLI couldn't auto-populate v1.2 data because phases were never added to ROADMAP.md during development — ROADMAP.md must be kept current as phases execute
- EditorPanel form load gap (vault.read() vs getCanvasJSON()) was identified but deferred twice — carries forward as known debt

### Patterns Established

- `resolveSeparator(node)` single resolution point — always resolve settings at one call site, not scattered across consumers
- `capture-before-advance` — syncManualEdit() before any state transition that uses accumulated text
- Retroactive VERIFICATION.md reconstruction from source + git log — acceptable when planning artifacts not preserved, use Phase 17 format
- Cross-phase CSS attribution — document when CSS for a feature lands in a different phase than the TypeScript wiring

### Key Lessons

1. **Write SUMMARY.md for every phase, even simple ones** — Phase 12 and 13 missing artifacts cost one full phase (Phase 19) to recover
2. **Keep ROADMAP.md updated as phases complete** — gsd-tools and audit tools depend on it; falling behind forces manual repair at milestone close
3. **Nyquist VALIDATION.md should be enforced from the first phase** — retrofitting across 8 phases is expensive; make it a gate
4. **Inserted phases (18, 19) worked cleanly** — decimal phase numbering for gap-closure and verification is a valid and lightweight pattern

### Cost Observations

- Model mix: quality profile (Sonnet 4.6 primary throughout)
- Sessions: ~4 sessions over 3 days
- Notable: Phase 19 was the most efficient phase — 3 plans in ~33 minutes; documentation-only phases are fast when evidence is in the code

---

## Milestone: v1.3 — Interactive Placeholder Editor

**Shipped:** 2026-04-12  
**Phases:** 1 (Phase 27) | **Plans:** 1 | **Timeline:** single day (~3.5 hours)

### What Was Built

- Chip-based placeholder list in SnippetManagerView replacing expandable row list — type-colour bars (PH_COLOR), human-readable labels, type badges, drag handles, remove buttons (CHIP-01)
- HTML5 native drag-and-drop reorder with 6-event handler per chip, correct splice pattern, dragleave child-flicker guard, dragend cleanup (CHIP-02)
- `autoSaveAfterDrop()` persists reordered array via `snippetService.save()` — SnippetFillInModal tab order follows persisted order at zero modal changes (CHIP-03)
- UUID guard preventing auto-save on unsaved drafts; 25 automated Vitest tests covering DnD guards, splice algorithm, and UUID check
- 5 code review issues (WR-01–05) found and fixed: stale DnD closure, dragleave child flicker, UUID guard, dragend cast, bare addEventListener for ephemeral elements

### What Worked

- **Bare `addEventListener` for ephemeral chip elements:** Code review (WR-05) correctly identified that `registerDomEvent` is only for persistent elements; chips are recreated on every re-render so `addEventListener` is the right choice — a subtle Obsidian-specific pattern now documented
- **UUID guard before auto-save:** Caught by code review as WR-03; prevents a real data integrity bug where an unsaved draft with a generated UUID would be permanently written before the user confirms
- **Chip renderer pattern:** `renderPlaceholderChip()` is self-contained — all DnD state local to the closure, no shared mutable drag state on the class — clean and easy to test
- **25 automated tests in a single phase:** Nyquist Wave 0 test-first structure for DnD logic caught the stale closure bug before it reached UAT

### What Was Inefficient

- **v1.3 executed outside the formal milestone workflow** — Phase 27 was started directly after v1.2 archive without running `/gsd-new-milestone`. ROADMAP.md, STATE.md, and REQUIREMENTS.md were never formally updated for v1.3. Required manual repair at milestone close.
- **styles.css not committed at phase completion** — The root `styles.css` (built output) had uncommitted Phase 27 CSS changes that were only discovered at milestone audit. Phase executor should commit all modified files before writing SUMMARY.md.
- **Branch name mismatch** — All Phase 27 work landed on `gsd/phase-26-auto-switch-to-node-editor-tab`. The branch was never renamed or a new branch created for Phase 27.

### Patterns Established

- `PH_COLOR` record — centralised type-to-CSS-var colour mapping; extend when adding new placeholder types
- Chip renderer pattern: `renderPlaceholderChip()` — self-contained chip with inline DnD listeners for ephemeral DOM elements
- `splice(from, 1)` then `splice(to, 0, moved)` — stable array reorder pattern for DnD
- Bare `addEventListener` for ephemeral elements; `registerDomEvent` only for persistent/long-lived elements

### Key Lessons

1. **Run `/gsd-new-milestone` before starting work after a milestone archive** — skipping it creates structural debt that must be repaired manually at the next close
2. **Commit all files before writing SUMMARY.md** — if `git status` is not clean at phase completion, the executor should commit or explain why before marking done
3. **Code review before UAT pays off at this scale** — WR-01–05 were all real bugs caught by review; UAT would have caught some but not the stale closure subtlety (WR-01/WR-04)

### Cost Observations

- Model mix: quality profile (Sonnet 4.6 primary)
- Sessions: 1 session (single day)
- Notable: Smallest milestone yet (1 phase, 18 min execution); overhead of code review + UAT + Nyquist audit was larger than implementation time — appropriate for a UI feature with complex DnD interaction

---

## Milestone: v1.4 — Snippets and Colors, Colors and Snippets

**Shipped:** 2026-04-15
**Phases:** 4 (28–31) | **Plans:** 12 | **Timeline:** 3 days (2026-04-13 → 2026-04-15)
**Git:** 54 commits, 66 files, +8753/-110 LOC

### What Was Built

- Phase 28: Auto node coloring — single `enrichedEdits` injection point in `saveNodeEdits` writes canvas color on every save across both Pattern B (canvas open) and Strategy A (canvas closed); two-priority type resolution (edits first, then existing node); `makeCanvasNode` test helper auto-derives color (NODE-COLOR-01/02/03)
- Phase 29: Snippet node as 8th kind — discriminated union extension, canvas-parser case, graph-validator missing-path check, EditorPanel subfolder picker via void async IIFE and BFS vault traversal (with WR-01 visited set), `v || undefined` normalization so empty string becomes root-fallback (SNIPPET-NODE-01/02/08)
- Phase 30: Runner snippet integration — `awaiting-snippet-pick` runner state, `ProtocolRunner.pickSnippet()` routes into existing fill-in flow, full session serialize/restore, `SnippetService.listFolder` with pre-I/O path-safety gate (rejects `..`, absolute paths, sibling-prefix matches), RunnerView picker with local (non-persisted) drill-down path state (SNIPPET-NODE-03/04/05/06/07)
- Phase 31: Mixed answer + snippet branching — question nodes route to both answer and snippet nodes simultaneously; `chooseSnippetBranch` runner API with undo-before-mutate + `returnToBranchList` flag; per-node `snippetLabel` + separator override editable in Node Editor; RunnerView partitions branches via typed array + two render loops

### What Worked

- **TDD Wave 0 (RED) → Wave 1 (GREEN) structure** held up across all four phases — every plan landed with failing tests first, implementations went green in the next wave, no blind spots
- **Code review before UAT** caught 6 real defects across v1.4 (28 WR-02/WR-03, 29 WR-01/WR-02, 30 WR-01/WR-03) including a BFS cycle risk and an auto-save race — all small but real
- **Retroactive Phase 30 VERIFICATION.md** unblocked the milestone audit re-run; the gsd-verifier pattern continues to work as a recovery tool
- **Discriminated union exhaustiveness** meant adding the 8th node kind forced compile-time fixes everywhere (runner, color-map, validator, parser) — no runtime surprises
- **Single injection point for color** (Phase 28 `enrichedEdits`) is a clean design — one place to change, impossible to forget a path
- **Pre-I/O path-safety gate** in SnippetService rejects traversal attempts before any disk access — defense in depth even though vault adapter would likely block them

### What Was Inefficient

- **Nyquist VALIDATION.md still draft for all four v1.4 phases** — same tech debt pattern as v1.2; enforcement was not gated at phase completion. Continues to accumulate.
- **Phase 30-03 marked `partial-awaiting-uat` at initial close** — required a second audit pass after retroactive VERIFICATION.md + UAT closure; incremental verification at plan close would have avoided the re-audit
- **ROADMAP.md Progress table went stale mid-milestone** (Phase 30 shown as 2/3, Phase 31 as Planned despite all commits landing) — same gap as v1.2. Executor still not updating ROADMAP.md as phases finish.
- **Live-vault UAT items for Phase 29** (subfolder dropdown population + canvas write-back) were not testable in automated suite and had to be closed manually during re-audit

### Patterns Established

- **`enrichedEdits` spread pattern** for single-point data injection before fork in a multi-path save function — applicable anywhere Pattern B / Strategy A (or similar dual-path) exists
- **Void async IIFE inside synchronous builder** — `void (async () => { ... })()` pattern populates async data into a synchronous form builder without refactoring the sync signature
- **Pre-I/O path-safety gate** — validate user-supplied paths (reject `..`, absolute, sibling-prefix) *before* any disk access, even when the underlying adapter likely blocks them
- **`returnToBranchList` flag on UndoEntry** — step-back from a sub-picker returns to the branch selection screen rather than to the previous node; preserves user mental model for mixed branches
- **`v || undefined` empty-string normalization** — consistent across v1.4 for optional fields (subfolderPath, snippetLabel, separator override); keeps JSON clean and lets save logic delete keys
- **Typed array partition + two render loops** for mixed-kind UI lists (Phase 31 branch rendering) — simpler than single loop with branching inside

### Key Lessons

1. **Exhaustiveness checks are free safety nets** — adding an 8th node kind forced the compiler to point at every switch statement; no runtime hunts required
2. **Verify phase completion before closing the plan** — partial-awaiting-uat states at close cost re-audit work; plans should close only when verification is complete or explicitly deferred with an acknowledged audit item
3. **Cycle guards are cheap insurance** — `listSnippetSubfolders` BFS without a visited set (WR-01) would never hit a cycle on normal filesystems, but NTFS junctions / symlinks / edge cases make it a must-have. Default to cycle-safe traversal.
4. **The `/gsd-new-milestone` skip from v1.3 did NOT repeat** — v1.4 was planned formally. The v1.3 retrospective lesson carried forward successfully.

### Cost Observations

- Model mix: quality profile (Sonnet 4.6 primary)
- Sessions: ~5 sessions across 3 days
- Notable: Phase 31 was added mid-milestone as a natural extension when the mixed-branching scenario surfaced during Phase 30 UAT — flexible scope management worked

---

## Milestone: v1.5 — Snippet Editor Refactoring

**Shipped:** 2026-04-16
**Phases:** 4 (32–35) | **Plans:** 18 | **Timeline:** 2 days (2026-04-15 → 2026-04-16)
**Git:** 73 commits, 90 files, +19518/-1034 LOC

### What Was Built

- Phase 32: SnippetService refactored with `Snippet = JsonSnippet | MdSnippet` discriminated union, extension-based routing in `listFolder`/`load`, `vault.trash()` delete, and `rewriteCanvasRefs` vault-wide canvas reference sync utility with WriteMutex and prefix-match semantics
- Phase 33: SnippetManagerView rewritten as recursive folder tree (542 lines) — unified SnippetEditorModal (create/edit, JSON↔MD toggle, folder dropdown, D-09 move-on-save pipeline, unsaved-changes guard), folder CRUD with contents listing, 120ms debounced vault watcher with prefix filter; 20 requirements satisfied
- Phase 34: Drag-and-drop + context menu "Move to…" + modal folder field for snippet/folder reorganization; F2/context-menu inline rename; canvas ref auto-rewrite on every move/rename — 8 requirements, UAT approved by Роман after 2 post-UAT fixes (77b62c1, fd0d50d)
- Phase 35: MD snippets in runner picker with glyph prefix differentiation, verbatim click-to-insert without fill-in modal, subfolder drill-down and mixed branching support — surgical 2-method edit to runner-view.ts

### What Worked

- **`rewriteCanvasRefs` as standalone utility** — designed in Phase 32, consumed by Phase 33 (modal move-on-save) and Phase 34 (DnD, rename, move) without modification. Cross-phase reuse validated the decoupled architecture.
- **Post-UAT fixes as part of verification** — Phase 34 UAT caught 2 real bugs (DOM parent lookup, modal rename path). Fixing them within the same phase cycle and re-verifying produced a clean audit trail without a separate bug-fix phase.
- **Discriminated union pattern continued to pay off** — `Snippet = JsonSnippet | MdSnippet` with `kind` discriminant enabled type-safe branching in runner-view.ts (Phase 35) with zero runtime surprises. Same pattern as Phase 29's 8th node kind.
- **Phase 35 minimal scope** — 2 plans, ~50 lines of production code change, 7 test cases. Proves that when the service layer (Phase 32) is well-designed, UI integration is trivial.
- **Integration checker found no orphaned exports** — 20/20 cross-phase connections wired correctly on first pass. Clean API contracts between phases.

### What Was Inefficient

- **REQUIREMENTS.md traceability checkboxes for Phase 34 never updated** — 8 MOVE/RENAME requirements stayed `[ ] Pending` despite Phase 34 VERIFICATION confirming all as MET. Found during milestone audit, fixed manually. Same pattern as v1.0 and v1.2.
- **Phase 32 VERIFICATION.md recorded `gaps_found` that was later resolved** — strict TS errors in test files caused build failure at Phase 32 close but were fixed by subsequent phases. The VERIFICATION.md was never updated, creating a stale document.
- **SUMMARY.md frontmatter `requirements_completed` field absent in most phases** — only Phase 35 populated it. The 3-source cross-reference in the audit was weakened by missing SUMMARY frontmatter.
- **Nyquist VALIDATION.md still in draft for all 4 phases** — the recurring tech debt pattern continues from v1.2 and v1.4. No phase gated on Nyquist completion.

### Patterns Established

- **`parentElement` over `.parent` for DOM queries** — mock `.parent` works in tests but fails in real Obsidian; always prefer `parentElement` with `.parent` as mock fallback (Phase 34 lesson, documented in Standing Pitfalls)
- **File-level moves are canvas-invisible** — SnippetNode stores `subfolderPath` (folder), not filename. File move/rename correctly skips `rewriteCanvasRefs`; only folder operations trigger it.
- **MD snippets bypass fill-in modal via direct `completeSnippet()`** — when content is static, skip the placeholder pipeline entirely rather than adding a "no placeholders" branch
- **Unified modal pattern** — single SnippetEditorModal with `mode: 'create' | 'edit'` replaces separate modals; 3 entry points converge on one component

### Key Lessons

1. **Update REQUIREMENTS.md traceability checkboxes as phases complete** — this is the 4th milestone where stale checkboxes were caught at audit. Must become a phase-completion gate.
2. **Update VERIFICATION.md if its gaps are resolved** — stale `gaps_found` status misleads audit tools; either re-verify or add a "resolved" note.
3. **Populate `requirements_completed` in SUMMARY.md frontmatter** — the 3-source cross-reference audit depends on it; missing data weakens confidence.
4. **Nyquist validation debt is compounding** — now spanning v1.2, v1.4, and v1.5 phases. Either gate phases on it or explicitly remove it from the workflow.
5. **Small, well-scoped phases (Phase 35) are the fastest to ship** — service-layer groundwork in earlier phases (Phase 32) makes downstream UI integration trivial.

### Cost Observations

- Model mix: quality profile (Opus 4.6 primary)
- Sessions: ~3 sessions over 2 days
- Notable: Phase 35 was the fastest — 2 plans, surgical edit, 7 tests, UAT passed on first try. Phase 34 was the most complex (6 plans, 2 post-UAT fixes). Phase 33 was the largest (5 plans, 20 requirements, 44-step UAT checklist).

---

## Milestone: v1.6 — Polish & Canvas Workflow

**Shipped:** 2026-04-17
**Phases:** 7 | **Plans:** 14 | **Timeline:** 2 days (2026-04-16 → 2026-04-17)

### What Was Built

- Dead code audit: Knip-driven removal of 8 unused TS exports, 2 dead files, 3 legend CSS rules, 3 RED test stubs; async-mutex dependency restored (Phase 36)
- Snippet editor polish: "Тип JSON" CSS flex-gap fix + "Создать папку" header button + live canvas-ref sync on folder rename (Phases 36, 37)
- `CanvasNodeFactory` — first programmatic Canvas node creation service using Pattern B `createTextNode` internal API with runtime probing, auto-color, adjacent positioning (Phase 38)
- Quick-create toolbar in Node Editor sidebar: Question, Answer, Snippet buttons (Phases 39, 42)
- Node duplication preserving all `radiprotocol_*` properties + `text` field, no edge copy (Phase 40)
- Hybrid live+disk `rewriteCanvasRefs` via `canvasLiveEditor.saveLive()` Pattern B with vault.modify() fallback (Phase 41)
- Double-click-created node selection fix: in-memory `canvas.nodes.get()` fallback in `renderNodeForm`, `setTimeout(0)` deferred selection read, `dblclick` listener wiring (Phase 42)
- Responsive toolbar at narrow sidebar widths via `flex-wrap: wrap` (Phase 42)

### What Worked

- **Pattern B runtime probing** in `CanvasNodeFactory` — graceful degradation with Notice when internal API unavailable; no hard coupling to undocumented Obsidian internals
- **Reusing the factory across quick-create and duplicate** paid off — Phase 40 `onDuplicate` is 60 lines because factory owns ID generation, offset math, and color assignment
- **In-memory `getData()` workaround** instead of arbitrary setTimeout for post-create editor load — Phase 39 moved away from the 150ms timer after discovering `result.canvasNode.getData()` bypasses the async-flush race cleanly
- **UAT gap-closure plans (42-03, 42-04)** replanned within the same phase instead of creating new phases — tight feedback loop, no milestone drift
- **`queueMicrotask` + `pendingEdits` merge** (Phase 42 WR-01/WR-02 post-review fix) — defers re-render off the event stack and preserves user input across type-change re-renders

### What Was Inefficient

- **6 plans missed `requirements_completed` frontmatter** in SUMMARY.md (37-01, 37-02, 38-01, 38-02, 39-01, 41-01) — milestone audit had to cross-reference VERIFICATION.md evidence manually; should be a TaskCreate/executor post-condition check
- **All 7 VALIDATION.md files stayed `draft` / `nyquist_compliant: false`** — Nyquist formalism was never completed despite 394/394 tests passing; deferred as documented tech debt
- **Branch accumulated 319 commits ahead of main without interim merges** — not a regression risk (clean fast-forward) but left `main` very stale; should merge after each milestone close, not batch
- **Housekeeping commit captured 160 deleted + 24 new artifacts** left over from prior milestone close reorganizations — should have been cleaned up at the close of each milestone in which they were produced

### Patterns Established

- **Runtime internal-API probing** as a first-class design pattern for any Obsidian internal call path: `typeof canvas.X !== 'function'` + Notice fallback
- **Factory-first node creation** — all new-node code paths (quick-create, duplicate, future templates) route through one `CanvasNodeFactory.createNode()` to share ID / offset / color logic
- **Hybrid live+disk paths with `isLiveAvailable` guard + per-iteration fallback flag** — generalized from Phase 41 `rewriteCanvasRefs`, applicable to any future bulk-canvas-rewrite feature
- **Append-only CSS banner convention** (`/* Phase N: ... */`) caught by both verifier and reviewer — prevented multiple near-regressions in `editor-panel.css` and `snippet-manager.css`
- **Plan-local `PHASE42-*` requirement IDs for gap-closure plans** — UAT-discovered gap plans use phase-local IDs, not pre-registered REQUIREMENTS.md entries; documented as acceptable in milestone audit

### Key Lessons

1. **Runtime probing beats hard coupling** — `CanvasNodeFactory` doesn't crash on Obsidian version change; it shows a Notice. This pattern should extend to every other undocumented internal (`saveLive`, `canvas.nodes`, `createTextNode`).
2. **UAT gap-closure as same-phase plans, not new phases** — Phase 42 Plans 03 and 04 stayed under Phase 42's requirement umbrella; cleaner than spawning Phase 43 for "fix the Phase 42 gaps."
3. **Post-review fixes can pile up** — WR-01/WR-02 in both Phase 41 (saveLive mutex) and Phase 42 (queueMicrotask) landed *after* initial verification. Code review should run before verification status = passed, not after.
4. **`queueMicrotask` is the answer for re-entrant renderers** — synchronous re-render of the view you're currently inside triggers stale closures; deferring with microtask breaks the cycle without introducing visual lag.
5. **Merge early, merge often** — 319-commit ahead-of-main is a code smell even when it's a clean fast-forward. Do the `main` merge at every milestone close, not "eventually."

### Cost Observations

- Model mix: quality profile (Opus 4.6/4.7 primary for planning and verification; Sonnet for executors)
- Sessions: ~4 sessions over 2 days
- Notable: Phase 42 was the largest v1.6 phase (4 plans — 2 original + 2 UAT gap-closure). Phases 40 (duplicate) and 41 (live canvas update) were surgical — 1 plan each, clean verification. Phase 36 dead-code audit completed in 2 plans on day 1 and set up Phase 37-42 with a clean baseline.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 7 | 28 | First milestone — baseline established |
| v1.2 | 8 | 11 | Retrofit verification pattern; inserted phases for gap closure; milestone audit pre-archival |
| v1.3 | 1 | 1 | Smallest milestone — single feature; skipped `/gsd-new-milestone`; structural debt repaired at close |
| v1.4 | 4 | 12 | Formal `/gsd-new-milestone` used; mid-milestone scope extension (Phase 31 added); re-audit recovery pattern proven |
| v1.5 | 4 | 18 | Largest plan count; rewriteCanvasRefs cross-phase reuse validated; post-UAT fix pattern established; 34 requirements — most requirement-dense milestone |
| v1.6 | 7 | 14 | Most phases in a single milestone; first Pattern B internal-API probing (CanvasNodeFactory); UAT gap-closure as same-phase plans (42-03, 42-04); live+disk hybrid pattern for canvas rewrites (Phase 41) |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Engine Modules |
|-----------|-------|------------------------|
| v1.0 | 28+ passing | parser, runner, snippets, sessions |
| v1.2 | 28+ passing + 8/8 UAT | same; no new engine modules added |
| v1.3 | 53+ passing + 5/5 UAT | same; +25 DnD/splice/UUID tests |
| v1.4 | 53+ passing + 12/12 UAT (7+5) | same; +snippet node fixtures + canvas-parser/validator/runner coverage for 8th kind |
| v1.5 | 356 passing + 44+31+11 UAT | +snippet-service, canvas-ref-sync, snippet-tree, snippet-editor-modal, snippet-dnd, inline-rename, runner-extensions (MD) |

### Top Lessons (Verified Across Milestones)

1. Human UAT checkpoint per UI phase catches bugs that automated tests miss
2. Pure engine modules (zero Obsidian imports) make the test loop fast and reliable — worth the upfront discipline
3. Always write SUMMARY.md per phase — missing artifacts cost a full recovery phase
4. Keep ROADMAP.md current as phases execute — gsd-tools depends on it at milestone close (repeat offense in v1.4)
5. Nyquist VALIDATION.md must be gated at phase completion — retroactive backlog has grown across v1.2, v1.4, and v1.5; pay the cost now or pay it compounded later
6. Code review before UAT catches subtle defects that slip past both automated tests and human testers (stale closures, cycle guards, race conditions) — v1.3 and v1.4 both prove this
7. Update REQUIREMENTS.md traceability checkboxes as phases complete — stale checkboxes found at audit in v1.0, v1.2, and v1.5; must become a phase-completion gate
8. Cross-phase utility design (rewriteCanvasRefs) pays compound dividends — designed once in Phase 32, consumed unmodified by Phases 33 and 34
