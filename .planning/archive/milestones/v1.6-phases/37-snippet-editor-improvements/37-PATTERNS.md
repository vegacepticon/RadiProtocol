# Phase 37: Snippet Editor Improvements - Pattern Map

**Mapped:** 2026-04-16
**Files analyzed:** 3
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/views/snippet-manager-view.ts` (modify) | view | event-driven | self (existing "Новый" button, lines 107-115) | exact |
| `src/styles/snippet-manager.css` (modify) | config | N/A | self (existing `.radi-snippet-tree-new-btn`, line 208) | exact |
| `src/__tests__/snippet-tree-view.test.ts` (modify) | test | N/A | self (FOLDER-01 test, lines 384-412) | exact |

## Pattern Assignments

### `src/views/snippet-manager-view.ts` — Add "Create folder" header button (modify, view, event-driven)

**Analog:** Same file, existing "Новый" button block

**Header button pattern** (lines 107-115):
```typescript
// Header strip with global "+ Новый" button
const header = contentEl.createDiv({ cls: 'radi-snippet-tree-header' });
const newBtn = header.createEl('button', { cls: 'mod-cta radi-snippet-tree-new-btn' });
const newIcon = newBtn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
setIcon(newIcon, 'plus');
newBtn.createSpan({ text: 'Новый' });
this.registerDomEvent(newBtn, 'click', () => {
  void this.openCreateModal(this.plugin.settings.snippetFolderPath);
});
```

**New button should follow the same pattern but:**
- Use `'radi-snippet-tree-new-btn'` class (no `mod-cta` — secondary styling)
- Use `'folder-plus'` icon
- Wire to `this.handleCreateSubfolder(this.plugin.settings.snippetFolderPath)`
- Insert immediately after the existing button block (after line 115, before tree container creation at line 118)

**handleCreateSubfolder reuse** (lines 497-541):
```typescript
private async handleCreateSubfolder(parentPath: string): Promise<void> {
  // Build a small form body with a text input for the subfolder name.
  const body = document.createElement('div');
  body.addClass('radi-snippet-subfolder-form');
  const label = body.createEl('label', { text: 'Имя подпапки' });
  const input = body.createEl('input', { type: 'text' });
  input.placeholder = 'например: обследования';
  label.appendChild(input);

  const modal = new ConfirmModal(this.app, {
    title: 'Создать подпапку',
    body,
    confirmLabel: 'Создать',
    cancelLabel: 'Отмена',
    destructive: false,
  });
  modal.open();
  // Focus the input after the modal opens
  setTimeout(() => { try { input.focus(); } catch { /* noop */ } }, 0);
  const result = await modal.result;
  if (result !== 'confirm') return;

  const trimmed = (input.value || '').trim();
  if (trimmed === '') {
    new Notice('Имя подпапки не может быть пустым.');
    return;
  }
  if (/[\\/]/.test(trimmed)) {
    new Notice('Имя подпапки не должно содержать «/» или «\\».');
    return;
  }
  const newPath = parentPath + '/' + trimmed;
  try {
    await this.plugin.snippetService.createFolder(newPath);
    const expanded = this.plugin.settings.snippetTreeExpandedPaths;
    if (!expanded.includes(parentPath)) expanded.push(parentPath);
    if (!expanded.includes(newPath)) expanded.push(newPath);
    await this.plugin.saveSettings();
    await this.rebuildTreeModel();
    this.renderTree();
  } catch (e) {
    new Notice('Не удалось создать папку: ' + ((e as Error)?.message ?? 'неизвестная ошибка'));
  }
}
```
No modifications needed to this method. The new header button simply calls it with the root path.

**Error handling pattern** — Same as existing: `try/catch` in `handleCreateSubfolder` shows `Notice` on failure. No additional error handling needed in the button click handler since `handleCreateSubfolder` is self-contained.

---

### `src/styles/snippet-manager.css` — Optional secondary button styling (modify, config)

**Analog:** Same file, existing `.radi-snippet-tree-new-btn` rule

**Existing button CSS** (lines 208-212):
```css
.radi-snippet-tree-new-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--size-2-1);
}
```

The new folder button reuses the same `.radi-snippet-tree-new-btn` class for layout. Since it omits `mod-cta`, Obsidian's default button styling applies (secondary look). No new CSS rules are strictly required unless visual fine-tuning is desired.

**If new CSS is added**, append at the bottom of the file with a phase comment per CLAUDE.md:
```css
/* Phase 37: create-folder header button */
```

---

### `src/__tests__/snippet-tree-view.test.ts` — New CLEAN-03 test case (modify, test)

**Analog:** Same file, FOLDER-01 test (lines 384-412) and MODAL-04 test (lines 516+)

**Test setup pattern** (lines 293-300 — describe block and beforeEach):
```typescript
describe('SnippetManagerView — tree rendering and interactions', () => {
  // Uses makePlugin() helper to create mock plugin with mock snippetService
  // Uses makeView(plugin) to instantiate SnippetManagerView
  // Calls view.onOpen() to trigger header and tree rendering
```

**FOLDER-01 pattern for calling handleCreateSubfolder** (lines 384-412):
```typescript
it('FOLDER-01: confirming the «Создать подпапку» flow calls service.createFolder with parent + name', async () => {
  const root = '.radiprotocol/snippets';
  const { plugin, service } = makePlugin({
    listings: {
      [root]: { folders: ['parent'], snippets: [] },
      [`${root}/parent`]: { folders: [], snippets: [] },
    },
  });
  const view = makeView(plugin);
  await view.onOpen();

  // Directly invoke the private handler via cast
  const handleCreateSubfolder = (view as any).handleCreateSubfolder.bind(view);
  confirmModalNextResult = 'confirm';
  original.mockImplementationOnce((options: any) => {
    const body = options.body as MockEl;
    const input = body.children.find((c: MockEl) => c.tagName === 'LABEL')
      ?.children.find((c: MockEl) => c.tagName === 'INPUT');
    if (input) input.value = 'sub';
  });

  await handleCreateSubfolder(`${root}/parent`);
  expect(service.createFolder).toHaveBeenCalledWith(`${root}/parent/sub`);
});
```

**New CLEAN-03 test should:**
1. Follow the same `makePlugin` / `makeView` / `await view.onOpen()` setup
2. Walk the header's children to find the folder button (second button with `radi-snippet-tree-new-btn` class, without `mod-cta`)
3. Verify the button exists and has the `folder-plus` icon
4. Simulate click and verify `handleCreateSubfolder` is called with the root snippet path

---

## Shared Patterns

### DOM Button Creation (Obsidian ItemView)
**Source:** `src/views/snippet-manager-view.ts` lines 109-115
**Apply to:** The new folder button in `onOpen()`
```typescript
const btn = parent.createEl('button', { cls: 'radi-snippet-tree-new-btn' });
const icon = btn.createSpan({ cls: 'radi-snippet-tree-new-icon' });
setIcon(icon, 'icon-name');
btn.createSpan({ text: 'Label' });
this.registerDomEvent(btn, 'click', () => { /* handler */ });
```

### CSS Append-Only Convention
**Source:** CLAUDE.md
**Apply to:** Any edit to `src/styles/snippet-manager.css`
- Add new rules at the bottom with `/* Phase 37: description */` comment
- Never modify or remove existing rules
- Run `npm run build` after any CSS change

### Test Mocking Pattern
**Source:** `src/__tests__/snippet-tree-view.test.ts` lines 136-180
**Apply to:** New CLEAN-03 test case
- Uses `vi.mock('obsidian', ...)` with MockEl-based DOM
- `confirmModalCtorSpy` + `confirmModalNextResult` control ConfirmModal behavior
- `makePlugin()` creates mock plugin with `snippetService` stubs
- `makeView(plugin)` instantiates view for testing

## No Analog Found

No files without analogs -- all modifications target existing files with established patterns.

## Metadata

**Analog search scope:** `src/views/`, `src/styles/`, `src/__tests__/`
**Files scanned:** 3
**Pattern extraction date:** 2026-04-16
