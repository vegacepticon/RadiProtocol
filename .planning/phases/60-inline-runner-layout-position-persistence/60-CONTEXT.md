# Phase 60: Inline Runner Layout & Position Persistence — Context

**Gathered:** 2026-04-24  
**Status:** Ready for planning  
**Source:** ROADMAP.md Phase 60 + v1.9 milestone decisions + Phase 54/59 inline-runner artifacts

## Decisions

### D-01 — Persist last drag position (LOCKED)

Inline Runner must save the user's last dragged coordinates and restore them when the inline command is invoked again. Persistence must survive tab switches and plugin reloads. Do not reset to default on every open.

Implementation note: `InlineRunnerModal` is a floating DOM host, not an `ItemView`, so the executor may use plugin persisted data (`loadData`/`saveData`) as the durable workspace-scoped backing store, but it must be named and treated as inline runner workspace position state, not as a user-facing setting. No Settings UI control is added.

### D-02 — Clamp restored position to viewport (LOCKED)

Any restored coordinates must be clamped against the current viewport so the modal is always visible and draggable after monitor/resolution changes or Obsidian layout changes.

### D-03 — Compact default footprint (LOCKED)

Inline Runner opens with a compact default layout: tighter padding, smaller question/answer spacing, bounded content height, and a narrower floating panel. This replaces Phase 54's note-width bottom bar behavior.

### D-04 — No resize handle / no auto-fade in v1.9 (LOCKED)

Do not implement drag-to-resize, cursor-proximity fade, per-canvas positioning, or additional settings. These are deferred in REQUIREMENTS.md and must not appear in Phase 60 plans.

## Deferred Ideas

- Resize handle on Inline Runner
- Auto-fade on cursor proximity
- Per-canvas preferred display mode
- Inline launch from canvas selector UI
- Settings UI for position reset

## Source Audit

| Source | Item | Coverage |
|--------|------|----------|
| GOAL | Compact default footprint that does not overlap active note editing area | 60-03 |
| GOAL | Remember drag-position across tab switches and plugin reloads | 60-01, 60-02 |
| GOAL | Viewport clamp prevents off-screen restore | 60-01, 60-02 |
| REQ | INLINE-FIX-02 position persists and clamps | 60-00, 60-01, 60-02, 60-04 |
| REQ | INLINE-FIX-03 compact default layout | 60-00, 60-03, 60-04 |
| RESEARCH | Phase 54 fixed-corner/no-position state is obsolete for v1.9 | 60-01, 60-02, 60-03 |
| CONTEXT | D-01 persist last drag position | 60-01, 60-02 |
| CONTEXT | D-02 clamp restored position | 60-01, 60-02 |
| CONTEXT | D-03 compact footprint | 60-03 |
| CONTEXT | D-04 no resize/no fade | All plans explicitly exclude |

## Relevant References

- `.planning/ROADMAP.md` Phase 60 success criteria
- `.planning/REQUIREMENTS.md` INLINE-FIX-02, INLINE-FIX-03 and out-of-scope rows
- `.planning/milestones/v1.8-phases/54-inline-protocol-display-mode/54-CONTEXT.md` — Phase 54 decisions being superseded only for position/layout
- `src/views/inline-runner-modal.ts` — floating inline modal host
- `src/styles/inline-runner.css` — per-feature CSS, append-only per CLAUDE.md
