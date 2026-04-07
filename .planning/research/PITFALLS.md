# Pitfalls Research: RadiProtocol v1.1

**Domain:** Obsidian community plugin — Canvas-based medical protocol generator
**Researched:** 2026-04-07 (v1.1 milestone)
**Overall confidence:** MEDIUM-HIGH

---

## 1. Live Canvas Editing via Internal API

**Risk: HIGH**

### What can go wrong
- `(view as any).canvas` is undocumented. Obsidian can rename or remove it in any release without notice.
- `canvas.requestSave()` may complete asynchronously. If the plugin modifies `canvas.nodes` and calls `requestSave()` before the canvas view's own dirty-check cycle runs, the canvas view may overwrite the node with stale in-memory data.
- The canvas view keeps its own in-memory node map. Writing directly to the JSON file via `vault.modify()` while the canvas is open **will still cause data loss** (canvas overwrites on next interaction) — the internal API path is the *only* safe route for live editing.
- ESLint `no-explicit-any` rule (enforced by `eslint-plugin-obsidianmd`) will flag `as any` casts. All casts must be isolated in one file (`src/canvas/canvas-live-editor.ts`) behind a typed public interface.

### Prevention
- Isolate all internal API access in `src/canvas/canvas-live-editor.ts` with a typed public interface. Zero `any` casts outside that file.
- Add a runtime guard `isLiveEditSupported(canvas): boolean` that checks for the presence of `canvas.nodes` and `canvas.requestSave` before using them. If unavailable, fall back to the v1.0 Strategy A notice ("close canvas to edit").
- Gate behind an experimental settings toggle initially so users can disable if unstable.
- Debounce `requestSave()` calls — never call it more than once per 500ms.
- Write an integration test that confirms roundtrip: patch node in memory → requestSave → re-read file → assert change persisted.

---

## 2. Full-Tab Runner View

**Risk: LOW**

### What can go wrong
- `getLeaf('tab')` opens a new tab every time if not guarded. Must check `workspace.getLeavesOfType(VIEW_TYPE_RUNNER)` first and reveal existing leaf rather than opening a duplicate.
- If the user has RunnerView open as both a sidebar panel and a tab simultaneously, state can desync. Need to decide: allow both, or enforce single instance.
- `getActiveFile()` returns `null` when the active leaf is a non-markdown view (including RunnerView itself). "Insert into current note" must use `getMostRecentLeaf()` pattern, not `getActiveFile()`.

### Prevention
- `activateRunnerView()` in `main.ts`: check existing leaves first, only create new if none found.
- Document the single-instance assumption in code comments.
- Use `getMostRecentLeaf()` for insert-into-note, not `workspace.getActiveFile()`.

---

## 3. Canvas Selector Dropdown

**Risk: LOW-MEDIUM**

### What can go wrong
- `RunnerView.render()` calls `this.contentEl.empty()` on every state transition (line 141). A selector rendered inside `contentEl` will be destroyed and recreated on every state change, losing focus and scroll position.
- Populating the dropdown with `vault.getFiles()` on every render is wasteful — file list can be large.

### Prevention
- Render the selector in `onOpen()` into a dedicated `headerEl` div that is **outside** the `contentEl` render scope.
- Cache the file list; refresh only on `vault.on('create'/'delete'/'rename')` events (unregistered in `onClose()`).

---

## 4. Community Plugin Submission

**Risk: MEDIUM** (rejection criteria are strict but well-documented)

### Common rejection reasons
- `console.log()` in production code — project ESLint catches this, but verify zero instances before PR.
- `innerHTML` usage — project ESLint catches this.
- `manifest.json` tag must be a plain version number (`1.1.0`), not `v1.1.0` — GitHub release tag must match exactly.
- Missing `isDesktopOnly: true` in `manifest.json` — required because the plugin uses Electron/Node APIs (file system via vault adapter).
- `minAppVersion` must reflect the oldest Obsidian version the plugin actually works on — `getLeaf('tab')` with string literal requires ≥ 1.0.0; confirm no newer API is used.
- Missing `versions.json` in repo root — required, maps plugin version → min Obsidian version.
- README must include: what the plugin does, installation instructions, and a screenshot or GIF.
- Plugin must pass `obsidian-plugin-lint` checks if run by reviewers.

### Prevention
- Run `npm run lint` (no-console, no-innerHTML) before submission PR.
- Audit `manifest.json` fields: `id`, `name`, `version`, `minAppVersion`, `description`, `isDesktopOnly`.
- Create `versions.json` mapping `"1.1.0": "1.5.7"` (or appropriate minAppVersion).
- Include at least one example `.canvas` file in the repo.

---

## 5. Node Templates

**Risk: LOW**

### What can go wrong
- Multi-node template insertion (e.g. question + answer set as a group) requires knowing the canvas coordinate space to avoid overlapping existing nodes. This is only safe via the live Canvas API.
- For v1.1 scope (single-node templates only, canvas closed), the risk is minimal — mirrors existing `SnippetService` pattern exactly.

### Prevention
- Scope v1.1 templates to single-node templates with Strategy A (canvas must be closed to apply).
- Multi-node / sub-graph templates are out of scope for v1.1.

---

## 6. Insert Into Current Note

**Risk: LOW**

### What can go wrong
- When RunnerView is the active leaf (tab mode), `workspace.getActiveFile()` returns `null` — plugin inserts into nothing, silently fails.
- `editor.replaceSelection()` inserts at cursor; if user has no cursor (just opened the note), text lands at position 0.

### Prevention
- Use `workspace.getMostRecentLeaf()` filtered to `MarkdownView` leaves.
- Show a notice if no Markdown note is active: "Open a note first to insert the report."

---

## Summary Table

| Pitfall | Risk | Phase | Prevention |
|---------|------|-------|-----------|
| Canvas internal API breakage | HIGH | Live editing | Runtime guard + fallback + isolated module |
| `requestSave()` race with canvas dirty cycle | HIGH | Live editing | Debounce + integration test |
| `as any` ESLint violations | MEDIUM | Live editing | Isolate in one file |
| Duplicate RunnerView tabs | LOW | Full-tab | Guard with `getLeavesOfType` |
| Selector destroyed on render | MEDIUM | Canvas selector | Render in `onOpen()` header |
| Submission rejection (manifest/console) | MEDIUM | Community | Lint + manifest audit |
| `getActiveFile()` returns null in tab | LOW | Insert-to-note | Use `getMostRecentLeaf()` |
