# Pitfalls Research: RadiProtocol

**Domain:** Obsidian community plugin -- Canvas-based medical protocol generator
**Researched:** 2026-04-05
**Overall confidence:** MEDIUM-HIGH (Canvas API area is LOW due to undocumented internals; Plugin API and graph traversal areas are HIGH)

---

## Canvas API Pitfalls

### CRITICAL: No Official Canvas Runtime API

**What goes wrong:** The Obsidian Plugin API exposes TypeScript type definitions for the `.canvas` JSON format (`CanvasData`, node types, edge types), but provides **no runtime API** for programmatically interacting with an open Canvas view. You cannot officially create nodes, modify edges, listen to canvas events, or register custom node types through a supported API.

**Why it happens:** Canvas was released as a core plugin with a file format (JSON Canvas / `.canvas`), not as an extensible platform. The Obsidian team has not published a Canvas plugin API.

**Consequences:**
- Plugins that need to modify canvas content while it is open must use undocumented internal APIs discovered via `app.workspace.getLeavesOfType('canvas')[0].view.canvas` -- these can break on any Obsidian update without warning.
- The Advanced Canvas plugin (the most prominent Canvas-extending plugin) uses monkey-patching and internal object introspection, which is inherently fragile.

**Prevention for RadiProtocol:**
- **Do NOT modify canvas files while they are open in the Canvas view.** The Canvas view holds its own in-memory state and will overwrite external changes on save. If you `vault.modify()` a `.canvas` file that is currently open, your changes will be lost or cause corruption.
- **Read-only approach:** Parse `.canvas` JSON via `vault.read()` to build the protocol runner's graph model. Never write back to the canvas file during a protocol session.
- If the side panel editor needs to modify canvas content, either: (a) require the canvas to be closed first, or (b) access the undocumented canvas internals with explicit version guards and try/catch, accepting the maintenance burden.
- Pin your `minAppVersion` carefully and test against Obsidian Insider builds before each release.

**Confidence:** HIGH -- multiple forum threads, DeepWiki documentation, and the Advanced Canvas plugin's architecture all confirm this limitation.

**Sources:**
- [Forum: Any details on the Canvas API?](https://forum.obsidian.md/t/any-details-on-the-canvas-api/57120)
- [DeepWiki: Canvas System](https://deepwiki.com/obsidianmd/obsidian-api/4.1-canvas-system)
- [Advanced Canvas plugin](https://github.com/Developer-Mike/obsidian-advanced-canvas)

### Canvas File Overwrites Plugin Changes

**What goes wrong:** If a `.canvas` file is open in Obsidian's Canvas view and a plugin modifies the file on disk via `vault.modify()`, the Canvas view does not detect or merge the changes. When the user next interacts with the canvas (or it auto-saves), the Canvas view writes its stale in-memory state back to disk, silently overwriting the plugin's changes.

**Why it happens:** The Canvas view does not watch for external file modifications the way the Markdown editor does. There is no reload/refresh mechanism for canvas files.

**Prevention:**
- Never programmatically modify a `.canvas` file that might be open. Check if a leaf of type `'canvas'` has the file open before writing.
- If you must write, close the canvas leaf first or prompt the user to close it.

**Confidence:** MEDIUM -- inferred from forum reports about external file modification behavior and the Templater race condition issue.

### Canvas Events Are Incomplete

**What goes wrong:** Canvas does not fire events for many user interactions. Specifically:
- No event when user right-clicks a non-file node or an edge.
- No `MetadataCache` events for `.canvas` file changes (the Advanced Canvas plugin had to add this themselves).
- No event for node selection, creation, or deletion.

**Prevention:** Do not design features that depend on reacting to real-time canvas editing events. Instead, parse the `.canvas` file on-demand (when the user triggers a command) rather than trying to keep a live-synced model.

**Confidence:** HIGH -- confirmed by Advanced Canvas issue tracker and forum discussions.

**Sources:**
- [Forum: Creating an Event for Menus on Canvas Items](https://forum.obsidian.md/t/creating-an-event-for-menus-on-canvas-items/85646)
- [Advanced Canvas: Fire MetadataCache events](https://github.com/Developer-Mike/obsidian-advanced-canvas/issues/156)

### JSON Canvas Format Extensibility -- A Double-Edged Sword

**What goes wrong:** The JSON Canvas spec explicitly supports arbitrary additional keys on nodes and edges for forward compatibility. This means RadiProtocol can store custom data (node type, snippet references, loop markers) directly in the `.canvas` file. However, other plugins or future Obsidian updates could also add keys that collide with yours, or strip unknown keys during format migrations.

**Prevention:**
- Namespace all custom properties with a prefix: e.g., `radiprotocol_nodeType`, `radiprotocol_snippetId`.
- Validate that your custom properties survived a round-trip after Obsidian processes the file.
- Never depend on custom properties being preserved across Obsidian major version upgrades without verification.

**Confidence:** MEDIUM -- the spec explicitly allows extra keys, but no guarantee they are preserved by Obsidian's internal canvas editor across versions.

**Sources:**
- [JSON Canvas specification](https://jsoncanvas.org/)

---

## Obsidian Plugin API Pitfalls

### ItemView State Management Is Poorly Documented

**What goes wrong:** The `setState()` and `getState()` methods on `ItemView` have confusing type signatures and minimal documentation. Developers frequently misunderstand how state serialization works for custom views, leading to views that lose their state on workspace layout restore (when Obsidian restarts or the user switches workspaces).

**Prevention:**
- `getState()` must return a JSON-serializable object. Obsidian stores this in `.obsidian/workspace.json`.
- `setState()` receives this object when the view is restored. Implement both methods and test workspace save/restore explicitly.
- Do not store large data in view state -- only store identifiers (e.g., which canvas file is being run, current node ID, session ID) and load full data from vault files.

**Confidence:** HIGH -- confirmed by forum threads and DeepWiki documentation.

**Sources:**
- [Forum: Confused about setViewState and state management](https://forum.obsidian.md/t/confused-about-the-setviewstate-and-state-management-of-the-itemview-class/66798)
- [Forum: How to correctly open an ItemView](https://forum.obsidian.md/t/how-to-correctly-open-an-itemview/60871)

### Memory Leaks from Event Listeners

**What goes wrong:** Plugins that register event listeners manually (via `app.workspace.on()` or DOM `addEventListener`) without using the framework's `registerEvent()` / `registerDomEvent()` methods will leak listeners when the plugin is disabled or hot-reloaded. Over time this causes degraded performance and zombie behavior.

**Prevention:**
- **Always** use `this.registerEvent()` for Obsidian events, `this.registerDomEvent()` for DOM events, and `this.registerInterval()` for intervals. These auto-cleanup on `onunload()`.
- Use `this.addChild(component)` for child components -- they auto-unload recursively.
- Only implement `onunload()` for cleanup that cannot be handled by the register methods (e.g., removing injected DOM nodes that persist outside your view).
- Never store references to DOM elements that outlive your view's lifecycle.

**Confidence:** HIGH -- this is well-documented in the official API and DeepWiki.

**Sources:**
- [DeepWiki: Plugin Development](https://deepwiki.com/obsidianmd/obsidian-api/3-plugin-development)
- [DeepWiki: Event System](https://deepwiki.com/obsidianmd/obsidian-api/5.1-event-system)

### Settings Persistence: data.json Gotchas

**What goes wrong:**
1. `loadData()` returns `null` (not `{}`) on first install when no `data.json` exists yet. If you destructure without defaults, you get `TypeError`.
2. Users manually edit `data.json` with invalid values. If you do not validate, the plugin crashes on load.
3. When Obsidian Sync or external sync tools update `data.json`, the plugin does not automatically detect the change. You must implement `onExternalSettingsChange()` (available since v1.5.7).
4. `saveData()` is async but developers often forget to `await` it, leading to data loss if Obsidian quits immediately after.

**Prevention:**
- Always merge loaded data with defaults: `this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());`
- Validate types and ranges on every value loaded from `data.json`.
- Implement `onExternalSettingsChange()` to reload settings when the file changes externally.
- Always `await this.saveData()`.

**Confidence:** HIGH.

### Deprecated API: `workspace.activeLeaf`

**What goes wrong:** `workspace.activeLeaf` is deprecated but still appears in many tutorials and sample plugins. Using it may trigger warnings in plugin review and will eventually break.

**Prevention:** Use `workspace.getActiveViewOfType()` or `workspace.getMostRecentLeaf()` instead.

**Confidence:** HIGH -- confirmed in forum and official docs.

**Sources:**
- [Forum: Broken in Obsidian docs: activeLeaf](https://forum.obsidian.md/t/broken-in-obsidian-docs-workspace-activeleaf-property/111539)

---

## Graph Traversal Pitfalls

### Infinite Loops in Cyclic Protocol Graphs

**What goes wrong:** RadiProtocol explicitly supports loop nodes (repeat a section until user exits). A user could accidentally create a cycle without a proper exit condition, or wire edges that create an unintended cycle. Naive traversal will spin forever.

**Prevention:**
- **Distinguish intentional loops from accidental cycles.** Intentional loops should be marked with explicit loop-start/loop-end nodes. Any cycle that does not pass through a loop-end node is an error.
- Implement a visited-set with path tracking during traversal. Use a three-state color system (white = unvisited, gray = in current path, black = fully processed) to detect back-edges that indicate cycles.
- Set a hard maximum iteration count for loops (configurable in settings, default maybe 50). Prompt the user when the limit is hit rather than silently stopping.
- Run a validation pass before starting a protocol session: detect unreachable nodes, dead-end paths (questions with no outgoing edges), and unintentional cycles.

**Confidence:** HIGH -- standard graph algorithm knowledge.

### Disconnected Subgraphs / Unreachable Nodes

**What goes wrong:** Users may have nodes on the canvas that are not connected to the main algorithm flow. If not detected, these are silently ignored, confusing the user who expected those questions to appear.

**Prevention:**
- During validation, compute reachability from the start node. Warn the user about unreachable nodes before running.
- Visually highlight unreachable nodes if possible (via the side panel).

**Confidence:** HIGH.

### Ambiguous Start Node

**What goes wrong:** The `.canvas` format has no concept of a "start" node. The user must designate one, but if they forget (or designate multiple), the protocol runner does not know where to begin.

**Prevention:**
- Require exactly one start node. Use a custom property (e.g., `radiprotocol_nodeType: "start"`) or a naming convention.
- If no start node is found, show a clear error with instructions.
- If multiple start nodes exist, prompt the user to choose or flag it as an error.

**Confidence:** HIGH.

### Mid-Session Save/Resume Serialization

**What goes wrong:** Saving a protocol session mid-run requires serializing: current node, accumulated protocol text, the user's answer history (for step-back), and any loop iteration state. Edge cases include:
1. The canvas file is modified between save and resume (nodes deleted, edges rewired). The saved session references node IDs that no longer exist.
2. Snippets referenced by the session are edited or deleted between save and resume.
3. Loop state is complex -- you need to track which iteration the user was on and which nodes within the loop were already visited in the current iteration.

**Prevention:**
- On resume, validate that all referenced node IDs still exist in the current canvas file. If not, show a clear error: "This protocol has been modified since your session was saved. [Start over] or [Try to continue from nearest valid node]."
- Store snippet content at save time (snapshot), not just snippet IDs. This way, even if the snippet changes, the in-progress session remains consistent.
- For loop state, serialize a stack of loop contexts: `{ loopNodeId, iteration, visitedInIteration: Set<nodeId> }`.
- Store sessions as JSON files in the vault (e.g., `.radiprotocol/sessions/`) so they survive plugin reinstalls.

**Confidence:** MEDIUM -- the general patterns are well-known, but the specific interaction with canvas file modification is RadiProtocol-specific.

---

## UX Pitfalls (Non-Technical Users)

### Visual Clutter Overwhelming Users

**What goes wrong:** Complex protocols with many branches create a dense, hard-to-navigate canvas. Users lose track of the flow, create spaghetti connections, and cannot visually verify their algorithm is correct.

**Prevention:**
- Encourage use of Canvas groups to organize protocol sections.
- Provide a "validate protocol" command that reports issues in a readable list rather than requiring visual inspection.
- Consider a "simplified view" in the side panel that shows the algorithm as a linear outline/tree rather than a 2D graph.

**Confidence:** MEDIUM -- based on general UX research for node-based editors.

**Sources:**
- [DEV: Designing node-based visual programming](https://dev.to/cosmomyzrailgorynych/designing-your-own-node-based-visual-programming-language-2mpg)

### Users Do Not Understand Directed Edges

**What goes wrong:** Non-technical users (radiologists) may not grasp that edge direction matters. They may wire an edge backward (from answer to question instead of question to answer) and not understand why the protocol skips a step or behaves unexpectedly.

**Prevention:**
- During validation, check that edges flow in sensible directions (question nodes should have outgoing edges to answer/next-question nodes, not incoming).
- Use clear arrow heads in the canvas (Obsidian supports directional edges).
- Provide error messages in plain language: "The connection from 'CT Chest' to 'IV Contrast?' goes the wrong way. Connections should flow from questions to their answers."

**Confidence:** MEDIUM -- inferred from general UX research on visual editors for non-programmers.

### Missing or Ambiguous Edge Labels

**What goes wrong:** Edges in the JSON Canvas format support labels, but users may forget to label them. In a protocol, an unlabeled edge from a question to the next step is ambiguous -- which answer does it represent?

**Prevention:**
- Validation should require that all edges from question nodes have labels (the answer text).
- Or, design the node schema so that answer text is in "answer nodes" connected to the question, rather than relying on edge labels. This is more robust and easier for users to understand.

**Confidence:** MEDIUM.

### No Undo for Destructive Protocol Edits

**What goes wrong:** A user accidentally deletes a node or edge in the Canvas editor. Obsidian Canvas has limited undo support. If the user saves and closes, the deleted structure is gone.

**Prevention:**
- This is largely outside plugin control (Canvas undo is an Obsidian core feature).
- Recommend users keep versioned backups (File Recovery core plugin, or git).
- Consider a "protocol export" feature that saves a snapshot of the algorithm before running, as a backup.

**Confidence:** HIGH -- this is a known Canvas limitation.

---

## Dev Workflow Pitfalls

### Hot-Reload Leaves Stale State

**What goes wrong:** The `pjeby/hot-reload` plugin (or similar) disables and re-enables your plugin when files change. If `onunload()` does not fully clean up (DOM nodes, CSS, global state, patched prototypes), the re-enabled plugin runs in a polluted environment. Symptoms: duplicate UI elements, doubled event handlers, broken views.

**Prevention:**
- Use `register*()` methods for everything possible -- they auto-cleanup.
- In `onunload()`, explicitly remove any injected DOM elements (e.g., side panel containers, status bar items created outside the framework).
- Test the disable/enable cycle manually early in development. Open the plugin settings, toggle the plugin off and on, and verify no artifacts remain.
- Place a `.hotreload` file in your plugin's dev directory to enable hot-reload.

**Confidence:** HIGH.

**Sources:**
- [pjeby/hot-reload](https://github.com/pjeby/hot-reload)
- [Obsidian dev workflow docs](https://docs.obsidian.md/Plugins/Getting+started/Development+workflow)

### esbuild Watch Mode + Hot Reload Timing

**What goes wrong:** esbuild's watch mode may trigger a rebuild mid-save, producing a partially-written `main.js`. The hot-reload plugin detects the file change and tries to load the incomplete file, causing a crash or silent failure.

**Prevention:**
- Hot-reload waits ~750ms after the last file change before reloading. This is usually sufficient, but very large builds may exceed this window.
- If you experience intermittent load failures during development, increase the debounce or switch to a manual reload workflow.
- Use esbuild's `onEnd` callback to write a trigger file only after the build completes, rather than relying on `main.js` modification time.

**Confidence:** MEDIUM -- inferred from the hot-reload plugin's design.

### Obsidian Installer vs App Version Mismatch

**What goes wrong:** Obsidian updates the app independently of the installer. Developers may test against one version but users run another. The `minAppVersion` in `manifest.json` is your only guard.

**Prevention:**
- Set `minAppVersion` to the version that introduced the newest API you use.
- Use `requireApiVersion()` for conditional feature support.
- Test against the Obsidian Insider build channel before releases if possible.

**Confidence:** HIGH.

---

## File Storage Pitfalls

### Race Conditions with vault.modify()

**What goes wrong:** If two async operations call `vault.modify()` on the same file concurrently, one write will silently overwrite the other. This is a known issue (documented in the Templater plugin's issue tracker). For RadiProtocol, this could happen if:
- Auto-save fires while the user is also triggering a manual save.
- Multiple snippet files are being written simultaneously.

**Prevention:**
- Implement a write queue/mutex for each file. Never have two concurrent `vault.modify()` calls on the same file.
- Use a simple async lock: `if (this.writing) { this.pendingWrite = data; return; }`.
- For snippet storage, consider one-file-per-snippet rather than a single JSON file containing all snippets. This reduces contention.

**Confidence:** HIGH.

**Sources:**
- [Templater: vault.modify() race condition](https://github.com/SilentVoid13/Templater/issues/1629)

### Encoding and Special Characters in Snippet Content

**What goes wrong:** Medical report text may contain special characters, Unicode (measurement symbols like micro sign, degree symbols), or copy-pasted text from Word/PDFs with smart quotes and em-dashes. If the file I/O does not handle UTF-8 properly, content gets corrupted.

**Prevention:**
- Obsidian's `vault.create()` and `vault.modify()` handle UTF-8 natively. Use them rather than Node.js `fs` directly (which also works but bypasses Obsidian's file tracking).
- Always use Obsidian's Vault API for file operations -- never `require('fs')`. The Vault API ensures the file is tracked by Obsidian's cache and avoids "file modified externally" warnings.
- Test with representative medical text including Unicode characters.

**Confidence:** HIGH.

### Sync Service Conflicts

**What goes wrong:** Users who sync their vault via Obsidian Sync, iCloud, Dropbox, or Git may encounter conflicts when snippet files or session files are modified on multiple devices. Obsidian Sync uses diff-match-patch for Markdown but may not merge JSON files intelligently -- it could produce invalid JSON.

**Prevention:**
- Design snippet files so that each snippet is a separate file (not one giant JSON array). This minimizes merge conflicts.
- If using JSON for session state, accept that sync conflicts may corrupt sessions. Implement validation on load and graceful degradation ("Session file is corrupted. Starting fresh.").
- Document that mid-session saves are local-device-only and should not be relied upon across synced devices.

**Confidence:** MEDIUM -- the sync conflict behavior for arbitrary JSON files is not fully documented.

### Snippet Folder May Not Exist

**What goes wrong:** On first run, or after a user deletes the snippet folder, the plugin crashes trying to read/write snippets to a nonexistent directory.

**Prevention:**
- Check for and create the snippet folder during `onload()` and before every write operation.
- Use `vault.createFolder()` with a try/catch (it throws if the folder already exists in some versions).
- Handle the case where the user has renamed or moved the configured snippet folder.

**Confidence:** HIGH.

---

## Community Plugin Submission Gotchas

### innerHTML Is Forbidden

**What goes wrong:** Using `innerHTML`, `outerHTML`, or `insertAdjacentHTML` in your plugin code will be flagged during review as a security risk. This is a common rejection reason.

**Prevention:**
- Use the DOM API: `document.createElement()`, `element.textContent`, `element.appendChild()`.
- Use Obsidian helpers: `createEl()`, `createDiv()`, `createSpan()`, `setIcon()`.
- If you absolutely must inject HTML (e.g., rendering snippet previews), use `sanitizeHTMLToDom()` from the Obsidian API (backed by DOMPurify).

**Confidence:** HIGH.

### console.log Is Forbidden in Production

**What goes wrong:** Only `console.warn()`, `console.error()`, and `console.debug()` are allowed. `console.log()` statements will be flagged during review.

**Prevention:**
- Remove all `console.log()` before submission.
- Use `console.debug()` for development logging (it can be filtered in DevTools).
- Consider a lightweight logger utility that compiles out in production builds.

**Confidence:** HIGH.

### Command Names Must Not Include Plugin Name

**What goes wrong:** Commands like "RadiProtocol: Run Protocol" will be flagged. Obsidian already shows the plugin name next to the command in the command palette.

**Prevention:**
- Name commands as just "Run protocol", "Validate protocol", etc.

**Confidence:** HIGH.

### UI Text Must Use Sentence Case

**What goes wrong:** "Run Protocol" should be "Run protocol". Title Case in UI text is flagged during review.

**Prevention:**
- Use sentence case everywhere: buttons, settings labels, command names, notices.

**Confidence:** HIGH.

### Must Not Use `require('fs')` or Node.js APIs Directly

**What goes wrong:** Plugins that use Node.js filesystem APIs directly will fail on mobile (even though RadiProtocol is desktop-first for v1). Reviewers flag this because it limits future portability and bypasses Obsidian's file tracking.

**Prevention:**
- Use `app.vault.read()`, `app.vault.modify()`, `app.vault.create()`, `app.vault.adapter.exists()` etc.
- Never import from `'fs'`, `'path'`, `'os'`, or other Node.js built-in modules.

**Confidence:** HIGH.

### License and Repository Requirements

**What goes wrong:** Missing LICENSE file or disabled GitHub Issues will block submission.

**Prevention:**
- Add a LICENSE file (MIT is standard for Obsidian plugins).
- Ensure GitHub Issues are enabled on the repository.

**Confidence:** HIGH.

### Promises Must Be Handled

**What goes wrong:** Unhandled promises (missing `await`, `.catch()`, or `void` operator) are flagged by automated review tooling.

**Prevention:**
- `await` all async calls, or explicitly mark fire-and-forget promises with `void`.
- Enable TypeScript strict mode and the `@typescript-eslint/no-floating-promises` rule.

**Confidence:** HIGH.

### Avoid `any` Types

**What goes wrong:** `any` types are flagged. The review expects proper typing.

**Prevention:**
- Use specific types. Where the Obsidian API returns `any` (e.g., `loadData()`), cast to your expected type immediately.

**Confidence:** HIGH.

---

## Risk Register

| # | Pitfall | Severity | Likelihood | Impact | Mitigation |
|---|---------|----------|------------|--------|------------|
| 1 | No official Canvas runtime API -- forced to use undocumented internals or read-only approach | **CRITICAL** | Certain | Architecture-defining | Design around read-only canvas parsing; do not depend on runtime canvas manipulation |
| 2 | Canvas view overwrites programmatic file changes | **CRITICAL** | High | Silent data loss | Never modify `.canvas` files while open in Canvas view |
| 3 | Infinite loops in user-built cyclic protocols | **HIGH** | High | Hung UI, bad UX | Validation pass before run + max iteration limits |
| 4 | `vault.modify()` race conditions on snippet/session files | **HIGH** | Medium | Data corruption | Write queue/mutex per file; one-file-per-snippet |
| 5 | ItemView state lost on workspace restore | **HIGH** | Medium | Session lost on restart | Implement `getState()`/`setState()` with minimal serializable state |
| 6 | `innerHTML` usage rejected in plugin review | **HIGH** | Medium (easy to slip in) | Submission blocked | Use DOM API and Obsidian helpers exclusively |
| 7 | Memory leaks from unregistered event listeners | **MEDIUM** | Medium | Degraded performance over time | Use `registerEvent()` / `registerDomEvent()` for everything |
| 8 | Users create disconnected/unreachable nodes | **MEDIUM** | High | Confusing protocol behavior | Pre-run validation with clear error messages |
| 9 | Edge direction confusion for non-technical users | **MEDIUM** | High | Broken protocols | Validation + plain-language error messages |
| 10 | Sync conflicts corrupt JSON snippet/session files | **MEDIUM** | Medium | Lost data on synced vaults | One-file-per-snippet; validate JSON on load; graceful degradation |
| 11 | Canvas custom properties stripped by future Obsidian updates | **MEDIUM** | Low-Medium | Algorithm metadata lost | Namespace properties; validate after round-trip; keep backup in separate file |
| 12 | Hot-reload leaves stale DOM/state during development | **LOW** | High during dev | Confusing dev experience | Rigorous `onunload()` cleanup; test toggle cycle early |
| 13 | Snippet folder missing on first run or after deletion | **LOW** | Medium | Plugin crash | Check/create folder before every file operation |
| 14 | `console.log` left in production code | **LOW** | Medium | Review rejection | Lint rule to catch it; use `console.debug()` during dev |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Canvas parsing & graph model | No runtime API; must parse JSON file directly | Build a standalone graph model from parsed JSON; never depend on Canvas view internals |
| Protocol runner UI (ItemView) | State management confusion; memory leaks | Implement getState/setState early; use register methods exclusively |
| Side panel node editor | Temptation to modify canvas while open | Either require canvas closed, or use undocumented APIs with explicit version guards |
| Snippet manager | Race conditions on file writes; folder existence | Write mutex; ensure folder on every operation; one-file-per-snippet |
| Loop support | Infinite loop from user error | Validate before run; hard iteration cap; three-state visited tracking |
| Mid-session save/resume | Stale references after canvas edits | Validate all node IDs on resume; snapshot snippet content at save time |
| Community submission | innerHTML, console.log, any types, command naming | Follow checklist from day one; lint rules to enforce |
