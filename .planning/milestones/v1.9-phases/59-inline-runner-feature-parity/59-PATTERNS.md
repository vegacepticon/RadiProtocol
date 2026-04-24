# Phase 59: Inline Runner Feature Parity — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 5 (3 MODIFY, 2 NEW)
**Analogs found:** 5 / 5 (all in-repo)

## File Classification

| Target File | Status | Role | Data Flow | Closest Analog | Match Quality |
|-------------|--------|------|-----------|----------------|---------------|
| `src/main.ts` (`handleRunProtocolInline` + new helper `resolveProtocolCanvasFiles`) | MODIFY | source (plugin entry / command handler) | request-response (vault lookup) | self (lines 421-487) + `src/views/canvas-selector-widget.ts` (TFolder recursion) | exact (self-refactor) |
| `src/views/inline-runner-modal.ts` (snippet dispatch @ 411-419, 800-830, 833-888, DELETE 891-973) | MODIFY | source (view / UI controller) | event-driven (runner state transitions + async modal await) | same file, `handleAnswerClick` @ 555-576 (INLINE-FIX-04 pattern) + `src/views/runner-view.ts::handleSnippetFill` @ 908, 997-1008 (INLINE-FIX-05 pattern) | exact (sidebar parity) |
| `src/__mocks__/obsidian.ts` | MODIFY | mock (test infra) | n/a | self (existing exports @ 77-180) + local override pattern in `src/__tests__/views/snippet-fill-in-modal.test.ts:195-240` | exact (append-only) |
| `src/__tests__/views/inline-runner-modal.test.ts` | NEW | test (unit/view) | request-response (spy-driven) | `src/__tests__/views/snippet-fill-in-modal.test.ts` (MockEl @ 18-192) + `src/__tests__/views/runner-snippet-sibling-button.test.ts` (FakeNode @ 37-110) | exact composite |
| `src/__tests__/main-inline-command.test.ts` | NEW | test (unit/pure helper) | request-response (pure function over mocked vault) | `src/__tests__/vault-utils.test.ts` (mocked-vault pattern @ 1-27) + `src/__tests__/runner-commands.test.ts` (if present) | role-match |

---

## Pattern Assignments

### 1. `src/main.ts::handleRunProtocolInline` (INLINE-FIX-01)

**Analog A (self — current shape to preserve):** `src/main.ts:421-487`

**Current imports in use** (lines 1-20 of main.ts; already present — do NOT re-import):
```typescript
import { App, Notice, Plugin, TFile, TFolder, SuggestModal } from 'obsidian';
```

**Existing D9 / D8 guard pattern** (lines 422-459, preserve verbatim, only augment folder resolution):
```typescript
// D9 guard: active file must be a markdown note
const activeFile = this.app.workspace.getActiveFile();
if (activeFile === null || activeFile.extension !== 'md') {
  new Notice('Open a markdown note first, then run this command.');
  return;
}

// Protocol folder enumeration
const folderPath = this.settings.protocolFolderPath.trim();
if (folderPath === '') {
  new Notice('Set a protocol folder in Settings to get started.');
  return;
}

const folder = this.app.vault.getAbstractFileByPath(folderPath);
if (!(folder instanceof TFolder)) {
  new Notice('Protocol folder not found.');
  return;
}

// Recursively enumerate .canvas files
const canvasFiles: TFile[] = [];
const collectCanvases = (f: TFolder): void => {
  for (const child of f.children) {
    if (child instanceof TFolder) {
      collectCanvases(child);
    } else if (child instanceof TFile && child.extension === 'canvas') {
      canvasFiles.push(child);
    }
  }
};
collectCanvases(folder);

// D8 guard: empty list
if (canvasFiles.length === 0) {
  new Notice(`No protocol canvases found in '${folderPath}'.`);
  return;
}
```

**Existing SuggestModal pattern** (lines 462-487, preserve verbatim — do NOT touch):
```typescript
const plugin = this;
const targetNote = activeFile;
this.pickerModal = new (class extends SuggestModal<{ file: TFile; name: string }> {
  constructor() { super(plugin.app); }
  getSuggestions(query: string): { file: TFile; name: string }[] { /* … */ }
  renderSuggestion(item, el): void { /* … */ }
  onChooseSuggestion(item): void {
    plugin.pickerModal = null;
    void plugin.openInlineRunner(item.file, targetNote);
  }
})();
this.pickerModal.open();
```

**New helper to extract (Pattern 3 from RESEARCH.md)** — `resolveProtocolCanvasFiles(vault, folderPath): TFile[]`:
```typescript
// NEW — add as a free function or private method in main.ts
// Consumes: Vault + raw user-stored folderPath (not trimmed)
// Returns: flat TFile[] of .canvas files, or [] when empty/invalid
private resolveProtocolCanvasFiles(folderPath: string): TFile[] {
  const normalized = folderPath
    .trim()
    .replace(/\\/g, '/')          // Windows path normalization
    .replace(/^\/+|\/+$/g, '');   // strip leading/trailing slashes
  if (normalized === '') return [];

  const folder = this.app.vault.getAbstractFileByPath(normalized);
  const out: TFile[] = [];

  if (folder instanceof TFolder) {
    const walk = (f: TFolder): void => {
      for (const child of f.children) {
        if (child instanceof TFolder) walk(child);
        else if (child instanceof TFile && child.extension === 'canvas') out.push(child);
      }
    };
    walk(folder);
    return out;
  }

  // Fallback: scan all vault files for .canvas under the normalized prefix
  const prefix = normalized + '/';
  for (const f of this.app.vault.getFiles()) {
    if (f.extension !== 'canvas') continue;
    if (f.path === normalized || f.path.startsWith(prefix)) out.push(f);
  }
  return out;
}
```

**Shared-file constraint (CLAUDE.md):** `main.ts` is an accumulated shared file. Only `handleRunProtocolInline` (lines 421-487) plus the NEW private method `resolveProtocolCanvasFiles` are in scope. Do NOT modify `handleRunProtocol`, `activateRunnerView`, plugin lifecycle, settings, or any other section.

**Analog B (for reference — TFolder recursion style):** `src/views/canvas-selector-widget.ts` uses the same `child instanceof TFolder` / `child instanceof TFile && child.extension === 'canvas'` recursion. The new helper matches that shape (no new inventions).

---

### 2. `src/views/inline-runner-modal.ts` — snippet dispatch (INLINE-FIX-04 + INLINE-FIX-05)

**Analog A (INLINE-FIX-04 — in the same file):** `handleAnswerClick` @ `src/views/inline-runner-modal.ts:554-576`

**Diff-before-after pattern to replicate in snippet paths:**
```typescript
// src/views/inline-runner-modal.ts:555-576 — answer path (already correct)
private async handleAnswerClick(answerNode: AnswerNode): Promise<void> {
  const stateBefore = this.runner.getState();
  const beforeText = this.extractAccumulatedText(stateBefore);

  this.runner.chooseAnswer(answerNode.id);

  const stateAfter = this.runner.getState();
  const afterText = this.extractAccumulatedText(stateAfter);

  if (afterText.length > beforeText.length) {
    if (!afterText.startsWith(beforeText)) {
      console.warn('[RadiProtocol] Text changed non-monotonically, skipping append');
      this.render();
      return;
    }
    const appendedText = afterText.slice(beforeText.length);
    await this.appendAnswerToNote(appendedText);
  }
  this.render();
}
```

**Accumulator extractor (already present — reuse):** `extractAccumulatedText` @ `src/views/inline-runner-modal.ts:637-649`:
```typescript
private extractAccumulatedText(state: ReturnType<typeof this.runner.getState>): string {
  switch (state.status) {
    case 'at-node':
    case 'awaiting-loop-pick':
    case 'awaiting-snippet-pick':
    case 'awaiting-snippet-fill':
      return state.accumulatedText;
    case 'complete':
      return state.finalText;
    default:
      return '';
  }
}
```

**Append-to-note sink (already present — preserve signature):** `appendAnswerToNote` @ `src/views/inline-runner-modal.ts:585-596`:
```typescript
private async appendAnswerToNote(text: string): Promise<void> {
  await this.plugin['insertMutex'].runExclusive(this.targetNote.path, async () => {
    const currentContent = await this.app.vault.read(this.targetNote);
    let toAppend = text;
    const sep = this.resolveSeparator();
    if (currentContent.endsWith(sep) && text.startsWith(sep)) {
      toAppend = text.slice(sep.length);
    }
    const newContent = currentContent + toAppend;
    await this.app.vault.modify(this.targetNote, newContent);
  });
}
```

**New helper to introduce (Wave 1b, reused in Wave 1c):**
```typescript
/** Mirrors handleAnswerClick's diff logic for snippet-dispatch sites. */
private async appendDeltaFromAccumulator(beforeText: string): Promise<void> {
  const afterText = this.extractAccumulatedText(this.runner.getState());
  if (afterText.length <= beforeText.length) return;
  if (!afterText.startsWith(beforeText)) {
    console.warn('[RadiProtocol] Text changed non-monotonically, skipping append');
    return;
  }
  await this.appendAnswerToNote(afterText.slice(beforeText.length));
}
```

**Current (buggy) `handleSnippetPickerSelection` to replace** @ `src/views/inline-runner-modal.ts:800-830`:
```typescript
// BUG at 812 and 821 — appendAnswerToNote receives RAW snippet.content / snippet.template
//                       instead of the accumulator delta.
this.runner.completeSnippet(snippet.content);
await this.appendAnswerToNote(snippet.content);   // ← RAW text, no separator
```

**Fix shape** (from RESEARCH.md Example A):
```typescript
// Capture baseline BEFORE completeSnippet so the delta includes the separator
const beforeState = this.runner.getState();
const beforeText = this.extractAccumulatedText(beforeState);

if (snippet.kind === 'md') {
  this.runner.completeSnippet(snippet.content);
  await this.appendDeltaFromAccumulator(beforeText);   // ← delta with separator
  this.snippetTreePicker?.unmount();
  this.snippetTreePicker = null;
  this.render();
  return;
}
// (same shape for JSON zero-placeholder arm)
```

---

**Analog B (INLINE-FIX-05 — sidebar parity target):** `src/views/runner-view.ts:997-1008` (`handleSnippetFill` JSON-with-placeholders arm):
```typescript
const modal = new SnippetFillInModal(this.app, snippet);
modal.open();
const rendered = await modal.result;
if (rendered !== null) {
  this.runner.completeSnippet(rendered);
} else {
  // D-11: Cancel = skip — advance runner with empty string
  this.runner.completeSnippet('');
}
void this.autoSaveSession();   // sidebar-only concern; inline does NOT autosave
this.render();
```

**Secondary sidebar reference (same pattern, at an earlier call site):** `src/views/runner-view.ts:908-919` — identical modal instantiation.

**Imports to add at top of `src/views/inline-runner-modal.ts`** (current import on line 11 is `import { renderSnippet, type JsonSnippet } from '../snippets/snippet-model';` — add one new line):
```typescript
import { SnippetFillInModal } from './snippet-fill-in-modal';
```

**Scope of deletion for `renderSnippetFillIn`** @ lines 891-973 — ENTIRE method body including the `values` map, the for-loop over placeholders, the `free-text` / `choice` branches, and the `btnRow` Cancel/Insert buttons. The `renderSnippet` import on line 11 may become unused — verify and drop it from the named imports if so (keep `JsonSnippet` if still referenced, which it is in the type signature of `handleSnippetFill` arguments).

**Scope of modification for the `awaiting-snippet-fill` render arm** @ lines 411-419 — keep as-is (already shows "Loading snippet..." then dispatches `handleSnippetFill`). The new `handleSnippetFill` resolves the `SnippetFillInModal.result` promise, calls `runner.completeSnippet(rendered | '')`, appends delta, then calls `render()` — the `awaiting-snippet-fill` state is transient.

**Shared-file constraint (CLAUDE.md) — explicit allow-list:**
- IN SCOPE: `handleSnippetPickerSelection` (800-830), `handleSnippetFill` (833-888), `renderSnippetFillIn` (891-973, to delete), and the `awaiting-snippet-fill` render arm (411-419).
- OUT OF SCOPE — do NOT edit: `handleActiveLeafChange` (443-477), `handleTargetNoteDeleted` (480-483), `updateModalPosition` (486-546), `resolveSeparator` (549-552), `handleAnswerClick` (555-576), `appendAnswerToNote` (585-596), `handleLoopBranchClick` (599-634), `extractAccumulatedText` (637-649), `renderOutputToolbar` (654+), `renderSnippetPicker`, `renderError` (976-984), constructor (44-63), `open()` (67+), `close()`, `buildContainer`, etc.

---

### 3. `src/__mocks__/obsidian.ts` (Wave 0 augmentation)

**Analog (self, append-only):** existing exports at `src/__mocks__/obsidian.ts:77-180`.

**Current state (minimal shape):**
- `Modal` class @ 110-123 (has `app`, `contentEl`, `titleEl`, `open`, `close`, `onOpen`, `onClose` — already sufficient for `SnippetFillInModal` construction in tests).
- `SuggestModal<T>` class @ 125-134 (already present).
- `TFile` class @ 168-173 (present with `path` field).
- `setIcon` function @ 177-179.
- **MISSING:** `TFolder` class (not exported).

**Addition required** (append at end of file, with Phase comment):
```typescript
/** TFolder mock — instanceof checks use this. Phase 59: added for main.ts::resolveProtocolCanvasFiles tests. */
export class TFolder {
  path: string;
  name: string;
  children: Array<TFile | TFolder>;
  constructor(path = '', children: Array<TFile | TFolder> = []) {
    this.path = path;
    this.name = path.split('/').pop() ?? '';
    this.children = children;
  }
}
```

**Extension required for `TFile`** (lines 168-173) — add `extension` and `basename` fields so canvas-file filtering works in tests:
```typescript
export class TFile {
  path: string;
  extension: string;
  basename: string;
  constructor(path = '') {
    this.path = path;
    const parts = path.split('/');
    const leaf = parts[parts.length - 1] ?? '';
    const dot = leaf.lastIndexOf('.');
    this.extension = dot >= 0 ? leaf.slice(dot + 1) : '';
    this.basename = dot >= 0 ? leaf.slice(0, dot) : leaf;
  }
}
```

**Shared-file constraint:** The existing `Modal`, `SuggestModal`, `Setting`, `Notice`, `Plugin`, `ItemView`, etc. exports MUST remain unchanged — per-test overrides via local `vi.mock('obsidian', …)` factories handle DOM-ish requirements (see the snippet-fill-in-modal.test.ts pattern below).

**Alternative path (per-test override):** Tests that need a richer `Modal.contentEl` (with `querySelector`, `addEventListener`, etc.) should install a LOCAL `vi.mock('obsidian', () => { … })` factory, following the pattern in `src/__tests__/views/snippet-fill-in-modal.test.ts:195-240` (reproduced below under pattern #4). Do NOT make the global mock heavier — it breaks unrelated tests.

---

### 4. `src/__tests__/views/inline-runner-modal.test.ts` (NEW — Wave 0)

**Analog A (MockEl pattern for DOM-ish mocks):** `src/__tests__/views/snippet-fill-in-modal.test.ts:18-192`

**Key infra excerpts (copy and adapt):**

`MockEl` interface declaration (lines 19-53 of analog):
```typescript
interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _value: string;
  _disabled: boolean;
  _type: string;
  _checked: boolean;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  name: string;
  inputMode: string;
  readOnly: boolean;
  dataset: Record<string, string>;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  toggleClass: (c: string, on?: boolean) => void;
  hasClass: (c: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
}
```

`makeEl` factory (lines 55-159 of analog) — includes `Object.defineProperty` for accessor-backed `textContent`/`value`/`disabled`/`type`/`checked`, plus `walk`/`buildMatcher` selector helpers (lines 162-192).

**Local obsidian mock override with enhanced Modal** (analog lines 195-240):
```typescript
vi.mock('obsidian', () => {
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    modalEl: { style: Record<string, string> };
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = makeEl('div');
      this.titleEl = makeEl('div');
      this.modalEl = { style: {} };
    }
    open(): void { this.onOpen(); }
    close(): void { this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
  }
  class Notice { constructor(_m: string) {} }
  class Plugin {}
  class ItemView {}
  class WorkspaceLeaf {}
  class PluginSettingTab {}
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    getSuggestions(_q: string): T[] { return []; }
    renderSuggestion(): void {}
    onChooseSuggestion(): void {}
    setPlaceholder(): void {}
    open(): void {}
    close(): void {}
  }
  class Setting { /* no-op chainables — copy from analog 227-237 */ }
  class TFile { path: string; constructor(p = '') { this.path = p; } }
  class TFolder { /* new — mirror the structure added to __mocks__/obsidian.ts */ }
  return { Modal, Notice, Plugin, ItemView, WorkspaceLeaf, PluginSettingTab, SuggestModal, Setting, TFile, TFolder };
});
```

**Analog B (FakeNode + click-dispatch pattern for runner-view-style tests):** `src/__tests__/views/runner-snippet-sibling-button.test.ts:37-110`

This pattern is relevant when a test needs to simulate clicking a rendered button element. Use this SECONDARY to the MockEl pattern — MockEl's `addEventListener` + `dispatchEvent` is richer. Only copy FakeNode if the test specifically needs the simpler `_clickHandler` shortcut.

**Resolving `SnippetFillInModal.result` promise in tests (INLINE-FIX-05 (a), (b), (c)):**
`SnippetFillInModal` extends `Modal` (the mocked one). The `result` promise is exposed as a `readonly` field @ `src/views/snippet-fill-in-modal.ts:32`. Tests resolve it by:
1. Intercepting the `new SnippetFillInModal(...)` call — either via `vi.spyOn` on the constructor OR by `vi.mock('../../views/snippet-fill-in-modal', ...)` with a factory that returns a controllable double.
2. Pattern reference for `vi.mock` of a view sibling: `src/__tests__/views/runner-snippet-sibling-button.test.ts:24-31` (mocks `SnippetTreePicker`).

**Recommended test file scaffold:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
// [MockEl infrastructure block — copy from snippet-fill-in-modal.test.ts:18-192]
// [Local obsidian mock override — copy pattern above]

// Mock SnippetFillInModal so tests can control `result` resolution
vi.mock('../../views/snippet-fill-in-modal', () => {
  class SnippetFillInModal {
    result: Promise<string | null>;
    private resolve!: (v: string | null) => void;
    constructor(_app: unknown, _snippet: unknown) {
      this.result = new Promise(res => { this.resolve = res; });
    }
    open(): void {}
    close(): void {}
    // Test-only helper
    __resolve(v: string | null): void { this.resolve(v); }
  }
  return { SnippetFillInModal };
});

import { InlineRunnerModal } from '../../views/inline-runner-modal';
```

---

### 5. `src/__tests__/main-inline-command.test.ts` (NEW — Wave 0)

**Analog A (vault-mock pattern for pure helper):** `src/__tests__/vault-utils.test.ts:1-27`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ensureFolderPath } from '../utils/vault-utils';

function makeVault(exists: boolean) {
  return {
    adapter: { exists: vi.fn().mockResolvedValue(exists) },
    createFolder: vi.fn().mockResolvedValue(undefined),
  };
}
```

**Extended vault mock for `resolveProtocolCanvasFiles`:**
```typescript
import { TFile, TFolder } from 'obsidian';   // uses the augmented mock

function makeVault(tree: Record<string, TFile | TFolder>) {
  // Tree keyed by path. TFolder.children points to its kids.
  const allFiles: TFile[] = Object.values(tree).filter(
    (f): f is TFile => f instanceof TFile
  );
  return {
    getAbstractFileByPath: vi.fn((p: string) => tree[p] ?? null),
    getFiles: vi.fn(() => allFiles),
  };
}
```

**Test matrix (from RESEARCH.md Wave 0 Validation Architecture):**
- INLINE-FIX-01 (a): trailing-slash trimmed — `"templates/ALGO/"` → resolves same as `"templates/ALGO"`
- INLINE-FIX-01 (b): leading-slash stripped — `"/templates/ALGO"` → resolves
- INLINE-FIX-01 (c): Windows backslash — `"templates\\ALGO"` → resolves
- INLINE-FIX-01 (d): fallback scan — `getAbstractFileByPath` returns `null`, but `getFiles()` contains canvases under the prefix → returns them
- INLINE-FIX-01 (e): empty folder — returns `[]` (the D8 guard in `handleRunProtocolInline` emits the Notice; the helper itself does not)

**Direct testing strategy:** Extract `resolveProtocolCanvasFiles` as a pure method/function. Test it directly with a mocked vault. Do NOT attempt to instrument `handleRunProtocolInline` — the inline `SuggestModal` class expression makes that method essentially untestable without refactor.

**Analog B (if command-level test is desired):** `src/__tests__/runner-commands.test.ts` exists in the tree but was not read here (outside scope of this phase's NEW test). If the planner wants a command-registration test, consult that file first.

---

## Shared Patterns

### Append-only CSS / shared-file rule (CLAUDE.md)
**Apply to:** `src/main.ts`, `src/views/inline-runner-modal.ts`, `src/__mocks__/obsidian.ts`.

Only modify the exact line ranges called out per file. Do NOT delete unrelated methods, event listeners, or imports. Verify the diff touches ONLY the listed ranges before commit.

### Accumulator-diff pattern (single source of truth for note append)
**Source:** `src/views/inline-runner-modal.ts:555-576` (handleAnswerClick).
**Apply to:** All snippet-dispatch paths in `inline-runner-modal.ts` — do NOT re-apply separator manually. The runner's `completeSnippet` + `TextAccumulator.appendWithSeparator` is the single source of truth; inline mode reads the delta.

### SnippetFillInModal invocation (sidebar parity)
**Source:** `src/views/runner-view.ts:908-919` and `src/views/runner-view.ts:997-1008`.
**Apply to:** `handleSnippetFill` in `inline-runner-modal.ts`.
**Key contract:** `modal.result` is `Promise<string | null>`. Non-null = rendered content → `runner.completeSnippet(rendered)`. Null (cancel/escape) = `runner.completeSnippet('')` (D-11/D-14). After resolution, apply the accumulator-diff pattern to append the delta.

### WriteMutex for all vault writes
**Source:** `src/views/inline-runner-modal.ts:585-596` (appendAnswerToNote).
**Apply to:** Any new write path (none expected; reuse `appendAnswerToNote` verbatim). Never call `vault.modify` outside the mutex.

### Test `vi.mock('obsidian', ...)` local override
**Source:** `src/__tests__/views/snippet-fill-in-modal.test.ts:195-240`.
**Apply to:** Any test needing DOM-ish Modal contentEl. Prefer local override over globally heavying `src/__mocks__/obsidian.ts`.

### Test `vi.mock('../../views/<sibling>', ...)` for dependency isolation
**Source:** `src/__tests__/views/runner-snippet-sibling-button.test.ts:24-31`.
**Apply to:** `inline-runner-modal.test.ts` — mock `SnippetFillInModal` and/or `SnippetTreePicker` so tests can control promise resolution and not exercise their rendering code paths.

---

## No Analog Found

None. All five target files have in-repo analogs with HIGH fidelity. The "NEW" files are composites of proven patterns; the "MODIFY" files' analogs are the files themselves (self-refactor) plus the sidebar reference (`runner-view.ts`) which is read-only.

---

## Metadata

**Analog search scope:**
- `src/main.ts`
- `src/views/inline-runner-modal.ts`, `src/views/runner-view.ts`, `src/views/snippet-fill-in-modal.ts`, `src/views/canvas-selector-widget.ts`
- `src/__mocks__/obsidian.ts`
- `src/__tests__/**/*.test.ts` (31 files scanned; 2 primary analogs read in detail)

**Files read in detail:**
- `src/views/inline-runner-modal.ts` (lines 1-80, 400-660, 790-985)
- `src/views/runner-view.ts` (lines 890-1010)
- `src/views/snippet-fill-in-modal.ts` (lines 1-60)
- `src/main.ts` (lines 400-495)
- `src/__mocks__/obsidian.ts` (lines 1-180, full)
- `src/__tests__/views/snippet-fill-in-modal.test.ts` (lines 1-250)
- `src/__tests__/views/runner-snippet-sibling-button.test.ts` (lines 1-110)
- `src/__tests__/vault-utils.test.ts` (full)

**Pattern extraction date:** 2026-04-24
