---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Node Editor Overhaul & Snippet Node
status: roadmap_ready
stopped_at: Roadmap created — ready to plan Phase 20
last_updated: "2026-04-10T00:00:00.000Z"
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# RadiProtocol — Project State

**Updated:** 2026-04-10  
**Milestone:** v1.3 — Node Editor Overhaul & Snippet Node  
**Status:** Roadmap ready — begin Phase 20  
**Last session:** 2026-04-10  
**Stopped at:** Roadmap created — ready to plan Phase 20

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-10)

**Core value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.  
**Current focus:** v1.3 — Node Editor auto-save, Snippet node type, canvas color coding, UX polish

---

## Current Position

**Milestone:** v1.3 — Node Editor Overhaul & Snippet Node  
**Phase:** 20 — Housekeeping Removals (not started)  
**Plan:** None yet  
**Status:** Not started

```
Progress: [░░░░░░░░░░░░░░░░░░░░] 0/8 phases complete (0%)
```

---

## Phase Progress

| Phase | Name | Status |
|-------|------|--------|
| 20 | Housekeeping Removals | Not started |
| 21 | Color Infrastructure | Not started |
| 22 | Snippet Node — Graph and Runner Layer | Not started |
| 23 | Node Editor Auto-Save and Color-on-Type-Change | Not started |
| 24 | Settings — Snippet Node Folder | Not started |
| 25 | Snippet Node Runner UI | Not started |
| 26 | Auto-Switch to Node Editor Tab | Not started |
| 27 | Interactive Placeholder Editor | Not started |

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Read-only Canvas contract (Strategy A) | No official Canvas runtime API; never modify `.canvas` while open — fallback when canvas closed |
| CanvasLiveEditor Pattern B | getData/setData/requestSave for live edits when canvas is open — undocumented but widely used |
| TypeScript + esbuild + plain DOM | Standard Obsidian plugin toolchain; zero framework overhead |
| Vitest for engine tests | Pure engine modules (parser, runner) have no Obsidian imports; fully unit-testable |
| One-file-per-snippet storage | Minimizes vault.modify() race conditions and sync conflicts |
| Discriminated union on `kind` for node types | Type-safe graph model; snippet added, free-text-input removed in v1.3 |
| Snapshot undo stack | Simplest correct approach for step-back; protocol text is small (<5KB) |
| `radiprotocol_*` property namespace | Avoids collisions with other plugins and future Obsidian updates |
| Canvas node colors are fully plugin-controlled | Always overwrite on type assignment; no user-color preservation, no opt-in setting |
| free-text-input silently degrades to text-block | Parser DEPRECATED_KINDS silent-skip; no user-facing errors on legacy canvases |
| In-textarea chip overlay deferred | Requires rich-text framework; v1.3 scope is list drag-and-drop only |
| Snippet node file picker: global + per-node override | radiprotocol_snippetFolder per-node takes precedence over global snippetNodeFolderPath |
| Auto-save captures nodeId at schedule time | Closure over argument values, never over this.currentNodeId — prevents cross-node write |
| awaiting-snippet-fill state retired | Sessions with this status cleared to fresh start; chooseSnippet() uses at-node halt pattern |

---

## Critical Pitfalls (Standing Reminders)

1. **Never modify `.canvas` while open in Canvas view** — use CanvasLiveEditor Pattern B instead
2. **`vault.modify()` race conditions** — use write mutex (async-mutex) per file path
3. **No `innerHTML`** — use DOM API and Obsidian helpers
4. **No `require('fs')`** — use `app.vault.*` exclusively
5. **`loadData()` returns null on first install** — always merge with defaults
6. **Infinite loop cycles** — validate protocol graph before running; hard iteration cap (default 50)
7. **`console.log` forbidden in production** — use `console.debug()` during dev; remove before release
8. **PROTECTED_FIELDS has two copies** — canvas-live-editor.ts (line 14) AND editor-panel-view.ts (line 181); both must be updated in Phase 21 or color writes silently fail on one save path
9. **Auto-save closure pitfall** — scheduleAutoSave(filePath, nodeId, edits) must close over argument values; if user switches nodes before timer fires, old snapshot must write to old nodeId
10. **Stale DOM after async save** — after awaiting saveLive(), check this.currentNodeId === savedNodeId before touching any DOM element
11. **vault.modify + requestSave race** — if isLiveAvailable() returns false, skip color write entirely; do not fall through to Strategy A
12. **free-text-input parser removal** — keep DEPRECATED_KINDS silent-skip set in canvas-parser.ts; do not error or warn on legacy nodes
13. **awaiting-snippet-fill session load** — treat unknown runnerStatus values as stale; start fresh (same code path as missing node IDs)
14. **revealLeaf timing** — use setTimeout(0) inside handleNodeClick(); do not use deprecated workspace.activeLeaf
15. **DnD event listener leak** — event delegation on stable container (one listener), not per-chip listeners

---

## Accumulated Context

### Architecture Notes (v1.3)

- **New file:** `src/canvas/node-color-map.ts` — pure constant, zero Obsidian imports, immediately Vitest-testable
- **New file:** `src/views/snippet-picker-modal.ts` — extends FuzzySuggestModal<TFile>
- **Deleted file:** `src/views/node-switch-guard-modal.ts` — dirty guard replaced by auto-save
- **awaiting-snippet-fill** removed from RunnerState union, protocol-runner.ts, runner-view.ts
- **Snippet execution pattern:** at-node halt + chooseSnippet() call — no runner state machine change needed

### Files With Significant v1.3 Changes

| File | Changes |
|------|---------|
| graph-model.ts | Add SnippetNode + snippet to RPNodeKind; remove FreeTextInputNode and free-text-input; remove snippetId from TextBlockNode |
| canvas-parser.ts | Add snippet parse case; DEPRECATED_KINDS silent-skip for free-text-input; remove snippetId from text-block case |
| protocol-runner.ts | Add chooseSnippet(); add snippet halt; remove enterFreeText(), completeSnippet(), awaiting-snippet-fill, snippetId/snippetNodeId |
| editor-panel-view.ts | Debounced auto-save; remove NodeSwitchGuardModal; add snippet form fields; color on type change; revealLeaf on node click |
| canvas-live-editor.ts | Remove color from PROTECTED_FIELDS (line 14) |
| runner-view.ts | Add snippet button at snippet node; handleSnippetNodeClick(); remove handleSnippetFill() |
| snippet-manager-view.ts | Drag-to-reorder placeholder list via event delegation |
| settings.ts | Add snippetNodeFolderPath: string |

---

## Repository

- Branch: `main`
- Remote: (not yet configured)
- Last commit: `5308b1d` — chore: archive phase directories from completed milestones
