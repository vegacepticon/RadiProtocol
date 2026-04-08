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

## Milestone: v1.1 — UX & Community Release

**Shipped:** 2026-04-08
**Phases:** 4 | **Plans:** 9 | **Timeline:** 2 days (2026-04-07 → 2026-04-08)

### What Was Built

- Full-tab runner view: `runnerViewMode` setting, `activateRunnerView()` D-04 deduplication across leaf modes
- Canvas selector dropdown: `CanvasSelectorWidget` drill-down folder navigator in runner header, vault file-event refresh
- Insert into current note: `insertIntoCurrentNote()` with `WriteMutex` guard, `active-leaf-change` button sync
- Live canvas editing: `CanvasLiveEditor` using Canvas internal API (getData/setData), live-first/Strategy-A-fallback, TDD with RED→GREEN wave structure

### What Worked

- **Phase 8 directory was deleted during Phase 9 planning** — artifacts preserved in git history; no work was lost, but the working tree lost the phase directory. Git is the safety net.
- **Wave-based TDD for Phase 11** (Wave 0 = RED stubs, Wave 1 = GREEN implementation, Wave 2 = wiring) worked cleanly — live canvas API integration is risky and the RED stubs made the contract explicit before any code was written
- **Isolating Phase 11 last** (highest-risk feature) was the right call — it didn't block Phase 8, 9, or 10 delivery
- **Separate `insertMutex`** over reusing snippetService mutex: avoids cross-concern lock contention, keeps file-path keying clean
- **headerEl vs contentEl** insight from Phase 9 (selector rendered in onOpen, not contentEl) generalised immediately — worth recording as a standing pattern

### What Was Inefficient

- ROADMAP.md progress table missing phases 8–11 at milestone close — had to be added manually
- Phase 8 planning directory silently deleted during Phase 9 commit — unclear how; worth watching
- gsd-tools `milestone complete` accomplishment extraction failed (SUMMARY files don't use `one_liner:` key in frontmatter) — had to be fixed manually

### Patterns Established

- `activateRunnerView()` D-04 deduplication: `getRoot()` identity check → reveal if same, detach + reopen if mode changed, open fresh if absent
- Runner header widgets go in `onOpen()` headerEl — contentEl is wiped by `render()` on every state transition
- vitest `resolve.alias: { obsidian: 'src/__mocks__/obsidian.ts' }` — required for any test file that imports Obsidian-dependent modules
- Live-first/fallback pattern with explicit returns: `if (savedLive) { ...; return; }` / catch → `return` — prevents dual-write and fallback on error

### Key Lessons

1. **Phase directories can disappear** — always keep git history; don't rely on working tree for phase artifact recovery
2. **vitest `resolve.alias` is a project-wide setup concern** — add it on the first test suite that uses Obsidian mocks; don't defer to individual test files
3. **Canvas internal API (getData/setData) is stable enough for a fallback strategy** — Pattern B worked; Strategy A fallback means Obsidian API changes can't brick the feature
4. **`active-leaf-change` fires reliably for button enable/disable sync** — robust pattern for any UI element that depends on the active editor leaf type

### Cost Observations

- Model mix: quality profile (Sonnet 4.6 primary throughout)
- Sessions: ~4 sessions over 2 days
- Notable: 4 phases in 2 days; Phase 11 (most complex, TDD + internal API) completed in a single session

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 7 | 28 | First milestone — baseline established |
| v1.1 | 4 | 9 | UX polish + live canvas API; 2 days, quality profile throughout |

### Cumulative Quality

| Milestone | Tests | Zero-Dep Engine Modules |
|-----------|-------|------------------------|
| v1.0 | 28+ passing | parser, runner, snippets, sessions |
| v1.1 | 127 passing, 3 pre-existing RED stubs | unchanged (all v1.1 changes are UI/wiring layer) |

### Top Lessons (Verified Across Milestones)

1. Human UAT checkpoint per UI phase catches bugs that automated tests miss
2. Pure engine modules (zero Obsidian imports) make the test loop fast and reliable — worth the upfront discipline
3. Wave-based TDD (RED stubs first) is essential for any integration with undocumented/internal APIs — makes the contract explicit before implementation
