# Phase 27: Interactive Placeholder Editor — Research

**Researched:** 2026-04-12
**Domain:** Obsidian plugin UI — HTML5 drag-and-drop, chip layout, CSS colour bars, DOM event delegation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Chip layout — coloured left bar (~4px), label, type badge, [×] at right, drag handle glyph (⠿) at far-left. Minimum chip height 32px.
- **D-02:** Colour palette fixed per type using Obsidian CSS vars: `free-text` → `var(--color-cyan)`, `choice` → `var(--color-orange)`, `multi-choice` → `var(--color-purple)`, `number` → `var(--color-green)`.
- **D-03:** Clicking chip body (not handle, not [×]) expands inline editor — same form as current `is-expanded` row.
- **D-04:** Drag handle (`⠿`) is the visual cue; `draggable="true"` on chip row; `dragstart` fires from handle region (or full chip — implementation detail at Claude's discretion per CONTEXT.md Claude's Discretion).
- **D-05:** HTML5 native drag-and-drop API — no external library.
- **D-06:** Auto-save on drop — `snippetService.save(draft)` immediately after splice + re-render. Success: `Notice("Snippet saved.")`. Error: `Notice("Failed to save snippet. Check that the vault is writable and try again.")`. [Save snippet] button remains active.
- **D-07:** Chip list is vertical flex column (same as current `rp-placeholder-list`). Full-width chips.
- **D-08:** [×] remove button stays on chip (not inside editor). Existing orphan-badge logic unchanged.

### Claude's Discretion

- Exact CSS class names for colour bar and drag-over indicator (UI-SPEC prescribes: `.rp-placeholder-chip`, `.rp-placeholder-chip-handle`, `.rp-placeholder-chip-label`, `.rp-placeholder-chip-badge`, `.rp-placeholder-chip-remove`, `.drag-over`)
- Whether colour bar is `border-left` on the chip or an inline `<span>` (UI-SPEC prescribes: `border-left: 4px solid var(--color-{type})` on chip row — no extra DOM node)
- Exact drag ghost appearance (browser default acceptable)
- Whether `draggable="true"` on whole chip row or only handle region
- Exact handle glyph (⠿, ⋮⋮, or similar)

### Deferred Ideas (OUT OF SCOPE)

- None raised during discussion.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHIP-01 | Each placeholder in Snippet Editor is rendered as a distinct coloured chip; raw `{{syntax}}` text is not visible in the chip list | `renderPlaceholderRow()` replaced by chip builder; PH_COLOR map drives `border-left`; label text shown, never `{{id}}` |
| CHIP-02 | Dragging a chip to a new position updates the visual order immediately | HTML5 native DnD: `dragstart`/`dragover`/`drop` splice `draft.placeholders` then re-render |
| CHIP-03 | After reorder, SnippetFillInModal presents fields in new order; tab key follows reordered sequence | `SnippetFillInModal` already iterates `snippet.placeholders` in array order (line 55 of snippet-fill-in-modal.ts); auto-save after drop persists new order; no modal changes needed |

</phase_requirements>

---

## Summary

Phase 27 is a pure UI surgery on `SnippetManagerView`. The two target functions — `renderPlaceholderList()` and `renderPlaceholderRow()` — are replaced with chip-based equivalents. The existing expand/collapse logic (`renderExpandedPlaceholder()`, `renderNumberExpanded()`) is reused unchanged; it simply attaches to chip body click instead of row header click.

The HTML5 native drag-and-drop API is well-supported in Obsidian/Electron. The splice-and-re-render pattern is the canonical approach for DOM-managed list reordering without a virtual DOM. The only noteworthy complexity is the click-region conflict: the chip element hosts three mutually exclusive zones (handle = drag only, body = expand, remove button = remove). A single `e.target` check guards each zone.

`SnippetFillInModal` already renders fields in `snippet.placeholders` array order (verified in source at line 55). Once the array is saved in the new order via `snippetService.save(draft)`, modal tab order updates for free — no modal code changes required.

**Primary recommendation:** Implement in a single plan: replace `renderPlaceholderRow()` with `renderPlaceholderChip()`, wire drag events inside `renderPlaceholderList()`, add CSS for chip classes, and call auto-save on drop.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Obsidian API (`createEl`, `createDiv`) | bundled | All DOM construction | Project constraint — no `innerHTML`, no external component library [VERIFIED: STATE.md critical pitfalls] |
| HTML5 Drag-and-Drop API | browser native | Chip reorder | Decision D-05: no external library; works in Electron without polyfill [VERIFIED: CONTEXT.md D-05] |
| Obsidian `Notice` | bundled | Transient save feedback | Pattern already used in `handleSave()` — line 616 of snippet-manager-view.ts [VERIFIED: codebase] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Obsidian CSS custom properties (`--color-cyan`, `--color-orange`, etc.) | bundled | Chip colour bar | Type-to-colour mapping (D-02) [VERIFIED: CONTEXT.md D-02, node-color-map.ts] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML5 native DnD | SortableJS / @dnd-kit | External library; adds bundle weight; D-05 explicitly rules it out |
| `border-left` colour bar | Inline `<span>` coloured strip | Extra DOM node; no functional advantage; UI-SPEC prescribes `border-left` |

**Installation:** No new packages. Zero dependency change.

---

## Architecture Patterns

### Recommended Project Structure

No new files. All changes confined to:
```
src/
├── views/snippet-manager-view.ts   — renderPlaceholderRow() → renderPlaceholderChip(); drag wiring
└── styles.css                      — new chip classes appended to Phase 5 section
```

### Pattern 1: Chip Builder (replaces `renderPlaceholderRow`)

**What:** A function `renderPlaceholderChip(draft, ph, index, container, templateArea)` creates the chip DOM element, attaches drag event listeners via `addEventListener` (not `registerDomEvent` — chips are recreated on every re-render), and returns the chip element.

**When to use:** Called from the rebuilt `renderPlaceholderList()` loop, exactly as `renderPlaceholderRow()` was called.

**Key insight from existing code:** `registerDomEvent` is for persistent ItemView-lifetime listeners (Obsidian cleans them up on `onClose`). Drag events on dynamically re-created chip elements use `addEventListener` directly — this pattern is already documented in CONTEXT.md code-context section.

**Example (pseudocode — implementation detail):**
```typescript
// Source: CONTEXT.md specifics section
const PH_COLOR: Record<SnippetPlaceholder['type'], string> = {
  'free-text':    'var(--color-cyan)',
  'choice':       'var(--color-orange)',
  'multi-choice': 'var(--color-purple)',
  'number':       'var(--color-green)',
};

private renderPlaceholderChip(
  draft: SnippetFile,
  ph: SnippetPlaceholder,
  index: number,
  container: HTMLElement,
  templateArea: HTMLTextAreaElement
): void {
  const chip = container.createDiv({ cls: 'rp-placeholder-chip' });
  chip.style.borderLeftColor = PH_COLOR[ph.type] ?? 'transparent';
  chip.setAttribute('draggable', 'true');

  const handle = chip.createSpan({ cls: 'rp-placeholder-chip-handle' });
  handle.textContent = '⠿';
  handle.setAttribute('aria-label', `Drag to reorder ${ph.label}`);

  const labelSpan = chip.createSpan({ cls: 'rp-placeholder-chip-label' });
  labelSpan.textContent = ph.label;  // NEVER {{id}} — CHIP-01 requirement

  const badge = chip.createSpan({ cls: 'rp-placeholder-chip-badge' });
  badge.textContent = ph.type;

  const removeBtn = chip.createEl('button', { cls: 'rp-placeholder-chip-remove', text: '×' });
  removeBtn.setAttribute('aria-label', `Remove placeholder ${ph.label}`);

  // Drag events (addEventListener — chips recreated on re-render)
  chip.addEventListener('dragstart', (e: DragEvent) => {
    e.dataTransfer?.setData('text/plain', String(index));
  });
  chip.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    chip.addClass('drag-over');
  });
  chip.addEventListener('dragleave', () => chip.removeClass('drag-over'));
  chip.addEventListener('drop', (e: DragEvent) => {
    e.preventDefault();
    chip.removeClass('drag-over');
    const from = parseInt(e.dataTransfer?.getData('text/plain') ?? '-1', 10);
    const to = index;
    if (from !== -1 && from !== to) {
      const [moved] = draft.placeholders.splice(from, 1);
      if (moved) draft.placeholders.splice(to, 0, moved);
      this.renderPlaceholderList(draft, container, templateArea);
      void this.autoSaveAfterDrop(draft);
    }
  });
  chip.addEventListener('dragend', () => {
    container.querySelectorAll('.drag-over').forEach(el => el.removeClass('drag-over'));
  });

  // Click-to-expand (guard: not handle, not removeBtn)
  this.registerDomEvent(chip, 'click', (e: MouseEvent) => {
    if (e.target === removeBtn || (e.target as HTMLElement).closest('.rp-placeholder-chip-handle')) return;
    chip.toggleClass('is-expanded', !chip.hasClass('is-expanded'));
    if (chip.hasClass('is-expanded')) {
      this.renderExpandedPlaceholder(draft, ph, chip, templateArea, container, labelSpan, badge);
    } else {
      chip.querySelector('.rp-placeholder-expanded')?.remove();
    }
  });

  // Remove button
  this.registerDomEvent(removeBtn, 'click', (e: MouseEvent) => {
    e.stopPropagation();
    draft.placeholders.splice(index, 1);
    const isOrphaned = draft.template.includes(`{{${ph.id}}}`);
    this.renderPlaceholderList(draft, container, templateArea);
    if (isOrphaned) {
      const badge = container.createDiv({ cls: 'rp-placeholder-orphan-badge' });
      badge.setAttribute('role', 'alert');
      badge.textContent = `Template still contains {{${ph.id}}} — remove from template or re-add this placeholder.`;
    }
  });
}
```

[VERIFIED: codebase — snippet-manager-view.ts, CONTEXT.md specifics section]

### Pattern 2: Auto-Save Helper

**What:** A private `async autoSaveAfterDrop(draft: SnippetFile): Promise<void>` method that calls `snippetService.save(draft)` and shows a Notice.

**Why separate:** Keeps drop handler synchronous (can't `await` inside an event listener body cleanly); mirrors the existing `handleSave()` pattern.

```typescript
private async autoSaveAfterDrop(draft: SnippetFile): Promise<void> {
  try {
    await this.plugin.snippetService.save(draft);
    // Sync this.snippets
    const idx = this.snippets.findIndex(s => s.id === draft.id);
    if (idx !== -1) this.snippets[idx] = draft;
    new Notice('Snippet saved.');
  } catch {
    new Notice('Failed to save snippet. Check that the vault is writable and try again.');
  }
}
```

[VERIFIED: CONTEXT.md D-06, existing handleSave() in snippet-manager-view.ts lines 593–623]

### Pattern 3: `border-left` Colour Bar (CSS)

**What:** The chip's type colour is expressed as a 4px left border directly on the chip element. The `border-left-color` is set inline via JS (since it's dynamic per-placeholder), or the class can carry the color.

**Simplest approach (UI-SPEC prescribes this):**
```css
/* styles.css — appended to Phase 5 section */
.rp-placeholder-chip {
  display: flex;
  flex-direction: column;
  border-left: 4px solid transparent; /* colour set inline per chip */
  border-radius: var(--radius-s);
  min-height: 32px;
  cursor: pointer;
}
.rp-placeholder-chip.is-expanded {
  background: var(--background-secondary);
  cursor: default;
}
.rp-placeholder-chip.drag-over {
  background: var(--background-modifier-hover);
}
.rp-placeholder-chip:hover:not(.is-expanded) {
  background: var(--background-modifier-hover);
}
.rp-placeholder-chip-handle {
  cursor: grab;
  width: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-text-size);
  color: var(--text-muted);
  user-select: none;
}
.rp-placeholder-chip-handle:active {
  cursor: grabbing;
}
.rp-placeholder-chip-label {
  flex: 1 1 auto;
  font-size: var(--font-text-size);
  line-height: 1.5;
}
.rp-placeholder-chip-badge {
  font-size: var(--font-smaller);
  color: var(--text-muted);
}
.rp-placeholder-chip-remove {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  padding: 0;
  font-size: var(--font-smaller);
}
```

[VERIFIED: CONTEXT.md D-01, D-02; UI-SPEC Component Inventory, styles.css Phase 5 section]

### Anti-Patterns to Avoid

- **Putting drag event listeners inside `registerDomEvent`:** `registerDomEvent` is for persistent ItemView-lifetime events. Chip drag listeners are on ephemeral DOM nodes recreated on each `renderPlaceholderList()` call — use `addEventListener` directly. [VERIFIED: CONTEXT.md code-context section]
- **Setting `draggable="true"` on handle only:** The browser requires the `draggable` attribute on the element that `dragstart` fires on. Setting it only on the handle span may not produce a draggable element in all browsers. Set it on the chip row; guard `dragstart` if needed. [ASSUMED — based on HTML5 spec knowledge]
- **Not calling `e.preventDefault()` in `dragover`:** Drop will not fire unless `dragover` cancels its default. [VERIFIED: HTML5 DnD spec requirement, referenced in CONTEXT.md D-05]
- **Forgetting to clean up `drag-over` class on `dragend`:** If the user drags off-list and releases, `dragleave` may not fire on every chip. The `dragend` cleanup pass (iterate all chips, remove `drag-over`) is a guard. [VERIFIED: CONTEXT.md D-05, UI-SPEC interaction contract]
- **Reusing `renderPlaceholderRow()` instead of replacing it:** The new chip layout is structurally different (handle + border-left vs. header-div inside row). Replace, do not extend.
- **Using `innerHTML`:** Project-wide hard prohibition. All DOM via `createEl()`/`createDiv()`. [VERIFIED: STATE.md critical pitfalls]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop list reorder | Custom pointer-event tracker | HTML5 native `dragstart`/`dragover`/`drop` | D-05 locks this; native API works in Electron without polyfill |
| Colour-per-type lookup | Inline conditionals scattered in render | `PH_COLOR` constant map (CONTEXT.md specifics) | Single authoritative source; matches node-color-map.ts pattern |
| Expand/collapse form | New inline editor components | Reuse `renderExpandedPlaceholder()` / `renderNumberExpanded()` as-is | These methods already handle all 4 placeholder types; attaching to chip click is the only change |

**Key insight:** The hardest parts of this phase (the inline editor forms, orphan badge logic, save/delete logic) already exist and need zero changes. Phase 27 is a rendering-layer swap, not a logic overhaul.

---

## Common Pitfalls

### Pitfall 1: `dragover` returns without `e.preventDefault()` — drop never fires
**What goes wrong:** User drags chip, releases over another chip, but nothing happens. No error in console.
**Why it happens:** HTML5 DnD: the browser only dispatches `drop` if the most recent `dragover` handler called `e.preventDefault()`.
**How to avoid:** Always `e.preventDefault()` in `dragover`.
**Warning signs:** Drop event never fires; `dragover` fires repeatedly but state unchanged.

### Pitfall 2: Expand triggers on handle click
**What goes wrong:** Dragging a chip (which starts with `mousedown` on handle) also fires `click` on the chip element after `mouseup`, expanding the inline editor unexpectedly.
**Why it happens:** Browser fires `click` after a drag if the mouse didn't move far enough to be considered a real drag (pointer-up in same vicinity).
**How to avoid:** In the chip click handler, check `e.target` is not the handle element (`closest('.rp-placeholder-chip-handle')`). [VERIFIED: CONTEXT.md code-context "Key Observation" section]
**Warning signs:** Chip expands when user intended to drag.

### Pitfall 3: Re-render loses expanded state
**What goes wrong:** After a drop, `renderPlaceholderList()` rebuilds all chips from scratch — any currently-expanded chip collapses.
**Why it happens:** Each call to `renderPlaceholderList()` calls `container.empty()` and recreates all DOM nodes.
**How to avoid:** This is acceptable per spec (drop triggers save + full re-render; expanding after drag is an edge case). Alternatively, capture the currently expanded index before re-render and re-expand after. The planner should decide whether to handle this — CONTEXT.md does not address it.
**Warning signs:** User expands a chip, then drags another chip, and the expanded chip collapses.

### Pitfall 4: `this.snippets` list not synced after auto-save on drop
**What goes wrong:** After a drop + auto-save, the list panel shows a stale snippet name or ordering if the user selects a different snippet and returns.
**Why it happens:** `handleSave()` updates `this.snippets[idx]` after saving, but `autoSaveAfterDrop()` might not.
**How to avoid:** In `autoSaveAfterDrop()`, find the snippet in `this.snippets` by id and update it, identical to the pattern in `handleSave()` lines 609–611. [VERIFIED: snippet-manager-view.ts lines 609–611]

### Pitfall 5: `dataTransfer` is null in drop handler
**What goes wrong:** `e.dataTransfer?.getData(...)` returns empty string; `from` index is `-1`; splice is skipped silently.
**Why it happens:** In some Electron builds, `dataTransfer` may be null if `dragstart` didn't set data correctly.
**How to avoid:** Guard with `if (from === -1 || from === to) return;` before splice. [ASSUMED]

---

## Code Examples

### Existing splice pattern (from CONTEXT.md specifics)
```typescript
// Source: CONTEXT.md specifics section
const [moved] = draft.placeholders.splice(from, 1);
draft.placeholders.splice(to, 0, moved);
```

### Existing auto-save error copy (from snippet-manager-view.ts lines 618–619)
```typescript
// Source: snippet-manager-view.ts lines 616–619
new Notice('Snippet saved.');
// ...
new Notice('Failed to save snippet. Check that the vault is writable and try again.');
```

### SnippetFillInModal tab order proof
```typescript
// Source: snippet-fill-in-modal.ts line 55
// Render one field per placeholder in array order (D-12: tab order = array order)
for (const placeholder of this.snippet.placeholders) {
  this.renderField(placeholder);
}
```
This confirms CHIP-03: reordering `snippet.placeholders` and saving is sufficient — zero modal changes needed.

### Existing remove button size (for [×] consistency)
```css
/* Source: styles.css Phase 5 section */
.rp-option-row button {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  padding: 0;
  font-size: var(--font-smaller);
}
```
The chip remove button matches this 24×24 pattern.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `renderPlaceholderRow()` — flex-column div with header + expanded child | `renderPlaceholderChip()` — chip with border-left colour bar, drag handle, inline editor | Phase 27 | Visual: chips replace rows; functional: identical expand/remove behaviour |
| No drag-and-drop on placeholder list | HTML5 native DnD splice-and-re-render | Phase 27 | Enables CHIP-02/CHIP-03 |

**Deprecated/outdated:**
- `.rp-placeholder-row` and `.rp-placeholder-row-header` CSS classes: replaced by `.rp-placeholder-chip` hierarchy. Keep old classes if needed for backwards compat or remove if confident no other code references them. Grep confirms they are only referenced in styles.css and snippet-manager-view.ts. [VERIFIED: codebase grep — classes appear only in these two files]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Setting `draggable="true"` on the whole chip row (not just the handle span) is required for `dragstart` to fire reliably in Electron/Chromium | Architecture Patterns — Pattern 1 | Low — if wrong, set draggable on handle span only and move dragstart listener there; one-line fix |
| A2 | `dataTransfer` may be null in some Electron builds if `dragstart` didn't set data | Common Pitfalls — Pitfall 5 | Low — defensive guard costs nothing; worst case is silent no-op |
| A3 | CHIP-01, CHIP-02, CHIP-03 map 1:1 to the three success criteria in ROADMAP.md | Phase Requirements section | Low — ROADMAP.md lists exactly three success criteria matching the requirement IDs |

**All other claims in this research were verified against the codebase or CONTEXT.md/UI-SPEC.**

---

## Open Questions

1. **Re-render collapses expanded chip after drop**
   - What we know: `renderPlaceholderList()` calls `container.empty()` — all chips are recreated on drop.
   - What's unclear: Is it acceptable for an expanded chip to collapse after a drag-drop? CONTEXT.md does not address this.
   - Recommendation: Accept as acceptable behaviour for v1 (the user intended to reorder, not to edit); document in plan as a known limitation. If required, save `expandedIndex` before re-render and restore after.

2. **`.rp-placeholder-row` and `.rp-placeholder-row-header` CSS class cleanup**
   - What we know: These classes exist in styles.css and snippet-manager-view.ts only; the new chips use `.rp-placeholder-chip` hierarchy.
   - What's unclear: Whether to remove old classes or leave them as dead CSS.
   - Recommendation: Remove from both files in the same plan to keep the codebase clean. Low-risk since grep confirms no other usage.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 27 is a pure code/CSS change with no external dependencies beyond the existing project toolchain (TypeScript, esbuild, Vitest — all confirmed present by existing test infrastructure).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts (inferred from package.json test script) |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHIP-01 | Chip renders placeholder label (not `{{id}}`), type badge, handle, remove button | unit | `npm test -- --reporter=dot src/__tests__/snippet-manager-view.test.ts` | ❌ Wave 0 — no snippet-manager-view test file exists yet |
| CHIP-02 | Drag-drop splice updates `draft.placeholders` array order | unit | `npm test -- --reporter=dot src/__tests__/snippet-manager-view.test.ts` | ❌ Wave 0 |
| CHIP-03 | `SnippetFillInModal` renders fields in `snippet.placeholders` array order | unit (already covered by array-order comment in fill-in-modal.ts) | `npm test` — existing snippet-model tests pass; no new test needed for modal since logic is unchanged | ✅ existing (snippet-fill-in-modal.ts logic untouched; no test file exists for it either, but CHIP-03 requires only that the array order persists after save) |

**Note on CHIP-03:** The modal code is not modified. CHIP-03 is satisfied by: (a) auto-save persisting the spliced array to disk, and (b) the existing modal array-iteration. A smoke/integration test for CHIP-03 would require an Obsidian runtime environment — not feasible in Vitest. Manual verification per success criterion SC-3 is the gate.

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/snippet-manager-view.test.ts` — covers CHIP-01 (chip DOM structure) and CHIP-02 (splice logic). Requires a minimal Obsidian mock for `createEl`/`createDiv` — the existing test suite (editor-panel.test.ts, RunnerView.test.ts) likely has such mocks already.

*(Check existing test setup files for reusable Obsidian DOM mocks before writing new fixtures.)*

---

## Security Domain

No authentication, session management, access control, cryptography, or external data handling in this phase. The only data path is `snippetService.save(draft)` — an existing, already-reviewed code path. No new ASVS categories apply.

The one applicable control:
- **V5 Input Validation (ASVS):** Placeholder labels and types come from the in-memory draft (user-authored, already in the vault). No new input surfaces introduced. The [×] remove button and drag handle do not accept external input. [VERIFIED: codebase — no new input fields in this phase]

---

## Sources

### Primary (HIGH confidence)
- `src/views/snippet-manager-view.ts` — full source, renderPlaceholderRow/renderPlaceholderList patterns, handleSave error copy
- `src/views/snippet-fill-in-modal.ts` — array-order iteration at line 55 (CHIP-03 proof)
- `src/snippets/snippet-model.ts` — SnippetPlaceholder type definition
- `src/styles.css` — existing chip/row/badge CSS patterns, sizing conventions
- `src/canvas/node-color-map.ts` — colour map pattern reference
- `.planning/phases/27-interactive-placeholder-editor/27-CONTEXT.md` — locked decisions D-01 through D-08
- `.planning/phases/27-interactive-placeholder-editor/27-UI-SPEC.md` — component inventory, interaction contract, spacing scale

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — project-wide DOM/toolchain constraints
- `.planning/ROADMAP.md` — CHIP requirement IDs and success criteria

### Tertiary (LOW confidence — assumed)
- HTML5 DnD `draggable` attribute behaviour in Electron/Chromium (A1, A2)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified in codebase
- Architecture: HIGH — existing functions identified, replacement pattern specified in CONTEXT.md
- Pitfalls: HIGH (Pitfall 1–4 verified) / LOW (Pitfall 5 assumed)

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable domain — Obsidian plugin API, HTML5 DnD, no fast-moving dependencies)
