---
date: 2026-07-26T16:31:29+0300
author: Roman Shulgha
repository: RadiProtocol
branch: main
commit: 946c20f
topic: "SnippetTreePicker keyboard navigation (ArrowUp/Down + Enter)"
source: .rpiv/artifacts/plans/2026-07-26_16-27-21_snippet-create-from-selection-and-insert-modal-ux.md
phase_n: 4
phase_title: "SnippetTreePicker keyboard navigation (ArrowUp/Down + Enter)"
status: ready
tags: [elaboration]
---

## Phase 4: SnippetTreePicker keyboard navigation (ArrowUp/Down + Enter)

### Changes

#### `src/views/snippet-tree-picker.ts`
Add three highlight-state instance fields next to the existing `searchInputEl` field (`src/views/snippet-tree-picker.ts:95`); register a `keydown` listener on `searchInputEl` in `mount()` immediately after the existing `input` listener (`src/views/snippet-tree-picker.ts:130`) and create the aria-live status span inside `.rp-stp-search`; broaden the keep-predicate in `removeListenersExceptSearch()` (`src/views/snippet-tree-picker.ts:173`) to also keep `keydown`; call `clearHighlight()` at the top of `renderDrillView()` (`src/views/snippet-tree-picker.ts:219`) and `renderSearchResults()` (`src/views/snippet-tree-picker.ts:433`) right after `removeBody(host)`; add four private keyboard-nav methods. Reset highlight state in `mount()` and `unmount()` alongside the existing state resets.

**1. Instance fields — add after `searchInputEl` (`src/views/snippet-tree-picker.ts:95`):**
```ts
  private searchInputEl: HTMLInputElement | null = null;

  /** Phase 4 — keyboard-nav highlight cursor. -1 = nothing highlighted.
   *  Reset on each mount() and on every body re-render via clearHighlight(). */
  private highlightedIndex: number = -1;
  /** The currently-highlighted row DOM node. Detached by removeBody() on the
   *  next re-render, so clearHighlight() only resets the cursor (no class
   *  removal needed — the old element is gone). */
  private highlightedRowEl: HTMLElement | null = null;
  /** Visually-hidden aria-live="polite" status span created in mount(); survives
   *  removeBody() because it lives inside .rp-stp-search. Updated by moveHighlight(). */
  private highlightStatusEl: HTMLElement | null = null;
```

**2. `mount()` — reset highlight state (add next to the existing state resets at `src/views/snippet-tree-picker.ts:110-112`):**
```ts
    this.searchInputEl = null;
    this.committedRelativePath = null;
    this.highlightedIndex = -1;
    this.highlightedRowEl = null;
    this.highlightStatusEl = null;
```

**3. `mount()` — add keydown listener + aria-live status span immediately after the existing `input` listener (`src/views/snippet-tree-picker.ts:130-133`):**
```ts
    this.addListener(searchInput, 'input', () => {
      const value = searchInput.value;
      this.onSearchInput(value);
    });
    // Phase 4 — keyboard navigation (ArrowUp/Down + Enter) on the search input.
    // Tracked via addListener so unmount()/clearContainer() tear it down, and
    // preserved across body re-renders by removeListenersExceptSearch().
    this.addListener(searchInput, 'keydown', (e) => {
      this.handleSearchKeydown(e as KeyboardEvent);
    });

    // Phase 4 — visually-hidden aria-live="polite" status span for screen-reader
    // announcements of the highlighted row title. Lives inside .rp-stp-search so
    // removeBody() (which keeps .rp-stp-search) preserves it across re-renders.
    const statusSpan = searchWrap.createEl('span', {
      cls: 'rp-stp-sr-only',
      attr: { 'aria-live': 'polite', role: 'status' },
    });
    this.highlightStatusEl = statusSpan;
```

**4. `unmount()` — reset highlight state (add next to the existing resets at `src/views/snippet-tree-picker.ts:149-150`):**
```ts
    this.containerEl = null;
    this.searchInputEl = null;
    this.committedRelativePath = null;
    this.highlightedIndex = -1;
    this.highlightedRowEl = null;
    this.highlightStatusEl = null;
```

**5. `removeListenersExceptSearch()` — broaden the keep-predicate at `src/views/snippet-tree-picker.ts:173`:**
```ts
      if (
        entry.el === (this.searchInputEl as unknown as HTMLElement) &&
        (entry.type === 'input' || entry.type === 'keydown')
      ) {
        keep.push(entry);
      } else {
        drop.push(entry);
      }
```

**6. `renderDrillView()` — call `clearHighlight()` right after `removeBody(host)` at `src/views/snippet-tree-picker.ts:219`:**
```ts
    this.removeListenersExceptSearch();
    this.removeBody(host);
    this.clearHighlight();
```

**7. `renderSearchResults()` — call `clearHighlight()` right after `removeBody(host)` at `src/views/snippet-tree-picker.ts:433`:**
```ts
    this.removeListenersExceptSearch();
    this.removeBody(host);
    this.clearHighlight();
```

**8. New private keyboard-nav methods — add after `renderSearchResults()` (before the class closing brace at `src/views/snippet-tree-picker.ts:481`):**
```ts

  // ── Keyboard navigation (Phase 4) ──────────────────────────────────────

  private handleSearchKeydown(e: KeyboardEvent): void {
    // Ignore modifier-laden keys (Ctrl/Cmd/Alt+Arrow etc.) — those belong to the
    // host (e.g. InlineRunnerModal Ctrl+← / Ctrl+→ / Esc) and must pass through
    // unchanged. The runner's handleKeydown INPUT/TEXTAREA bail holds regardless.
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = this.currentRows();
      if (rows.length === 0) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      this.moveHighlight(rows, delta);
      return;
    }

    if (e.key === 'Enter') {
      // No-op + no-throw when nothing is highlighted.
      if (this.highlightedIndex === -1 || this.highlightedRowEl === null) return;
      e.preventDefault();
      // Dispatch the row's registered click handler — same path as a mouse click
      // (file row → onSelect, folder row → drill).
      this.highlightedRowEl.click();
      return;
    }
  }

  /** All visible folder/file rows under the current root, in document order.
   *  Never cached — always re-queried so a fresh re-render's rows are used. */
  private currentRows(): HTMLElement[] {
    const root = this.rootEl();
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('.rp-stp-folder-row, .rp-stp-file-row'));
  }

  /** Move the highlight cursor by `delta` with wrap-around modulo rows.length. */
  private moveHighlight(rows: HTMLElement[], delta: number): void {
    const count = rows.length;
    if (count === 0) return;

    // Toggle the old highlight off (the old element is still live at this point).
    if (this.highlightedRowEl !== null) {
      this.highlightedRowEl.classList.remove('rp-stp-row-highlighted');
    }

    let next: number;
    if (this.highlightedIndex === -1) {
      // Nothing highlighted: ArrowDown → first (0), ArrowUp → last (count-1).
      next = delta === 1 ? 0 : count - 1;
    } else {
      next = (this.highlightedIndex + delta + count) % count;
    }
    const row = rows[next];

    row.classList.add('rp-stp-row-highlighted');
    row.scrollIntoView({ block: 'nearest' });

    this.highlightedIndex = next;
    this.highlightedRowEl = row;

    // Announce the highlighted row title via the aria-live status span.
    const titleEl = row.querySelector<HTMLElement>('.rp-stp-row-title');
    const name = titleEl?.textContent ?? '';
    if (this.highlightStatusEl !== null) {
      this.highlightStatusEl.textContent = this.t('snippetTreePicker.highlightAria', { name });
    }
  }

  /** Reset the highlight cursor. Called at the top of every body re-render
   *  (renderDrillView / renderSearchResults) right after removeBody(host) —
   *  the previously-highlighted row is already detached by removeBody(), so
   *  no class removal is needed; just reset the cursor. */
  private clearHighlight(): void {
    this.highlightedIndex = -1;
    this.highlightedRowEl = null;
  }
```

#### `src/styles/snippet-tree-picker.css`
Append the keyboard-nav highlight rule + the visually-hidden screen-reader-only helper at the end of the file (after the `.rp-stp-select-folder-btn.is-committed:hover` block at `src/styles/snippet-tree-picker.css:274-277`). Additive selectors — no existing rule touched (Phase 3's pin/height rules land earlier in the file; these are distinct selectors).

```css
/* Phase 4 — keyboard-nav highlight + screen-reader-only status span. */
.rp-stp-row-highlighted {
  background: var(--background-modifier-hover);
  border-color: var(--background-modifier-border);
}

.rp-stp-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

#### `src/i18n/locales/en.json`
Add the `highlightAria` key under the existing `snippetTreePicker` namespace (after `breadcrumbNavLabel`). No existing key modified.

```json
    "crumbAria": "Go to {name}",
    "breadcrumbNavLabel": "Snippet folders",
    "highlightAria": "Highlighted: {name}"
  },
```

#### `src/i18n/locales/ru.json`
Add the `highlightAria` key under the existing `snippetTreePicker` namespace (after `breadcrumbNavLabel`). No existing key modified.

```json
    "crumbAria": "Перейти к {name}",
    "breadcrumbNavLabel": "Папки сниппетов",
    "highlightAria": "Подсвечено: {name}"
  },
```

#### `src/__tests__/views/snippet-tree-picker.test.ts`
Add a `triggerKeydown` helper and a `rowsOf` helper next to the existing `triggerClick`/`triggerInput` helpers; extend the `MockEl` interface and `makeEl` factory with four additive methods (`querySelector`, `querySelectorAll`, `scrollIntoView`, `click`) so the implementation's real-DOM calls (`rootEl().querySelectorAll(...)`, `row.querySelector('.rp-stp-row-title')`, `row.scrollIntoView(...)`, `this.highlightedRowEl.click()`) work in the hand-rolled MockEl environment; append a `describe('Keyboard navigation (Phase 4)', ...)` Vitest suite covering ArrowDown/ArrowUp traversal, wrap-around, Enter dispatches the row's click handler (file-row `onSelect` spy + folder-row drill assertion), Enter no-op when no row highlighted, keydown listener survives a debounced search re-render, highlight resets after a drill re-render, and the aria-live status announcement.

**A. `MockEl` interface — add four members (inside the `interface MockEl { ... }` block, e.g. after `dispatchEvent`):**
```ts
  querySelector: (selector: string) => MockEl | null;
  querySelectorAll: (selector: string) => MockEl[];
  scrollIntoView: (opts?: unknown) => void;
  click: () => void;
```

**B. `makeEl()` factory — add four implementations (inside the `el` object, e.g. after `dispatchEvent`):**
```ts
    querySelector(selector: string): MockEl | null {
      // Minimal: supports a single '.class' selector. Returns first descendant
      // match in document order (mirrors DOM querySelector semantics — not self).
      const cls = selector.trim().startsWith('.') ? selector.trim().slice(1) : selector.trim();
      function walk(node: MockEl): MockEl | null {
        for (const c of node.children) {
          if (c.classList.has(cls)) return c;
          const r = walk(c);
          if (r) return r;
        }
        return null;
      }
      return walk(el);
    },
    querySelectorAll(selector: string): MockEl[] {
      // Minimal: supports comma-separated '.class1, .class2' selectors. Returns
      // all descendant matches in document order.
      const classes = selector
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('.'))
        .map((s) => s.slice(1));
      const out: MockEl[] = [];
      function walk(node: MockEl): void {
        for (const c of node.children) {
          if (classes.some((cls) => c.classList.has(cls))) out.push(c);
          walk(c);
        }
      }
      walk(el);
      return out;
    },
    scrollIntoView(_opts?: unknown): void {},
    click(): void {
      el.dispatchEvent({ type: 'click', target: el });
    },
```

**C. Test helpers — add near the existing `triggerInput`/`flushDebounce` helpers:**
```ts
function triggerKeydown(
  inputEl: MockEl | undefined,
  key: string,
  mods: { ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean } = {},
): void {
  if (!inputEl) throw new Error('triggerKeydown: element is undefined');
  const event = {
    type: 'keydown',
    key,
    target: inputEl,
    ctrlKey: !!mods.ctrlKey,
    altKey: !!mods.altKey,
    metaKey: !!mods.metaKey,
    preventDefault: vi.fn(),
  };
  inputEl.dispatchEvent(event as unknown as { type: string; target?: unknown });
}

function rowsOf(container: MockEl): MockEl[] {
  return findAll(container, (el) =>
    el.classList.has('rp-stp-folder-row') || el.classList.has('rp-stp-file-row'),
  );
}
```

**D. Keyboard-nav suite — append at the end of the file (after the last `describe('Picker row accessibility ...)` block):**
```ts
describe('Keyboard navigation (Phase 4)', () => {
  let svc: FakeSnippetService;

  beforeEach(() => {
    svc = makeFakeSnippetService();
  });

  it('ArrowDown moves the highlight onto the first row, then the second', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen', 'chest'],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown');
    let rows = rowsOf(container);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[1].classList.has('rp-stp-row-highlighted')).toBe(false);

    triggerKeydown(input, 'ArrowDown');
    rows = rowsOf(container);
    expect(rows[1].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(false);
  });

  it('ArrowUp moves the highlight back to the previous row', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen', 'chest'],
      snippets: [],
    });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → 0
    triggerKeydown(input, 'ArrowDown'); // → 1
    triggerKeydown(input, 'ArrowUp');   // → 0
    const rows = rowsOf(container);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[1].classList.has('rp-stp-row-highlighted')).toBe(false);
  });

  it('wrap-around: ArrowDown from last wraps to first; ArrowUp from first wraps to last', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen', 'chest'],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → 0
    triggerKeydown(input, 'ArrowDown'); // → 1
    triggerKeydown(input, 'ArrowDown'); // → 2 (last)
    let rows = rowsOf(container);
    expect(rows[2].classList.has('rp-stp-row-highlighted')).toBe(true);

    triggerKeydown(input, 'ArrowDown'); // wrap last → first
    rows = rowsOf(container);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[2].classList.has('rp-stp-row-highlighted')).toBe(false);

    triggerKeydown(input, 'ArrowUp'); // wrap first → last
    rows = rowsOf(container);
    expect(rows[2].classList.has('rp-stp-row-highlighted')).toBe(true);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(false);
  });

  it('Enter on a highlighted file row dispatches the row click handler (onSelect with kind: file)', async () => {
    svc.listFolder.mockResolvedValue({
      folders: [],
      snippets: [jsonSnippet(`${ROOT}/report.json`)],
    });
    const { picker, container, onSelect } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → file row (only row)
    triggerKeydown(input, 'Enter');
    expect(onSelect).toHaveBeenCalledWith({ kind: 'file', relativePath: 'report.json' });
  });

  it('Enter on a highlighted folder row drills in (same path as a mouse click)', async () => {
    svc.listFolder
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] })
      .mockResolvedValueOnce({ folders: ['ct'], snippets: [] });
    const { picker, container, onSelect } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → folder row (first row)
    triggerKeydown(input, 'Enter');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    // onSelect NOT called — folder click drills (D-12).
    expect(onSelect).not.toHaveBeenCalled();
    expect(svc.listFolder).toHaveBeenCalledWith(`${ROOT}/abdomen`);
  });

  it('Enter with no highlighted row is a no-op and does not throw', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen'],
      snippets: [jsonSnippet(`${ROOT}/r.json`)],
    });
    const { picker, container, onSelect } = makePicker({ mode: 'both' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    expect(() => triggerKeydown(input, 'Enter')).not.toThrow();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('after a debounced search re-render the keydown listener is still active (ArrowDown moves highlight on freshly-rendered rows)', async () => {
    svc.listFolder.mockResolvedValue({ folders: [], snippets: [] });
    svc.listFolderDescendants.mockResolvedValue({
      files: [`${ROOT}/abdomen/ct.md`, `${ROOT}/abdomen/mri.md`],
      folders: [],
      total: 2,
    });
    const { picker, container } = makePicker({ mode: 'file-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerInput(input, 'm');
    await flushDebounce();

    // Search results rendered — proves removeListenersExceptSearch() preserved
    // the keydown listener (it would have been dropped by the old input-only
    // keep-predicate).
    expect(rowsOf(container).length).toBe(2);

    triggerKeydown(input, 'ArrowDown');
    const rows = rowsOf(container);
    expect(rows[0].classList.has('rp-stp-row-highlighted')).toBe(true);
  });

  it('after a drill re-render the highlight resets (no row carries rp-stp-row-highlighted)', async () => {
    svc.listFolder
      .mockResolvedValueOnce({ folders: ['abdomen'], snippets: [] })
      .mockResolvedValueOnce({ folders: ['ct'], snippets: [] });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown'); // → row 0 highlighted
    expect(rowsOf(container)[0].classList.has('rp-stp-row-highlighted')).toBe(true);

    // Drill in via click → renderDrillView → clearHighlight resets the cursor.
    triggerClick(rowsOf(container)[0]);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();

    const rowsAfter = rowsOf(container);
    expect(rowsAfter.every((r) => !r.classList.has('rp-stp-row-highlighted'))).toBe(true);
  });

  it('aria-live status span announces the highlighted row title via snippetTreePicker.highlightAria (defaultT → English)', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen'],
      snippets: [],
    });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    triggerKeydown(input, 'ArrowDown');

    const status = findFirst(container, (el) => el.classList.has('rp-stp-sr-only'));
    expect(status?.textContent).toBe('Highlighted: abdomen');
  });

  it('modifier-laden keys (Ctrl+ArrowDown) are ignored — no highlight moves, no throw', async () => {
    svc.listFolder.mockResolvedValue({
      folders: ['abdomen', 'chest'],
      snippets: [],
    });
    const { picker, container } = makePicker({ mode: 'folder-only' }, svc);
    await picker.mount();

    const input = findFirst(container, (el) => el.classList.has('rp-stp-search-input'))!;
    expect(() => triggerKeydown(input, 'ArrowDown', { ctrlKey: true })).not.toThrow();
    expect(rowsOf(container).every((r) => !r.classList.has('rp-stp-row-highlighted'))).toBe(true);
  });
});
```

### Success Criteria
#### Automated Verification:
- [ ] `npm test` — new `src/__tests__/views/snippet-tree-picker.test.ts` `Keyboard navigation (Phase 4)` suite passes: ArrowDown/ArrowUp traversal, wrap-around (last→first + first→last), Enter dispatches the row's `click` handler (file-row `onSelect` spy + folder-row drill assertion), Enter no-op when no row highlighted, keydown listener survives a debounced search re-render (ArrowDown moves highlight on freshly-rendered rows), highlight resets after a drill re-render, aria-live status announcement, modifier-laden keys ignored.
- [ ] `npm run lint` — ESLint + Stylelint pass (including the new `.rp-stp-row-highlighted` / `.rp-stp-sr-only` CSS rules).
- [ ] `npm run build` — type-check + esbuild production bundle succeeds; `InlineRunnerModal` and `InsertSnippetModal` consumers compile unchanged (no public-surface signature change to `SnippetTreePickerOptions` or `SnippetTreePicker`).
#### Manual Verification:
- [ ] In the Insert snippet modal, typing a query then pressing ArrowDown moves the highlight onto the first row; ArrowDown again moves to the second; ArrowUp moves back; navigation wraps from last→first and first→last.
- [ ] Pressing Enter while a file row is highlighted inserts that snippet (same path as a mouse click); pressing Enter on a folder row drills in (same path as a mouse click); pressing Enter with no row highlighted is a no-op.
- [ ] After the modal re-renders on a new keystroke or a breadcrumb/drill navigation, arrow keys still work and no stale-row `.click()` fires.
- [ ] A screen reader announces the highlighted row's title on each highlight move (aria-live status span via `snippetTreePicker.highlightAria`).
- [ ] Arrow/Enter keys pressed while focus is in the picker search input do not trigger `InlineRunnerModal` Ctrl+← / Ctrl+→ / Escape handling (the runner's `handleKeydown` INPUT/TEXTAREA bail holds).
- [ ] `snippetTreePicker.highlightAria` key exists in both `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`.

## Notes / Deferred
- **MockEl extended with `querySelector` / `querySelectorAll` / `scrollIntoView` / `click`.** The implementation uses the real-DOM APIs `rootEl().querySelectorAll('.rp-stp-folder-row, .rp-stp-file-row')`, `row.querySelector('.rp-stp-row-title')`, `row.scrollIntoView({ block: 'nearest' })`, and `this.highlightedRowEl.click()` (per the plan's prescription). The existing `MockEl` in `src/__tests__/views/snippet-tree-picker.test.ts` did not implement these. To keep the implementation faithful to the plan AND testable in the hand-rolled MockEl environment, four additive methods were added to the `MockEl` interface + `makeEl` factory (minimal: `querySelector`/`querySelectorAll` support only `.class` / comma-separated `.class1, .class2` selectors — sufficient for this phase's queries; `scrollIntoView` is a no-op; `click` dispatches a synthetic click event to the row's registered listeners). This is additive test infrastructure; it does not touch the existing default-`false` path-display test (`'result row secondary text = full relative path from rootPath'` in `src/__tests__/views/snippet-tree-picker.test.ts`) that Phase 5 keeps unchanged, so risk r3's disjointness holds.