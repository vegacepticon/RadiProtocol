---
phase: 27-interactive-placeholder-editor
reviewed: 2026-04-12T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/styles.css
  - src/views/snippet-manager-view.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-04-12
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 27 adds a chip-based placeholder UI to `SnippetManagerView`. The CSS additions are clean and well-structured. The TypeScript work is largely sound, but there are five warnings that need attention before this code ships: a broken drag-and-drop index problem caused by stale closures (the most impactful issue), a `dragleave` false-fire on child elements, silent data-loss on drop when the draft id is a new UUID, a duplicate CSS rule block, and an event-listener accumulation pattern on each re-render. There are no critical (security/crash) issues.

---

## Warnings

### WR-01: Stale `index` closure makes DnD reorder silently wrong after any re-render

**File:** `src/views/snippet-manager-view.ts:378-401`

**Issue:** Each chip captures `index` as a `const` at render time via `renderPlaceholderChip(…, index, …)`. After `renderPlaceholderList` is called (e.g. after a drop, or after the mini-form "Add" button fires), every chip is recreated with fresh indices — that is correct. **However**, the `drop` handler at line 395 reads the _source_ index from `e.dataTransfer?.getData('text/plain')`, which was written by the `dragstart` handler at line 379. If any re-render happens between `dragstart` and `drop` (currently impossible in practice because rendering is synchronous, but the autoSaveAfterDrop call is `void`-ed and async, so a very fast second drag could arrive while save is still in flight), the stored string index may refer to a slot that has already shifted. More concretely: if the user drops chip 0 onto chip 2, the list re-renders (chips 0–1 are now renumbered), then a concurrent (queued) async save finishes and the caller re-renders again. The second re-render is not triggered today, but the pattern is fragile.

More importantly, the `from` value received in `drop` is the serialised integer from `dragstart`, but _both_ `from` and `to` are taken from the closure snapshots of the render cycle. There is no guard that `from < draft.placeholders.length` after the splice, so when `from > to` and the list length is small, `splice(to, 0, moved)` can insert at an out-of-range position (JS coerces to end, so no crash — but the visual result is wrong). While not a guaranteed crash, this is a logic error in ordering.

**Fix:** Store a drag-index on the chip's `dataset` rather than relying on `dataTransfer`. Read and update it inside the same synchronous `drop` closure so the index is always current:

```typescript
// In renderPlaceholderChip, replace the dragstart/drop pair:
chip.dataset['dragIndex'] = String(index);   // kept up-to-date by re-render

chip.addEventListener('dragstart', (e: DragEvent) => {
  e.dataTransfer?.setData('text/plain', chip.dataset['dragIndex'] ?? String(index));
});

chip.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault();
  chip.removeClass('drag-over');
  const fromStr = e.dataTransfer?.getData('text/plain');
  const from = fromStr !== undefined ? parseInt(fromStr, 10) : -1;
  const to = parseInt(chip.dataset['dragIndex'] ?? '-1', 10);
  if (isNaN(from) || isNaN(to) || from === to || from < 0 || to < 0) return;
  if (from >= draft.placeholders.length || to >= draft.placeholders.length) return;
  const [moved] = draft.placeholders.splice(from, 1);
  if (moved) draft.placeholders.splice(to, 0, moved);
  this.renderPlaceholderList(draft, container, templateArea);
  void this.autoSaveAfterDrop(draft);
});
```

---

### WR-02: `dragleave` fires on child elements, causing flickering `drag-over` class

**File:** `src/views/snippet-manager-view.ts:389-391`

**Issue:** The `dragleave` event fires whenever the pointer moves from the chip into any child element (handle span, label span, badge span, remove button). This makes the `drag-over` visual indicator flicker during a drag, and in some browsers the drop target loses the `drag-over` class before the `drop` fires. The `drop` handler already calls `chip.removeClass('drag-over')`, but the `dragleave` misfiring makes the UI visually noisy.

**Fix:** Check that the related target is not a descendant of the chip before removing the class:

```typescript
chip.addEventListener('dragleave', (e: DragEvent) => {
  if (chip.contains(e.relatedTarget as Node | null)) return;
  chip.removeClass('drag-over');
});
```

---

### WR-03: `autoSaveAfterDrop` silently saves a draft that has never been named/saved — overwrites UUID-named file

**File:** `src/views/snippet-manager-view.ts:680-690`

**Issue:** `autoSaveAfterDrop` calls `this.plugin.snippetService.save(draft)` without checking whether the draft has ever been saved. When a user creates a new snippet (id = UUID, e.g. `"550e8400-e29b-41d4-a716-446655440000"`) and immediately reorders its placeholders via drag, `save` will persist the snippet under the UUID filename before the user has entered a name and clicked "Save snippet". This bypasses the id-from-name normalization logic in `handleSave` (line 635: `draft.id = slugifyLabel(draft.name) || oldId`), permanently storing the file as a UUID-keyed entry. If the user then clicks "Save snippet" they get a *second* file with the slugified name, while the UUID file remains as orphaned data.

**Fix:** Guard the auto-save against unsaved (UUID) drafts by checking whether the id is already a clean slug (or by tracking a `persisted` flag on the draft):

```typescript
private async autoSaveAfterDrop(draft: SnippetFile): Promise<void> {
  // Only auto-save snippets that have already been explicitly saved once.
  // New drafts still have their raw UUID id — let the user save manually.
  const isNewDraft = draft.id === draft.id && /^[0-9a-f]{8}-/.test(draft.id);
  if (isNewDraft) return;   // skip silently; placeholder order is held in memory
  try {
    await this.plugin.snippetService.save(draft);
    const idx = this.snippets.findIndex(s => s.id === draft.id);
    if (idx !== -1) this.snippets[idx] = draft;
    new Notice('Snippet saved.');
  } catch {
    new Notice('Failed to save snippet. Check that the vault is writable and try again.');
  }
}
```

---

### WR-04: `dragleave` / `dragend` cleanup calls `el.removeClass` on a plain `Element`, which is not an `HTMLElement` — runtime error in strict DOM typing

**File:** `src/views/snippet-manager-view.ts:404-406`

**Issue:** `container.querySelectorAll('.drag-over')` returns a `NodeList<Element>`. The Obsidian API's `removeClass` method is defined on `HTMLElement`, not on base `Element`. Calling `el.removeClass(…)` on a raw `Element` will throw a TypeError at runtime in strict mode (TypeScript will flag this if `noImplicitAny` / `strict` is enabled; at minimum it is an unsafe cast).

**Fix:**

```typescript
chip.addEventListener('dragend', () => {
  container.querySelectorAll('.drag-over').forEach(el => {
    (el as HTMLElement).removeClass('drag-over');
  });
});
```

---

### WR-05: Expanded inline editor event listeners accumulate on re-render cycles

**File:** `src/views/snippet-manager-view.ts:409-424`

**Issue:** The `click` handler for toggling the expanded editor is registered with `this.registerDomEvent(chip, 'click', …)` (line 409). `registerDomEvent` is the Obsidian-safe wrapper that ties listener lifetime to the view's lifecycle — correct for the outer chip. However, inside the expand branch, `renderExpandedPlaceholder` and `renderNumberExpanded` register additional listeners using `this.registerDomEvent` on inputs that are created fresh on every expand/collapse. Because these are registered against the view's internal listener registry, they survive collapses: each time the user expands the same chip, a new set of input, select, and button listeners accumulates without deregistering the previous set. The `label` input for a single placeholder could end up with N listener registrations after N expand/collapse cycles, updating `ph.label` N times per keystroke.

`chip.querySelector('.rp-placeholder-expanded')?.remove()` (line 422) removes the DOM nodes but Obsidian's `registerDomEvent` registry holds a reference to the removed nodes' listeners — they are never unregistered until the view is closed.

**Fix:** Use bare `addEventListener` on the transient expanded-section elements (they are destroyed on collapse, so GC naturally frees them), reserving `registerDomEvent` only for long-lived, view-scoped elements:

```typescript
// In renderExpandedPlaceholder and renderNumberExpanded,
// replace this.registerDomEvent(inputEl, …) with inputEl.addEventListener(…)
// for all inputs, selects, and buttons inside .rp-placeholder-expanded.
```

Alternatively, keep a local `AbortController` per expanded section and pass its signal to each `addEventListener`, then abort on collapse.

---

## Info

### IN-01: Duplicate CSS rule blocks for `.rp-snippet-preview-label` and `.rp-snippet-preview`

**File:** `src/styles.css:607-625` and `src/styles.css:639-658`

**Issue:** Both `.rp-snippet-preview-label` and `.rp-snippet-preview` are defined twice. The second declarations (lines 639–658) differ slightly from the first (lines 607–625): the second `preview-label` adds `margin-bottom` and the second `preview` adds `min-height` and changes `padding` from `var(--size-4-1)` to `var(--size-4-2)`. The cascade resolves in favour of the later rules, making the earlier rules dead code and creating silent inconsistency.

**Fix:** Remove the first pair of rule blocks (lines 607–625) and keep only the more complete second definitions (lines 639–658).

---

### IN-02: `autoSaveAfterDrop` shows a `Notice('Snippet saved.')` that may confuse users mid-drag

**File:** `src/views/snippet-manager-view.ts:687`

**Issue:** The "Snippet saved." notice fires on every drag-and-drop reorder. If the user reorders three placeholders quickly, three successive toasts appear. This is low-severity UI noise but may make users think they triggered a manual save.

**Fix:** Either suppress the notice for auto-saves, or use a more specific message such as `'Order saved.'`.

---

### IN-03: `PH_COLOR` uses Obsidian CSS variables that may not resolve in all themes

**File:** `src/views/snippet-manager-view.ts:20-25`

**Issue:** `var(--color-cyan)`, `var(--color-orange)`, `var(--color-purple)`, `var(--color-green)` are Obsidian's semantic color variables that exist in the default theme but are not guaranteed by the public API to be present in all community themes. If a theme omits them, `border-left-color` will fall back to `transparent` (the CSS default), silently removing the color differentiation.

**Fix:** This is an acceptable risk for an internal tool, but it should be documented. Alternatively provide a fallback: `var(--color-cyan, #06b6d4)`. No code change required if the team accepts the theme-dependency.

---

_Reviewed: 2026-04-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
