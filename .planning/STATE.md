---
gsd_state_version: 1.0
milestone: v1.14
milestone_name: Internationalization, Documentation & Infrastructure
status: completed
started_at: 2026-05-03
completed_at: 2026-05-03
last_updated: "2026-05-03T10:35:00.000Z"
last_activity: 2026-05-03 — Phase 84 complete: i18n extracted across all layers (views, snippets, graph, runner, runner-view), README.md and docs/CONTRIBUTING.md + docs/PROTOCOL-AUTHORING.md written
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
---

# RadiProtocol — Project State

**Updated:** 2026-05-03
**Milestone:** v1.14 Internationalization, Documentation & Infrastructure — **OPEN**
**Status:** Opened 2026-05-03 — 0/3 phases complete, 0/8 requirements satisfied; awaiting Phase 84 planning

**Status:** Phase 84 completed 2026-05-03 — 1/3 phases complete, 5/5 plans done; awaiting Phase 85 planning

## Current Position

Phase: 85 — Multiple Inline Runners (planning)
Plan: none active
Status: Phase 84 landed — all i18n extracted, docs written; research for inline-multi completed at v1.14 open
Last activity: 2026-05-03 — Phase 84 complete (plans 01-05)

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-03 — v1.14 Current Milestone section).
See: `.planning/REQUIREMENTS.md` (v1.14 — 8 requirements active: I18N-01/02, DOC-01/02, INLINE-MULTI-01/02, TEMPLATE-LIB-01/02).
See: `.planning/ROADMAP.md` (v1.14 added to active milestones; v1.13 archived).
See: `.planning/MILESTONES.md` (v1.14 opening entry; v1.13 closing entry preserved).
See: `.planning/MILESTONE-AUDIT.md` (v1.13 audit preserved; v1.14 audit pending at milestone close).

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

**Current focus:** Phase 84 planning — i18n infrastructure, README, CONTRIBUTING.

---

## v1.14 Phase Map (planning)

| Phase | Goal (one-line) | Requirements | Status |
|-------|-----------------|--------------|--------|
| 84 | i18n infrastructure (locale files, typed t(), settings dropdown) + README + CONTRIBUTING docs | I18N-01, I18N-02, DOC-01, DOC-02 | Planning |
| 85 | Multiple inline runners — registry, per-instance cleanup, cascade positioning | INLINE-MULTI-01, INLINE-MULTI-02 | Planning |
| 86 | Template library MVP — LibraryService, GitHub raw fetch, SnippetManagerView integration | TEMPLATE-LIB-01, TEMPLATE-LIB-02 | Planning |

**Execution order:** Phase 84 first (i18n strings must exist before Phase 85/86 UI work references them). Phases 85 and 86 may run in parallel after 84 lands.

---

## Accumulated Context

### Research Completed (2026-05-03)

**Text-block after start node bug:** Investigated via dedicated tests (`start-text-block.test.ts`, `start-text-block-fixture.test.ts`). Runner core correctly handles `start → text-block → question`. No root cause found in runner; likely user expectation mismatch (text-block is pass-through by design) or empty content in canvas node. Tests added to prevent future regressions.

**Multiple inline runners:** Architectural analysis complete. Complexity: MEDIUM (Stage 1: SMALL). Key findings:
- `ProtocolRunner` is pure — multiple instances are trivially safe.
- Missing pieces: plugin-level registry, per-instance `isFillModalOpen` flag, cascade positioning, `onunload()` cleanup.
- Session recovery is OUT for v1.14 — requires `canvasPath + '#' + notePath` key schema change.
- Recommended: Stage 1 (registry + cleanup + cascade) in Phase 85; Stage 2 (session recovery + per-note position) deferred.

**Template library:** Architectural analysis complete. Complexity: MVP — SMALL (~1–2 days). Key findings:
- `SnippetService` already supports CRUD in subfolders — Library can reuse it.
- GitHub raw + `requestUrl()` is the recommended backend; no API key needed.
- `LibraryService` ~150 LOC + UI ~100 LOC.
- Risks: GitHub rate limits (60/hr anonymous), network absence, name collisions.

### Carry-over Tech Debt (from v1.13 close)

- Phases 64/66/67 lack formal `VERIFICATION.md`; Nyquist `VALIDATION.md` missing for Phases 63–83.
- 3 open debug sessions (`inline-runner-drag-resets-size`, `inline-runner-tab-switch-resets-size`, `phase-27-regressions`).
- Deprecated `LoopStartNode` / `LoopEndNode` retained for Migration Check enumeration.
- `protocol-runner.ts` (819 LOC) — engine decomposition still deferred (MEDIUM-5 from CONCERNS.md).
- 2 lint warnings (`obsidianmd/prefer-file-manager-trash-file` × 2 in `snippet-service.ts`) — unchanged from v1.12.

### Key Constraints for v1.14

- **Claude Max subscription expires 2026-05-04** — use Claude Code for architecture/complex tasks only; delegate bounded implementation to OpenCode or Hermes tools.
- **No user questions during sleep hours** — all cronjob tasks must be self-contained and not require clarification.
- **Plugin must not break** — every change requires test verification (`npm test`, `npm run lint`, `npm run build`).
