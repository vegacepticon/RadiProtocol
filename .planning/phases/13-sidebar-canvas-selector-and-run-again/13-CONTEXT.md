---
phase: 13
name: Sidebar Canvas Selector and Run Again
status: discussed
discussed: 2026-04-08
---

# Phase 13 Context — Sidebar Canvas Selector and Run Again

## Domain Boundary

Two self-contained features:
1. **Sidebar canvas selector parity** — `CanvasSelectorWidget` must be visible and functional when the runner is open in sidebar mode (currently invisible due to missing CSS)
2. **Run again** — after a protocol completes, a button lets the user restart the same canvas from the beginning without switching canvases

The phase boundary is FIXED. It does not include changing the canvas mid-session flow, restyling the complete state output, or adding a "back to selector" idle screen.

---

## Canonical Refs

- `src/views/runner-view.ts` — RunnerView: `onOpen()`, `render()`, complete-state branch, `openCanvas()`
- `src/views/canvas-selector-widget.ts` — CanvasSelectorWidget: full implementation, CSS class names
- `src/styles.css` — all plugin CSS; `rp-selector-*` classes are currently ABSENT (root cause)
- `.planning/STATE.md` — Critical Pitfall 8: selector must live in `headerEl`, not `contentEl`

---

## Decisions

### 1. Sidebar selector: stay in `headerEl`, add missing CSS

**Decision:** Keep `CanvasSelectorWidget` mounted in `headerEl` for both tab and sidebar modes. The code already does this unconditionally in `onOpen()`. The fix is adding CSS for all `rp-selector-*` classes to `src/styles.css`.

**Root cause:** CSS for `rp-selector-*` classes is completely absent from `src/styles.css`. In tab mode Obsidian's native header styles happen to make the button visible; in sidebar mode the narrower header hides it entirely.

**What to add in CSS:**
- `.rp-selector-wrapper` — should occupy full width of the header container, displayed as a block below the title row. The `headerEl` in Obsidian renders custom child divs as block-level elements below the title/actions row.
- `.rp-selector-trigger` — full-width button (`width: 100%`), compact height, shows current canvas name or placeholder text
- `.rp-selector-chevron` — inline icon on the right of the trigger label
- `.rp-selector-popover` — absolute-positioned dropdown, `z-index` high enough to overlay content, `min-width` matching trigger, background + border
- `.rp-selector-row` — list item, `display: flex`, `align-items: center`, `cursor: pointer`, hover state
- `.rp-selector-row-icon` — icon span, fixed width
- `.rp-selector-row-label` — text label, `flex: 1`
- `.rp-selector-back-row`, `.rp-selector-folder-row`, `.rp-selector-file-row` — row type variants
- `.rp-selector-row-arrow` — chevron for folder drill-in
- `.rp-selector-empty-hint` — muted text for empty state
- `.is-selected` on file row — highlight for currently selected canvas

**Constraint (Pitfall 8):** Do NOT move the selector to `contentEl`. `render()` calls `contentEl.empty()` which would destroy the selector widget. It must remain in `headerEl`.

---

### 2. "Run again" button: in `questionZone`, below the complete heading

**Decision:** In the `complete` case of `render()`, add a "Run again" button inside `questionZone`, immediately after the `h2` heading. It appears in the same zone as protocol actions (not the output toolbar).

**Layout:**
```
questionZone:
┌────────────────────────────┐
│  Protocol complete  (h2)   │
│  [Run again]               │  <- new button
└────────────────────────────┘

previewZone:
  [textarea with finalText]

outputToolbar:
  [Copy] [Save] [Insert]
```

**CSS class:** `rp-run-again-btn` — standard button, no special accent color needed (not a primary action).

---

### 3. "Run again" behavior: call `openCanvas(this.canvasFilePath)`

**Decision:** The click handler calls `void this.openCanvas(this.canvasFilePath!)`. No pre-reset needed.

**Why it works:**
- The session is already cleared synchronously when the `complete` state is first rendered (existing code: `void this.plugin.sessionService.clear(this.canvasFilePath)`)
- `openCanvas()` calls `this.runner.start(graph)` and `this.render()` — a clean restart
- `canvasFilePath` is guaranteed non-null in the `complete` branch (protocol cannot complete without a canvas loaded)

**Button visibility:** The button only renders in the `complete` case, which is only reachable when `canvasFilePath !== null`. No null guard needed in the click handler.

**Selector label:** `openCanvas()` calls `this.selector?.setSelectedPath(filePath)` — the selector label stays correct (same canvas selected).

---

## Non-Decisions (Claude's Discretion)

- Exact colors, border-radius, padding values for new CSS — follow existing `rp-*` token patterns in `src/styles.css`
- Button label text: "Run again" (English, consistent with existing UI language)
- Whether to add a test for "Run again" button presence: yes, follow the pattern in `RunnerView.test.ts`

---

## Deferred Ideas

*(none raised during discussion)*
