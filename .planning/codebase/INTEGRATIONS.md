# External Integrations

**Analysis Date:** 2026-04-16

## APIs & External Services

**Obsidian Plugin API (sole external dependency):**
- Package: `obsidian` 1.12.3
- Treated as external by esbuild — provided at runtime by the Obsidian desktop app
- No network calls, no external APIs, no third-party services

This plugin is entirely self-contained within Obsidian's vault ecosystem.

## Obsidian API Usage Patterns

### Plugin Lifecycle (`src/main.ts`)

The plugin class extends `Plugin` and registers:
- **3 views** via `this.registerView()`:
  - `RunnerView` (`src/views/runner-view.ts`) — protocol execution UI
  - `EditorPanelView` (`src/views/editor-panel-view.ts`) — node editor sidebar
  - `SnippetManagerView` (`src/views/snippet-manager-view.ts`) — snippet management
- **3 commands** via `this.addCommand()`:
  - `run-protocol` — opens the runner view
  - `open-node-editor` — opens the editor panel
  - `open-snippet-manager` — opens snippet manager
- **1 ribbon icon** (`activity`) — triggers `run-protocol`
- **1 settings tab** via `this.addSettingTab()` (`src/settings.ts`)
- **Context menu** items via `this.app.workspace.on('file-menu', ...)`

### View System

All views extend `ItemView`:
- `RunnerView` (`src/views/runner-view.ts`) — main protocol execution interface
- `EditorPanelView` (`src/views/editor-panel-view.ts`) — canvas node editor
- `SnippetManagerView` (`src/views/snippet-manager-view.ts`) — snippet tree + editor

Views are activated into workspace leaves via `this.app.workspace.getLeaf()` or `this.app.workspace.getRightLeaf()`.

### Modal System

Multiple modals extend `Modal` or `SuggestModal`:
- `SnippetFillInModal` (`src/views/snippet-fill-in-modal.ts`) — placeholder fill-in dialog
- `SnippetEditorModal` (`src/views/snippet-editor-modal.ts`) — snippet creation/editing
- `CanvasSwitchModal` (`src/views/canvas-switch-modal.ts`) — canvas file picker
- `ResumeSessionModal` (`src/views/resume-session-modal.ts`) — session resume prompt
- `NodePickerModal` (`src/views/node-picker-modal.ts`) — node selection (extends `SuggestModal`)
- `ConfirmModal` (`src/views/confirm-modal.ts`) — generic confirmation dialog
- `NodeSwitchGuardModal` (`src/views/node-switch-guard-modal.ts`) — unsaved changes guard

### DOM Construction

All UI is built using Obsidian's `createEl()` / `createDiv()` helpers (enforced by ESLint rule banning `innerHTML`/`outerHTML`). Icons use `setIcon()` from the Obsidian API.

## Data Storage

**Databases:**
- None — all persistence is file-based within the Obsidian vault

**Vault File I/O:**

The plugin reads/writes files through `this.app.vault` methods:
- `vault.read(file)` / `vault.cachedRead(file)` — read file contents
- `vault.modify(file, content)` — write file contents
- `vault.create(path, content)` — create new files
- `vault.adapter.exists(path)` — check file existence
- `vault.adapter.list(path)` — list directory contents
- `vault.getAbstractFileByPath(path)` — resolve vault path to `TFile`/`TFolder`

Key services performing vault I/O:
- `SnippetService` (`src/snippets/snippet-service.ts`) — CRUD for snippet JSON files in `.radiprotocol/snippets/`
- `SessionService` (`src/sessions/session-service.ts`) — CRUD for session JSON files in `.radiprotocol/sessions/`
- `CanvasRefSync` (`src/snippets/canvas-ref-sync.ts`) — syncs snippet references with canvas files
- `WriteMutex` (`src/utils/write-mutex.ts`) — serializes concurrent vault writes
- `VaultUtils` (`src/utils/vault-utils.ts`) — vault helper functions

**Canvas File Parsing:**
- `CanvasParser` (`src/graph/canvas-parser.ts`) — parses `.canvas` JSON files into a graph model
- `GraphValidator` (`src/graph/graph-validator.ts`) — validates parsed canvas graphs
- `GraphModel` (`src/graph/graph-model.ts`) — in-memory graph representation

**Internal Canvas API (undocumented):**
- `CanvasLiveEditor` (`src/canvas/canvas-live-editor.ts`) — uses Obsidian's internal `view.canvas.getData()` / `setData()` / `requestSave()` for live canvas editing
- Types declared in `src/types/canvas-internal.d.ts`
- Runtime-probed — falls back to file-based strategy if internal API is unavailable

**Data File Locations (configurable via settings):**

| Data Type | Default Path | Format |
|-----------|-------------|--------|
| Snippets | `.radiprotocol/snippets/` | JSON files |
| Sessions | `.radiprotocol/sessions/` | JSON files |
| Protocol output | `RadiProtocol Output/` or clipboard | Markdown |
| Protocols (source) | Any `.canvas` file in vault | Obsidian Canvas JSON |

**File Storage:**
- Local filesystem only (via Obsidian vault adapter)
- No cloud storage integrations

**Caching:**
- None (reads vault files on demand)

## Authentication & Identity

- Not applicable — local desktop plugin, no auth required

## Monitoring & Observability

**Error Tracking:**
- None — errors shown to user via `Notice` (Obsidian toast notifications)

**Logs:**
- `console.warn()`, `console.error()`, `console.debug()` — allowed by ESLint config
- `console.log()` is banned by ESLint

## CI/CD & Deployment

**Hosting:**
- Distributed as an Obsidian community plugin (desktop only)
- Build artifacts: `main.js`, `styles.css`, `manifest.json`

**CI Pipeline:**
- Not detected (no `.github/workflows/`, no CI config files found)

**Version Management:**
- `version-bump.mjs` script updates `manifest.json` and `versions.json`
- `versions.json` maps plugin version to minimum Obsidian version

## Environment Configuration

**Required env vars:**
- None for production (plugin runs inside Obsidian)

**Optional dev env vars (`.env`):**
- `OBSIDIAN_DEV_VAULT_PATH` — path to Obsidian dev vault for auto-copy during watch builds

## Plugin Manifest (`manifest.json`)

```json
{
  "id": "radiprotocol",
  "name": "RadiProtocol",
  "version": "0.1.0",
  "minAppVersion": "1.5.7",
  "isDesktopOnly": true
}
```

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Workspace Events

The plugin listens to Obsidian workspace events:
- `file-menu` — adds context menu items for canvas files
- `active-leaf-change` — tracks active leaf for editor panel sync
- Various view-level events for UI state management

---

*Integration audit: 2026-04-16*
