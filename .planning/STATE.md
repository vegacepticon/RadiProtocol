---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Runner UX & Bug Fixes
status: executing
last_updated: "2026-04-09T08:37:06.225Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 5
  completed_plans: 7
  percent: 100
---

# RadiProtocol — Project State

**Updated:** 2026-04-09
**Milestone:** v1.2 — Runner UX & Bug Fixes
**Status:** Ready to execute
**Last session:** 2026-04-09T08:28:12.169Z

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-07)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.  
**Current focus:** Phase 15 — text-separator-setting

---

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 1 | Project Scaffold + Canvas Parsing Foundation | Complete |
| 2 | Core Protocol Runner Engine | Complete |
| 3 | Runner UI (ItemView) | Complete |
| 4 | Canvas Node Editor Side Panel | Complete |
| 5 | Dynamic Snippets | Complete |
| 6 | Loop Support | Complete |
| 7 | Mid-Session Save + Resume | Complete |

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Read-only Canvas contract | No official Canvas runtime API; never modify `.canvas` while open |
| TypeScript + esbuild + plain DOM | Standard Obsidian plugin toolchain; zero framework overhead for v1 |
| Vitest for engine tests | Pure engine modules (parser, runner) have no Obsidian imports; fully unit-testable |
| One-file-per-snippet storage | Minimizes vault.modify() race conditions and sync conflicts |
| Discriminated union on `kind` for node types | Type-safe graph model; 7 node types: start, question, answer, text-block, free-text, loop-start, loop-end |
| Snapshot undo stack | Simplest correct approach for step-back; protocol text is small (<5KB) |
| `radiprotocol_*` property namespace | Avoids collisions with other plugins and future Obsidian updates |
| Canvas write-back Strategy A | Require canvas closed before any vault.modify() — simple and safe; avoids undocumented internals (A4 resolved) |
| plugin.saveSettings() not saveData() directly | Consistent with main.ts wrapper; all settings call sites use the wrapper |
| maxLoopIterations moved into Runner section | D-07 groups related runner settings under one heading in Settings tab |
| RunnerView reconstructs ProtocolRunner at openCanvas() start | Simplest way to pick up textSeparator from settings; no lazy init or observer needed |
| resolveSeparator(node) single resolution point | node.radiprotocol_separator ?? defaultSeparator — avoids duplicated logic across 5 call sites |

---

## Open Assumptions (Require User Confirmation Before Phases 5 + 6)

| ID | Assumption | Phase |
|----|-----------|-------|
| A1 | Loop-start node uses two outgoing edges (continue + exit) rather than a dedicated "loop again?" node | 6 |
| A2 | Snippet placeholder syntax uses `{{placeholder_id}}` double-curly-brace format | 5 |
| A3 | Session files stored vault-visible in `.radiprotocol/sessions/` (not hidden in plugin data.json) | 7 |

---

## Critical Pitfalls (Standing Reminders)

1. **Never modify `.canvas` while open in Canvas view** — Canvas view will overwrite on next interaction
2. **`vault.modify()` race conditions** — use write mutex (async-mutex) per file path
3. **No `innerHTML`** — use DOM API and Obsidian helpers; blocks community review if violated
4. **No `require('fs')`** — use `app.vault.*` exclusively
5. **`loadData()` returns null on first install** — always merge with defaults
6. **Infinite loop cycles** — validate protocol graph before running; hard iteration cap (default 50)
7. **`console.log` forbidden in production** — use `console.debug()` during dev; remove before release

---

## Repository

- Branch: `main`
- Remote: (not yet configured)
- Last commit: `2530427` — docs(04-02): finalize SUMMARY — human UAT approved, all 7 tests passed
