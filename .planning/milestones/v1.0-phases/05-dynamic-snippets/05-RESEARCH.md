# Phase 5: Dynamic Snippets — Research

**Researched:** 2026-04-06
**Domain:** Obsidian plugin — Snippet CRUD system, fill-in modal, per-file async write mutex, master-detail ItemView
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Master-detail two-column layout. Left column: scrollable list of snippet names with a
**[+ New snippet]** button at the top. Right column: edit form for the selected snippet —
Name field, Template textarea, Placeholders section with [+ Add placeholder], and
**[Save] [Delete]** buttons at the bottom.

**D-02:** When no snippet is selected (empty state or brand-new vault), the right column shows
a prompt: "Select a snippet to edit, or click + New snippet to create one." No blank form.

**D-03:** [+ New snippet] creates an unsaved draft entry in the list (e.g., "Untitled") and
immediately selects it so the user can start filling in the name and template.

**D-04:** Under the Template textarea, a **[+ Add placeholder]** button opens a mini-form
(inline, not a separate modal) with two fields: Label (human-readable) and Type (dropdown:
free-text / choice / multi-choice / number). On confirm: auto-generates an `id` by slugifying
the label, inserts `{{slug}}` at cursor position in the Template textarea, appends a new
placeholder row to the Placeholders list. Raw `id` values are never shown to users.

**D-05:** Existing placeholder rows show: label, type, and an inline **[×]** remove button. For
`choice`/`multi-choice` types, clicking the row expands options input inline. Removing a
placeholder does NOT auto-remove `{{id}}` from the template — a warning badge highlights
orphaned references.

**D-06:** Options for `choice` and `multi-choice` placeholders are entered as **individual text
fields with [×] remove buttons** and a **[+ Add option]** button. One field per option,
rendered vertically.

**D-07:** `multi-choice` placeholders have an additional **Join separator** field (default: `", "`)
that defines how selected values are concatenated into the final text.

**D-08:** `number` placeholders show a single **Unit** text field (optional, e.g. `mm`, `cm`).
When unit is provided, the rendered output is `{value} {unit}` (e.g. `12 mm`).

**D-09:** During snippet fill-in, every `choice` and `multi-choice` field shows the predefined
options (radio buttons for `choice`, checkboxes for `multi-choice`) plus a **"Custom: [text
input]"** field at the bottom. Typing in the custom field auto-deselects any radio/checkbox
selection.

**D-10:** `SnippetFillInModal` extends Obsidian's `Modal` class. It is opened by `RunnerView`
when `runner.getState().status === 'awaiting-snippet-fill'`. After the user confirms,
`RunnerView` calls `runner.completeSnippet(renderedText)`. The modal has zero knowledge of
the runner — it receives a `SnippetFile` and returns a rendered string (or null on cancel).

**D-11:** Cancel behavior: if the user closes/cancels the fill-in modal, the snippet is **skipped**
(runner advances past the text-block node without appending any text).

**D-12:** Tab-navigation between placeholder fields uses standard HTML tab order — fields are
rendered in `placeholders[]` array order. A visible **[Confirm]** button is the last tab stop.

**D-13:** Live preview is a read-only textarea at the bottom of the modal, updated on every
keystroke/selection change. Shows the full rendered snippet text with current placeholder
values substituted.

**D-14:** `SnippetService` receives `this.app` and `settings` in its constructor. Implements:
`list()`, `load(id)`, `save(snippet)`, `delete(id)`, `exists(id)`.

**D-15:** Snippet files stored at `.radiprotocol/snippets/{snippet.id}.json`. Folder ensured
via `vault.createFolder()` before every write. `WriteMutex` (per-file key = full path) wraps
every `vault.modify()` call. `async-mutex` is the backing library.

**D-16:** `SnippetPlaceholder` interface in `snippet-model.ts` needs three new optional fields:
`options?: string[]` (for choice/multi-choice), `unit?: string` (for number),
`joinSeparator?: string` (for multi-choice, default `", "`).

**D-17:** `RunnerView` already handles `awaiting-snippet-fill` state detection (Phase 3 stub
renders a placeholder message). Phase 5 replaces that stub with the real `SnippetFillInModal`
open call. No structural changes to `ProtocolRunner`.

### Claude's Discretion

- Exact styling (padding, colors, font sizes) for the snippet manager and fill-in modal
- Whether [Save] triggers on every field change (auto-save) or only on explicit button click
- Error message wording for missing snippet folder, corrupt JSON, or save failures
- Exact tab-stop order within the snippet manager form

### Deferred Ideas (OUT OF SCOPE)

- Linked placeholders across report sections
- Optional sections in snippets (conditional blocks)
- Snippet preview in `SnippetManagerView` with sample values
- Drag-to-reorder placeholder rows
- Mandatory field enforcement (warn if placeholder left blank)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SNIP-01 | `SnippetService` provides full CRUD for snippet files stored as individual JSON files in `.radiprotocol/snippets/` | D-14, D-15: service pattern established; stub at `src/snippets/snippet-service.ts` ready for implementation |
| SNIP-02 | Support four placeholder types: `free-text`, `choice`, `multi-choice`, `number` | D-16: `SnippetPlaceholder` interface extension documented; three new fields identified |
| SNIP-03 | Every placeholder has a human-readable label; raw placeholder syntax is never exposed to the user | D-04: slug → label mapping; D-12: modal shows label not id |
| SNIP-04 | `SnippetFillInModal` presents all placeholders as labeled input fields with tab-navigation | D-12: standard DOM tab order; fields in `placeholders[]` order; UI-SPEC fieldset/legend pattern |
| SNIP-05 | `SnippetFillInModal` shows live preview of rendered snippet text as user fills in values | D-13: read-only textarea updated on every `input` event; `rp-snippet-preview` CSS class |
| SNIP-06 | Runner integration: `TextBlockNode` with `snippetId` transitions runner to `awaiting-snippet-fill` and opens fill-in modal | `AwaitingSnippetFillState` already defined; `completeSnippet()` already implemented; `RunnerView` stub exists |
| SNIP-07 | `WriteMutex` (per-file async lock) wraps every `vault.modify()` on snippet files | `async-mutex` v0.5.0 confirmed available on npm; `WriteMutex` stub at `src/utils/write-mutex.ts` |
| SNIP-08 | Snippet folder created automatically before every write | `ensureFolderPath()` stub in `src/utils/vault-utils.ts`; `vault.createFolder()` pattern documented |
| SNIP-09 | Choice placeholder fields always allow free-text override | D-09: "Custom:" input row below all options; auto-deselects radio/checkbox |
</phase_requirements>

---

## Summary

Phase 5 is an implementation phase with no architecture unknowns. All structural scaffolding was laid in prior phases: `SnippetFile`/`SnippetPlaceholder` interfaces exist in `snippet-model.ts`, `WriteMutex` and `ensureFolderPath()` stubs exist, the `SnippetManagerView` is registered as an `ItemView`, and `runner.completeSnippet()` is fully implemented and tested. The `AwaitingSnippetFillState` interface and `RunnerView` stub are wired. Phase 5 fills in these stubs and connects them.

The four primary deliverables are: (1) `SnippetService` CRUD with `WriteMutex` protection, (2) `WriteMutex` implementation using `async-mutex` (NOT yet installed — must be added to `dependencies`), (3) `SnippetFillInModal` extending Obsidian's `Modal`, and (4) `SnippetManagerView` full UI replacing the Phase 3 stub.

The `RunnerView` is a Phase 3 stub that also needs to be implemented — its `awaiting-snippet-fill` branch wiring is technically a Phase 5 task, but the runner view itself has not been built yet. This is the most significant cross-phase dependency: Phase 5 requires a functional `RunnerView` to exercise SNIP-06.

**Primary recommendation:** Implement in wave order — (W1) data model + `WriteMutex` + `SnippetService`, (W2) `SnippetManagerView` UI, (W3) `SnippetFillInModal`, (W4) `RunnerView` + runner integration wiring. Each wave is independently testable before the next begins.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `obsidian` | 1.12.3 | `Modal`, `ItemView`, `App`, `vault.*` | Plugin runtime — all UI classes, vault API |
| `async-mutex` | 0.5.0 | Per-file async write lock (`Mutex`) | SNIP-07; already listed in STACK.md; NOT yet in `package.json` — must be installed |
| `vitest` | ^4.1.2 | Unit tests for pure modules | Already configured; `src/__tests__/**/*.test.ts` included |

[VERIFIED: npm registry] `async-mutex` current version is 0.5.0 (confirmed via `npm view async-mutex version`).
[VERIFIED: codebase] `package.json` does NOT currently list `async-mutex` — it must be added to `dependencies` before the `WriteMutex` implementation can compile.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 6.0.2 | Type safety; strict null checks | All source files |
| esbuild | 0.28.0 | Bundle to `main.js` | Build pipeline only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `async-mutex` | Manual Promise queue | `async-mutex` is already the decided library (STACK.md); rolling a mutex is hand-rolling a solved problem |
| Obsidian `Modal` | Inline ItemView fill-in | `Modal` is the locked decision (D-10); inline approach would complicate runner state handling |

**Installation (required before implementation):**

```bash
npm install async-mutex
```

**Version verification:** `async-mutex` 0.5.0 confirmed on npm registry 2026-04-06. [VERIFIED: npm registry]

---

## Architecture Patterns

### Recommended Project Structure (Phase 5 additions)

```
src/
├── snippets/
│   ├── snippet-model.ts      # EXTEND: add options, unit, joinSeparator to SnippetPlaceholder
│   └── snippet-service.ts    # IMPLEMENT: full CRUD
├── utils/
│   ├── write-mutex.ts        # IMPLEMENT: WriteMutex using async-mutex
│   └── vault-utils.ts        # IMPLEMENT: ensureFolderPath(vault, path)
└── views/
    ├── snippet-manager-view.ts   # IMPLEMENT: full master-detail UI
    ├── runner-view.ts            # IMPLEMENT: full RunnerView + awaiting-snippet-fill branch
    └── snippet-fill-in-modal.ts  # CREATE: new file — SnippetFillInModal extends Modal
```

Note: `src/styles.css` currently has only a placeholder comment — Phase 5 populates it with all `rp-snippet-*` CSS classes defined in the UI-SPEC.

### Pattern 1: WriteMutex (per-file async lock)

**What:** A map of `path → Mutex` ensures only one write operation at a time per file path. Uses `async-mutex` `Mutex` class.

**When to use:** Wrap every `vault.modify()` call on snippet files. Never call `vault.modify()` without acquiring the lock for that file's path first.

**Example:**

```typescript
// src/utils/write-mutex.ts
import { Mutex } from 'async-mutex';

export class WriteMutex {
  private locks = new Map<string, Mutex>();

  private getLock(path: string): Mutex {
    let lock = this.locks.get(path);
    if (lock === undefined) {
      lock = new Mutex();
      this.locks.set(path, lock);
    }
    return lock;
  }

  async runExclusive<T>(path: string, fn: () => Promise<T>): Promise<T> {
    const lock = this.getLock(path);
    return lock.runExclusive(fn);
  }
}
```

[ASSUMED] This implementation pattern is consistent with `async-mutex` documentation and the project's pure-module constraint (zero Obsidian imports). The `async-mutex` API is stable.

### Pattern 2: SnippetService — Vault CRUD

**What:** Service receives `(app: App, settings: RadiProtocolSettings)`. Reads/writes JSON files using `app.vault.*`. Wraps every write in `WriteMutex.runExclusive()`. Calls `ensureFolderPath()` before every write.

**Key vault operations used:**

```typescript
// Read — check existence first (vault.adapter.exists is the correct existence check)
const exists = await app.vault.adapter.exists(filePath);
const raw = await app.vault.adapter.read(filePath);

// Create new file
await app.vault.create(filePath, JSON.stringify(snippet, null, 2));

// Modify existing file — always wrapped in WriteMutex
await mutex.runExclusive(filePath, async () => {
  await app.vault.adapter.write(filePath, JSON.stringify(snippet, null, 2));
});

// Delete
const file = app.vault.getAbstractFileByPath(filePath);
if (file instanceof TFile) {
  await app.vault.delete(file);
}

// Ensure folder
await app.vault.createFolder(folderPath);
// Note: vault.createFolder() throws if folder already exists on some Obsidian versions.
// Guard with: if (!(await app.vault.adapter.exists(folderPath))) { ... }
```

[VERIFIED: codebase] The existing `vault.modify()` guard pattern (`adapter.exists()` before `modify()`) is used in `editor-panel-view.ts` — consistent with project convention.

[ASSUMED] `vault.adapter.write()` is the correct low-level write for plain path-based writes; `vault.modify(TFile)` requires a `TFile` instance. Either approach is valid. Using `adapter.write` avoids needing to resolve a `TFile` object first.

### Pattern 3: SnippetFillInModal (Obsidian Modal subclass)

**What:** Extend Obsidian's `Modal` class. Build the entire UI in `onOpen()`. Return a Promise that resolves to `string | null`. The caller `await`s this promise via a pattern where `resolve` is stored and called by [Confirm] / [Cancel].

**Important constraint:** Obsidian's `Modal.open()` is synchronous and returns `void`. To make the modal awaitable, use a stored Promise resolver:

```typescript
// src/views/snippet-fill-in-modal.ts
import { Modal, App } from 'obsidian';
import type { SnippetFile } from '../snippets/snippet-model';

export class SnippetFillInModal extends Modal {
  private snippet: SnippetFile;
  private resolve!: (value: string | null) => void;
  readonly result: Promise<string | null>;

  constructor(app: App, snippet: SnippetFile) {
    super(app);
    this.snippet = snippet;
    this.result = new Promise<string | null>(res => { this.resolve = res; });
  }

  onOpen(): void {
    this.titleEl.setText(this.snippet.name);
    // Build placeholder fields into this.contentEl
    // Build live preview textarea
    // [Confirm] button: this.resolve(renderSnippet(this.snippet, values)); this.close();
    // [Cancel] button: this.resolve(null); this.close();
  }

  onClose(): void {
    // If closed via Escape (not Confirm or Cancel), resolve null
    this.resolve(null);
    this.contentEl.empty();
  }
}

// Usage in RunnerView:
// const modal = new SnippetFillInModal(this.app, snippet);
// modal.open();
// const rendered = await modal.result;
// if (rendered !== null) { runner.completeSnippet(rendered); }
// else { runner.skipSnippet(); }  // or equivalent cancel path
```

[ASSUMED] The `Promise`-resolver pattern for making `Modal` awaitable is a well-established Obsidian plugin idiom. The `Modal` base class provides `titleEl`, `contentEl`, and the `close()` method.

**`onClose()` double-resolve guard:** Since `onClose()` can fire after `[Confirm]` already resolved the promise, the implementation should guard against double-resolution. Use a `resolved` flag:

```typescript
private resolved = false;

private safeResolve(value: string | null): void {
  if (!this.resolved) {
    this.resolved = true;
    this.resolve(value);
  }
}
```

### Pattern 4: Snippet Template Rendering

**What:** Replace `{{placeholder-id}}` tokens with the user-supplied values. Pure function, zero Obsidian imports — fully unit-testable.

```typescript
// Can live in snippet-model.ts or a new snippet-renderer.ts (pure module)
export function renderSnippet(
  snippet: SnippetFile,
  values: Record<string, string>  // key = placeholder.id, value = filled string
): string {
  let output = snippet.template;
  for (const placeholder of snippet.placeholders) {
    const value = values[placeholder.id] ?? '';
    output = output.replaceAll(`{{${placeholder.id}}}`, value);
  }
  return output;
}
```

**Number+unit rendering:**
```typescript
// For number placeholders with a unit:
const numValue = values[placeholder.id] ?? '';
const rendered = placeholder.unit ? `${numValue} ${placeholder.unit}`.trim() : numValue;
```

**Multi-choice rendering:**
```typescript
// For multi-choice: selected values joined by joinSeparator
const selected: string[] = getSelectedValues(placeholder, values);
const rendered = selected.join(placeholder.joinSeparator ?? ', ');
```

[VERIFIED: codebase] `String.prototype.replaceAll` is available in ES2021+; TypeScript target is ES6, but the `lib` includes `ES7`. For safety, a `split/join` approach works in all targets: `output.split(`{{${id}}}`).join(value)`.

### Pattern 5: Label Slugification

**What:** Convert a human-readable label to a valid placeholder `id`. Used in D-04 (add placeholder flow).

```typescript
// Pure function — keep in snippet-model.ts or a utility
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric runs with hyphen
    .replace(/^-+|-+$/g, '');      // Strip leading/trailing hyphens
}
// "Patient age" → "patient-age"
// "Size (mm)" → "size-mm"
```

[ASSUMED] Standard slugification pattern. No library needed.

### Pattern 6: Cursor Position Insert in Textarea

**What:** Inserting `{{slug}}` at the cursor position in the Template textarea (D-04).

```typescript
// Works for <textarea> elements
function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  textarea.value =
    textarea.value.substring(0, start) + text + textarea.value.substring(end);
  // Place cursor after inserted text
  textarea.selectionStart = start + text.length;
  textarea.selectionEnd = start + text.length;
  // Dispatch input event so any listeners update
  textarea.dispatchEvent(new Event('input'));
}
```

[ASSUMED] Standard DOM pattern for textarea cursor insertion. Works in Obsidian's Electron environment.

### Pattern 7: SnippetManagerView (master-detail ItemView)

**What:** `ItemView` with two-column layout. Left: snippet list. Right: edit form for selected snippet.

**Constructor pattern (consistent with project pattern):**
```typescript
export class SnippetManagerView extends ItemView {
  private plugin: RadiProtocolPlugin;  // Access snippetService via plugin

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }
```

**Note:** The existing `SnippetManagerView` stub constructor only takes `leaf` (no `plugin`). The constructor signature must be updated, and the registration in `main.ts` must pass the plugin reference.

**Existing `main.ts` only registers `EditorPanelView`** — `SnippetManagerView` is not yet registered and its activation command (`open-snippet-manager`) is not yet wired. Both must be added in `main.ts` during Phase 5.

### Anti-Patterns to Avoid

- **Double vault.modify() without mutex:** Even a single missed `vault.modify()` call outside `WriteMutex` opens a race-condition window (SNIP-07). Every write path must go through the mutex.
- **Assuming snippet folder exists:** `vault.createFolder()` must be called before every write, guarded by an existence check (SNIP-08). Calling `createFolder()` on an existing path throws on some Obsidian versions.
- **innerHTML in modal or view:** Zero `innerHTML` — use `createEl()`, `createDiv()` throughout (NFR constraint; ESLint-enforced).
- **Raw addEventListener:** Use `this.registerDomEvent()` in `ItemView`, and store+clean listeners manually in `Modal.onClose()` (Modal does not extend Component). [ASSUMED] Modal lacks `registerDomEvent` — use direct event listeners, cleared in `onClose`.
- **Floating promises in event handlers:** All `async` callbacks in `registerDomEvent` must be wrapped: `this.registerDomEvent(el, 'click', () => { void this.handleSave(); })`.
- **Exposing placeholder id to users:** The `id` field is internal; the UI always shows `label`. Never render `id` as visible text in the manager or modal.
- **resolveAll() without guard in Modal.onClose():** If `[Confirm]` already resolved the promise and then `onClose()` also calls resolve, a double-resolve would send `null` to the caller. Always use the `resolved` guard flag.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-file async write serialization | Custom Promise queue or semaphore | `async-mutex` `Mutex` class | Already decided (STACK.md); battle-tested; correct cancellation semantics |
| Snippet template token replacement | Complex regex engine | `String.split().join()` or `replaceAll()` | Template syntax is trivially simple: `{{id}}` — no nesting, no conditionals |
| Label-to-slug conversion | External library | Inline 2-line function | No edge cases relevant to medical labels that require a full slugify library |
| Modal awaitable wrapper | New framework | Promise-resolver pattern (Pattern 3 above) | Standard Obsidian idiom; no library needed |

**Key insight:** The snippet system's apparent complexity lives in the UI surface area (many field types, live preview, inline mini-forms), not in algorithmic logic. The data model and rendering are simple; investing implementation effort in the DOM construction is correct.

---

## Common Pitfalls

### Pitfall 1: `async-mutex` Not in `package.json`

**What goes wrong:** TypeScript compiler error `Cannot find module 'async-mutex'` when implementing `WriteMutex`. Build fails.

**Why it happens:** `async-mutex` is listed in `STACK.md` as a decided dependency but was NOT added to `package.json` during prior phases. The project currently has zero `dependencies` entries beyond `obsidian`. [VERIFIED: codebase — `package.json` has no `async-mutex` entry]

**How to avoid:** First task of Wave 1 must be `npm install async-mutex`. Then add it to `package.json` `dependencies` (not `devDependencies`) because it ships in the production bundle.

**Warning signs:** `npm list async-mutex` returns `(empty)`.

---

### Pitfall 2: `vault.createFolder()` Throws on Existing Path

**What goes wrong:** `await vault.createFolder('.radiprotocol/snippets')` throws `Error: Folder already exists` on Obsidian versions that do not silently succeed.

**Why it happens:** Obsidian's `Vault.createFolder()` is not idempotent on all versions. Some versions throw, some return silently.

**How to avoid:** Always guard with existence check before creating:
```typescript
export async function ensureFolderPath(vault: Vault, folderPath: string): Promise<void> {
  const exists = await vault.adapter.exists(folderPath);
  if (!exists) {
    await vault.createFolder(folderPath);
  }
}
```
[ASSUMED] Based on community-documented behavior. Multiple plugin authors report this behavior. Guard is the universal recommendation.

---

### Pitfall 3: Modal `onClose()` Fires After `[Confirm]`

**What goes wrong:** User clicks [Confirm], the modal closes, `onClose()` fires and calls `this.resolve(null)`, overwriting the `string` value already resolved. The caller receives `null` instead of the rendered text, so the snippet is silently skipped.

**Why it happens:** Obsidian always calls `onClose()` when the modal closes, regardless of whether [Confirm] or [Cancel] triggered the close.

**How to avoid:** Use the `resolved` boolean guard (see Pattern 3 above). Set `resolved = true` before calling `this.close()` in the confirm handler.

---

### Pitfall 4: `SnippetManagerView` Constructor Not Updated in `main.ts`

**What goes wrong:** The `SnippetManagerView` stub constructor only accepts `leaf`. After Phase 5 adds `plugin` as a second parameter, the registration call `new SnippetManagerView(leaf)` in `main.ts` will produce a TypeScript error or a runtime crash where `this.plugin` is undefined.

**Why it happens:** `main.ts` was not updated in prior phases to pass the plugin reference (the stub never needed it).

**How to avoid:** When updating `SnippetManagerView` constructor signature, simultaneously update `main.ts` to:
1. Register `SnippetManagerView` with plugin reference passed in.
2. Add the `open-snippet-manager` command.
3. Instantiate `SnippetService` and store it as `this.snippetService`.

---

### Pitfall 5: `RunnerView` Is Still a Phase 3 Stub

**What goes wrong:** SNIP-06 requires `RunnerView` to open `SnippetFillInModal` when `awaiting-snippet-fill` state is detected. But the current `RunnerView` is a Phase 3 stub with only a placeholder `<p>` in `onOpen()`. Phase 5 cannot implement the runner integration branch without first implementing the rest of `RunnerView`.

**Why it happens:** Phase 3 was listed as "Not started" in `STATE.md`, but Phase 4 was completed. The phases were executed out of order — Phase 5 depends on Phase 3 UI work.

**How to avoid:** The planner must include a task to implement `RunnerView` fully (or at minimum the `awaiting-snippet-fill` integration branch) as a prerequisite wave before the runner integration task. This is the highest-risk dependency in Phase 5.

---

### Pitfall 6: Live Preview Performance with Large Templates

**What goes wrong:** If the template has many placeholders and `renderSnippet()` is called on every keypress via an `input` event listener, performance degrades perceptibly on large templates.

**Why it happens:** Frequent string rebuilding on each keystroke.

**How to avoid:** For v1, this is not a real risk — radiology report snippets are small (< 500 characters). No debouncing is needed. If it becomes an issue, a 50ms debounce on the preview update is sufficient.

---

### Pitfall 7: `replaceAll` Availability

**What goes wrong:** TypeScript error `Property 'replaceAll' does not exist on type 'string'` because the `lib` configuration does not include `ES2021`.

**Why it happens:** `tsconfig.json` has `lib: ["DOM", "ES5", "ES6", "ES7"]` — `ES2021` (where `replaceAll` was standardized) is not in the list. [VERIFIED: codebase — tsconfig.json lib array]

**How to avoid:** Use `split/join` pattern instead of `replaceAll`:
```typescript
output = output.split(`{{${placeholder.id}}}`).join(value);
```
This works with ES6 lib and is functionally identical.

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Obsidian Modal Extension (base pattern)

```typescript
// Source: Obsidian API — Modal class is in obsidian module
// The mock in src/__mocks__/obsidian.ts confirms: Modal has app, contentEl, open(), close()
import { Modal, App } from 'obsidian';

export class SnippetFillInModal extends Modal {
  constructor(app: App, private snippet: SnippetFile) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(this.snippet.name);
    const { contentEl } = this;
    contentEl.addClass('rp-snippet-modal');
    // ... build UI
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
```

[VERIFIED: codebase — `src/__mocks__/obsidian.ts` shows `Modal` has `app`, `contentEl`, `open()`, `close()`]

### ItemView Registration (main.ts pattern)

```typescript
// Consistent with how EditorPanelView is registered (verified in main.ts)
this.registerView(
  SNIPPET_MANAGER_VIEW_TYPE,
  (leaf) => new SnippetManagerView(leaf, this)
);

this.addCommand({
  id: 'open-snippet-manager',
  name: 'Open snippet manager',
  callback: () => { void this.activateSnippetManagerView(); },
});
```

[VERIFIED: codebase — `main.ts` lines 41–48 show `EditorPanelView` registration pattern]

### Vault Write Guard Pattern

```typescript
// Consistent with existing vault.modify guard in editor-panel-view.ts
// Pattern: check existence → create or modify
const filePath = `${this.folderPath}/${snippet.id}.json`;
const content = JSON.stringify(snippet, null, 2);

await this.mutex.runExclusive(filePath, async () => {
  const exists = await this.app.vault.adapter.exists(filePath);
  if (exists) {
    await this.app.vault.adapter.write(filePath, content);
  } else {
    await this.app.vault.create(filePath, content);
  }
});
```

[VERIFIED: codebase — existence-before-modify pattern confirmed in `editor-panel-view.ts`]

### createEl DOM Construction (project pattern)

```typescript
// Source: All existing views use this pattern — no innerHTML ever
// Fieldset for accessibility (radio/checkbox groups) per UI-SPEC
const fieldset = this.contentEl.createEl('fieldset');
const legend = fieldset.createEl('legend', { text: placeholder.label });
legend.addClass('rp-snippet-modal-label');

for (const option of placeholder.options ?? []) {
  const row = fieldset.createDiv({ cls: 'rp-snippet-modal-options' });
  const radio = row.createEl('input');
  radio.type = 'radio';
  radio.name = `placeholder-${placeholder.id}`;
  radio.value = option;
  row.createEl('label', { text: option });
}
```

[VERIFIED: codebase — `createEl`, `createDiv`, `addClass` are the project-standard DOM construction methods throughout `editor-panel-view.ts` and `runner-view.ts`]

### registerDomEvent Pattern

```typescript
// In ItemView (SnippetManagerView), event listeners use registerDomEvent
// Source: verified in editor-panel-view.ts
this.registerDomEvent(saveBtn, 'click', () => { void this.handleSave(); });
this.registerDomEvent(deleteBtn, 'click', () => { this.handleDelete(); });

// In Modal (SnippetFillInModal), Modal does not extend Component —
// use direct addEventListener, cleaned up in onClose()
confirmBtn.addEventListener('click', () => { this.handleConfirm(); });
// In onClose(): contentEl.empty() disposes all child elements
```

[VERIFIED: codebase — `registerDomEvent` usage confirmed in `editor-panel-view.ts`]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `runner-view.ts` Phase 3 stub | Full `RunnerView` implementation with all 5 runner states | Phase 5 | RunnerView must be fully implemented; stub is not sufficient for SNIP-06 |
| `SnippetManagerView` stub (one `<p>`) | Full master-detail two-column ItemView | Phase 5 | Complete rewrite of `onOpen()` — no existing UI to preserve |
| `WriteMutex` empty class stub | `async-mutex` Mutex-based per-file lock | Phase 5 | Requires installing `async-mutex` as a new dependency |
| `ensureFolderPath()` no-op stub | Actual `vault.createFolder()` guarded implementation | Phase 5 | Vault writes will fail until this is implemented |

**Deprecated/outdated:**

- `snippet-service.ts` empty class: The Phase 5 implementation completely replaces this stub.
- `runner-view.ts` placeholder `<p>`: The Phase 5 implementation completely replaces `onOpen()`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `WriteMutex.runExclusive(path, fn)` API shape as shown in Pattern 1 | Architecture Patterns | Low — `async-mutex` Mutex API is stable; `runExclusive` is its primary method |
| A2 | `vault.adapter.write(path, content)` is the correct low-level write (vs `vault.modify(TFile)`) | Pattern 2 | Low — both approaches work; `adapter.write` avoids needing a TFile instance |
| A3 | `vault.createFolder()` throws on existing path on some Obsidian versions | Pitfall 2 | Medium — if wrong, the guard adds unnecessary overhead but no harm |
| A4 | Modal does not extend Component, so `registerDomEvent` is unavailable inside `SnippetFillInModal` | Patterns 3, 7 | Low — if wrong, using `registerDomEvent` would be better; using direct listeners with `contentEl.empty()` cleanup is safe either way |
| A5 | `String.prototype.replaceAll` is not available with the current `lib` config | Pitfall 7 / Pattern 4 | Low — `split/join` works unconditionally; no downside to using it |
| A6 | Label slugification requires only lowercase + hyphen normalization for medical labels | Pattern 5 | Low — the custom field accepts free-text override (D-09); an imperfect slug is correctable |

---

## Open Questions (RESOLVED)

1. **RunnerView Phase 3 dependency** — RESOLVED: Phase 5 Plan 04 (Wave 4) implements the full RunnerView, addressing all Phase 3 deferred requirements (RUN-10, RUN-11, UI-01 through UI-12) alongside SNIP-06 runner integration.
   - What we know: Phase 3 was never executed (STATE.md confirms "Not started"). `runner-view.ts` is a stub with only a placeholder paragraph.
   - What's unclear: Does Phase 5 include implementing the full RunnerView (Phases 3 requirements: RUN-10, RUN-11, UI-01 through UI-12) or only the `awaiting-snippet-fill` branch?
   - Recommendation: Phase 5 should implement the full `RunnerView` (all runner UI including question rendering, answer buttons, free-text input, text-block display, step-back, output buttons) as Wave 1 or 2, since the snippet integration is impossible without it. The planner should scope this explicitly and flag that it addresses previously unimplemented Phase 3 requirements.

2. **`snippetFolderPath` in settings** — RESOLVED: Plan 01 (Wave 1) adds `snippetFolderPath: string` to `RadiProtocolSettings` with default value `'.radiprotocol/snippets'` in both the interface and `DEFAULT_SETTINGS` in `settings.ts`.
   - What we know: CONTEXT.md D-15 says `settings.snippetFolderPath` (default `.radiprotocol/snippets`). The current `RadiProtocolSettings` interface in `settings.ts` does NOT have a `snippetFolderPath` field.
   - What's unclear: Must `snippetFolderPath` be a user-configurable setting, or is it a hardcoded constant?
   - Recommendation: Add `snippetFolderPath: string` to `RadiProtocolSettings` and `DEFAULT_SETTINGS` in `settings.ts` as part of Phase 5 Wave 1. Default value: `'.radiprotocol/snippets'`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build toolchain | ✓ | (project already building) | — |
| npm | Package install | ✓ | (project already building) | — |
| `async-mutex` | SNIP-07 WriteMutex | ✗ | — | None — must install |
| `vitest` | Unit tests | ✓ | ^4.1.2 (in devDeps) | — |
| Obsidian desktop | Manual testing | [ASSUMED ✓] | >= 1.5.7 | — |

[VERIFIED: codebase] `npm list async-mutex` returns `(empty)` — package is not installed.

**Missing dependencies with no fallback:**

- `async-mutex`: Required by `WriteMutex` (SNIP-07). Must be added via `npm install async-mutex`. No alternative is acceptable — the decision is locked.

**Missing dependencies with fallback:**

- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run src/__tests__` |
| Full suite command | `npx vitest run` |

[VERIFIED: codebase] `vitest.config.ts` exists and includes `src/__tests__/**/*.test.ts`. The `obsidian` module is aliased to `src/__mocks__/obsidian.ts`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SNIP-01 | `SnippetService.list()`, `load()`, `save()`, `delete()`, `exists()` — vault CRUD | Unit (with vault mock) | `npx vitest run src/__tests__/snippet-service.test.ts` | ❌ Wave 0 |
| SNIP-02 | `SnippetPlaceholder` with `options`, `unit`, `joinSeparator` fields; `renderSnippet()` with all 4 types | Unit | `npx vitest run src/__tests__/snippet-model.test.ts` | ❌ Wave 0 |
| SNIP-03 | Label shown to user; id never rendered in UI | Manual test | — | — |
| SNIP-04 | Tab navigation between fields | Manual test | — | — |
| SNIP-05 | Live preview updates on input | Manual test | — | — |
| SNIP-06 | Runner transitions to `awaiting-snippet-fill` and modal opens | Manual test | — | — |
| SNIP-07 | `WriteMutex` serializes concurrent writes | Unit (stress test) | `npx vitest run src/__tests__/write-mutex.test.ts` | ❌ Wave 0 |
| SNIP-08 | `ensureFolderPath()` creates folder only when absent | Unit (with adapter mock) | `npx vitest run src/__tests__/vault-utils.test.ts` | ❌ Wave 0 |
| SNIP-09 | Custom free-text override clears radio/checkbox selection | Manual test | — | — |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/snippet-model.test.ts` — covers SNIP-01 (interface shape), SNIP-02 (`renderSnippet` with all 4 placeholder types)
- [ ] `src/__tests__/snippet-service.test.ts` — covers SNIP-01 CRUD operations (requires minimal vault adapter mock)
- [ ] `src/__tests__/write-mutex.test.ts` — covers SNIP-07 (concurrent writes, serialization guarantee)
- [ ] `src/__tests__/vault-utils.test.ts` — covers SNIP-08 (`ensureFolderPath` idempotency)

Note: `src/__mocks__/obsidian.ts` already has a `Modal` mock stub — it may need `titleEl` added for `SnippetFillInModal` tests.

---

## Security Domain

The plugin has `security_enforcement` not explicitly set to `false` in config — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Plugin runs in single-user local Obsidian vault |
| V3 Session Management | No | No session tokens; snippet fill-in is synchronous UI |
| V4 Access Control | No | All plugin data is local vault files; no multi-user scenario |
| V5 Input Validation | Yes | Snippet template content, placeholder labels, user-typed values |
| V6 Cryptography | No | No encryption; snippet files are plain JSON in the user's vault |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via user-supplied snippet content rendered to DOM | Tampering/Spoofing | `createEl()` + text content only — never `innerHTML`; enforced by ESLint `no-restricted-syntax` rule |
| Corrupt/malformed snippet JSON causing plugin crash | Denial of Service | `try/catch` around `JSON.parse()` in `SnippetService.load()`; surface as `Notice`, not unhandled exception |
| Race-condition snippet file corruption | Tampering | `WriteMutex` (SNIP-07) — all vault writes serialized per file path |
| Snippet folder path traversal (malicious `snippetFolderPath` setting) | Elevation of Privilege | `settings.snippetFolderPath` is set by the user themselves in their own vault — no untrusted input; low risk |

**V5 input validation detail:** User-supplied values in the fill-in modal are passed through `renderSnippet()` as plain string substitution. Since the output is always rendered via `createEl()` text content (not innerHTML), injection is not possible at the DOM level. The rendered string is appended to `TextAccumulator` and eventually copied to clipboard or written to a note — no secondary execution context.

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase — `src/snippets/snippet-model.ts`] Current interface shape
- [VERIFIED: codebase — `src/snippets/snippet-service.ts`] Stub state
- [VERIFIED: codebase — `src/utils/write-mutex.ts`] Stub state
- [VERIFIED: codebase — `src/utils/vault-utils.ts`] Stub state
- [VERIFIED: codebase — `src/views/snippet-manager-view.ts`] Stub state + constructor signature
- [VERIFIED: codebase — `src/views/runner-view.ts`] Phase 3 stub state
- [VERIFIED: codebase — `src/runner/protocol-runner.ts`] `completeSnippet()` fully implemented
- [VERIFIED: codebase — `src/runner/runner-state.ts`] `AwaitingSnippetFillState` fully defined
- [VERIFIED: codebase — `src/main.ts`] `SnippetService` not yet instantiated; `SnippetManagerView` not yet registered
- [VERIFIED: codebase — `src/settings.ts`] `snippetFolderPath` field absent from `RadiProtocolSettings`
- [VERIFIED: codebase — `package.json`] `async-mutex` not in dependencies
- [VERIFIED: npm registry] `async-mutex` current version 0.5.0 (2026-04-06)
- [VERIFIED: codebase — `vitest.config.ts`] Test framework confirmed, include pattern confirmed
- [VERIFIED: codebase — `src/__mocks__/obsidian.ts`] `Modal` mock shape confirmed

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` — module structure, service-locator pattern, vault patterns
- `.planning/research/STACK.md` — `async-mutex` decision, plain DOM recommendation
- `.planning/phases/05-dynamic-snippets/05-CONTEXT.md` — all locked decisions D-01 through D-17
- `.planning/phases/05-dynamic-snippets/05-UI-SPEC.md` — CSS class inventory, interaction contracts, accessibility requirements

### Tertiary (LOW confidence — not independently re-verified this session)

- [ASSUMED] `vault.createFolder()` throws on existing path in some Obsidian versions (community-reported; defensive guard is universal recommendation)
- [ASSUMED] `Modal` does not extend `Component`, making `registerDomEvent` unavailable inside modal
- [ASSUMED] Promise-resolver pattern for awaitable Modal is standard Obsidian idiom (seen in community plugins)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions verified on npm registry; `async-mutex` absence confirmed in codebase
- Architecture: HIGH — all integration points verified against actual source files
- Pitfalls: HIGH (Pitfalls 1, 4, 5, 7 verified in codebase) / MEDIUM (Pitfalls 2, 3 based on community knowledge)
- Test map: HIGH — existing test infrastructure confirmed; gap files identified with specific paths

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable domain — Obsidian plugin API + async-mutex are not fast-moving)
