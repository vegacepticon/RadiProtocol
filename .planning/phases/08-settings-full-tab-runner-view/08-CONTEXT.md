# Phase 8: Settings + Full-Tab Runner View - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Runner view mode" setting (Sidebar panel / Editor tab) to the plugin settings tab, and make `activateRunnerView()` in `main.ts` respect that setting on every invocation.

Scope includes:
- Fully implementing the `RadiProtocolSettingsTab.display()` stub with all existing settings controls (output destination, output folder, max loop iterations) plus the new runner view mode dropdown
- Branching `activateRunnerView()` in `main.ts` based on the new setting
- Handling deduplication across mode transitions (close-and-reopen if mode changed, reveal if same)

Out of scope for this phase: Canvas selector dropdown (Phase 9), output: insert into note (Phase 10), live canvas editing (Phase 11).

</domain>

<decisions>
## Implementation Decisions

### Settings Tab
- **D-01:** Phase 8 implements the **complete** settings tab — all existing settings controls (output destination, output folder, max loop iterations) plus the new runner view mode setting. The current `display()` stub (`'Settings UI coming in phase 3.'`) is replaced with full controls.

### Runner View Mode Setting
- **D-02:** Runner view mode is a **dropdown** (`new Setting().addDropdown()`) with two options:
  - `"sidebar"` → "Sidebar panel" (default, matches v1.0 behavior)
  - `"tab"` → "Editor tab"
  - Standard Obsidian settings pattern; easy to extend in the future.

### Transition Behavior
- **D-03:** Changing the runner view mode in settings does **not** affect an already-open runner instance. The new mode takes effect only on the **next invocation** of the runner command.

### Deduplication Logic (RUNTAB-03 extension)
- **D-04:** On each `activateRunnerView()` call, the logic is:
  1. Check if any `RUNNER_VIEW_TYPE` leaf already exists.
  2. If it exists **and** the current mode matches the leaf's location (sidebar vs. tab) → `revealLeaf` (no-duplicate behavior).
  3. If it exists **but** the mode has changed (e.g., was sidebar, now tab) → close the existing leaf, then open fresh in the new mode.
  4. If no leaf exists → open in the current mode.

  "Tab mode" leaf = opened via `workspace.getLeaf('tab')`.
  "Sidebar mode" leaf = opened via `workspace.getRightLeaf(false)`.

  To detect which mode the existing leaf was opened in: check whether the leaf is in the right sidebar (`workspace.rightSplit` or `leaf.getRoot() === workspace.rightSplit`) vs. in the main workspace split.

### Claude's Discretion
- Label text for the setting and its description string — Claude can choose clear English labels consistent with Obsidian settings conventions.
- Whether to add a heading separator between settings groups in the settings tab — Claude decides based on the number of controls.
- `runnerViewMode` field name in `RadiProtocolSettings` interface — Claude chooses the idiomatic TypeScript name.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Runner Tab Mode — RUNTAB-01, RUNTAB-02, RUNTAB-03 (the three acceptance criteria for this phase)

### Existing Implementation Files
- `src/settings.ts` — `RadiProtocolSettings` interface, `DEFAULT_SETTINGS`, `RadiProtocolSettingsTab` class. The `display()` method is currently a stub and must be fully replaced.
- `src/main.ts` — `activateRunnerView()` method (lines ~149–174). This method is the primary target for the tab/sidebar branch. Also see how other views (`activateEditorPanelView`, `activateSnippetManagerView`) open in the sidebar — runner tab mode should diverge from this pattern.

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RadiProtocolSettings` interface in `src/settings.ts` — add `runnerViewMode: 'sidebar' | 'tab'` field here; add default `'sidebar'` to `DEFAULT_SETTINGS`.
- `RadiProtocolSettingsTab.display()` in `src/settings.ts` — replace stub with `new Setting(containerEl)` calls using Obsidian's `Setting` API.
- `activateRunnerView()` in `src/main.ts` — branch on `this.settings.runnerViewMode`; use `workspace.getLeaf('tab')` for tab mode vs `workspace.getRightLeaf(false)` for sidebar mode.

### Established Patterns
- All other view activations (`activateEditorPanelView`, `activateSnippetManagerView`) call `workspace.detachLeavesOfType(...)` then `workspace.getRightLeaf(false)` — runner tab mode must NOT call `detachLeavesOfType` blindly (it would close the tab too); instead apply the D-04 deduplication logic.
- Settings are persisted via `this.saveData(this.settings)` in `saveSettings()` — no changes to this pattern needed.
- `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` in `onload()` handles missing fields from old saves — adding a new field with a default is safe with this pattern.
- No `innerHTML` usage anywhere — settings tab must use `containerEl.createEl` / Obsidian `Setting` API only.

### Integration Points
- `main.ts` `activateRunnerView()` — primary change point
- `src/settings.ts` `RadiProtocolSettings` interface + `DEFAULT_SETTINGS` + `RadiProtocolSettingsTab.display()` — secondary change points
- `RunnerView` itself (`src/views/runner-view.ts`) — no changes expected; the view is identical regardless of where the leaf is placed

</code_context>

<specifics>
## Specific Ideas

- The dropdown options use Obsidian-idiomatic label text: "Sidebar panel" and "Editor tab" (consistent with Obsidian's own UI vocabulary).
- Mode detection for deduplication (D-04): check `leaf.getRoot() === this.app.workspace.rightSplit` to distinguish sidebar leaves from tab leaves — this is the standard way Obsidian plugins detect sidebar vs main area.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-settings-full-tab-runner-view*
*Context gathered: 2026-04-07*
