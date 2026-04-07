# Phase 9: Canvas Selector Dropdown - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a canvas selector to `RunnerView` so users can choose which `.canvas` protocol to run from within the plugin panel — without closing the panel and re-invoking the command.

Scope includes:
- A new "Protocol canvas folder" setting in `RadiProtocolSettingsTab`
- A custom drill-down dropdown widget rendered in `RunnerView.onOpen()` header (`this.headerEl`) — NOT `contentEl`
- Reactive refresh of the dropdown when vault files change (create/delete/rename)
- Confirmation modal when switching canvas mid-session (at-node / awaiting-snippet-fill states)
- Updated idle-state content in `contentEl` (replaces old "Open a canvas file to start" text)

Out of scope: output destination (Phase 10), live canvas editing (Phase 11).

</domain>

<decisions>
## Implementation Decisions

### Settings: Protocol Canvas Folder
- **D-01:** Add a separate **"Protocol canvas folder"** setting (text field) to the settings tab — distinct from `outputFolder`. This setting controls which folder the dropdown scans for `.canvas` files.
- **D-02:** The field name in `RadiProtocolSettings` interface: `protocolFolderPath` (string). Default: `''` (empty).
- **D-03:** If `protocolFolderPath` is empty, the dropdown shows **no items** and displays a hint: "Set a protocol folder in Settings to get started." — no fallback to all-vault scan.

### Canvas Selector Widget
- **D-04:** The selector is a **custom div-based drill-down dropdown** (NOT a native `<select>`) to support folder navigation. Built entirely with DOM API (`createDiv`, `createEl`) — no `innerHTML`.
- **D-05:** The widget is rendered in **`this.headerEl`** inside `onOpen()`, NOT inside `contentEl`. `contentEl` is cleared by `render()` on every state transition; `headerEl` is not touched by `render()`.
- **D-06:** The trigger button shows the **basename** of the currently selected canvas (without `.canvas` extension). When nothing is selected, shows placeholder text (e.g., "Select a protocol…").

### Drill-Down Navigation
- **D-07:** The dropdown opens as a custom popover panel. Contents of the configured folder are shown. Subfolders appear with a folder icon + `►` arrow; clicking a folder **drills into** it showing its contents (files + nested subfolders). A `← Back` row at the top navigates to the parent level.
- **D-08:** `.canvas` files are shown with a file/protocol icon. Clicking a file selects it and closes the popover.
- **D-09:** Display name of each file: **basename only** (without `.canvas` extension). E.g., `CT Chest` not `CT/CT Chest`.
- **D-10:** The drill-down state is ephemeral (resets to root on each dropdown open). No need to persist last-visited folder.

### Reactive Refresh
- **D-11:** Register vault event listeners via `this.registerEvent()` for `vault.on('create')`, `vault.on('delete')`, and `vault.on('rename')`. When any `.canvas` file inside `protocolFolderPath` is affected, rebuild the dropdown's internal file tree and re-render the popover if currently open.

### Mid-Session Canvas Switch
- **D-12:** When the user selects a different canvas and the runner state is `at-node` or `awaiting-snippet-fill`: show a **confirmation modal** ("The active session will be reset. Continue?"). On confirm → call `sessionService.clear(currentCanvasFilePath)` then `openCanvas(newPath)`. On cancel → revert dropdown selection to the previous canvas.
- **D-13:** When runner state is `complete` or `idle` → switch **without confirmation**. No modal needed.
- **D-14:** Session auto-saves after every step (existing SessionService behaviour). Before resetting, the current session is already persisted — no extra save step needed.

### Idle-State UX
- **D-15:** In the `idle` case of `render()`, **remove** the existing `h2` "Open a canvas file to start" and the `p` command palette hint. Replace with a single short hint: `"Select a protocol above"` (pointing to the header dropdown). The dropdown in `headerEl` is the primary entry point.

### Claude's Discretion
- Exact CSS class names for the drill-down popover and its rows.
- Whether to close the popover on outside-click via a document click listener or a dedicated overlay div.
- Icon choice for folders and files (Obsidian's `setIcon()` with Lucide icon names: e.g., `folder`, `file-text`).
- Exact label/description text for the new "Protocol canvas folder" setting.
- How to handle the edge case where `protocolFolderPath` points to a folder that doesn't exist yet (show empty list + hint, same as empty setting).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Implementation Files
- `src/views/runner-view.ts` — Primary change file. `onOpen()` (line ~130), `render()` (line ~140), `canvasFilePath` field (line ~19), `openCanvas()` method. The `render()` method clears `contentEl` on every call — never put the selector here.
- `src/main.ts` — `activateRunnerView()` (line ~146): already calls `view.openCanvas(filePath)` for the active canvas leaf. The selector is an additional path to `openCanvas()`.
- `src/settings.ts` — `RadiProtocolSettings` interface and `DEFAULT_SETTINGS`. Add `protocolFolderPath: string` here. `RadiProtocolSettingsTab.display()` — add the new setting control here.

### Sessions
- `src/sessions/session-service.ts` — `clear(canvasFilePath)` is called before switching canvas in D-12.

### No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RunnerView.openCanvas(filePath: string)` — the method that loads a canvas and starts the session. The selector simply calls this when a file is picked.
- `RadiProtocolSettings` + `DEFAULT_SETTINGS` in `src/settings.ts` — add `protocolFolderPath` field here; merge-with-defaults pattern in `onload()` handles missing field safely.
- `this.registerEvent()` on `ItemView` — correct way to register vault event listeners inside a view; auto-cleaned on view close.
- `app.vault.getAbstractFileByPath()` + `TFolder` / `TFile` — traverse folder tree to build the file list for the drill-down.

### Established Patterns
- All DOM is built via `createEl`/`createDiv`; no `innerHTML` allowed (ESLint enforced).
- `setIcon(el, 'icon-name')` from Obsidian API for Lucide icons.
- Settings use `new Setting(containerEl).setName().setDesc().addText()` / `.addDropdown()` patterns.
- `sessionService.clear(path)` + `openCanvas(path)` is the correct sequence for a forced reset.

### Integration Points
- `RunnerView.onOpen()` → render selector into `this.headerEl`
- `RunnerView.render()` idle case → replace old "Open a canvas file to start" with "Select a protocol above"
- `RadiProtocolSettingsTab.display()` → add "Protocol canvas folder" text setting
- `RadiProtocolSettings` interface + `DEFAULT_SETTINGS` → add `protocolFolderPath: ''`

</code_context>

<specifics>
## Specific Ideas

- Visual drill-down mockup confirmed by user:
  ```
  [ 📂 CT/              ► ]
  [ 📂 MRI/             ► ]
  [ 📂 X-Ray/           ► ]

  — after clicking CT/ —
  [ ← Back              ]
  [ 📋 CT Chest         ]
  [ 📋 CT Abdomen       ]
  [ 📂 Trauma/         ► ]
  ```
- Use case: radiologist organises protocols by modality (CT, MRI, X-Ray) and body area subfolders. The drill-down allows deep nesting without clutter.
- Trigger button label: basename of selected file (e.g., "CT Chest") or "Select a protocol…" when none selected.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-canvas-selector-dropdown*
*Context gathered: 2026-04-07*
