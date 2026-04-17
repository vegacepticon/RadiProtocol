---
status: awaiting_human_verify
trigger: "phase-27-regressions: After phase 27 (chip drag-and-drop / placeholder editor), at least 4 features regressed"
created: 2026-04-12T00:00:00Z
updated: 2026-04-12T03:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED — color regression root cause found: `canvas-live-editor.ts` PROTECTED_FIELDS included 'color', blocking onTypeDropdownChange from writing the palette color through saveLive. Fix applied: removed 'color' from PROTECTED_FIELDS + added delete node['color'] on unmark path.
test: Build passes (tsc --skipLibCheck + esbuild). Awaiting manual verification in Obsidian.
expecting: Setting node type now updates canvas node color immediately
next_action: User verifies node color changes in Obsidian

## Symptoms

expected:
1. Auto-save: Changes to node settings should auto-save without manual action
2. Node type highlighting: Nodes on canvas should be visually colored/styled according to their node type
3. Tab auto-switch: When user selects a node on the canvas, the UI should automatically switch to the node editor/settings tab
4. Protocol Runner textarea: The textarea in Protocol Runner should always have the same dark background color — no visual change on hover (should NOT turn gray when hovering)

actual:
1. Auto-save is not working — changes are not being saved
2. Node type colors/highlighting is not appearing on canvas nodes
3. Tab does NOT auto-switch when selecting a node — user has to manually click the tab
4. Protocol Runner textarea turns GRAY on hover — inconsistent with the intended always-dark styling

errors: No specific error messages reported, these are visual/behavioral regressions

started: After phase 27 (chip drag-and-drop for placeholder editor) was completed

reproduction:
1. Auto-save: Edit any node setting field, wait — change not persisted
2. Node colors: Open canvas, observe nodes lack type-based color styling
3. Tab switch: Click any node on canvas — settings tab does not activate
4. Hover: Open Protocol Runner, hover over the textarea input area — it turns gray

## Eliminated

- hypothesis: Regressions came from snippet-manager-view.ts changes in phase 27
  evidence: git diff showed only WR-05 addEventListener fix there, unrelated to the 4 regressions
  timestamp: 2026-04-12T01:00:00Z

- hypothesis: Color not working because NODE_COLOR_MAP was missing (deleted in 96022c2)
  evidence: NODE_COLOR_MAP was recreated in the previous session fix. But color still not rendering.
  timestamp: 2026-04-12T03:00:00Z

- hypothesis: Color not writing through because onTypeDropdownChange logic was wrong
  evidence: onTypeDropdownChange correctly sets edits['color'] = mappedColor, then calls saveNodeEdits which calls saveLive. The bug was one layer deeper.
  timestamp: 2026-04-12T03:00:00Z

## Evidence

- timestamp: 2026-04-12T01:00:00Z
  checked: git diff HEAD~8..HEAD -- src/views/snippet-manager-view.ts
  found: Phase 27 only changed snippet-manager-view.ts (WR-05 addEventListener fix) — not the source of regressions
  implication: The regressions must be in editor-panel-view.ts or styles.css

- timestamp: 2026-04-12T01:00:00Z
  checked: git log --oneline -- styles.css
  found: Commit 0928cb1 "fix(21): suppress Obsidian default textarea hover background change" added .rp-preview-textarea:hover rule; then commit 96022c2 (phase 27) DELETED it
  implication: Regression 4 confirmed — phase 27 explicitly removed the hover fix

- timestamp: 2026-04-12T01:00:00Z
  checked: git show 96022c2 --stat
  found: Despite commit message saying "add chip CSS classes", commit 96022c2 deleted 6693 lines across 54 files including src/canvas/node-color-map.ts
  implication: This was a massive cleanup/reset commit, not just CSS additions

- timestamp: 2026-04-12T01:00:00Z
  checked: git show 9803c4d:src/views/editor-panel-view.ts vs current HEAD:src/views/editor-panel-view.ts
  found: Pre-phase27 editor-panel-view.ts had: (a) import of NODE_COLOR_MAP, (b) _debounceTimer/_savedIndicatorEl/_indicatorTimer fields, (c) scheduleAutoSave() method called from all onChange handlers, (d) onTypeDropdownChange() writing color via NODE_COLOR_MAP, (e) showSavedIndicator() method, (f) call to this.plugin.ensureEditorPanelVisible() in handleNodeClick — ALL of these were removed in 96022c2
  implication: Regressions 1, 2, 3 are all in editor-panel-view.ts being reset to an earlier state

- timestamp: 2026-04-12T01:00:00Z
  checked: git show 9803c4d:src/main.ts
  found: Pre-phase27 main.ts had ensureEditorPanelVisible() method; current HEAD main.ts does NOT have it
  implication: Tab auto-switch (regression 3) requires restoring ensureEditorPanelVisible() to main.ts AND calling it in handleNodeClick()

- timestamp: 2026-04-12T03:00:00Z
  checked: canvas-live-editor.ts PROTECTED_FIELDS constant (line 14)
  found: const PROTECTED_FIELDS = new Set(['id', 'x', 'y', 'width', 'height', 'type', 'color']) — 'color' was protected, blocking color writes through saveLive (Pattern B)
  implication: Even though onTypeDropdownChange correctly computed the color, saveLive silently skipped writing it. Strategy A (vault.modify) was never reached because saveLive returned true.

- timestamp: 2026-04-12T03:00:00Z
  checked: git log --oneline -- src/canvas/canvas-live-editor.ts
  found: Commit 0539332 "fix(26): remove color from PROTECTED_FIELDS so type-dropdown color writes through" had already fixed this. Commit 96022c2 reverted it by resetting the file.
  implication: This is the same regression pattern — phase 27 reverted a prior fix.

## Resolution

root_cause: Two-part root cause:
  PART 1 (previous session): Phase 27 commit 96022c2 deleted node-color-map.ts, removed auto-save/debounce, tab-switch, and textarea hover fix from editor-panel-view.ts/main.ts/styles.css.
  PART 2 (this session): canvas-live-editor.ts PROTECTED_FIELDS included 'color', so even after NODE_COLOR_MAP was restored and onTypeDropdownChange was writing edits['color'], the saveLive function silently dropped the color field and returned true — preventing Strategy A fallback. This was a regression of fix(26) commit 0539332.

fix: Applied two rounds of fixes:
  Round 1 (previous session, commit c7743b6): Recreated node-color-map.ts; restored auto-save, tab-switch, textarea hover.
  Round 2 (this session): Removed 'color' from PROTECTED_FIELDS in canvas-live-editor.ts; added delete node['color'] in the unmark branch to match Strategy A behavior.

verification: Build passes (tsc --skipLibCheck + esbuild, deployed to dev vault). Awaiting manual verification in Obsidian.

files_changed:
  - src/canvas/node-color-map.ts (recreated — Round 1)
  - src/views/editor-panel-view.ts (restored auto-save + color + tab-switch — Round 1)
  - src/main.ts (restored ensureEditorPanelVisible — Round 1)
  - src/styles.css (restored hover fix + saved-indicator CSS — Round 1)
  - styles.css (restored hover fix + saved-indicator CSS — Round 1)
  - src/canvas/canvas-live-editor.ts (removed 'color' from PROTECTED_FIELDS + unmark color clear — Round 2)
