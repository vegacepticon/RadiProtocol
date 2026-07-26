---
date: 2026-07-26T16:31:54+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "Add hideSearchResultPath option and opt in from InsertSnippetModal"
source: .rpiv/artifacts/plans/2026-07-26_16-27-21_snippet-create-from-selection-and-insert-modal-ux.md
phase_n: 5
phase_title: "Add hideSearchResultPath option and opt in from InsertSnippetModal"
status: ready
tags: [elaboration]
---

## Phase 5: Add hideSearchResultPath option and opt in from InsertSnippetModal

### Changes

#### `src/views/snippet-tree-picker.ts`
Add an optional `hideSearchResultPath?: boolean` field to the `SnippetTreePickerOptions` interface (after the existing `t?: Translator` field at `src/views/snippet-tree-picker.ts:73-74`). It defaults to `false` by virtue of being optional, is search-result-only, and does not affect drill-view rows (which never render the path line). No constructor normalization — read `this.options.hideSearchResultPath` directly, matching the established `this.options.mode` / `this.options.rootPath` / `this.options.t` access pattern. No new fields, listeners, or state.

Interface edit (current shape at `src/views/snippet-tree-picker.ts:62-75`):

```ts
export interface SnippetTreePickerOptions {
  app: App;
  snippetService: SnippetService;
  container: HTMLElement;
  mode: SnippetTreePickerMode;
  /** Vault-relative root path the picker is anchored at. */
  rootPath: string;
  initialSelection?: string;
  onSelect: (result: SnippetTreePickerResult) => void;
  /** Phase 84 (I18N-02): translator for user-visible copy. Optional —
   *  unit tests and standalone callers fall back to the English defaultT. */
  t?: Translator;
  /** Phase 5: when true, search-result file rows omit the secondary
   *  `.rp-stp-result-path` line and render basename-only. Default `false`
   *  preserves the prior two-line behavior (basename + full relative path).
   *  Drill-view rows never render the path line regardless of this flag. */
  hideSearchResultPath?: boolean;
}
```

Narrow the `renderFileRow()` path-div gate at `src/views/snippet-tree-picker.ts:381` from `if (isSearchResult)` to `if (isSearchResult && !this.options.hideSearchResultPath)`. The surrounding `renderFileRow` body (current shape at `src/views/snippet-tree-picker.ts:354-389`):

```ts
  private renderFileRow(
    listEl: HTMLElement,
    snippetOrBasename: Snippet | { basename: string; relativePath: string },
    isSearchResult: boolean,
  ): void {
    let basename: string;
    let relativePath: string;
    if ('kind' in snippetOrBasename) {
      // Drill-view row: Snippet object. Basename from path. Relative path = drillPath + basename.
      basename = basenameOf(snippetOrBasename.path);
      relativePath = this.drillPath.length === 0
        ? basename
        : `${this.drillPath.join('/')}/${basename}`;
    } else {
      basename = snippetOrBasename.basename;
      relativePath = snippetOrBasename.relativePath;
    }

    const row = createButton(listEl, { cls: 'rp-stp-file-row' });
    const nameEl = row.createEl('div', { cls: 'rp-stp-result-name' });
    nameEl.setText(`${fileGlyph(basename)} ${basename}`);
    nameEl.empty();
    nameEl.createEl('span', { cls: 'rp-stp-row-glyph', text: fileGlyph(basename) });
    nameEl.createEl('span', { cls: 'rp-stp-row-title', text: basename });
    if (isSearchResult && !this.options.hideSearchResultPath) {
      const pathEl = row.createEl('div', { cls: 'rp-stp-result-path' });
      pathEl.setText(relativePath);
    }

    const relPathAtClickTime = relativePath;
    this.addListener(row, 'click', () => {
      this.options.onSelect({ kind: 'file', relativePath: relPathAtClickTime });
    });
  }
```

No change to `renderFolderRow` (its `if (isSearchResult)` gate at `src/views/snippet-tree-picker.ts:336` stays — folder search-result rows keep their path line for disambiguation in the move-to modal). No change to the drill-view branch, no change to the constructor.

#### `src/views/insert-snippet-modal.ts`
Pass `hideSearchResultPath: true` alongside the existing `mode: 'file-only'` in the `SnippetTreePicker` options object constructed in `onOpen()` at `src/views/insert-snippet-modal.ts:32-44`. No other change to the modal — Phase 3's `modalEl.addClass('rp-insert-snippet-modal')` remains the first statement in `onOpen()` (owned by Phase 3, sequenced before this phase); this edit lands on the later options-object lines only.

The updated `onOpen()` body (current shape at `src/views/insert-snippet-modal.ts:22-45`):

```ts
  onOpen(): void {
    const { contentEl, titleEl } = this;
    contentEl.empty();
    titleEl.setText(this.plugin.i18n.t('insertSnippet.title'));

    const rootPath = this.plugin.settings.snippetFolderPath.trim();
    if (rootPath === '') {
      contentEl.createEl('p', { text: this.plugin.i18n.t('insertSnippet.setSnippetFolderFirst') });
      return;
    }

    const pickerHost = contentEl.createDiv({ cls: 'rp-insert-snippet-picker-host' });
    this.picker = new SnippetTreePicker({
      app: this.app,
      snippetService: this.plugin.snippetService,
      container: pickerHost,
      mode: 'file-only',
      rootPath,
      hideSearchResultPath: true,
      t: this.plugin.i18n.t.bind(this.plugin.i18n),
      onSelect: (result) => {
        void this.handleSelect(rootPath, result.relativePath);
      },
    });
    void this.picker.mount();
  }
```

#### `src/__tests__/views/snippet-tree-picker.test.ts`
Add one Vitest suite asserting that with `hideSearchResultPath: true` in file-only mode, a search-result file row renders `.rp-stp-result-name` (glyph + basename) but no `.rp-stp-result-path` element. The existing default-`false` regression guard at `src/__tests__/views/snippet-tree-picker.test.ts:647-655` (`'result row secondary text = full relative path from rootPath'`) stays unchanged. The new suite reuses the in-file `makePicker` / `findFirst` / `findByClass` / `triggerInput` / `flushDebounce` helpers and the `FakeSnippetService` / `makeFakeSnippetService` / `jsonSnippet` fixtures already defined at `src/__tests__/views/snippet-tree-picker.test.ts:235-280`. Append at the end of the file (after the last `describe('Picker row accessibility…')` block):

```ts
describe('hideSearchResultPath option (Phase 5)', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('hideSearchResultPath: true in file-only mode renders name but omits the result-path line', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/ct/ct-routine.md`],
      folders: [],
      total: 1,
    });
    const { picker, container } = makePicker(
      { mode: 'file-only', hideSearchResultPath: true },
      svc,
    );
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'ct');
    await flushDebounce();

    // Name line present (glyph + basename).
    const nameEl = findFirst(container, (el) => el.classList.has('rp-stp-result-name'));
    expect(nameEl).not.toBeNull();
    expect(nameEl?.textContent).toContain('ct-routine.md');

    // No result-path element rendered anywhere in the picker.
    const pathEl = findFirst(container, (el) => el.classList.has('rp-stp-result-path'));
    expect(pathEl).toBeNull();

    // The file row itself is still present and selectable.
    const fileRows = findByClass(container, 'rp-stp-file-row');
    expect(fileRows.length).toBe(1);
  });

  it('hideSearchResultPath omitted (default false) still renders the result-path line — regression guard', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/ct/ct-routine.md`],
      folders: [],
      total: 1,
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'ct');
    await flushDebounce();

    const pathEl = findFirst(container, (el) => el.classList.has('rp-stp-result-path'));
    expect(pathEl).not.toBeNull();
    expect(pathEl?.textContent).toBe('abdomen/ct/ct-routine.md');
  });
});
```

### Success Criteria
#### Automated Verification:
- [ ] `npm run build` (`tsc --noEmit` + esbuild) passes with no type errors after adding the optional `hideSearchResultPath?: boolean` field — all existing callers compile unchanged because the field is optional.
- [ ] `npm test` passes — the existing default-`false` test at `src/__tests__/views/snippet-tree-picker.test.ts:647-655` remains green (search-result file row still renders `.rp-stp-result-path` with the full relative path when the flag is unset), and the two new tests in the `hideSearchResultPath option (Phase 5)` suite pass (`.rp-stp-result-path` is absent when `hideSearchResultPath: true` while `.rp-stp-result-name` is present; the default-`false` regression guard renders the path line).
- [ ] `npm run lint` passes for `src/views/snippet-tree-picker.ts`, `src/views/insert-snippet-modal.ts`, and `src/__tests__/views/snippet-tree-picker.test.ts`.

#### Manual Verification:
- [ ] Run the "Insert snippet" command, type a query matching a snippet, and confirm the search-result rows show name-only (no secondary path line).
- [ ] Open the Snippet Manager move-to modal (`both`/`folder-only` mode, does not pass the flag) and confirm search-result rows still show the secondary path line for disambiguation — no regression.
- [ ] In the insert modal, drill-view navigation (if reachable) shows name-only rows as before — the flag is search-only and does not affect drill-view.