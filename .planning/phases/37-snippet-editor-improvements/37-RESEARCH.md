# Phase 37: Snippet Editor Improvements - Research

**Researched:** 2026-04-16
**Domain:** Obsidian plugin UI — snippet tree header controls, canvas reference sync
**Confidence:** HIGH

## Summary

Phase 37 addresses two requirements: CLEAN-03 (create folder button in snippet editor header) and SYNC-01 (directory rename updates canvas SnippetNode references). The critical finding is that SYNC-01 is **already fully implemented** in Phase 34 Plan 03 — the `commitInlineRename` method in `snippet-manager-view.ts` already calls `rewriteCanvasRefs` with the correct old-to-new mapping when a folder is renamed, and also rewrites the expand-state prefixes. The only net-new code is CLEAN-03: adding a "Create folder" button to the snippet editor header bar.

CLEAN-03 is a small UI addition. The `handleCreateSubfolder` method already exists and handles the full flow (prompt via ConfirmModal, validation, `snippetService.createFolder()`, expand-state update, tree redraw). It is currently wired only to the folder context menu's "Создать подпапку" item. The header button needs to call the same method with the snippet root path as the parent.

**Primary recommendation:** Add a single "Новая папка" button to the header bar in `onOpen()`, styled consistently with the existing "Новый" button, wiring it to `handleCreateSubfolder(this.plugin.settings.snippetFolderPath)`. For SYNC-01, write a verification test confirming the existing rename-to-canvas-sync pipeline works end-to-end.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Create folder button in header | Frontend (Plugin UI) | -- | DOM button creation in ItemView.onOpen() |
| Folder creation logic | Frontend (Plugin UI) | Storage (Vault) | SnippetService.createFolder calls vault.adapter |
| Canvas ref sync on rename | Frontend (Plugin UI) | Storage (Vault) | rewriteCanvasRefs reads/writes .canvas files via vault API |

## Project Constraints (from CLAUDE.md)

- CSS files: append-only per phase, edit only the relevant feature file in `src/styles/`
- Never remove existing code you didn't add from shared files
- After any CSS change, run `npm run build` to regenerate `styles.css`
- No `innerHTML` — use DOM API and Obsidian helpers
- No `require('fs')` — use `app.vault.*` exclusively
- `console.log` forbidden in production

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLEAN-03 | User can create a new folder via a button next to the "Create snippet" button in snippet editor | `handleCreateSubfolder` method already exists (line 497); header bar built in `onOpen()` (line 109); just need to add a second button |
| SYNC-01 | When a directory is renamed in snippet editor, all canvas SnippetNode `subfolderPath` references update to the new directory name | **Already implemented** in Phase 34 Plan 03: `commitInlineRename` (line 910) calls `rewriteCanvasRefs` for folder renames. Existing tests in `snippet-tree-inline-rename.test.ts` verify this. Phase 37 should add an integration-level verification test. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | (bundled) | Plugin API — Modal, ItemView, Notice, setIcon, vault | [VERIFIED: project package.json] Only API available for Obsidian plugins |
| vitest | 4.1.2 | Unit testing | [VERIFIED: npm test output] Already configured in project |

No new dependencies needed for this phase.

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Новая папка" button in header
  |
  v
handleCreateSubfolder(snippetRoot)
  |
  v
ConfirmModal (prompt for folder name)
  |
  v (on confirm)
SnippetService.createFolder(snippetRoot + '/' + name)
  |
  v
vault.adapter → creates folder on disk
  |
  v
Expand-state updated in settings
  |
  v
rebuildTreeModel() + renderTree() → folder appears in tree
```

For SYNC-01 (already implemented):
```
User renames folder via inline rename (F2 or context menu)
  |
  v
commitInlineRename() → snippetService.renameFolder()
  |
  v
rewriteCanvasRefs(app, {oldKey → newKey})
  |
  v
For each .canvas file:
  read → parse → check snippet nodes → rewrite subfolderPath → write back
  |
  v
Expand-state prefix rewrite in settings
  |
  v
Notice: "Папка переименована. Обновлено канвасов: N"
```

### Pattern 1: Header Button Addition
**What:** Add a button to the existing header strip in `onOpen()`
**When to use:** When adding a new top-level action to the snippet manager
**Example:**
```typescript
// Source: existing "Новый" button pattern at line 110-116 of snippet-manager-view.ts
const folderBtn = header.createEl('button', { cls: 'radi-snippet-tree-new-btn' });
const folderIcon = folderBtn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
setIcon(folderIcon, 'folder-plus');
folderBtn.createSpan({ text: 'Папка' });
this.registerDomEvent(folderBtn, 'click', () => {
  void this.handleCreateSubfolder(this.plugin.settings.snippetFolderPath);
});
```
[VERIFIED: snippet-manager-view.ts lines 109-116]

### Pattern 2: handleCreateSubfolder Reuse
**What:** The `handleCreateSubfolder` method (line 497) already handles the full create-folder flow
**When to use:** Both context menu and header button should delegate to the same method
**Example:** Pass `this.plugin.settings.snippetFolderPath` as `parentPath` for root-level folder creation.
[VERIFIED: snippet-manager-view.ts lines 497-541]

### Anti-Patterns to Avoid
- **Duplicating folder creation logic:** Do NOT copy the ConfirmModal + validation + createFolder logic into a new method. Reuse `handleCreateSubfolder` directly.
- **Modifying existing header button styling:** The existing "Новый" button is `mod-cta` (primary). The new folder button should NOT also be `mod-cta` — use a secondary style to maintain visual hierarchy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folder creation prompt | Custom input dialog | Existing `handleCreateSubfolder` with `ConfirmModal` | Already validates name, handles errors, updates expand-state |
| Canvas ref sync | New sync mechanism | Existing `rewriteCanvasRefs` | Battle-tested in Phase 34 with prefix matching, mutex, error handling |
| Tree refresh | Manual DOM manipulation | Existing `rebuildTreeModel()` + `renderTree()` | Vault watchers also trigger debounced redraw on 'create' events |

## Common Pitfalls

### Pitfall 1: Double Button Styling
**What goes wrong:** Both header buttons have `mod-cta` class, creating two equally prominent primary buttons
**Why it happens:** Copying the existing button pattern verbatim
**How to avoid:** Use plain button styling (no `mod-cta`) for the folder button; keep `mod-cta` only on the "Новый" snippet button
**Warning signs:** Two blue/accent buttons side by side in the header

### Pitfall 2: Forgetting Root Path Expansion
**What goes wrong:** New root-level folder is created but the tree root isn't expanded, so it's not visible
**Why it happens:** `handleCreateSubfolder` expands the parent path, but if the root path itself isn't in the tree, the folder won't show
**How to avoid:** The existing `handleCreateSubfolder` already handles this — it pushes both parent and child to `snippetTreeExpandedPaths`. Since root-level children are always visible (no expand needed at root level), this is actually a non-issue. But verify during testing.
**Warning signs:** Folder creation succeeds but tree doesn't show it

### Pitfall 3: Removing Existing Code
**What goes wrong:** CLAUDE.md explicitly warns against removing existing code from shared files
**Why it happens:** Agent might "clean up" while editing snippet-manager-view.ts
**How to avoid:** Only add the new button code in `onOpen()`, do not modify any existing methods
**Warning signs:** Test failures in unrelated snippet tree tests

## Code Examples

### Header Button Addition (primary deliverable)
```typescript
// Source: derived from existing pattern at snippet-manager-view.ts:109-116
// Insert after the existing "Новый" button block (line 116) in onOpen():
const folderBtn = header.createEl('button', { cls: 'radi-snippet-tree-new-btn' });
const folderIcon = folderBtn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
setIcon(folderIcon, 'folder-plus');
folderBtn.createSpan({ text: 'Папка' });
this.registerDomEvent(folderBtn, 'click', () => {
  void this.handleCreateSubfolder(this.plugin.settings.snippetFolderPath);
});
```
[VERIFIED: pattern from existing codebase]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Create subfolder only via context menu on folder row | (Phase 37) Also via header button at root level | Phase 37 | Users can create root-level folders without context-menu |
| Canvas refs not synced on rename | Canvas refs auto-synced via rewriteCanvasRefs | Phase 34 | SYNC-01 already satisfied |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The folder button should NOT use `mod-cta` class (secondary styling) | Anti-Patterns | Low — cosmetic only, easily fixed |
| A2 | Button label should be "Папка" (short) rather than "Новая папка" (long) | Code Examples | Low — text is trivially changeable |

## Open Questions

1. **Button label text: "Папка" vs "Новая папка"**
   - What we know: The existing button says "Новый" (short). Header space is limited.
   - What's unclear: Whether "Папка" alone is clear enough, or if "Новая папка" is needed for clarity
   - Recommendation: Use "Папка" for consistency with "Новый" shortness; icon provides additional context

2. **SYNC-01 verification scope**
   - What we know: SYNC-01 is fully implemented in Phase 34. Existing tests in `snippet-tree-inline-rename.test.ts` cover the rename-to-canvas-sync path.
   - What's unclear: Whether the planner should include a dedicated verification task or just reference existing tests
   - Recommendation: Include a lightweight verification task that runs existing tests and confirms SYNC-01 success criteria manually

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | vitest.config.ts (or package.json) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLEAN-03 | Header has "Create folder" button; clicking it opens ConfirmModal with folder name prompt; folder created under snippet root | unit | `npx vitest run src/__tests__/snippet-tree-view.test.ts -t "create folder"` | Partial -- snippet-tree-view.test.ts exists, new test case needed |
| SYNC-01 | Folder rename in tree triggers rewriteCanvasRefs with correct mapping | unit | `npx vitest run src/__tests__/snippet-tree-inline-rename.test.ts` | Yes -- already covers this |

### Sampling Rate
- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] New test case in `snippet-tree-view.test.ts` for CLEAN-03 header folder button
- Existing `snippet-tree-inline-rename.test.ts` already covers SYNC-01 -- no gap

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | Existing validation in `handleCreateSubfolder`: empty check, slash check |
| V6 Cryptography | no | -- |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in folder name | Tampering | `assertInsideRoot` in SnippetService + slash validation in handleCreateSubfolder |

No new security surface -- reusing existing validated code paths.

## Sources

### Primary (HIGH confidence)
- `src/views/snippet-manager-view.ts` — header bar construction, handleCreateSubfolder, commitInlineRename with rewriteCanvasRefs
- `src/snippets/canvas-ref-sync.ts` — rewriteCanvasRefs implementation
- `src/snippets/snippet-service.ts` — createFolder, renameFolder methods
- `src/__tests__/snippet-tree-inline-rename.test.ts` — existing SYNC-01 test coverage
- `src/styles/snippet-manager.css` — existing header and button CSS

### Secondary (MEDIUM confidence)
- None needed -- all research from codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing code
- Architecture: HIGH — pattern is copy of existing button, reuse of existing method
- Pitfalls: HIGH — well-understood from prior phases

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable — no external dependency changes expected)
