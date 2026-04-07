# Phase 8: Settings + Full-Tab Runner View — Research

**Researched:** 2026-04-07
**Domain:** Obsidian Plugin API — Workspace leaf management, PluginSettingTab UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 8 implements the **complete** settings tab — all existing settings controls (output destination, output folder, max loop iterations) plus the new runner view mode setting. The current `display()` stub is replaced with full controls.
- **D-02:** Runner view mode is a **dropdown** (`new Setting().addDropdown()`) with two options: `"sidebar"` → "Sidebar panel" (default), `"tab"` → "Editor tab".
- **D-03:** Changing the runner view mode in settings does **not** affect an already-open runner instance. New mode takes effect only on the **next invocation** of the runner command.
- **D-04:** `activateRunnerView()` deduplication logic on each call:
  1. Check if any `RUNNER_VIEW_TYPE` leaf already exists.
  2. Exists + mode matches leaf location → `revealLeaf` (no duplicate).
  3. Exists + mode changed → close existing leaf, open fresh in new mode.
  4. No leaf exists → open in current mode.
  - "Tab mode" leaf = `workspace.getLeaf('tab')`
  - "Sidebar mode" leaf = `workspace.getRightLeaf(false)`
  - Mode detection: `leaf.getRoot() === workspace.rightSplit`

### Claude's Discretion

- Label text for the setting and its description string — clear English labels consistent with Obsidian settings conventions.
- Whether to add a heading separator between settings groups in the settings tab.
- `runnerViewMode` field name in `RadiProtocolSettings` interface.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RUNTAB-01 | User can configure runner view to open as full editor tab (vs sidebar panel) via a toggle in Plugin Settings | Settings API: `new Setting().addDropdown()` on `RadiProtocolSettingsTab.display()` with `runnerViewMode` field in `RadiProtocolSettings` |
| RUNTAB-02 | When tab mode active and runner command invoked, runner opens as editor tab in main workspace — not right sidebar | `workspace.getLeaf('tab')` then `leaf.setViewState({ type: RUNNER_VIEW_TYPE })` — verified in obsidian.d.ts |
| RUNTAB-03 | If runner tab already open when command invoked, Obsidian reveals existing tab instead of creating duplicate | D-04 deduplication: `getLeavesOfType(RUNNER_VIEW_TYPE)` + `leaf.getRoot()` comparison + `revealLeaf` path |
</phase_requirements>

---

## Summary

Phase 8 involves two coordinated changes to the plugin: (1) replacing the stub `display()` method in `RadiProtocolSettingsTab` with a fully functional settings UI using Obsidian's `Setting` API, and (2) extending `activateRunnerView()` in `main.ts` to branch between sidebar and tab rendering based on a new `runnerViewMode` setting.

The Obsidian plugin API for this phase is well-understood and directly observable in the local `node_modules/obsidian/obsidian.d.ts` (version 1.12.3 — already installed). The critical APIs — `workspace.getLeaf('tab')`, `workspace.getRightLeaf(false)`, `workspace.rightSplit`, `leaf.getRoot()`, and `Setting.addDropdown()` — are all documented in the type definitions and confirmed present. No new npm packages are required.

The deduplication logic in D-04 is the subtlest part of the phase. The current `activateRunnerView()` already handles the "leaf exists → revealLeaf" case for sidebar mode. The phase adds a mode-mismatch branch (close and reopen) and a mode-aware open path. The key implementation detail is using `leaf.getRoot() === this.app.workspace.rightSplit` to detect whether an existing leaf lives in the sidebar vs. the main tab area — this is a stable, documented pattern from `WorkspaceItem.getRoot()` returning the root `WorkspaceItem`, which for sidebar leaves is `workspace.rightSplit` (a `WorkspaceSidedock`).

**Primary recommendation:** Implement in two files only — `src/settings.ts` and `src/main.ts`. No changes to `RunnerView` itself; the view is placement-agnostic.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | 1.12.3 | Plugin API — `Setting`, `PluginSettingTab`, `Workspace`, `WorkspaceLeaf` | Already installed; the only required API |
| TypeScript | 6.0.2 | Type safety | Already in project toolchain |
| Vitest | ^4.1.2 | Unit testing | Already in project toolchain |

No new dependencies. [VERIFIED: package.json in project root]

**Installation:** No `npm install` required — all dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure (no changes)
```
src/
├── settings.ts       # Add runnerViewMode field + full display() implementation
├── main.ts           # Extend activateRunnerView() with tab/sidebar branch
└── views/
    └── runner-view.ts  # No changes
```

### Pattern 1: Adding a New Settings Field with Safe Defaults

**What:** Add a typed field to the `RadiProtocolSettings` interface with a default. The existing `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` pattern in `onload()` ensures backward compatibility — users upgrading from v1.0 automatically get `'sidebar'` as the default without data migration.

**When to use:** Always, for any new settings field.

**Example:**
```typescript
// Source: src/settings.ts (existing project code + Obsidian convention)
export interface RadiProtocolSettings {
  // ... existing fields ...
  runnerViewMode: 'sidebar' | 'tab';
}

export const DEFAULT_SETTINGS: RadiProtocolSettings = {
  // ... existing defaults ...
  runnerViewMode: 'sidebar',  // default = v1.0 behavior preserved
};
```

### Pattern 2: Obsidian Setting API — Dropdown

**What:** Use `new Setting(containerEl).setName(...).setDesc(...).addDropdown(...)` to render a labeled dropdown with options mapped from internal string values to display labels.

**When to use:** Any enum-like setting with 2–5 choices.

**Example:**
```typescript
// Source: Obsidian Plugin API (obsidian.d.ts Setting class, confirmed present)
new Setting(containerEl)
  .setName('Runner view mode')
  .setDesc('Where to open the protocol runner panel.')
  .addDropdown(drop => drop
    .addOption('sidebar', 'Sidebar panel')
    .addOption('tab', 'Editor tab')
    .setValue(this.plugin.settings.runnerViewMode)
    .onChange(async (value) => {
      this.plugin.settings.runnerViewMode = value as 'sidebar' | 'tab';
      await this.plugin.saveSettings();
    })
  );
```

[VERIFIED: `Setting` class with `addDropdown` confirmed in obsidian.d.ts at node_modules/obsidian/obsidian.d.ts]

### Pattern 3: Opening a Leaf as an Editor Tab

**What:** `workspace.getLeaf('tab')` returns a new leaf in the main workspace tab strip, then `leaf.setViewState(...)` populates it with a registered view.

**When to use:** Tab mode only. Do NOT use for sidebar views.

**Example:**
```typescript
// Source: obsidian.d.ts line 6927 — getLeaf(newLeaf?: PaneType | boolean): WorkspaceLeaf
// PaneType = 'tab' | 'split' | 'window' (obsidian.d.ts line 4624)
const leaf = this.app.workspace.getLeaf('tab');
await leaf.setViewState({ type: RUNNER_VIEW_TYPE, active: true });
this.app.workspace.revealLeaf(leaf);
```

[VERIFIED: obsidian.d.ts, local node_modules, version 1.12.3]

### Pattern 4: Detecting Sidebar vs. Main Area Leaf

**What:** `leaf.getRoot()` returns the root `WorkspaceItem`. For sidebar leaves, this is `workspace.rightSplit` (a `WorkspaceSidedock`). For main-area tabs, it is `workspace.rootSplit` (NOT `rightSplit`).

**When to use:** D-04 deduplication — check which mode an existing leaf was opened in.

**Example:**
```typescript
// Source: obsidian.d.ts WorkspaceItem.getRoot() (line 7248) + workspace.rightSplit (line 6792)
const existingLeaves = workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
if (existingLeaves.length > 0 && existingLeaves[0] !== undefined) {
  const existingLeaf = existingLeaves[0];
  const leafIsInSidebar = existingLeaf.getRoot() === workspace.rightSplit;
  const targetIsSidebar = this.settings.runnerViewMode === 'sidebar';

  if (leafIsInSidebar === targetIsSidebar) {
    // Mode matches — just reveal
    workspace.revealLeaf(existingLeaf);
    return;
  }

  // Mode changed — close existing, fall through to open fresh
  existingLeaf.detach();
}
```

[VERIFIED: obsidian.d.ts — `getRoot()` on WorkspaceItem (line 7248), `rightSplit: WorkspaceSidedock | WorkspaceMobileDrawer` on Workspace (line 6792)]

### Pattern 5: Settings Tab — Full display() Implementation

**What:** Replace the stub with `containerEl.empty()` followed by `new Setting(containerEl)` calls for each setting. Use `Setting.setHeading()` to separate logical groups.

**When to use:** All settings controls go through `Setting` API — never use `containerEl.innerHTML` or raw `<input>` elements (community review rule in STATE.md).

**Example (output destination dropdown):**
```typescript
// Source: Obsidian Setting API — confirmed in obsidian.d.ts
new Setting(containerEl)
  .setName('Output destination')
  .setDesc('Where to send the completed protocol report.')
  .addDropdown(drop => drop
    .addOption('clipboard', 'Clipboard')
    .addOption('new-note', 'New note')
    .addOption('both', 'Both')
    .setValue(this.plugin.settings.outputDestination)
    .onChange(async (value) => {
      this.plugin.settings.outputDestination = value as RadiProtocolSettings['outputDestination'];
      await this.plugin.saveSettings();
    })
  );
```

### Anti-Patterns to Avoid

- **Calling `workspace.detachLeavesOfType(RUNNER_VIEW_TYPE)` unconditionally:** The other view activators use this pattern, but it destroys any existing runner session. Runner must use the D-04 deduplication logic (check → reveal or close-and-reopen) instead.
- **Using `workspace.getRightLeaf(false)` in tab mode:** This always puts the view in the sidebar regardless of setting. Use `workspace.getLeaf('tab')` for tab mode.
- **Using `innerHTML` in the settings tab:** Blocked by community review and standing project constraint (STATE.md). Use `Setting` API and `containerEl.createEl` only.
- **Calling `onChange` without `await`:** Settings must be persisted immediately on change; `saveSettings()` is async and must be awaited.
- **Checking `leaf.parent instanceof WorkspaceSidedock`:** The `parent` of a leaf is a `WorkspaceTabs`, not directly a `WorkspaceSidedock`. The correct pattern is `leaf.getRoot() === workspace.rightSplit` (confirmed by type hierarchy in obsidian.d.ts).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persisting settings | Custom JSON serialization | `this.saveData(this.settings)` / `this.loadData()` | Already implemented in `saveSettings()`; handles vault I/O |
| Settings controls (dropdowns, text inputs, toggles) | `<select>`, `<input>` HTML | Obsidian `Setting` API | Community review requirement; handles Obsidian theme styling |
| Leaf existence check | Manual DOM inspection | `workspace.getLeavesOfType(RUNNER_VIEW_TYPE)` | Standard Obsidian pattern; returns typed array |
| Default-safe settings loading | Null-check guard code | `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` | Already in `onload()` — adding a field with a default is safe automatically |

---

## Common Pitfalls

### Pitfall 1: Checking Leaf Side via `parent` Instead of `getRoot()`
**What goes wrong:** `leaf.parent` is a `WorkspaceTabs`, not `WorkspaceSidedock`. Checking `leaf.parent instanceof WorkspaceSidedock` always returns `false` regardless of location.
**Why it happens:** Developers inspect the type hierarchy and pick the most direct parent.
**How to avoid:** Use `leaf.getRoot() === workspace.rightSplit` — `getRoot()` walks up to the root container, which IS `rightSplit` for sidebar leaves.
**Warning signs:** Deduplication logic that always opens fresh tabs even when sidebar mode is active.

### Pitfall 2: `detachLeavesOfType` Destroying the Runner Session
**What goes wrong:** Calling `workspace.detachLeavesOfType(RUNNER_VIEW_TYPE)` closes the view and triggers `onClose()`, clearing `contentEl`. Any in-progress protocol session (graph, runner state) is lost.
**Why it happens:** Copy-pasting from `activateEditorPanelView` or `activateSnippetManagerView` which use this pattern safely (they have no stateful session).
**How to avoid:** Use `existingLeaf.detach()` only in the mode-changed branch of D-04 (i.e., only when intentionally discarding and reopening). The reveal path must NOT detach.
**Warning signs:** Runner resets to idle state every time the command is invoked.

### Pitfall 3: `getRightLeaf(false)` Returning `null`
**What goes wrong:** `workspace.getRightLeaf(false)` can return `null` if the right sidebar is in an unexpected state. The existing `activateRunnerView()` guards against this with `if (leaf !== null)`.
**Why it happens:** Sidebar not initialized, or mobile-only state.
**How to avoid:** Keep the existing `null` guard. Tab mode (`getLeaf('tab')`) does not have this issue — it always returns a leaf.
**Warning signs:** Silent no-op when trying to open in sidebar mode.

### Pitfall 4: Settings Not Persisting on Dropdown Change
**What goes wrong:** The dropdown `onChange` callback fires but the new value is not saved to disk. Closing and reopening Obsidian reverts to the old setting.
**Why it happens:** Forgetting to call `await this.plugin.saveSettings()` inside `onChange`, or calling it without `await` (fire-and-forget float).
**How to avoid:** Always `await this.plugin.saveSettings()` inside each `onChange`. The `onChange` handler should be an `async` function.
**Warning signs:** Setting appears to work in current session but reverts after restart.

### Pitfall 5: `runnerViewMode` Missing from Old Installs
**What goes wrong:** Users upgrading from v1.0 have stored settings without `runnerViewMode`. `loadData()` returns the old object, and `settings.runnerViewMode` is `undefined`.
**Why it happens:** Settings were saved before the new field was added.
**How to avoid:** This is already handled by `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` in `onload()` — `DEFAULT_SETTINGS` provides `runnerViewMode: 'sidebar'` and `Object.assign` keeps all existing fields while filling in the missing one. No extra code needed, but the default in `DEFAULT_SETTINGS` must be set.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'runnerViewMode')`.

---

## Code Examples

### Complete `activateRunnerView()` with D-04 Deduplication

```typescript
// Source: D-04 decision (CONTEXT.md) + Obsidian workspace API patterns
async activateRunnerView(): Promise<void> {
  const { workspace } = this.app;
  const existingLeaves = workspace.getLeavesOfType(RUNNER_VIEW_TYPE);

  if (existingLeaves.length > 0 && existingLeaves[0] !== undefined) {
    const existingLeaf = existingLeaves[0];
    const leafIsInSidebar = existingLeaf.getRoot() === workspace.rightSplit;
    const targetIsSidebar = this.settings.runnerViewMode === 'sidebar';

    if (leafIsInSidebar === targetIsSidebar) {
      // Mode unchanged — reveal existing leaf (RUNTAB-03)
      workspace.revealLeaf(existingLeaf);
      return;
    }

    // Mode changed — close old leaf, open fresh below
    existingLeaf.detach();
  }

  // Open in the configured mode
  let leaf: WorkspaceLeaf | null;
  if (this.settings.runnerViewMode === 'tab') {
    leaf = workspace.getLeaf('tab');           // RUNTAB-02: main workspace tab
  } else {
    leaf = workspace.getRightLeaf(false);      // sidebar (default v1.0 behavior)
  }

  if (leaf !== null) {
    await leaf.setViewState({ type: RUNNER_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  // After opening, trigger openCanvas on active canvas if any (preserved from v1.0)
  const canvasLeaves = workspace.getLeavesOfType('canvas');
  const activeCanvas = canvasLeaves[0];
  if (activeCanvas !== undefined) {
    const filePath = (activeCanvas.view as { file?: { path: string } } | undefined)?.file?.path;
    if (filePath !== undefined) {
      const runnerLeaves = workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
      const runnerLeaf = runnerLeaves[0];
      if (runnerLeaf !== undefined) {
        const view = runnerLeaf.view as RunnerView;
        void view.openCanvas(filePath);
      }
    }
  }
}
```

### Full `RadiProtocolSettingsTab.display()` Skeleton

```typescript
// Source: Obsidian Setting API (obsidian.d.ts) + project conventions (no innerHTML)
display(): void {
  const { containerEl } = this;
  containerEl.empty();

  // Group: Output
  new Setting(containerEl).setName('Output').setHeading();

  new Setting(containerEl)
    .setName('Output destination')
    .setDesc('Where to send the completed protocol report.')
    .addDropdown(drop => drop
      .addOption('clipboard', 'Clipboard')
      .addOption('new-note', 'New note')
      .addOption('both', 'Both')
      .setValue(this.plugin.settings.outputDestination)
      .onChange(async (value) => {
        this.plugin.settings.outputDestination = value as RadiProtocolSettings['outputDestination'];
        await this.plugin.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName('Output folder')
    .setDesc('Vault folder for saved report notes.')
    .addText(text => text
      .setPlaceholder('RadiProtocol Output')
      .setValue(this.plugin.settings.outputFolderPath)
      .onChange(async (value) => {
        this.plugin.settings.outputFolderPath = value.trim() || 'RadiProtocol Output';
        await this.plugin.saveSettings();
      })
    );

  // Group: Runner
  new Setting(containerEl).setName('Runner').setHeading();

  new Setting(containerEl)
    .setName('Runner view mode')
    .setDesc('Where to open the protocol runner panel.')
    .addDropdown(drop => drop
      .addOption('sidebar', 'Sidebar panel')
      .addOption('tab', 'Editor tab')
      .setValue(this.plugin.settings.runnerViewMode)
      .onChange(async (value) => {
        this.plugin.settings.runnerViewMode = value as 'sidebar' | 'tab';
        await this.plugin.saveSettings();
      })
    );

  // Group: Advanced
  new Setting(containerEl).setName('Advanced').setHeading();

  new Setting(containerEl)
    .setName('Max loop iterations')
    .setDesc('Hard cap on loop iterations to prevent infinite loops. Default: 50.')
    .addText(text => text
      .setValue(String(this.plugin.settings.maxLoopIterations))
      .onChange(async (value) => {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num > 0) {
          this.plugin.settings.maxLoopIterations = num;
          await this.plugin.saveSettings();
        }
      })
    );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getLeaf(true)` / `getLeaf(false)` | `getLeaf('tab')` / `getLeaf('split')` | Obsidian ~0.15.x | Boolean arg deprecated; use `PaneType` string |
| Custom persistence (JSON files) | `loadData()` / `saveData()` | Obsidian Plugin API v1 | Built-in; handles all serialization |

**Deprecated:**
- `workspace.splitLeaf()` — replaced by `getLeaf('split')`
- `getLeaf(true)` boolean form — deprecated per obsidian.d.ts JSDoc, replaced by `getLeaf('tab')`

[VERIFIED: obsidian.d.ts JSDoc annotations at lines 6883 and 6901]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Setting.setHeading()` is available on the installed `obsidian@1.12.3` package | Architecture Patterns (Pattern 5) | Heading separator would fail — use `containerEl.createEl('h3')` as fallback |

All other claims were verified against `node_modules/obsidian/obsidian.d.ts` (version 1.12.3) in this session.

---

## Open Questions

1. **`Setting.setHeading()` availability**
   - What we know: The method is commonly used in community plugins and referenced in Obsidian docs examples.
   - What's unclear: Not confirmed in the local obsidian.d.ts scan (grep was not run specifically for `setHeading`).
   - Recommendation: Implementer should grep `obsidian.d.ts` for `setHeading` before using. If absent, use `containerEl.createEl('h3', { text: 'Group name' })` instead — both approaches are DOM-safe and compliant with the no-innerHTML rule.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is purely code changes to `src/settings.ts` and `src/main.ts`. No external tools, services, CLIs, or runtimes beyond the existing project toolchain (Node.js, npm, TypeScript, Vitest) are required. All dependencies confirmed present in `package.json`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RUNTAB-01 | `DEFAULT_SETTINGS.runnerViewMode` equals `'sidebar'` | unit | `npm test -- --reporter=dot src/__tests__/settings-tab.test.ts` | ✅ (extend existing) |
| RUNTAB-01 | `RadiProtocolSettings` interface includes `runnerViewMode: 'sidebar' \| 'tab'` | unit | `npm test -- --reporter=dot src/__tests__/settings-tab.test.ts` | ✅ (extend existing) |
| RUNTAB-01 | `RadiProtocolSettingsTab.display()` no longer renders stub text | unit | `npm test -- --reporter=dot src/__tests__/settings-tab.test.ts` | ✅ (extend existing) |
| RUNTAB-02 | `activateRunnerView()` uses `getLeaf('tab')` when `runnerViewMode === 'tab'` — structural test | manual/integration | — | Manual only — requires Obsidian workspace |
| RUNTAB-03 | Re-invoking when tab exists reveals same leaf — structural test | manual/integration | — | Manual only — requires Obsidian workspace |

> Note: RUNTAB-02 and RUNTAB-03 involve `activateRunnerView()` which depends on `workspace.*` APIs. These cannot be meaningfully unit-tested without a full Obsidian environment. Manual UAT covers them. The existing `settings-tab.test.ts` covers RUNTAB-01 and the type/default assertions.

### Sampling Rate
- **Per task commit:** `npm test -- --reporter=dot src/__tests__/settings-tab.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/settings-tab.test.ts` — extend with: `runnerViewMode` default is `'sidebar'`, interface includes the new field, `display()` stub text is gone. File already exists; tests need to be added, not the file created.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — local plugin, no auth |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a — local vault, no multi-user |
| V5 Input Validation | yes (minimal) | `maxLoopIterations`: parse with `parseInt`, validate `> 0` and `isNaN` guard |
| V6 Cryptography | no | n/a — no secrets or encryption |

### Known Threat Patterns for Obsidian Plugin Settings

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Invalid integer from settings text field | Tampering | `parseInt` + `isNaN` guard + `num > 0` check before assign |
| XSS via settings label text | Tampering | Obsidian `Setting` API renders via DOM (not `innerHTML`) — safe by construction |

No significant security surface in this phase. Settings are local, vault-scoped, no network I/O, no secrets.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/obsidian/obsidian.d.ts` (v1.12.3) — `Workspace.getLeaf`, `PaneType`, `workspace.rightSplit`, `WorkspaceItem.getRoot()`, `WorkspaceSidedock`, `Setting`, `revealLeaf`, `getRightLeaf` — verified by direct file read
- `src/settings.ts` — existing `RadiProtocolSettings` interface, `DEFAULT_SETTINGS`, `RadiProtocolSettingsTab` stub — verified by direct file read
- `src/main.ts` — existing `activateRunnerView()`, `activateEditorPanelView()`, `activateSnippetManagerView()` patterns — verified by direct file read
- `package.json` — dependency versions — verified by direct file read

### Secondary (MEDIUM confidence)
- `src/__tests__/settings-tab.test.ts` — existing test structure; confirms what needs extending
- `src/__tests__/editor-panel.test.ts` — confirms `vi.mock('obsidian')` pattern used across test suite

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in project node_modules
- Architecture: HIGH — Obsidian API verified in installed type definitions; existing codebase patterns confirmed
- Pitfalls: HIGH — derived from direct code inspection of existing `activateRunnerView()` and Obsidian type hierarchy

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (Obsidian 1.x API is stable; valid as long as obsidian package version is unchanged)
