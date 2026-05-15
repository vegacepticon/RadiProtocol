---
gsd_state_version: 1.0
milestone: v1.17
milestone_name: UX Hardening & Inline Runner
status: hygiene
started_at: 2026-05-14
completed_at:
last_updated: "2026-05-15T19:55:00.000Z"
last_activity: 2026-05-15 — v1.17.1 patch release (progress bar fix, start-checkbox placement, duplicate i18n, self-check UX)
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 0
  completed_plans: 0
---

# RadiProtocol — Project State

**Updated:** 2026-05-14
**Milestone:** none active — post-v1.16 repository hygiene
**Status:** v1.16.1 patch prepared after v1.16.0 stable shipped 2026-05-12 via beta chain (v1.16.0-beta.1..v1.16.0). Planning drift audit completed 2026-05-14; stale source references to `.planning/` were promoted to tracked docs.

## Current Position

Phase: planning
Plan: none active
Status: After v1.16.0 release, planning cleanup + push of 2 refactor commits (loop-start/loop-end removal from ProtocolDocumentParser, .canvas comment cleanup). v1.14 milestone formally closed.

## Project Reference

See: `.planning/PROJECT.md`
See: `.planning/ROADMAP.md` (updated 2026-05-13 — v1.14 closed, v1.15/v1.16 added, progress table updated)
See: `.planning/MILESTONES.md` (v1.14/v1.15/v1.16 entries pending update)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

**Current focus:** Repository hygiene after v1.16.0 release.

## v1.14 Phase Map — CLOSED

| Phase | Goal (one-line) | Requirements | Status |
|-------|-----------------|--------------|--------|
| 84 | i18n infrastructure + README + CONTRIBUTING | I18N-01, I18N-02, DOC-01, DOC-02 | ✅ Complete |
| 85 | Multiple inline runners (registry, cleanup, cascade) | INLINE-MULTI-01, INLINE-MULTI-02 | ✅ Complete |
| 86 | Template library MVP | TEMPLATE-LIB-01, TEMPLATE-LIB-02 | ✅ Complete |

## v1.15 / v1.16 Backlog

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| — | Visual protocol editor (.rp.json native) | EDITOR-01.. | Backlog |
| — | Dead session persistence cleanup | SESSION-CLEANUP-01 | Backlog |
| — | Tech debt / codebase health | — | Backlog |

Full details: `.planning/ROADMAP.md`

## Accumulated Context

### v1.16 Release Summary (2026-05-12..13)

- `.canvas` → `.rp.json` migration complete: `ProtocolDocumentV1`, `ProtocolDocumentParser`, `ProtocolDocumentStore`, `.rp.json` runner integration
- Visual protocol editor (SVG-based) implemented: node creation, edge drawing, zoom/pan, minimap, loop-exit UX
- Snippet tree picker, snippet fill modal, focus restoration
- Loop support (single-loop, multiple loop exits, infinite canvas)
- v1.16.0 stable released via GitHub Actions CI; v1.16.0-beta.1..beta.9 chain tested via BRAT
- `.canvas` format kept as legacy; CanvasParser still parses `.canvas` for backward compatibility

### Planning Cleanup Notes

- `.planning/` was not updated between v1.14 (2026-05-03) and v1.16.0 (2026-05-12)
- No formal phases/plans for v1.15/v1.16; work done in previous sessions without GSD tracking
- v1.14 milestone formally closed without a GitHub Release (content shipped as part of v1.16)
- Active `.planning/phases/` reduced to current phase artifacts; v1.12 phase copies preserved under `.planning/archive/milestones/v1.12-phases/`
- Source-level references to gitignored `.planning/notes/` replaced with tracked `docs/ARCHITECTURE-NOTES.md` links
- CI/package script freshness gate added via `npm run check:planning`
