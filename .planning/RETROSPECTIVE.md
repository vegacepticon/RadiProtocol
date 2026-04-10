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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 7 | 28 | First milestone — baseline established |
| v1.2 | 8 | 11 | Retrofit verification pattern; inserted phases for gap closure; milestone audit pre-archival |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Engine Modules |
|-----------|-------|------------------------|
| v1.0 | 28+ passing | parser, runner, snippets, sessions |
| v1.2 | 28+ passing + 8/8 UAT | same; no new engine modules added |

### Top Lessons (Verified Across Milestones)

1. Human UAT checkpoint per UI phase catches bugs that automated tests miss
2. Pure engine modules (zero Obsidian imports) make the test loop fast and reliable — worth the upfront discipline
3. Always write SUMMARY.md per phase — missing artifacts cost a full recovery phase
4. Keep ROADMAP.md current as phases execute — gsd-tools depends on it at milestone close
