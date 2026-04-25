# Phase 67: Inline Runner Resizable Modal & File-Bound Snippet Parity — Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 11 source / test / docs files
**Analogs found:** 11 / 11 (every new or modified file has an in-tree analog)

> **Verification note.** CONTEXT.md cites several line numbers from a snapshot. Each citation below was re-verified against the live code; corrections are flagged inline (`VERIFIED` / `CORRECTED`).

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/views/inline-runner-modal.ts` (FIX-06) | view (DOM-managed floating panel) | event-driven (pointer + ResizeObserver + workspace events) → debounced `loadData/saveData` | drag lifecycle in same file (`enableDragging` 654-683 + `restoreOrDefaultPosition` 628-635 + `reclampCurrentPosition` 644-652) | exact (parallel mechanism on the same class) |
| `src/styles/inline-runner.css` (FIX-06) | config (CSS, append-only per phase) | n/a | Phase 60 block at lines 164-198 incl. `.is-dragging` 178-180 | exact (mirror `.is-resizing` to `.is-dragging`) |
| `src/settings.ts` (FIX-06) | model (settings interface) | persisted via plugin `loadData/saveData` | `InlineRunnerPosition` interface at lines 7-10 + field at line 28 | exact (rename + add optional fields) |
| `src/main.ts` (FIX-06) | controller (plugin accessors) | request-response (sync read, async save) | `getInlineRunnerPosition` / `saveInlineRunnerPosition` at lines 229-236 | exact (type-only update) |
| `src/runner/protocol-runner.ts` (FIX-07) | controller (runtime state machine) | event-driven (graph traversal) | `pickFileBoundSnippet` body at lines 349-368 (Phase 56 D-03) | exact (mirror minus undo push — Pitfall 1) |
| `src/graph/node-label.ts` (FIX-07) | utility (pure label extractor) | transform (`RPNode → string`) | sibling-button caption grammar in `inline-runner-modal.ts:343-365` and `runner-view.ts:495-545` | exact (verbatim grammar reuse) |
| `src/__tests__/graph/node-label.test.ts` | test (vitest, pure) | n/a | existing snippet arm at lines 45-48 | exact (extend in place) |
| `src/__tests__/runner/protocol-runner-*.test.ts` (extend) | test (vitest, pure runner) | n/a | `protocol-runner-pick-file-bound-snippet.test.ts` (Phase 56) + `protocol-runner-loop-picker.test.ts` (Phase 44) | exact (graph factory + state assertion harness) |
| `src/__tests__/views/runner-snippet-*.test.ts` (extend) | test (vitest, RunnerView fake-DOM) | n/a | `runner-snippet-sibling-button.test.ts:1-80` | exact (FakeNode + RunnerView mount harness) |
| `src/__tests__/views/inline-runner-modal-loop-snippet.test.ts` (NEW or extend `inline-runner-modal.test.ts`) | test (vitest, InlineRunnerModal fake-DOM) | n/a | `inline-runner-modal.test.ts` MockEl harness (lines 1-80) | exact |
| `src/__tests__/inline-runner-layout.test.ts` (NEW) | test (vitest, fake DOM + window) | n/a | `inline-runner-position.test.ts:1-225` | exact (FakeElement + FakeDocument + ResizeObserver stub already present) |

---

## Pattern Assignments

### `src/views/inline-runner-modal.ts` (view, event-driven)

**Analog:** the same file's drag lifecycle. Every Phase 60 mechanism that the resize feature must mirror is already in this class:

**Field declarations** (`inline-runner-modal.ts:24-28, 81, 91, 92-94`) — `VERIFIED`:
```typescript
const INLINE_RUNNER_DEFAULT_WIDTH = 360;
const INLINE_RUNNER_DEFAULT_HEIGHT = 240;
const INLINE_RUNNER_DEFAULT_MARGIN = 16;
const INLINE_RUNNER_MIN_VISIBLE_WIDTH = 160;
const INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT = 40;
// ...
private resizeObserver: ResizeObserver | null = null;        // line 81 — declared but NEVER wired (Phase 67 wires it)
// ...
private windowResizeHandler: (() => void) | null = null;     // line 91 — already wired for re-clamp
private dragMoveHandler: ((event: PointerEvent) => void) | null = null;
private dragUpHandler: ((event: PointerEvent) => void) | null = null;
private isDragging = false;
```
> Phase 67 adds parallel state: `private isResizing = false;` and `private resizeDebounceTimer: number | null = null;`.

**Pure clamp helper** (`inline-runner-modal.ts:30-51`) — `VERIFIED`. The exported `clampInlineRunnerPosition` is the canonical Phase 60 D-02 clamp-on-restore primitive. Phase 67 D-10 either:
- extends this signature with size clamping (returning `InlineRunnerLayout`), OR
- adds a sibling `clampInlineRunnerLayout(layout, viewport)` that internally calls `clampInlineRunnerPosition`.

```typescript
export function clampInlineRunnerPosition(
  position: InlineRunnerPosition | null,
  viewport: InlineRunnerViewport,
  size: InlineRunnerSize,
): InlineRunnerPosition | null {
  if (!isFiniteInlineRunnerPosition(position)) return null;
  const visibleWidth  = Math.min(Math.max(size.width,  INLINE_RUNNER_MIN_VISIBLE_WIDTH),         viewport.width);
  const visibleHeight = Math.min(Math.max(size.height, INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT), viewport.height);
  const maxLeft = Math.max(0, viewport.width  - Math.min(visibleWidth,  INLINE_RUNNER_MIN_VISIBLE_WIDTH));
  const maxTop  = Math.max(0, viewport.height - Math.min(visibleHeight, INLINE_RUNNER_MIN_VISIBLE_HEADER_HEIGHT));
  return {
    left: Math.min(Math.max(0, position.left), maxLeft),
    top:  Math.min(Math.max(0, position.top),  maxTop),
  };
}
```
> Critical: do NOT change `INLINE_RUNNER_MIN_VISIBLE_WIDTH = 160`. It gates *position* recovery (drag visibility floor). The new `min-width: 240px` from D-09 is enforced separately, in CSS only.

**Restore-on-open lifecycle** (`inline-runner-modal.ts:608-635`) — `VERIFIED`:
```typescript
private getDefaultPosition(): InlineRunnerPosition { /* viewport - size - margin */ }
private applyPosition(position: InlineRunnerPosition): void {
  if (this.containerEl === null) return;
  this.containerEl.style.left = `${Math.round(position.left)}px`;
  this.containerEl.style.top  = `${Math.round(position.top)}px`;
  this.containerEl.style.right  = '';
  this.containerEl.style.bottom = '';
  this.containerEl.style.width  = '';
  this.containerEl.style.maxWidth = '';
  this.containerEl.style.transform = '';
}
private restoreOrDefaultPosition(): void {
  const saved = this.plugin.getInlineRunnerPosition();
  const viewport = this.getViewport();
  const size = this.getContainerSize();
  const restored = clampInlineRunnerPosition(saved, viewport, size);
  const position = restored
    ?? clampInlineRunnerPosition(this.getDefaultPosition(), viewport, size)
    ?? { left: INLINE_RUNNER_DEFAULT_MARGIN, top: INLINE_RUNNER_DEFAULT_MARGIN };
  this.applyPosition(position);
}
```
> Phase 67 mirror: `applyLayout(layout)` writes `width`/`height` (Math.round) when they are finite numbers; falls through to `applyPosition` for the position fields. `restoreOrDefaultLayout()` reads `plugin.getInlineRunnerPosition()` (returns the renamed type), calls `clampInlineRunnerLayout` with viewport, and applies via `applyLayout`. Missing `width`/`height` falls back to `INLINE_RUNNER_DEFAULT_WIDTH` / `INLINE_RUNNER_DEFAULT_HEIGHT` (D-06).

**Drag lifecycle — the canonical "save only on interaction-end" pattern** (`inline-runner-modal.ts:654-698`) — `VERIFIED`:
```typescript
private enableDragging(header: HTMLElement): void {
  header.addEventListener('pointerdown', (event: PointerEvent) => {
    if (this.containerEl === null) return;
    const start = this.getAppliedPosition() ?? this.getDefaultPosition();
    const startX = event.clientX, startY = event.clientY;
    this.isDragging = true;
    this.containerEl.addClass('is-dragging');                             // D-02 mirror

    this.dragMoveHandler = (moveEvent: PointerEvent) => {
      const next = clampInlineRunnerPosition(/* ... */);
      if (next !== null) this.applyPosition(next);                        // live, no save
    };

    this.dragUpHandler = () => {
      const finalPosition = this.getAppliedPosition();
      this.removeDragListeners();
      if (finalPosition !== null) {
        void this.plugin.saveInlineRunnerPosition(finalPosition);         // D-07: save on release
      }
    };

    document.addEventListener('pointermove', this.dragMoveHandler);
    document.addEventListener('pointerup',   this.dragUpHandler);
  });
}

private removeDragListeners(): void {
  // ... removeEventListener for pointermove/pointerup ...
  if (this.containerEl !== null) this.containerEl.removeClass('is-dragging');
  this.isDragging = false;
}
```
> **Phase 67 resize lifecycle (parallel structure):** in `open()` after `restoreOrDefaultPosition()`, instantiate `this.resizeObserver = new ResizeObserver(entries => this.handleResizeTick(entries))` and call `this.resizeObserver.observe(this.containerEl)`. Each tick:
> 1. If `!this.isResizing`, set `this.isResizing = true` and `containerEl.addClass('is-resizing')`.
> 2. Clear any pending `this.resizeDebounceTimer`; schedule a new one (300–500 ms — D-04 says 400 ms; Claude's Discretion allows 300–500).
> 3. On timer expiry: read final size from `containerEl.getBoundingClientRect()`, build `layout = { left, top, width, height }` (clamped via `clampInlineRunnerLayout`), call `await this.plugin.saveInlineRunnerLayout(layout)` (or rename-preserving `saveInlineRunnerPosition`), then `containerEl.removeClass('is-resizing')` and `this.isResizing = false`.
> No `pointerdown`/`pointerup` listeners on the resizer — the browser owns native CSS `resize: both` (D-01).

**Re-clamp on viewport change** (`inline-runner-modal.ts:184-190, 644-652`) — `VERIFIED`:
```typescript
this.workspaceLayoutRef = this.app.workspace.on('layout-change', () => {
  void this.reclampCurrentPosition(true);
});
this.windowResizeHandler = () => {
  void this.reclampCurrentPosition(true);
};
window.addEventListener('resize', this.windowResizeHandler);

// ...
private async reclampCurrentPosition(persistIfChanged: boolean): Promise<void> {
  const current = this.getAppliedPosition() ?? this.plugin.getInlineRunnerPosition() ?? this.getDefaultPosition();
  const clamped = clampInlineRunnerPosition(current, this.getViewport(), this.getContainerSize());
  if (clamped === null) return;
  this.applyPosition(clamped);
  if (persistIfChanged && (clamped.left !== current.left || clamped.top !== current.top)) {
    await this.plugin.saveInlineRunnerPosition(clamped);
  }
}
```
> Phase 67 extends `reclampCurrentPosition` (or adds `reclampCurrentLayout`) to also clamp width/height; persist when EITHER position OR size changed. D-11.

**Cleanup on close** (`inline-runner-modal.ts:225-232`) — `VERIFIED`:
```typescript
if (this.resizeObserver !== null) {
  this.resizeObserver.disconnect();
  this.resizeObserver = null;
}
if (this.windowResizeHandler !== null) {
  window.removeEventListener('resize', this.windowResizeHandler);
  this.windowResizeHandler = null;
}
```
> Phase 67 cleanup: also clear pending `resizeDebounceTimer` via `window.clearTimeout(this.resizeDebounceTimer)` and `removeClass('is-resizing')` defensively.

**Drift from analog the new code must adopt:**
- `ResizeObserver` is class-field-only at line 81 — Phase 67 must instantiate, observe, and disconnect it (currently dead).
- Type rename: every reference to `InlineRunnerPosition` in this file (import line 12, `isFiniteInlineRunnerPosition` line 30, `clampInlineRunnerPosition` line 35-39, `getDefaultPosition` line 608, `applyPosition` line 617, `restoreOrDefaultPosition` line 628, `getAppliedPosition` line 637, `reclampCurrentPosition` line 644) must update to `InlineRunnerLayout`. Settings field name is **unchanged** (D-05).

---

### `src/styles/inline-runner.css` (config, append-only)

**Analog:** Phase 60 compact-modal block + `.is-dragging` rule.

**Phase 60 layout block** (`src/styles/inline-runner.css:164-198`) — `VERIFIED` (CONTEXT cited "inline-runner-modal.ts:178-180" — that was wrong; the rule is in this CSS file):
```css
/* Phase 60: compact draggable inline runner */
.rp-inline-runner-container {
  width: min(360px, calc(100vw - var(--size-4-8)));
  max-width: calc(100vw - var(--size-4-8));
  max-height: min(52vh, calc(100vh - var(--size-4-8)));
  bottom: auto;
  right: auto;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  box-shadow: var(--shadow-l);
  overflow: hidden;
  transition: box-shadow 0.12s ease;
}

.rp-inline-runner-container.is-dragging {
  box-shadow: var(--shadow-xl);
}

.rp-inline-runner-header {
  padding: var(--size-2-3) var(--size-4-2);
  cursor: grab;
  user-select: none;
}

.rp-inline-runner-container.is-dragging .rp-inline-runner-header {
  cursor: grabbing;
}
```
> **Phase 67 must append at end of file (after line 245)** under a `/* Phase 67: resizable inline runner */` comment. Per CLAUDE.md "CSS files: append-only per phase" and "Never remove existing code you didn't add". The Phase 60 `overflow: hidden` on `.rp-inline-runner-container` (line 174) is the one rule that conflicts with `resize: both` — D-01 requires `overflow: auto` (or split: container `overflow: hidden` removed in the Phase 67 block while `.rp-inline-runner-content` keeps its existing `overflow-y: auto` from line 57). The cleanest patch is to add an override rule in the Phase 67 block, NOT to mutate line 174.

**Phase 67 append-only block (template):**
```css
/* Phase 67: resizable inline runner */
.rp-inline-runner-container {
  resize: both;
  overflow: auto;                                           /* override Phase 60 line 174 */
  min-width: 240px;                                         /* D-09 — fits Back/Skip footer row */
  min-height: 120px;                                        /* D-09 — header + ≥1 button row + footer */
  max-width: calc(100vw - var(--size-4-8));                 /* D-10 — already declared; safe re-state */
  max-height: calc(100vh - var(--size-4-8));                /* D-10 */
}

.rp-inline-runner-container.is-resizing {
  box-shadow: var(--shadow-xl);                             /* D-02 — exact mirror of .is-dragging */
}
```
> Run `npm run build` after the CSS edit to regenerate `styles.css` (CLAUDE.md). Never commit `styles.css` directly.

---

### `src/settings.ts` (model, persisted)

**Analog:** the existing `InlineRunnerPosition` interface and field — both must be touched for D-05 / D-06.

**Existing declaration** (`src/settings.ts:7-10`) — `VERIFIED`:
```typescript
export interface InlineRunnerPosition {
  left: number;
  top: number;
}
```

**Existing field** (`src/settings.ts:28`) — `VERIFIED`:
```typescript
/** Phase 60 (D-01): Last dragged inline runner position, persisted across reloads. */
inlineRunnerPosition?: InlineRunnerPosition | null;
```

**Existing default** (`src/settings.ts:40`) — `VERIFIED`:
```typescript
inlineRunnerPosition: null,
```

**Phase 67 changes (D-05 + D-06):**
```typescript
/** Phase 67 (D-05): renamed from InlineRunnerPosition; width/height optional for back-compat (D-06).
 *  Existing on-disk records have only {left, top}; the missing fields fall back to
 *  INLINE_RUNNER_DEFAULT_WIDTH / INLINE_RUNNER_DEFAULT_HEIGHT in the modal layer.
 *  Settings field name `inlineRunnerPosition` is intentionally NOT renamed — preserves
 *  on-disk back-compat per Pitfall #11. */
export interface InlineRunnerLayout {
  left: number;
  top: number;
  width?: number;
  height?: number;
}
```
> Field type changes from `InlineRunnerPosition` to `InlineRunnerLayout`. Field name and default value (`null`) unchanged.

**Drift from analog:** the rename is type-only; do not introduce a deprecation alias (no consumers outside the four files in the touch list — verified by grep: 5 hits across `inline-runner-modal.ts`, `settings.ts`, `main.ts`, `__tests__/views/inline-runner-position.test.ts`, `__tests__/views/runner-footer-layout.test.ts`).

---

### `src/main.ts` (controller, accessor pair)

**Analog:** the accessor pair itself.

**Existing accessors** (`src/main.ts:229-236`) — `VERIFIED` (one line off CONTEXT's "229-237" — the closing brace is at 236):
```typescript
getInlineRunnerPosition(): InlineRunnerPosition | null {
  return this.settings.inlineRunnerPosition ?? null;
}

async saveInlineRunnerPosition(position: InlineRunnerPosition | null): Promise<void> {
  this.settings.inlineRunnerPosition = position;
  await this.saveSettings();
}
```

**Phase 67 changes:** type signature only. Method name preserved (D-08 — both names acceptable; lower-blast-radius option is to keep `getInlineRunnerPosition` / `saveInlineRunnerPosition` since the settings field name is unchanged):
```typescript
getInlineRunnerPosition(): InlineRunnerLayout | null {
  return this.settings.inlineRunnerPosition ?? null;
}

async saveInlineRunnerPosition(layout: InlineRunnerLayout | null): Promise<void> {
  this.settings.inlineRunnerPosition = layout;
  await this.saveSettings();
}
```
> Update import line at top of file (currently `import type { InlineRunnerPosition } from './settings';` — replace with `InlineRunnerLayout`).

**Drift from analog:** none. Pure type swap, no logic change.

---

### `src/runner/protocol-runner.ts` (controller, state machine — FIX-07 root cause)

**Analog:** `pickFileBoundSnippet` body (Phase 56 D-03) at lines 349-368 — `VERIFIED`:
```typescript
pickFileBoundSnippet(
  questionNodeId: string,
  snippetNodeId: string,
  snippetPath: string,
): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.currentNodeId !== questionNodeId) return;

  // D-15 undo-before-mutate — identical UndoEntry shape to pickSnippet (:305).
  this.undoStack.push({                                      // ← Phase 67 D-14 OMITS this block
    nodeId: questionNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: this.loopContextStack.map(f => ({ ...f })),
  });

  this.snippetId = snippetPath;
  this.snippetNodeId = snippetNodeId;
  this.currentNodeId = snippetNodeId;
  this.runnerStatus = 'awaiting-snippet-fill';
}
```

**Block to replace** (`src/runner/protocol-runner.ts:736-741`) — `VERIFIED`:
```typescript
case 'snippet': {
  // Phase 30 D-07: halt at snippet node, RunnerView renders the picker.
  this.currentNodeId = cursor;
  this.runnerStatus = 'awaiting-snippet-pick';
  return;
}
```

**Phase 67 D-14 replacement** (mandate exception to CLAUDE.md "never remove existing code you didn't add" — must be documented in the commit message):
```typescript
case 'snippet': {
  this.currentNodeId = cursor;
  if (typeof node.radiprotocol_snippetPath === 'string' && node.radiprotocol_snippetPath !== '') {
    // Phase 67 D-14 — file-bound: bypass picker, direct dispatch (parity with Phase 56 D-03 pickFileBoundSnippet).
    // No undo push here — advanceThrough never pushes (Pitfall 1); the caller (e.g. chooseLoopBranch line 225)
    // already pushed the predecessor entry before transferring control.
    this.snippetId = node.radiprotocol_snippetPath;
    this.snippetNodeId = cursor;
    this.runnerStatus = 'awaiting-snippet-fill';
  } else {
    // Phase 30 D-07: directory-bound (or unbound) — picker path preserved.
    this.runnerStatus = 'awaiting-snippet-pick';
  }
  return;
}
```

**Why no undo push here** (verified by reading `chooseLoopBranch` at line 225 → `advanceThrough` at line 265, and `advanceThrough` definition at line 601): `advanceThrough` is a private traversal primitive called from `start()`, `chooseAnswer/chooseLoopBranch/skip/completeSnippet` after the caller has already pushed (where appropriate). Adding an undo entry inside `case 'snippet'` would double-push for loop-body→snippet (`chooseLoopBranch` already pushed the loop frame undo) and was the explicit warning in CONTEXT D-14.

**Type assumption:** `node` inside this `case 'snippet'` is narrowed to `SnippetNode`, which carries `radiprotocol_snippetPath?: string` (`src/graph/graph-model.ts:96`).

**Drift from analog:** `pickFileBoundSnippet` runs from `at-node` (caller flips runner state); `advanceThrough` runs from any traversal entry and uses `cursor` as the new current node. The two are structurally siblings, not identical.

---

### `src/graph/node-label.ts` (utility, transform — FIX-07 visible side)

**Analog:** sibling-button caption grammar at `src/views/inline-runner-modal.ts:343-365` (`VERIFIED`) and the matching block in `src/views/runner-view.ts:495-545` (`VERIFIED` — same grammar, same `📄`/`📁` emoji bytes).

**Inline-runner sibling button (canonical grammar)** — `inline-runner-modal.ts:346-365`:
```typescript
const isFileBound =
  typeof snippetNode.radiprotocol_snippetPath === 'string' &&
  snippetNode.radiprotocol_snippetPath !== '';
let label: string;
if (isFileBound) {
  const snippetPath = snippetNode.radiprotocol_snippetPath as string;
  if (snippetNode.snippetLabel !== undefined && snippetNode.snippetLabel.length > 0) {
    label = `📄 ${snippetNode.snippetLabel}`;       // 📄 + label
  } else {
    const lastSlash = snippetPath.lastIndexOf('/');
    const basename = lastSlash >= 0 ? snippetPath.slice(lastSlash + 1) : snippetPath;
    const dot = basename.lastIndexOf('.');
    const stem = dot > 0 ? basename.slice(0, dot) : basename;
    label = stem.length > 0 ? `📄 ${stem}` : '📄 Snippet';
  }
} else {
  label = (snippetNode.snippetLabel !== undefined && snippetNode.snippetLabel.length > 0)
    ? `📁 ${snippetNode.snippetLabel}`               // 📁 + label
    : '📁 Snippet';
}
```

**Block to replace** (`src/graph/node-label.ts:26`) — `VERIFIED` (single line in the switch):
```typescript
case 'snippet': return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';
```

**Phase 67 D-15 replacement (preserves directory-bound back-compat for `graph-validator` error messages — see Specifics §):**
```typescript
case 'snippet': {
  const isFileBound = typeof node.radiprotocol_snippetPath === 'string' && node.radiprotocol_snippetPath !== '';
  if (isFileBound) {
    const path = node.radiprotocol_snippetPath as string;
    if (node.snippetLabel !== undefined && node.snippetLabel.length > 0) return `📄 ${node.snippetLabel}`;
    const lastSlash = path.lastIndexOf('/');
    const basename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
    const dot = basename.lastIndexOf('.');
    const stem = dot > 0 ? basename.slice(0, dot) : basename;
    return stem.length > 0 ? `📄 ${stem}` : '📄 Snippet';
  }
  if (node.snippetLabel !== undefined && node.snippetLabel.length > 0) return `📁 ${node.snippetLabel}`;
  return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';     // back-compat with graph-validator
}
```

**Drift from analog:** the new arm uses the same emoji code points (`📄` = 📄, `📁` = 📁) as the modal — character-for-character identity is the invariant from the file's own header comment ("Do not diverge — the validator error text and the runner button caption MUST match character-for-character").

**Important:** the existing `node-label.test.ts:46-47` directory-bound assertions (`'snippet (Findings/Chest)'` and `'snippet (root)'`) MUST stay green — `graph-validator` consumes them in error UX (Specifics §, point 5). The test file extends the snippet `it()` block; it does not replace it.

---

### `src/__tests__/graph/node-label.test.ts` (test, vitest pure)

**Analog:** the existing snippet arm at lines 45-48 — `VERIFIED`:
```typescript
it('snippet → subfolderPath variant, else `snippet (root)`', () => {
  expect(nodeLabel({ id: 's1', kind: 'snippet', subfolderPath: 'Findings/Chest', ...baseRect } as RPNode)).toBe('snippet (Findings/Chest)');
  expect(nodeLabel({ id: 's2', kind: 'snippet', ...baseRect } as RPNode)).toBe('snippet (root)');
});
```

**Phase 67 extension (additive):**
- Keep both existing assertions verbatim (graph-validator back-compat).
- Add a new `it('snippet file-bound → 📄 caption variants', () => { … })` block covering: snippetLabel-set → `📄 ${label}`, snippetLabel-empty + path with extension → `📄 ${stem}`, snippetLabel-empty + path with no slashes/no dot → `📄 ${path}`, snippetLabel-empty + empty path string → exception case (gate is the `!== ''` check, so empty path falls through to directory-bound arm).
- Mirror the test data shape: `{ id, kind: 'snippet', radiprotocol_snippetPath: '<path>', snippetLabel?: '<label>', ...baseRect }`.

**Drift from analog:** none — the file structure (`describe` block + `it.each` patterns from the rest of the file) handles file-bound naturally. No new helpers needed.

---

### `src/__tests__/runner/protocol-runner-loop-body-snippet.test.ts` (NEW, or extend existing) (test, vitest pure)

**Analog A — graph factory & state assertion harness:** `protocol-runner-pick-file-bound-snippet.test.ts:26-99` — `VERIFIED`. Reuse `makeStart` / `makeQuestion` / `makeSnippet` / `buildGraph` as-is. The fixture builder pattern is portable.

**Analog B — loop-picker-driven traversal:** `protocol-runner-loop-picker.test.ts:1-80` — `VERIFIED`. Demonstrates the `start() → chooseLoopBranch(edgeId) → assert state` rhythm that exercises `advanceThrough` along a body branch. Phase 67 wires a `makeLoop(id, headerText)` helper plus an edge to a file-bound snippet.

**Phase 67 fixture (template — Plan author refines):**
```typescript
const path = 'abdomen/ct.md';
const graph = buildGraph(
  [
    makeStart('n-start'),
    makeLoop('n-loop', 'iter'),                                  // unified loop node (Phase 43 D-11)
    makeSnippet('sn', { radiprotocol_snippetPath: path }),       // file-bound
    makeTextBlock('n-end', 'done'),
  ],
  [
    ['n-start', 'n-loop'],
    ['n-loop', 'sn',  'body'],                                    // body edge → file-bound snippet (FIX-07 hot path)
    ['n-loop', 'n-end', '+exit'],
    ['sn', 'n-loop'],                                             // back-edge for loop semantics
  ],
  'n-start',
);
const runner = new ProtocolRunner();
runner.start(graph);
runner.chooseLoopBranch('e-1');                                   // body edge — exercises advanceThrough → case 'snippet'

const state = runner.getState();
expect(state.status).toBe('awaiting-snippet-fill');               // FIX-07 — was 'awaiting-snippet-pick' before fix
if (state.status !== 'awaiting-snippet-fill') return;
expect(state.snippetId).toBe(path);
expect(state.nodeId).toBe('sn');
```

**Companion negative test:** identical fixture with `makeSnippet('sn', {})` (directory-bound) → expect `state.status === 'awaiting-snippet-pick'` (Phase 30 D-07 path preserved).

**Drift from analog:** the loop-picker tests at `protocol-runner-loop-picker.test.ts` use canvas-fixture-loaded graphs (`loadGraph('unified-loop-valid.canvas')`); the file-bound-snippet tests at `protocol-runner-pick-file-bound-snippet.test.ts` use inline-built graphs. Phase 67 should follow the **inline-built** pattern (faster, no fixture file maintenance, isolates the FIX-07 logic).

---

### `src/__tests__/views/runner-snippet-loop-body-file-bound.test.ts` (NEW, or extend `runner-snippet-autoinsert-fill.test.ts`)

**Analog:** `runner-snippet-sibling-button.test.ts:1-80` — `VERIFIED`. The FakeNode + RunnerView mount harness already exercises the runner-side dispatch. Phase 67 reuses the FakeNode primitives and adds a fixture where the user clicks a loop-body branch button whose target is a file-bound Snippet — asserts that `chooseLoopBranch` flow (not `chooseSnippetBranch`) drives the runner into `awaiting-snippet-fill` and dispatches `handleSnippetFill` (sidebar mode reproduction of the user's bug).

**Drift from analog:** the sibling-button test mounts a Question with a file-bound Snippet neighbour; the new test mounts a Loop with a file-bound Snippet body-target — the click-handler entry point differs (loop-body click → `chooseLoopBranch`, sibling-button click → `pickFileBoundSnippet` per Phase 56). Both end at the same `awaiting-snippet-fill` arm AFTER Phase 67's runner-core fix lands.

---

### `src/__tests__/views/inline-runner-modal-loop-snippet.test.ts` (NEW, or extend `inline-runner-modal.test.ts`)

**Analog:** `inline-runner-modal.test.ts` MockEl harness (`VERIFIED`, lines 1-80). Mirror the runner-snippet-sibling-button test, but mount `InlineRunnerModal` instead of `RunnerView`. Verifies the same regression in inline mode (per CONTEXT D-18 Test Layer #3).

**Drift from analog:** `inline-runner-modal.test.ts` is the broader scaffolding file (Phase 59 wave 0); the new test focuses narrowly on loop-body → file-bound snippet → `handleSnippetFill` dispatch. The existing `case 'awaiting-snippet-fill'` arm at `inline-runner-modal.ts:475-483` is the assertion target — confirm it routes into `handleSnippetFill(state.snippetId, …)` after `chooseLoopBranch` lands at the snippet node.

---

### `src/__tests__/inline-runner-layout.test.ts` (NEW)

**Analog:** `src/__tests__/views/inline-runner-position.test.ts` — `VERIFIED`. The `FakeElement` + `FakeDocument` + `vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} })` scaffolding is already in place (lines 18-159). Reuse all of it.

**Existing FakeDocument + ResizeObserver stub** (`inline-runner-position.test.ts:144-152`):
```typescript
const doc = new FakeDocument();
vi.stubGlobal('document', doc);
vi.stubGlobal('window', {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});
vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });
```
> Phase 67 layout test must replace the inert `ResizeObserver` stub with a controllable double that records the `observe(target)` call and exposes a `trigger(entries)` method to feed synthetic `ResizeObserverEntry` payloads at chosen tick boundaries. Pattern:
> ```typescript
> class ControllableResizeObserver {
>   static lastInstance: ControllableResizeObserver | null = null;
>   private callback: ResizeObserverCallback;
>   constructor(cb: ResizeObserverCallback) { this.callback = cb; ControllableResizeObserver.lastInstance = this; }
>   observe(_target: Element): void {}
>   disconnect(): void {}
>   trigger(entries: Partial<ResizeObserverEntry>[]): void { this.callback(entries as ResizeObserverEntry[], this); }
> }
> vi.stubGlobal('ResizeObserver', ControllableResizeObserver);
> ```

**Existing fake plugin** (`inline-runner-position.test.ts:118-137`) — `VERIFIED`. Extend `saveInlineRunnerPosition` spy signature to accept the `InlineRunnerLayout` shape (still callable with the legacy `{left, top}`-only object; optional fields make the call signature back-compat).

**Test cases (per CONTEXT D-18 Test Layer #5 + #6):**
1. `clampInlineRunnerLayout` clamps width to `viewport.width - 32` when oversized.
2. `clampInlineRunnerLayout` clamps height to `viewport.height - 32` when oversized.
3. Missing `width` falls back to `INLINE_RUNNER_DEFAULT_WIDTH = 360`; missing `height` → `240`.
4. Window-resize on a viewport that shrinks below saved size → re-clamp via `reclampCurrentLayout(true)` → applies clamped values AND persists (mirror `inline-runner-position.test.ts:211-224`).
5. ResizeObserver tick burst (5 ticks within debounce window) → exactly **one** `saveInlineRunnerPosition` (or `saveInlineRunnerLayout`) call after the debounce timer expires.
6. `.is-resizing` class added on first tick, removed after debounce expiry.

**Drift from analog:** the existing position tests use real `setTimeout`/`Promise.resolve` rhythm; Phase 67 debounce tests should use `vi.useFakeTimers()` to deterministically advance `vi.advanceTimersByTime(400)` past the debounce boundary.

---

## Shared Patterns

### Pattern A — "Save only on interaction-end" (D-07)

**Source:** drag lifecycle, `inline-runner-modal.ts:672-678`.
**Apply to:** Phase 67 resize lifecycle.

The drag pattern persists once, on `pointerup`. Resize must persist once, on debounce-timer expiry. Live `pointermove` ticks (drag) and live `ResizeObserver` ticks (resize) NEVER call `plugin.saveInlineRunnerPosition`.

```typescript
// Drag — analog
this.dragUpHandler = () => {
  const finalPosition = this.getAppliedPosition();
  this.removeDragListeners();
  if (finalPosition !== null) {
    void this.plugin.saveInlineRunnerPosition(finalPosition);
  }
};

// Resize — Phase 67 mirror (illustrative)
private handleResizeDebounceTimeout(): void {
  if (this.containerEl === null) return;
  const rect = this.containerEl.getBoundingClientRect();
  const layout = clampInlineRunnerLayout({
    left: this.getAppliedPosition()?.left ?? 0,
    top:  this.getAppliedPosition()?.top  ?? 0,
    width:  Math.round(rect.width),
    height: Math.round(rect.height),
  }, this.getViewport());
  if (layout !== null) void this.plugin.saveInlineRunnerPosition(layout);
  this.containerEl.removeClass('is-resizing');
  this.isResizing = false;
}
```

### Pattern B — Pure clamp helpers (D-02, D-10)

**Source:** `clampInlineRunnerPosition` exported pure function at `inline-runner-modal.ts:35-51`.
**Apply to:** new `clampInlineRunnerLayout` (or extended signature). Pure, exported, unit-testable without instantiating the modal — the existing position tests at `inline-runner-position.test.ts:201-209` rely on this pattern; Phase 67 layout tests must inherit it.

### Pattern C — `awaiting-snippet-fill` is the unified terminal state for file-bound

**Source:** Phase 56 D-03 (`pickFileBoundSnippet:367`), Phase 59 (`inline-runner-modal.ts:475-483` `case 'awaiting-snippet-fill'`), and Phase 67 D-14 (the new `case 'snippet'` branch).
**Apply to:** every existing arm that already handles `awaiting-snippet-fill` is reused verbatim by FIX-07 — no view-layer change needed. CONTEXT D-16 / D-17 are explicit about this.

### Pattern D — File-bound caption grammar (`📄`/`📁` emoji prefix)

**Source:** `inline-runner-modal.ts:343-365` and `runner-view.ts:495-545`.
**Apply to:** `node-label.ts` snippet arm (D-15). Character-for-character identity (Cyrillic-safe Unicode escape `📄` / `📁`) preserved. The label module already documents this cross-file invariant in its top comment.

### Pattern E — Append-only CSS per phase (CLAUDE.md)

**Source:** the file's existing structure — Phase 60 block lives at lines 164-244 under no separating comment, but the convention from later phases is `/* Phase N: description */` headers.
**Apply to:** Phase 67 rules at end of `src/styles/inline-runner.css` under `/* Phase 67: resizable inline runner */`. Never mutate Phase 60 line 174 (`overflow: hidden`); override it inside the Phase 67 block instead.

### Pattern F — `advanceThrough` never pushes UndoEntry (Pitfall 1)

**Source:** every `case` in `advanceThrough` (lines 601-749) — none push to `undoStack`. Compare to `pickFileBoundSnippet:358-362` which DOES push (because it is a caller, not part of `advanceThrough`).
**Apply to:** the new `case 'snippet'` file-bound branch (D-14). The omission of the undo push is load-bearing — `chooseLoopBranch:225` already pushed before calling `advanceThrough(edge.toNodeId)` at line 265.

### Pattern G — Settings on-disk back-compat via optional fields (Pitfall #11)

**Source:** the existing `inlineRunnerPosition?: InlineRunnerPosition | null` field at `settings.ts:28` — the `?` and the explicit `| null` accommodate both legacy users (no field) and explicit-null users.
**Apply to:** D-06 — `width?` / `height?` on the renamed `InlineRunnerLayout` interface. No migration code, no version bump. The modal's `applyLayout` / `clampInlineRunnerLayout` substitutes defaults when fields are missing or non-finite.

---

## No Analog Found

None. Every modified file has a strong in-tree analog. The closest "no-analog" candidate would be the new layout test file — it is graded `exact` because `inline-runner-position.test.ts` already exercises the same modal class with the same fake-DOM scaffolding; the only delta is the controllable `ResizeObserver` double, which is a 10-line addition to the scaffolding.

---

## Verification Corrections to CONTEXT.md

CONTEXT.md was largely accurate; two factual corrections to be aware of when planning:

| CONTEXT.md citation | Correction |
|---|---|
| `inline-runner-modal.ts:178-180` for `.is-dragging` rule | Actually `src/styles/inline-runner.css:178-180`. (The `.is-dragging` selector is CSS, not TS.) |
| `main.ts:229-237` for accessor pair | Pair spans `main.ts:229-236` (closing brace on 236). One-line difference; immaterial to plan. |
| `inline-runner-modal.ts:35-51` `clampInlineRunnerPosition` | Verified exact. |
| `inline-runner-modal.ts:81` `resizeObserver` field | Verified exact. |
| `inline-runner-modal.ts:91` `windowResizeHandler` field | Verified exact (declaration); wiring is at lines 187-190 + cleanup 229-232. |
| `inline-runner-modal.ts:613-672` drag/applyPosition | Verified — `applyPosition` at 617-626, `enableDragging` at 654-683. CONTEXT range is correct in spirit. |
| `inline-runner-modal.ts:343-365` sibling-button caption grammar | Verified exact (CONTEXT cited 350-364 — close enough; the full block is 343-380 including the click handler). |
| `protocol-runner.ts:736-741` `case 'snippet'` 4-line block | Verified exact, 6 lines including braces. |
| `node-label.ts:18-30` snippet arm | Verified — the snippet arm itself is the single line at `node-label.ts:26`; surrounding context spans 18-29. |
| `pickFileBoundSnippet` body (CONTEXT calls it the canonical reference) | Verified at `protocol-runner.ts:349-368`. |
| `settings.ts:7-10` `InlineRunnerPosition` interface + `:28` field | Verified exact. |
| `__tests__/views/runner-footer-layout.test.ts:375` mock | Verified at lines 407-408 (CONTEXT line 375 is off; the relevant mock is at 407). The mock currently does `vi.fn(() => null)` for `getInlineRunnerPosition` — type signature update needed (return `InlineRunnerLayout | null` instead of `InlineRunnerPosition | null`) but the runtime payload `null` is unchanged. |

---

## Metadata

**Analog search scope:** `src/views/`, `src/styles/`, `src/runner/`, `src/graph/`, `src/__tests__/runner/`, `src/__tests__/views/`, `src/__tests__/graph/`, plus `src/main.ts` and `src/settings.ts`.
**Files scanned (Read or Grep):** 14 source/test/doc files.
**Pattern extraction date:** 2026-04-25.
