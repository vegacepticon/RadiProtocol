# Domain Pitfalls

**Domain:** Obsidian community plugin — Canvas-driven protocol runner (v1.3 Node Editor Overhaul & Snippet Node)
**Researched:** 2026-04-10
**Scope:** Pitfalls specific to adding auto-save debounce, snippet node, drag-and-drop placeholder editor, canvas color coding, auto-tab-switch, and free-text-input removal to an existing Obsidian plugin. Supersedes generic v1.0 pitfalls where more specific findings apply.

---

## Critical Pitfalls

Mistakes that cause data corruption, hard-to-reproduce bugs, or require rewrites.

---

### Pitfall 1: Auto-save debounce callback reads `this.currentNodeId` at fire time, not at schedule time

**What goes wrong:** When the user clicks a new canvas node, `handleNodeClick` calls `loadNode`, which immediately sets `this.currentFilePath` and `this.currentNodeId` to the new node before the async `renderNodeForm` completes. If an auto-save debounce timer from the previous node fires after `loadNode` has updated those fields but before the new form has loaded, `saveNodeEdits` will execute with the new node's identity but with pending edits that belong to the old node. The wrong fields are silently written to the wrong node.

**Why it happens:** `loadNode` in `editor-panel-view.ts` updates `this.currentFilePath = canvasFilePath` and `this.currentNodeId = nodeId` synchronously and immediately, before the async read has finished. A debounce closure that reads `this.currentNodeId` at fire time reads the new node's ID, not the one being edited when the timer was scheduled.

**Code location:** `editor-panel-view.ts` — `loadNode` (line 124-129), `saveNodeEdits` (line 131-212). The auto-save replacement of the Save button will add a `scheduleAutoSave()` method that must not reference `this.currentNodeId` inside the timeout callback.

**Consequences:** Silent data corruption — fields from node A written onto node B. `requestSave()` persists this to disk immediately. Hard to reproduce because it is timing-dependent (user must switch nodes within the debounce window).

**Prevention:** The debounce callback must capture `filePath` and `nodeId` in a closure at the moment the edit is staged. Pattern:

```typescript
private scheduleAutoSave(filePath: string, nodeId: string, edits: Record<string, unknown>): void {
  // Capture identity and snapshot at schedule time — never read this.currentNodeId inside the timer
  const savedFilePath = filePath;
  const savedNodeId = nodeId;
  const editSnapshot = { ...edits };
  const existing = this.autoSaveTimer;
  if (existing !== undefined) clearTimeout(existing);
  this.autoSaveTimer = setTimeout(() => {
    this.autoSaveTimer = undefined;
    void this.saveNodeEdits(savedFilePath, savedNodeId, editSnapshot);
  }, AUTOSAVE_DEBOUNCE_MS);
}
```

Call `scheduleAutoSave(this.currentFilePath, this.currentNodeId, { ...this.pendingEdits })` from each `onChange` handler — pass the values as arguments, not as closed-over `this` references.

**Detection:** Fields from node A appearing on node B after rapidly switching between nodes in under 1 second.

**Phase:** The phase introducing auto-save debounce (removes Save button). Must be the first design decision in that phase, before any other work.

---

### Pitfall 2: Pending debounce timer must be cancelled on node switch, not just left to fire

**What goes wrong:** When the dirty guard is removed (v1.3), switching nodes no longer prevents an in-flight save from completing. If `loadNode` does not cancel the existing debounce timer before resetting `pendingEdits = {}`, the timer fires with the snapshot captured at schedule time (Pitfall 1 fixed) — which is correct behavior. However, if the debounce window is generous (e.g., 800ms) and the user switches nodes mid-window, the old node receives a save. That is intentional and correct — but `pendingEdits` will already be empty. The snapshot approach from Pitfall 1 handles this correctly. The failure mode is if a developer cancels the timer without saving, silently discarding the last edit to the old node.

**Why it happens:** Confusion about whether the timer should fire-and-save or be cancelled on node switch. Without the dirty guard, the user has no explicit "save before switching" step — auto-save is the only save path.

**Prevention:** On node switch, **let the timer fire** for the old node (do not cancel it). The snapshot captured at schedule time will save the old node's edits correctly. Only cancel the timer if the view is being destroyed (`onClose`). Make this policy explicit in a code comment.

**Phase:** Same as Pitfall 1.

---

### Pitfall 3: `vault.modify` blocked by a pending `requestSave` debounce on the same canvas file

**What goes wrong:** A confirmed Obsidian bug (forum-reported, 2024): when `canvas.requestSave()` has been called and its debounce is pending, `vault.modify()` on the same `.canvas` file either fails silently or is overwritten when the debounced flush completes. The 500ms debounce in `CanvasLiveEditor.debouncedRequestSave` means there is a 500ms window after every live save where Strategy A (vault.modify fallback) will not work correctly.

**Code location:** `canvas-live-editor.ts` — `debouncedRequestSave` (line 136-144). The window is 500ms.

**Why it matters for v1.3:** Color coding writes `color` via the live path (`setData` + `requestSave`). If the live path fails partway and falls to Strategy A, the `vault.modify` call lands inside the debounce window. Additionally, the snippet node's file picker uses `vault.read` (read-only) — this is safe. But if any v1.3 feature introduces a fallback `vault.modify` after a live save, this race applies.

**Prevention:**
- When `saveLive` returns `true`, never follow with `vault.modify` on the same file in the same code path.
- If Strategy A is the primary path (canvas closed), the live editor has no pending timer for that file — verify this is true by only entering Strategy A when `isLiveAvailable` returns false. When the canvas is closed there is no `requestSave` pending.
- For color coding: if `isLiveAvailable` is false, skip the color write entirely. Do not attempt Strategy A for color coding (writing colors to a closed canvas is not urgent and risks this race).

**Phase:** Color coding phase; any phase that mixes the live and vault write paths.

---

### Pitfall 4: Writing `color` field overwrites user-set node colors with no recovery path

**What goes wrong:** The canvas `color` field is a single string value that accepts either palette indices `"1"`–`"6"` or hex `"#RRGGBB"`. RadiProtocol cannot distinguish between a color the user set intentionally via the Obsidian canvas color picker and one that was written by a previous RadiProtocol save. When the plugin writes a type color (e.g., `"2"` for question nodes) via `setData`, it replaces whatever the user had set.

**Current protection:** `PROTECTED_FIELDS` in `canvas-live-editor.ts` (line 14) includes `'color'`, which currently blocks all color writes via `saveLive`. Removing `'color'` from `PROTECTED_FIELDS` for type color coding removes this protection.

**Why it matters:** Radiologists may use canvas node colors for their own organizational purposes (e.g., red = needs review, green = approved). RadiProtocol overwriting these silently on every node edit is a significant UX regression that may cause the plugin to be rejected or uninstalled.

**Prevention (design decision required before implementation):**

Option A — Ownership flag (recommended): Introduce `radiprotocol_colorManaged: true` on nodes where RadiProtocol has set the color. On each type-color write, check: if `node.color` is present AND `node.radiprotocol_colorManaged` is not `true`, skip the color write (user owns it). Only write `color` when the node has no color, or when `radiprotocol_colorManaged` is already true from a previous RadiProtocol write.

Option B — Only write when absent: Only set `color` if `node.color` is undefined. Never overwrite. Simpler but means nodes whose color was set by the user before RadiProtocol color coding existed are never re-colored by the plugin.

Option C — Settings toggle: Provide a plugin setting "Apply node type colors" defaulting to off. Let the user explicitly opt in to type-color coding, accepting that it will overwrite their colors.

**The rollback in `saveLive` is not the issue:** The existing rollback (`setData(originalData)` on error) correctly restores `color` if `setData` throws. The pitfall is in the intentional write succeeding when it should not.

**Phase:** Color coding phase. The ownership flag schema must be documented in `ARCHITECTURE.md` before implementation.

---

### Pitfall 5: Removing `free-text-input` from `RPNodeKind` silently breaks existing canvas files and sessions

**What goes wrong:** Existing `.canvas` files in user vaults contain nodes with `radiprotocol_nodeType: "free-text-input"`. When v1.3 removes this from `RPNodeKind`, the canvas parser's switch statement will not recognize these nodes. They will be treated as plain canvas nodes and silently skipped — disappearing from the protocol graph without any warning.

Existing session files (`.radiprotocol/sessions/*.json`) with `runnerStatus: "at-node"` and `currentNodeId` pointing to a free-text-input node will fail to resume: `currentNodeId` will not exist in the new parsed graph, causing an error state.

**Code locations:**
- `graph-model.ts` line 4-11: `RPNodeKind` union definition
- `editor-panel-view.ts` line 267-268: `free-text-input` dropdown option
- `session-model.ts` line 47: `runnerStatus: 'at-node' | 'awaiting-snippet-fill'` — does not encode node kind, but `currentNodeId` will point to a nonexistent node

**Consequences:** No data loss in the raw `.canvas` file, but RadiProtocol's view of the canvas silently omits those nodes. Dangling edges. Protocol graphs that were valid before v1.3 become structurally invalid after upgrade. Users lose work.

**Prevention (must implement before removal):**
1. Keep a `case 'free-text-input':` branch in the parser that maps it to a `text-block` node (migration) or emits a `ParseWarning` to be shown in the validation panel.
2. The session resume path must check `graph.nodes.has(currentNodeId)` before attempting resume. If not found: show "This session references a node type that was removed in v1.3. Session cannot be resumed. Starting from the beginning."
3. Keep `free-text-input` in the Node Editor dropdown as a read-only `[legacy] free-text-input` option that shows a migration message.
4. Write a one-time migration note in a manifest or plugin-data field so the user is informed on first load after upgrade.

**Phase:** Node type removal phase. Implement migration before removal. UAT must include an existing canvas with free-text-input nodes and an existing session referencing one.

---

## Moderate Pitfalls

---

### Pitfall 6: Drag-and-drop chip editor creates orphaned event listeners on rebuild

**What goes wrong:** The interactive placeholder chip editor will attach `dragstart`, `dragover`, `drop`, and `dragend` event listeners to individual chip `<div>` elements. When the chip list is rebuilt (placeholder added, removed, or reordered), the old chip DOM nodes are removed via `container.empty()`. Obsidian's `HTMLElement.empty()` detaches nodes from the DOM tree but does not call `removeEventListener` on them. If the listener closures reference outer scope variables (chip array, template state), those chip elements are retained in memory because the GC sees live references.

**Why it happens for plain DOM:** Obsidian's `registerDomEvent` is tracked on the `Component` (the `ItemView`) and auto-removes on `onClose`. However, `registerDomEvent` is only useful for elements that exist for the full lifetime of the component. Chip elements are dynamically created and destroyed — `registerDomEvent` does not help here because the chips are gone before `onClose`.

**Practical risk level:** LOW per individual session (chips are small), but accumulates across many add/remove cycles over a long editing session.

**Prevention (event delegation pattern — preferred):**

Attach one `dragstart`, `dragover`, `drop`, `dragend` listener to the stable chip container element (registered via `registerDomEvent` for the view's lifetime). Inside each handler, read `event.target.closest('[data-placeholder-id]')` to identify which chip is involved. The container element is never removed, so no orphan listeners.

```typescript
this.registerDomEvent(chipContainer, 'dragstart', (e: DragEvent) => {
  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-placeholder-id]');
  if (!chip) return;
  this.draggedId = chip.dataset.placeholderId ?? null;
  e.dataTransfer?.setData('text/plain', this.draggedId ?? '');
});
```

**Alternative (explicit cleanup):** If per-chip listeners are unavoidable, maintain `chipListeners: Array<{ el: HTMLElement; type: string; handler: EventListener }>`, call `removeEventListener` on each before rebuilding, then clear the array.

**Phase:** Interactive placeholder editor phase.

---

### Pitfall 7: `workspace.revealLeaf` timing in a `click` handler loses canvas node selection

**What goes wrong:** The auto-switch-to-Node-Editor feature must call `revealLeaf` on the editor panel leaf when a canvas node is clicked. The existing `attachCanvasListener` handler in `editor-panel-view.ts` (line 76-87) fires on `'click'` on the canvas container. Obsidian updates `canvas.selection` after the pointer event, not synchronously — this is already documented in `canvas-internal.d.ts`. Calling `revealLeaf` synchronously in this same handler will focus the sidebar leaf, which may move focus away from the canvas before Obsidian has registered the node selection, causing the selection to read as empty.

**Code location:** `editor-panel-view.ts` — `attachCanvasListener` and `canvasPointerdownHandler` (line 76-95).

**Prevention:** The `canvasPointerdownHandler` in the existing code already fires on `'click'` (not `'pointerdown'`), which means it fires after the selection is updated. The `revealLeaf` call should be deferred with `setTimeout(0)` regardless, to ensure focus handling does not race with Obsidian's internal canvas event processing:

```typescript
this.canvasPointerdownHandler = () => {
  setTimeout(() => {
    const selection = canvasView.canvas?.selection;
    // ... read selection, then:
    void this.handleNodeClick(filePath, node.id);
    // revealLeaf is called inside activateEditorPanelView, which is also fine with setTimeout deferral
  }, 0);
};
```

**Deprecation note:** `workspace.activeLeaf` is confirmed deprecated in the Obsidian API (flagged in automated community plugin review PRs, 2025-2026). The existing code does not use `activeLeaf` — it uses `getMostRecentLeaf()` (line 52 of `editor-panel-view.ts`). Keep it that way. Do not add any new `activeLeaf` reads in v1.3.

**Phase:** Auto-tab-switch phase.

---

### Pitfall 8: `getData`/`setData` internal API removal — color coding hard-depends on live path

**What goes wrong:** `CanvasLiveEditor` already has a robust probe-and-fallback pattern for all existing features: if `getData` is missing, `saveLive` returns `false` and callers fall through to Strategy A. The new risk for v1.3 is that color coding and live metadata writes treat the live path as "nice to have" but require special handling: Strategy A (vault.modify while canvas is closed) for color coding is unappealing UX — the user would need to close and reopen the canvas to see type colors.

**Why this is not a rejection risk:** The Obsidian community review team does not prohibit undocumented internal APIs. Multiple approved plugins (`obsidian-advanced-canvas`, `obsidian-link-nodes-in-canvas`, `enchanted-canvas`) use the same `getData`/`setData` pair. The risk is post-approval breakage on Obsidian updates.

**Prevention:**
- For color coding specifically: if `isLiveAvailable(filePath)` returns false, skip the color write entirely. Show a one-time Notice: "Type colors require the canvas to be open." Do not attempt a closed-canvas color write.
- Pin the probe pattern (`typeof view.canvas?.getData !== 'function'`) as the single detection point. Never assume the API is present.

**Phase:** Color coding phase.

---

### Pitfall 9: Snippet node `file` field must use vault-relative paths and `vault.read(TFile)`, not `fs`

**What goes wrong:** The snippet node's file picker presents `.md` files from a configured folder. If the implementation reads those files via Node.js `require('fs')` or `app.vault.adapter.read` with a raw filesystem path, it will: (a) fail on Obsidian mobile, (b) bypass vault file tracking, (c) be flagged in community review. The community review automated tooling specifically flags `require('fs')` and `app.vault.adapter` filesystem access with raw paths.

**Existing pattern to follow:** `SnippetService` (throughout) uses `vault.read(file as TFile)` where `file` is obtained via `vault.getAbstractFileByPath(vaultRelativePath)`. The snippet node file picker must follow the same pattern exactly.

**Prevention:**
```typescript
const file = this.plugin.app.vault.getAbstractFileByPath(snippetFilePath);
if (!(file instanceof TFile)) { /* show error */ return; }
const content = await this.plugin.app.vault.read(file);
```

Never use `app.vault.adapter.read()` with user-supplied path strings. Always validate the path returns a `TFile` before reading.

**Phase:** Snippet node phase. The file read implementation must be in the phase plan before writing any code.

---

### Pitfall 10: Adding `'snippet'` to `RPNodeKind` — all `switch (kind)` exhaustive cases need updating

**What goes wrong:** `RPNodeKind` is a discriminated union. TypeScript enforces exhaustive switch coverage when `noImplicitReturns` and `strict` are enabled. Adding `'snippet'` will produce compile errors in every switch that does not handle the new case. Missed switches that use `default: throw` or equivalent will throw at runtime when a snippet node is encountered.

**Files at risk (by pattern from existing code):**
- `graph-model.ts` — add `SnippetNode` interface and add to `RPNode` union
- `canvas-parser.ts` — add `case 'snippet':` in the node-kind switch
- `editor-panel-view.ts` — add `case 'snippet':` in `buildKindForm` (line 316+)
- `protocol-runner.ts` — add `case 'snippet':` in the node-processing switch
- `graph-validator.ts` — add validation rules for snippet nodes
- Any test files that enumerate node kinds

**Prevention:** After adding `'snippet'` to the union, run `npx tsc --noEmit` immediately. Fix every compile error before writing any feature logic. Do this as the very first step in the snippet node phase.

**Phase:** Snippet node phase — first task.

---

### Pitfall 11: Auto-save save callback must not reference DOM elements removed by form rebuild

**What goes wrong:** The auto-save callback is async (it calls `saveLive` which awaits). During the await, the user may switch nodes, triggering `contentEl.empty()` which destroys the current form's DOM. If the save callback holds a reference to a DOM element to display a "Saved" indicator after the await resolves, accessing that removed element either throws (if the element is no longer in the document) or silently does nothing (the update is invisible).

**Prevention:** The save callback must check `this.currentNodeId === savedNodeId` after the await before touching any DOM. If the node has changed, suppress all DOM updates. The saved indicator (if any) should be queried freshly from `this.contentEl` rather than captured in a closure before the await.

**Phase:** Auto-save phase.

---

## Minor Pitfalls

---

### Pitfall 12: `text-block` with `radiprotocol_snippetId` on existing nodes confuses the runner after v1.3

**What goes wrong:** v1.3 makes text-block plain text only (removes snippet insertion logic). But existing `.canvas` files may have text-block nodes with `radiprotocol_snippetId` populated. If the runner still reads `snippetId` from parsed `TextBlockNode`, it will enter `awaiting-snippet-fill` state for nodes that the user has configured as "plain text only" in v1.3.

**Prevention:**
- Remove `snippetId` from the `TextBlockNode` interface in `graph-model.ts`. The parser will then ignore this field when parsing text-block nodes.
- Optionally, in the Node Editor text-block form, if `nodeRecord['radiprotocol_snippetId']` is present, show a warning: "This node has a snippet ID from a previous version. It will not be used. Save to remove it." and include a button that writes `radiprotocol_snippetId: undefined` via auto-save.

**Phase:** text-block simplification phase.

---

### Pitfall 13: Drag-and-drop chip `dragover` fires continuously — do not do expensive work inside it

**What goes wrong:** The `dragover` event fires every few hundred milliseconds while a chip is being dragged over a valid drop target. If the `dragover` handler does any re-rendering, DOM queries, or state mutation (not just `preventDefault()`), it will produce visible lag and janky animation.

**Prevention:** The `dragover` handler must only call `event.preventDefault()` and (optionally) set `event.dataTransfer.dropEffect`. All reorder logic belongs in the `drop` handler, which fires once. Visual "drop zone" highlighting can be done via a CSS class toggle in `dragenter`/`dragleave`, not in `dragover`.

**Phase:** Interactive placeholder editor phase.

---

### Pitfall 14: `canvas:node-menu` undocumented event — low rejection risk, document the usage

**What goes wrong:** The `canvas:node-menu` workspace event (used in `main.ts` line 87) is undocumented. Community review may request a comment explaining why it is used and confirming community precedent. This is not a rejection risk — multiple approved plugins use it — but may add a round of review feedback.

**What the existing code does correctly:** Uses `unknown` cast and a minimal typed interface. The comment at line 82-84 already explains the rationale. Keep this comment through v1.3; do not remove it.

**Phase:** Pre-submission review sweep (post-v1.3).

---

### Pitfall 15: Snippet folder global setting + per-node override — settings migration on upgrade

**What goes wrong:** If the v1.3 settings schema adds a `snippetFolderPath` field (global setting) and the per-node override is stored in the canvas file (`radiprotocol_snippetFolder`), users upgrading from v1.2 will have no `snippetFolderPath` in their `data.json`. The `Object.assign({}, DEFAULT_SETTINGS, await this.loadData())` pattern in `main.ts` (line 25) handles this correctly by falling back to `DEFAULT_SETTINGS` for missing keys — so this is low risk if the default is sensible (e.g., the existing snippet folder path).

**Prevention:** Set `DEFAULT_SETTINGS.snippetFolderPath` to match the existing snippet storage path (`.radiprotocol/snippets`) so users upgrading get the same behavior with no action required. Do not introduce a required migration step.

**Phase:** Settings phase for snippet folder configuration.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Auto-save debounce (remove Save button) | Pitfall 1: wrong node saved; Pitfall 2: timer cancel policy; Pitfall 11: DOM reference after node switch | Snapshot node ID + edits at schedule time; let timer fire on switch; check node identity after async save |
| Canvas node color coding | Pitfall 4: overwrites user colors; Pitfall 3: vault.modify conflict; Pitfall 8: live path required | Ownership flag pattern; only write when live path available; degrade gracefully |
| Remove free-text-input node type | Pitfall 5: existing sessions and canvases broken | Keep parser case as migration; add session resume guard; UAT with legacy canvas |
| Snippet node (new type) | Pitfall 10: exhaustive switch gaps; Pitfall 9: unsafe file read | Compile check immediately after adding to union; use `vault.read(TFile)` |
| text-block plain-text only | Pitfall 12: stale `snippetId` on existing nodes | Remove field from `TextBlockNode`; show legacy-field warning in Node Editor |
| Auto-tab-switch to Node Editor | Pitfall 7: revealLeaf timing race | Defer with `setTimeout(0)` inside click handler |
| Interactive placeholder editor | Pitfall 6: event listener leak on chip rebuild; Pitfall 13: dragover performance | Event delegation on container; only `preventDefault` in dragover |
| Snippet folder setting | Pitfall 15: settings migration | DEFAULT_SETTINGS fallback to existing path |
| Community submission | Pitfall 14: undocumented canvas:node-menu; `require('fs')`; `activeLeaf` | Existing comment sufficient; use vault API only; no activeLeaf reads |

---

## Carry-Forward: Pitfalls from v1.0 Research That Remain Relevant

The following pitfalls from the original research remain valid for v1.3 and are not superseded:

- **Canvas view overwrites plugin changes** — still relevant; CanvasLiveEditor's live path avoids this by using `setData` rather than `vault.modify` while the canvas is open.
- **`vault.modify()` race conditions** — still relevant; `WriteMutex` covers snippet/session writes. Color coding via live path does not go through `vault.modify`, so no new WriteMutex surface is added.
- **`innerHTML` forbidden in community review** — still enforced. No new innerHTML usage should be introduced in v1.3 (chip labels, file picker results must use `createEl`/`textContent`).
- **`require('fs')` forbidden** — see Pitfall 9 above.
- **Unhandled promises** — existing ESLint rules (`@typescript-eslint/no-floating-promises`) already enforce this.

---

## Sources

- Code review (this repository): `src/canvas/canvas-live-editor.ts`, `src/views/editor-panel-view.ts`, `src/graph/graph-model.ts`, `src/runner/runner-state.ts`, `src/sessions/session-model.ts`, `src/types/canvas-internal.d.ts`, `src/main.ts`
- Obsidian Forum: [`vault.process` and `vault.modify` don't work when there is a `requestSave` debounce event](https://forum.obsidian.md/t/vault-process-and-vault-modify-dont-work-when-there-is-a-requestsave-debounce-event/107862) — confirmed race condition between `vault.modify` and pending canvas `requestSave` debounce (MEDIUM confidence — forum report, not official docs)
- Obsidian Forum: [Are devs allowed to publish plugins that use private APIs?](https://forum.obsidian.md/t/are-devs-allowed-to-publish-plugins-that-use-private-apis/73574) — private APIs tolerated; main risk is instability not rejection (MEDIUM confidence)
- Obsidian API CHANGELOG: `revealLeaf` bug fixed in v1.5.11; not deprecated as of April 2026 (HIGH confidence — official changelog at `github.com/obsidianmd/obsidian-api/blob/master/CHANGELOG.md`)
- `workspace.activeLeaf` deprecation: confirmed deprecated; `getActiveViewOfType` is the replacement; flagged in automated community plugin review PRs (HIGH confidence — multiple 2025-2026 review PRs in `obsidianmd/obsidian-releases`)
- Canvas color field format: dual-format `"1"`–`"6"` palette indices or `"#RRGGBB"` hex; optional on all node types (HIGH confidence — official `canvas.d.ts` at `github.com/obsidianmd/obsidian-api`)
- Canvas color system (DeepWiki): palette colors adapt to light/dark theme; hex is fixed (HIGH confidence — DeepWiki synthesis of official API)
- MDN Web Docs: HTML5 drag-and-drop event lifecycle — `dragover` fires continuously; `drop` fires once; `dragend` is the cleanup event (HIGH confidence — official MDN)
- Obsidian Event System (DeepWiki): `registerDomEvent` auto-removes on Component unload; does not remove listeners on dynamically destroyed child elements (MEDIUM confidence — DeepWiki synthesis)
