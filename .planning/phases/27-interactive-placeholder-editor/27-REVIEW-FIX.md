---
phase: 27-interactive-placeholder-editor
fixed_at: 2026-04-12T00:00:00Z
review_path: .planning/phases/27-interactive-placeholder-editor/27-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 27: Code Review Fix Report

**Fixed at:** 2026-04-12
**Source review:** .planning/phases/27-interactive-placeholder-editor/27-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01 through WR-05; Info findings excluded per fix_scope)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: Stale `index` closure makes DnD reorder silently wrong after any re-render

**Files modified:** `src/views/snippet-manager-view.ts`
**Commit:** 936ff4d
**Applied fix:** Set `chip.dataset['dragIndex'] = String(index)` at render time. The `dragstart` handler now reads from `chip.dataset['dragIndex']` instead of the closed-over `index`. The `drop` handler reads `to` from `chip.dataset['dragIndex']` as well, and adds guards: `isNaN`, same-slot (`from === to`), negative-index, and out-of-range (`>= draft.placeholders.length`) checks before the splice.

---

### WR-02: `dragleave` fires on child elements, causing flickering `drag-over` class

**Files modified:** `src/views/snippet-manager-view.ts`
**Commit:** 936ff4d
**Applied fix:** Changed the `dragleave` listener signature to accept `(e: DragEvent)` and added a guard: `if (chip.contains(e.relatedTarget as Node | null)) return;` before removing the `drag-over` class. Combined in the same commit as WR-01 and WR-04 since all three were in the same DnD event handler block.

---

### WR-03: `autoSaveAfterDrop` silently saves a draft that has never been named/saved

**Files modified:** `src/views/snippet-manager-view.ts`
**Commit:** d26d433
**Applied fix:** Added a UUID detection guard at the top of `autoSaveAfterDrop` using a full UUID v4 regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`). When `draft.id` matches, the method returns early with no side effects. The in-memory placeholder order is preserved and will be persisted when the user explicitly clicks "Save snippet".

---

### WR-04: `dragend` cleanup calls `el.removeClass` on plain `Element` — runtime error in strict DOM typing

**Files modified:** `src/views/snippet-manager-view.ts`
**Commit:** 936ff4d
**Applied fix:** Added `(el as HTMLElement)` cast inside the `dragend` forEach so that Obsidian's `removeClass` extension method is accessible. Combined in the same commit as WR-01 and WR-02.

---

### WR-05: Expanded inline editor event listeners accumulate on re-render cycles

**Files modified:** `src/views/snippet-manager-view.ts`
**Commit:** f9e98a5
**Applied fix:** Replaced all six `this.registerDomEvent(...)` calls inside `renderExpandedPlaceholder` and `renderNumberExpanded` with bare `element.addEventListener(...)`. Affected elements: `labelInput` (input), `typeSelect` (change), `optInput` (input), `removeOptBtn` (click), `addOptionBtn` (click), `sepInput` (input), and `unitInput` (input). These elements are destroyed on collapse, so GC naturally frees their listeners; using `registerDomEvent` was causing ghost listener accumulation in the view's internal registry across expand/collapse cycles.

---

_Fixed: 2026-04-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
