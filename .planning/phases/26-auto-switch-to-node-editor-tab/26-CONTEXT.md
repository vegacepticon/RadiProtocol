# Phase 26: Auto-Switch to Node Editor Tab - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables bundled in this phase:

1. **Auto-reveal**: Clicking any canvas node brings the Node Editor tab to the foreground
   automatically (non-destructive `revealLeaf`). If the Node Editor panel is not yet open,
   it is created first.

2. **Auto-save regression fix**: Restore the full Phase 23 auto-save implementation that
   was accidentally reverted by the Phase 24 test commit (`da9e1b5`). This includes:
   debounce auto-save, flush-on-switch, immediate save on type-change, "Saved ✓" indicator,
   and removal of `NodeSwitchGuardModal` / `pendingEdits` dirty-guard pattern.

Does NOT include: changes to Runner logic, canvas parsing, or snippet node behaviour.

</domain>

<decisions>
## Implementation Decisions

### Auto-Reveal Trigger
- **D-01:** Auto-reveal fires on **every** canvas node click — unconditionally. No check for
  which tab is currently active. Clicking a node always means "I want to edit it", so the
  Node Editor always comes to front. Simpler and more consistent than a runner-active condition.

### Reveal-or-Create Strategy
- **D-02:** Non-destructive path only. The existing `activateEditorPanelView()` method
  (`workspace.detachLeavesOfType()` + recreate) must NOT be called for auto-reveal.
  Introduce a separate `ensureEditorPanelVisible(): Promise<void>` method in `main.ts` that:
  - If `getLeavesOfType(EDITOR_PANEL_VIEW_TYPE)` returns an existing leaf → `revealLeaf(leaf)`
  - If no leaf exists → create one via `getRightLeaf(false)` + `setViewState` + `revealLeaf`
  The form is NOT recreated on reveal; `loadNode()` handles form content separately.

### Where Reveal Logic Lives
- **D-03:** `EditorPanelView.handleNodeClick()` calls `this.plugin.ensureEditorPanelVisible()`
  **before** `this.loadNode()`. This keeps the reveal step co-located with the node-load step.
  `ensureEditorPanelVisible()` is a new method on the plugin class.

### Auto-Save — Full Phase 23 Restoration
- **D-04:** Restore complete Phase 23 auto-save implementation:
  - `scheduleAutoSave()` with debounce timer — fires after each `onChange` in the form
  - Flush on node-switch: clear debounce timer, await `saveNodeEdits()` before loading new node
  - Immediate save on node-type change (dropdown `onChange`)
  - `_savedIndicatorEl` ("Saved ✓") shown briefly after each successful save
  - **Remove** `NodeSwitchGuardModal` import and `pendingEdits`-based dirty guard from
    `handleNodeClick()` — auto-save makes it unnecessary
- **D-05:** Source of truth for restoration: the `06926bb` + `843436b` + `9e849ee` commits
  (Phase 23 implementation + its two fixes). The `da9e1b5` revert is the regression to undo.
  Planner/executor should read those diffs, not reconstruct from scratch.

### Claude's Discretion
- Exact debounce delay (Phase 23 used ~1 s; same value acceptable)
- Whether `ensureEditorPanelVisible` is `async` or returns `Promise<void>` (async preferred
  for the `setViewState` await path)
- Whether `_savedIndicatorEl` visibility uses a CSS class or `display` toggle

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 26 — Goal, Success Criteria SC-1 and SC-2 (authoritative)

### Regression source (must read before implementing D-04 / D-05)
- Git commits to review for Phase 23 auto-save: `06926bb`, `843436b`, `9e849ee`
  (restore these changes to `src/views/editor-panel-view.ts`)
- Git commit to understand what was reverted: `da9e1b5` (test(24-01) — reverted Phase 23 auto-save)

### Existing code to modify
- `src/main.ts` — add `ensureEditorPanelVisible()` method; do NOT modify `activateEditorPanelView()`
- `src/views/editor-panel-view.ts` — modify `handleNodeClick()` to call `ensureEditorPanelVisible()`;
  restore Phase 23 auto-save fields and methods; remove `NodeSwitchGuardModal` guard block
- `src/views/node-switch-guard-modal.ts` — may be deleted if no other consumer (verify first)

### Prior phase context
- Phase 14 (`14-node-editor-auto-switch-and-unsaved-guard`) — original auto-switch implementation;
  the `attachCanvasListener()` / `handleNodeClick()` pattern comes from here
- Phase 23 implementation — `EditorPanelView` auto-save fields:
  `_debounceTimer`, `_savedIndicatorEl`, `_indicatorTimer`, `scheduleAutoSave()`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EditorPanelView.attachCanvasListener()` (`src/views/editor-panel-view.ts:49`) — already attaches
  a `click` handler to the canvas container; `handleNodeClick()` is called on every node click
- `EditorPanelView.handleNodeClick()` (`src/views/editor-panel-view.ts:98`) — entry point for the
  auto-reveal call; add `await this.plugin.ensureEditorPanelVisible()` here before `this.loadNode()`
- `plugin.activateEditorPanelView()` (`src/main.ts:128`) — destructive; do NOT call from
  auto-reveal path; `ensureEditorPanelVisible()` is the non-destructive alternative
- `workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE)` — check if panel already open
- `workspace.revealLeaf(leaf)` — bring existing leaf to front (used in `activateRunnerView`)

### Established Patterns
- All DOM construction uses `createEl()`/`createDiv()` — no `innerHTML`
- Services registered with `this.registerEvent()` — auto-cleanup on plugin unload
- `new Notice(...)` for transient user-facing messages
- `workspace.getRightLeaf(false)` + `setViewState` + `revealLeaf` — standard open pattern
  (see `activateEditorPanelView` and `activateSnippetManagerView` for reference)

### Integration Points
- `handleNodeClick()` in `EditorPanelView` — add `await this.plugin.ensureEditorPanelVisible()` call
- `main.ts` — add `ensureEditorPanelVisible()` as a new public `async` method
- `editor-panel-view.ts` constructor / class fields — re-add Phase 23 auto-save private fields

</code_context>

<specifics>
## Specific Ideas

- The reveal call in `handleNodeClick()` must happen BEFORE `this.loadNode()` — the leaf must
  exist before the form is rendered into it
- The `ensureEditorPanelVisible()` method should NOT detach — it is a pure reveal-or-open helper
- Phase 23 auto-save restoration: use the git diffs of commits `06926bb`, `843436b`, `9e849ee`
  as the canonical implementation, not a re-derive from scratch — the bugs were already fixed
  in those commits

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-auto-switch-to-node-editor-tab*
*Context gathered: 2026-04-11*
