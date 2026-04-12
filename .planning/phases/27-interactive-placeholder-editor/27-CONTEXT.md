# Phase 27: Interactive Placeholder Editor - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Transform the placeholder list in `SnippetManagerView` from expandable rows into coloured
chips that support drag-and-drop reordering. After a drop, the new order is persisted
immediately to disk. `SnippetFillInModal` already iterates `snippet.placeholders` in array
order, so once the array is saved correctly, tab-order updates at no extra cost.

Delivers: chip-based `renderPlaceholderList`, colour-by-type palette, drag-and-drop reorder
with auto-save on drop, click-to-expand inline editor (existing expand semantics preserved).

Does NOT include: changes to `SnippetFillInModal`, changes to `SnippetService`, changes to
`SnippetFile` / `SnippetPlaceholder` model (no new fields), changes to the [+ Add placeholder]
mini-form flow, touch/pointer events.

</domain>

<decisions>
## Implementation Decisions

### Chip Visual Design
- **D-01:** Each placeholder is rendered as a chip with:
  - A coloured left bar (narrow vertical strip, ~4px wide) indicating the placeholder type
  - Label text (human-readable, never the raw `{{id}}`)
  - Type badge (muted text, same as current `rp-placeholder-type-badge`)
  - [×] remove button, visible at all times (right edge of chip)
  - A drag handle glyph (e.g. `⠿`) on the far-left as a separate region

  Layout sketch:
  ```
  [⠿] [█] Patient name    free-text    [×]
  [⠿] [█] Organ size      number       [×]
  [⠿] [█] Laterality      choice       [×]
  ```

### Chip Colour Palette
- **D-02:** Colours are **fixed per placeholder type**, using Obsidian CSS colour variables:
  - `free-text`    → `var(--color-cyan)`
  - `choice`       → `var(--color-orange)`
  - `multi-choice` → `var(--color-purple)`
  - `number`       → `var(--color-green)`

  Consistent with the colour semantics in `node-color-map.ts` (Phase 21 infrastructure).
  The colour bar is rendered as an `::before` pseudo-element or an inline `<span>` on the
  chip — implementation detail at Claude's discretion.

### Editing via Chip (click-to-expand)
- **D-03:** Clicking the chip body (anywhere except the drag handle and the [×] button)
  **expands an inline editor below the chip** — identical semantics to the current
  `is-expanded` row behaviour. The drag handle region does NOT trigger expand.
  Expanded state shows the same form as today: Label field, Type dropdown, Options/Unit/Sep
  fields depending on type.

- **D-04:** The drag handle (`⠿`, left region) is the only draggable region. `draggable="true"`
  is set on the **chip element**, but `dragstart` is initiated only from the handle region
  (or the full chip row — implementation detail). Clicking the non-handle area expands;
  dragging the handle area reorders.

### Drag-and-Drop Implementation
- **D-05:** Use the **HTML5 native drag-and-drop API** — no external library.
  - `draggable="true"` on the chip row element
  - `dragstart` stores the dragged placeholder index in `dataTransfer`
  - `dragover` on sibling chips shows a drop indicator (CSS class, e.g. `drag-over`)
  - `drop` splices `draft.placeholders` and calls `renderPlaceholderList` to re-render
  - Works natively in Obsidian/Electron; no dependency added

### Persistence — Auto-Save on Drop
- **D-06:** Immediately after `drop` re-renders the list, call `snippetService.save(draft)`.
  - On success: show Obsidian `Notice("Snippet saved.")` (same as current save flow)
  - On error: show `Notice("Failed to save snippet. Check that the vault is writable and try again.")`
  - The [Save snippet] button remains and still works as before (for other edits)
  - `this.snippets` local list is kept in sync (update the entry at the existing index)

### Chip List Layout
- **D-07:** Chip list is a **vertical flex column** (same as current `rp-placeholder-list`).
  Chips are full-width, not wrapped. Vertical layout is required for predictable drop targets
  between items.

### [×] Remove Button on Chip
- **D-08:** The [×] remove button stays on the chip (not inside the expanded editor).
  Clicking [×] still triggers the current orphan-badge logic and re-renders the list.
  No change to remove semantics from Phase 5 D-05.

### Claude's Discretion
- Exact CSS class names for the colour bar and drag-over indicator
- Whether the colour bar is an inline `<span>` or a CSS `border-left` on the chip
- Exact drag ghost appearance (browser default is acceptable)
- Whether `draggable="true"` is set on the whole chip row or only the handle region
- Exact handle glyph (⠿, ⋮⋮, or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements
- `.planning/ROADMAP.md` §Phase 27 — Goal, Success Criteria SC-1…SC-3 (authoritative)

### Existing code to modify
- `src/views/snippet-manager-view.ts` — `renderPlaceholderList()` and `renderPlaceholderRow()`:
  replace row rendering with chip rendering; add drag event handlers
- `src/styles.css` — `.rp-placeholder-list`, `.rp-placeholder-row`, `.rp-placeholder-row-header`:
  update/extend for chip layout, colour bar, drag-over indicator

### Existing code to read (do not modify)
- `src/canvas/node-color-map.ts` — colour palette pattern used in Phase 21
- `src/views/snippet-fill-in-modal.ts` — iterates `snippet.placeholders` in array order (D-12);
  no changes needed — just verify after reorder
- `src/snippets/snippet-model.ts` — `SnippetFile.placeholders: SnippetPlaceholder[]` — order
  of this array = tab order in fill-in modal

### Pattern reference
- Phase 5 CONTEXT.md D-05 — original placeholder row semantics (label + type + [×] + expand)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderExpandedPlaceholder()` / `renderNumberExpanded()` — existing inline expand logic;
  reuse as-is, just attach to chip click event instead of row click
- `refreshOrphanBadges()` — called on remove; keep unchanged
- `rp-placeholder-type-badge` CSS class — reuse for type badge on chip
- `rp-placeholder-orphan-badge` CSS class — reuse unchanged

### Established Patterns
- All DOM via `createEl()`/`createDiv()` — no `innerHTML`
- `registerDomEvent()` for click handlers; `addEventListener` for drag events
  (drag events on dynamically created elements can use `addEventListener` directly,
  since `registerDomEvent` on `this` is for ItemView lifetime cleanup)
- `new Notice(...)` for transient messages
- `snippetService.save(draft)` — existing async save call used in `handleSave()`

### Integration Points
- `renderPlaceholderRow()` — wholesale replacement: swap row `<div>` for chip `<div>`
  with colour bar, drag handle, label, type badge, [×], and click-to-expand
- `handleSave()` / `handleDelete()` — unchanged
- `renderPlaceholderList()` — add drag event wiring; call `snippetService.save(draft)`
  after successful drop reorder

### Key Observation — Current Expand Click Region Conflict
- Current code: `registerDomEvent(header, 'click', ...)` on the whole header row
- New code: drag handle must NOT trigger expand; click on label/badge area triggers expand;
  [×] must NOT trigger expand (already guarded by `e.target === removeBtn`)
- Solution: set `draggable="true"` on chip row; listen for `dragstart` to capture index;
  on chip click check `e.target` is not handle and not [×] before expanding

</code_context>

<specifics>
## Specific Ideas

- Use CSS `border-left: 4px solid var(--color-cyan)` on the chip element as the colour bar —
  simplest approach, no extra DOM node
- `dataTransfer.setData('text/plain', String(index))` in `dragstart` to pass source index
- `dragover` must call `e.preventDefault()` to allow drop; add/remove `drag-over` CSS class
  on `dragenter`/`dragleave`
- After drop: `const [moved] = draft.placeholders.splice(from, 1); draft.placeholders.splice(to, 0, moved);`
  then re-render and auto-save
- Colour map for chips (separate constant, not reusing `NODE_COLOR_MAP`):
  ```ts
  const PH_COLOR: Record<SnippetPlaceholder['type'], string> = {
    'free-text':    'var(--color-cyan)',
    'choice':       'var(--color-orange)',
    'multi-choice': 'var(--color-purple)',
    'number':       'var(--color-green)',
  };
  ```

</specifics>

<deferred>
## Deferred Ideas

- None raised during discussion

</deferred>

---

*Phase: 27-interactive-placeholder-editor*
*Context gathered: 2026-04-12*
