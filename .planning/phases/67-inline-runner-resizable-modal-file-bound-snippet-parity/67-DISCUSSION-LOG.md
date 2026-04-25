# Phase 67: Inline Runner Resizable Modal & File-Bound Snippet Parity — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 67 — Inline Runner Resizable Modal & File-Bound Snippet Parity
**Areas discussed:** Resize UX + CSS, Persistence shape + save timing, Min/max + clamp, INLINE-FIX-07 — bug or parity
**Discussion language:** Russian (per `memory/feedback_language.md`)

---

## Selection of areas

| Option | Description | Selected |
|--------|-------------|----------|
| Resize UX + CSS | Where & how user grabs the frame: native CSS resize:both vs custom edge/corner zones, visible grip, .is-resizing class | ✓ |
| Persistence shape + save timing | Extend InlineRunnerPosition to {left,top,width,height} or separate inlineRunnerSize? When to save: on every pointermove vs only pointerup. Migration. | ✓ |
| Min/max sizes + clamp | Lower/upper bound for width and height. Behavior on viewport overflow. Extend clampInlineRunnerPosition or add clampInlineRunnerSize. | ✓ |
| INLINE-FIX-07 — bug or parity | Reproducible scenario with picker fallback, or regression tests + invariant tightening? Affects code-fix plan vs tests-only. | ✓ |

**User's choice:** All four areas selected.

---

## Resize UX + CSS

### How to capture the resize gesture

| Option | Description | Selected |
|--------|-------------|----------|
| Native CSS resize:both (Recommended) | resize:both + overflow on container; browser draws SE-corner grip; minimum JS, ResizeObserver for end-detect; built-in cursor states. Limitation: SE-corner only. | ✓ |
| Custom edge+corner zones | 8 invisible absolute-positioned elements (N/E/S/W/NE/NW/SE/SW), own cursors, pointer handlers. Full control, more code & tests. | |
| Custom corner-grip in SE | One visible element in SE-corner with handle icon, proprietary pointer handlers. Explicit affordance, but resize only one direction. | |

**User's choice:** Native CSS resize:both (Recommended)

### Visual feedback during resize

| Option | Description | Selected |
|--------|-------------|----------|
| .is-resizing parallel to .is-dragging (Recommended) | Add .rp-inline-runner-container.is-resizing with box-shadow:var(--shadow-xl) — exactly like .is-dragging. Pattern already in code (line 178). | ✓ |
| No flag | No visual effect during resize — cursor itself is sufficient affordance. | |
| Other | User-described | |

**User's choice:** .is-resizing parallel to .is-dragging (Recommended)

### Style native resize-grip in SE corner?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep browser default (Recommended) | ::-webkit-resizer standard, user experience matches Obsidian textareas. Zero cost. Drawback: weak in dark theme. | ✓ |
| Custom ::-webkit-resizer | Style with var(--text-muted) and var(--background-modifier-border), explicit affordance. Works in Chromium (Obsidian). +~5 CSS lines. | |

**User's choice:** Keep browser default (Recommended)

### Resize-end detection

| Option | Description | Selected |
|--------|-------------|----------|
| ResizeObserver + debounce (Recommended) | Existing resizeObserver (line 81) listens to container, debounce 300–500 ms without new sizes = resize-end. Works for native resize without pointer-listeners. | ✓ |
| pointerdown→pointerup on resizer | Listen pointerup on window after pointerdown near SE-corner. More complex for native resize — browser captures events. | |
| Other | User-described | |

**User's choice:** ResizeObserver + debounce (Recommended)

### Continue with more questions about Resize UX, or next area?

| Option | Selected |
|--------|----------|
| Move to Persistence shape + save timing | ✓ |
| More questions about Resize UX | |

**User's choice:** Move to Persistence shape + save timing

---

## Persistence shape + save timing

### How to store size alongside position (Phase 60 inlineRunnerPosition)?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend InlineRunnerPosition to {left,top,width,height} (Recommended) | One field inlineRunnerPosition holds entire layout. Possibly rename to InlineRunnerLayout. Less branching, atomic save. width/height optional for migration. | ✓ |
| Separate field inlineRunnerSize {width,height} | Two independent settings fields: position and size. Minimum changes to Phase 60 field. Two separate save calls. | |

**User's choice:** Extend InlineRunnerPosition to {left,top,width,height} (Recommended)

### When to write width/height to saveData?

| Option | Description | Selected |
|--------|-------------|----------|
| Only at resize-end (Recommended) | ResizeObserver + 400ms debounce → final dimensions saved. Minimum I/O. Parity with Phase 60: position saves only on pointerup after drag (inline-runner-modal.ts:672). | ✓ |
| On every ResizeObserver tick | Every pixel of change → saveData. Problem: dozens of writes per second during resize. | |
| On every tick + 100ms debounce | Intermediate — 100ms debounce. Faster crash-recovery. | |

**User's choice:** Only at resize-end (Recommended)

### Interface name after extension?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep InlineRunnerPosition | Name unchanged, optional width? height? added. Zero risk, simpler migration. But name is semantically wrong (Position with width/height). | |
| Rename to InlineRunnerLayout (Recommended) | Semantics clear. ~7 files (settings.ts, main.ts, inline-runner-modal.ts, 4 tests). Field in settings renamed? Or type rename, settings field same? | |
| Rename type, keep settings field (Recommended) | Type: InlineRunnerLayout. Settings field: inlineRunnerPosition (preserves back-compat with live data in .obsidian/plugins/.../data.json). No migration logic. Clean code names. | ✓ |

**User's choice:** Rename type, keep settings field (Recommended)

### Migration: first run after update or data without width/height

| Option | Description | Selected |
|--------|-------------|----------|
| Optional fields + default (Recommended) | width and height optional. If missing — applyPosition uses INLINE_RUNNER_DEFAULT_WIDTH=360 / DEFAULT_HEIGHT=240 (already in code at lines 24-25). Zero migration logic, back-compat. | ✓ |
| Required + one-time migration | At loadData check and write defaults. More code, no benefit. | |

**User's choice:** Optional fields + default (Recommended)

### Continue or move to Min/max + clamp?

| Option | Selected |
|--------|----------|
| Move to Min/max + clamp | ✓ |
| More questions about Persistence | |

**User's choice:** Move to Min/max + clamp

---

## Min/max + clamp

### Minimum width for resize?

| Option | Description | Selected |
|--------|-------------|----------|
| 240px (Recommended) | Slightly above INLINE_RUNNER_MIN_VISIBLE_WIDTH=160 (used for position-clamp). Fits Phase 65 Back/Skip with labels. Enforced via CSS min-width. | ✓ |
| 300px | More confident minimum. All buttons in one row. Limits user freedom. | |
| 160px (= MIN_VISIBLE_WIDTH) | Maximum freedom. Problem: question text truncates, buttons wrap. | |

**User's choice:** 240px (Recommended)

### Minimum height for resize?

| Option | Description | Selected |
|--------|-------------|----------|
| 120px (Recommended) | Fits header (~32px) + 1–2 rows of content + Back/Skip footer. Remainder scrolls in .rp-inline-runner-content. | ✓ |
| 80px (header+footer only) | Maximum compactness. Content fully hidden in scroll. | |
| 200px | More context visible. Larger than compact default 240. | |

**User's choice:** 120px (Recommended)

### Maximum sizes and viewport-clamp?

| Option | Description | Selected |
|--------|-------------|----------|
| max = viewport - margin (Recommended) | max-width: calc(100vw - 32px); max-height: calc(100vh - 32px) in CSS. clampInlineRunnerLayout extended: if saved.width > viewport.width → clamp to viewport-margin. Mirrors Phase 60 D-02 (clamp-on-restore). | ✓ |
| No max, trust user | No max-bound. On restore: if width > viewport — clamp to viewport. User can resize beyond viewport and lose grip. | |

**User's choice:** max = viewport - margin (Recommended)

### Handling viewport-shrink (user shrunk Obsidian window)?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-clamp on window-resize event (Recommended) | windowResizeHandler (already in code line 91) recomputes layout, applies clampInlineRunnerLayout. Pattern already works for position. | ✓ |
| Re-clamp only on restore (open) | Allow exceeding viewport in live session on window resize. Each open computes anew. | |

**User's choice:** Re-clamp on window-resize event (Recommended)

### Move to INLINE-FIX-07?

| Option | Selected |
|--------|----------|
| Move to INLINE-FIX-07 | ✓ |
| More questions about Min/max | |

**User's choice:** Move to INLINE-FIX-07

---

## INLINE-FIX-07 — bug or parity

### Status of INLINE-FIX-07 — real bug or regression-parity?

| Option | Description | Selected |
|--------|-------------|----------|
| Reproducible bug exists | You personally saw inline file-bound Snippet fall into picker or not insert file. Describe scenario via Other. | ✓ |
| Regression-parity without code-fix (Recommended) | Code already correct. Phase adds regression tests for parity (.md / .json-no-placeholders / .json-with-placeholders in inline mode) and documents invariants. | |
| Not sure, need manual test | Need to reproduce in Obsidian before planning. Plan will contain repro-steps. | |

**User's choice:** Reproducible bug — "yes, if I set a specific snippet in target via node editor settings, when the runner reaches that snippet node the button shows root directory and clicking forces manual directory walking instead of inserting the preconfigured snippet, for some reason"

### Sidebar parity check: does the same scenario work correctly in sidebar runner?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, sidebar works correctly | Same snippet node in sidebar runner inserts the file directly (as Phase 56 designed). Bug isolated in inline-runner-modal. | |
| No, sidebar also breaks | Bug above inline-runner: in graph-parser, node-editor, or ProtocolRunner. Then INLINE-FIX-07 extends beyond inline-only and affects sidebar. | ✓ |
| Haven't tested | Need to clarify before planning. | |

**User's choice:** No, sidebar also breaks

### Button label text in inline mode (broken case)?

| Option | Description | Selected |
|--------|-------------|----------|
| Folder icon 📁 + name | Folder icon, i.e. isFileBound==false. Problem above inline-runner: parser/node-editor isn't writing radiprotocol_snippetPath. | |
| File icon 📄 + name | File icon (isFileBound==true), but click still goes to picker. Problem in dispatch handler or pickFileBoundSnippet. | |
| Don't remember exactly | Need to check in Obsidian. | |

**User's choice:** "no icon, says `snippet (root)`" (Other) — investigation revealed this is the `nodeLabel()` output for snippet nodes without `subfolderPath`, used in loop-body branch buttons (`runner-view.ts:645`, `inline-runner-modal.ts:452`)

### Scope of INLINE-FIX-07 expands to protocol-runner + node-label — agreed?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include in Phase 67 (Recommended) | Fix in protocol-runner.ts case 'snippet': if file-bound → awaiting-snippet-fill (as pickFileBoundSnippet does); directory-bound → current behavior. Update node-label.ts so loop-body buttons show correct label. ROADMAP and STATE amended. | ✓ |
| Separate phase 68 for runner-core fix | Phase 67 stays Inline-only (resize only). protocol-runner fix — separate phase. INLINE-FIX-07 release deferred and misses v1.10. | |
| Only protocol-runner.ts, no node-label | Fix traversal in runner. Loop-body buttons keep showing "snippet (root)" — not idealistic, but insertion logic works. Minimum changes. | |

**User's choice:** Yes, include in Phase 67 (Recommended)

### Are inline-runner.ts changes for FIX-07 needed?

| Option | Description | Selected |
|--------|-------------|----------|
| Not needed, runner-core fix covers both modes (Recommended) | Fixing one place in protocol-runner.ts auto-fixes sidebar AND inline. Inline-runner-modal.ts not modified for FIX-07 (only for resize). | ✓ |
| There are inline-only nuances | Describe via Other. | |

**User's choice:** Not needed (Recommended)

### Label format for file-bound snippet in nodeLabel() and loop-body buttons?

| Option | Description | Selected |
|--------|-------------|----------|
| 📄 ${stem} parity with sibling-button (Recommended) | Exactly as in inline-runner-modal.ts:350-360: if snippetLabel exists → 📄 ${snippetLabel}; else → 📄 ${basename stem}; fallback → 📄 Snippet. Single caption-grammar across runner. | ✓ |
| Other format | Describe. | |

**User's choice:** 📄 ${stem} parity with sibling-button (Recommended)

### Test scope for INLINE-FIX-07?

| Option | Description | Selected |
|--------|-------------|----------|
| Runner-core + sidebar + inline (Recommended) | (1) ProtocolRunner unit-tests: advanceThrough on file-bound → awaiting-snippet-fill, directory-bound → awaiting-snippet-pick. (2) RunnerView regression: loop-body → file-bound → direct-insert. (3) InlineRunnerModal regression: same. (4) node-label.test.ts: file-bound vs directory-bound captions. | ✓ |
| Runner-core unit only | Basic ProtocolRunner unit tests. View-regression rely on existing Phase 56 tests. | |

**User's choice:** Runner-core + sidebar + inline (Recommended)

---

## Final wrap-up

### Ready for CONTEXT.md, or more areas to explore?

| Option | Selected |
|--------|----------|
| Create CONTEXT.md | ✓ |
| Explore additional gray areas | |

**User's choice:** Create CONTEXT.md

---

## Claude's Discretion

The following items were left to planner judgment in CONTEXT.md `<decisions>` section:

- Exact debounce constant within 300–500 ms range for resize-end
- Whether `clampInlineRunnerPosition` is renamed or wrapped
- Whether `applyPosition` is renamed to `applyLayout` or kept
- Exact wording of deviation note in PLAN.md / commit messages explaining `protocol-runner.ts` and `node-label.ts` touches in an inline-only ROADMAP-labeled phase
- Whether legacy `node-label.test.ts:47 'snippet (root)'` assertion remains for directory-bound back-compat (planner inspects callers)

## Deferred Ideas

- Per-canvas remembered layout
- Resize handles on N/W/E edges (beyond SE corner)
- Auto-fade Inline Runner on cursor proximity
- Settings UI for "reset inline layout"
- Touch / mobile resize testing
- Versioned settings schema migration
- Unifying `.is-dragging` and `.is-resizing` into `.is-interacting`
