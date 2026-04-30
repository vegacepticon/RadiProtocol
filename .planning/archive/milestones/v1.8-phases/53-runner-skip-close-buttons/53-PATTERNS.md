# Phase 53: Runner Skip & Close Buttons — Pattern Map

**Mapped:** 2026-04-20
**Files to modify:** 4 (runner-view.ts, protocol-runner.ts, runner-view.css, canvas-selector.css — last is optional)
**Analogs found:** 4 / 4 (all targets have exact or near-exact analogs in the same files)

---

## File Classification

| Target file | Change type | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|---|
| `src/views/runner-view.ts` | modify (add Skip button render + click, add Close button render + click, add setIcon import) | view | request-response + user-event | self (existing answer-btn handler + handleSelectorSelect) | exact (same file, same patterns) |
| `src/runner/protocol-runner.ts` | modify (add `skip()` method) | state machine | command-pattern + undo-stack push | self (chooseAnswer() at lines 80-111) | exact |
| `src/styles/runner-view.css` | append-only (Phase 53 block at EOF) | styling | static | self (Phase 47 block at line 229) | exact |
| `src/styles/canvas-selector.css` | append-only (optional — if Close button styling lives with selector-bar) | styling | static | self (rp-selector-bar at line 3) | role-match (decision belongs to planner) |

CLAUDE.md constraints apply to **every** file above:
- **Never remove existing code** in runner-view.ts / protocol-runner.ts.
- **CSS append-only per phase** — new rules at bottom under `/* Phase 53: Skip & Close buttons */` header.

---

## Pattern Assignments

### `src/views/runner-view.ts` — Skip button (D-01, D-07 … D-11)

**Analog #1 — Answer button render + click (the reference pattern Skip mirrors):**
`src/views/runner-view.ts` lines **400–414** (inside `case 'question':` branch of `render()`):

```typescript
if (answerNeighbors.length > 0) {
  const answerList = questionZone.createDiv({ cls: 'rp-answer-list' });
  for (const answerNode of answerNeighbors) {
    const btn = answerList.createEl('button', {
      cls: 'rp-answer-btn',
      text: answerNode.displayLabel ?? answerNode.answerText,
    });
    this.registerDomEvent(btn, 'click', () => {
      this.capturePendingTextareaScroll();  // RUNFIX-02: preserve scroll across re-render
      this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // BUG-01: capture manual edit (D-01)
      this.runner.chooseAnswer(answerNode.id);
      void this.autoSaveSession();   // SESSION-01 — save after answer
      void this.renderAsync();
    });
  }
}
```

**Apply-to notes (Skip):**
- Skip is rendered **only** when `node.kind === 'question'` (D-07). Insert the Skip button inside the same `case 'question'` branch, after the existing `answerList` and `snippetList` blocks (before the `if (state.canStepBack)` block at line 478) so that it sits under `rp-answer-list` per D-01.
- The click handler MUST follow the 5-line canonical prologue exactly: `capturePendingTextareaScroll()` → `syncManualEdit(previewTextarea?.value ?? '')` (D-11, BUG-01) → `runner.skip()` → `autoSaveSession()` → `renderAsync()`.
- D-08 target-existence check: before calling `runner.skip()`, verify `answerNeighbors.length > 0`. If zero answer neighbors, either (a) don't render Skip at all, or (b) render disabled. Planner decides per Claude's Discretion bullet #3 in CONTEXT.md.
- Use `setIcon(btn, 'skip-forward')` + `btn.setAttribute('aria-label', '…')` + `btn.title = '…'` per D-04/D-05. Obsidian `setIcon` is NOT currently imported — planner must extend the `from 'obsidian'` import at **line 2** of runner-view.ts.

---

### `src/views/runner-view.ts` — Close button (D-02, D-12 … D-16)

**Analog #2 — `handleSelectorSelect()` — the reference confirmation-before-destructive pattern:**
`src/views/runner-view.ts` lines **286–323**:

```typescript
/**
 * Called by CanvasSelectorWidget when a file is picked.
 * Implements D-12 / D-13 mid-session confirmation logic.
 */
private async handleSelectorSelect(newPath: string): Promise<void> {
  // No-op if the user selects the already-active canvas
  if (newPath === this.canvasFilePath) return;

  const state = this.runner.getState();
  const needsConfirmation =
    state.status === 'at-node' ||
    state.status === 'awaiting-snippet-pick' ||
    state.status === 'awaiting-snippet-fill' ||
    state.status === 'awaiting-loop-pick';

  if (needsConfirmation) {
    // D-12: show confirmation modal; runner state is in-progress
    const modal = new CanvasSwitchModal(this.app);
    modal.open();
    const confirmed = await modal.result;

    if (!confirmed) {
      // D-12: user cancelled — revert selector label to previous canvas
      this.selector?.setSelectedPath(this.canvasFilePath);
      return;
    }

    // D-12: confirmed — clear active session before switching (D-14: already auto-saved)
    if (this.canvasFilePath !== null) {
      await this.plugin.sessionService.clear(this.canvasFilePath);
    }
  }
  // D-13: idle or complete — switch without confirmation; fall through directly

  // Update selector label to the new canvas, then load it
  this.selector?.setSelectedPath(newPath);
  await this.openCanvas(newPath);
}
```

**Apply-to notes (Close handler — new private method, e.g. `handleClose()`):**
- The `needsConfirmation` predicate is **identical verbatim** (D-13 set): `at-node | awaiting-snippet-pick | awaiting-snippet-fill | awaiting-loop-pick`. Copy it byte-for-byte.
- On **cancel**, Close does NOT touch `this.selector` (no selector path ever changed) — just `return`. Diverges from `handleSelectorSelect` which reverts the selector label.
- On **confirmed** (or no-confirmation path), perform the D-14 teardown sequence **in this exact order**:
  1. `await this.plugin.sessionService.clear(this.canvasFilePath)` — only if `canvasFilePath !== null`.
  2. `this.runner = new ProtocolRunner({ defaultSeparator: this.plugin.settings.textSeparator })` — re-create to mirror line 95-97 of `openCanvas()`; `this.runner.getState()` then returns `{ status: 'idle' }`.
  3. `this.graph = null`, `this.canvasFilePath = null`, `this.previewTextarea = null`.
  4. `this.selector?.setSelectedPath(null)` — D-16: reset selector to placeholder ("Select a protocol…"). The widget API is at `canvas-selector-widget.ts` lines 44-48 and explicitly accepts `null`.
  5. `this.render()` — re-enters `case 'idle':` branch (line 362), visually identical to fresh plugin open.

**Analog #3 — `renderOutputToolbar()` — button construction reference (setIcon + registerDomEvent + disabled state):**
`src/views/runner-view.ts` lines **966–1023** (key excerpt 971-1019):

```typescript
const copyBtn = toolbar.createEl('button', {
  cls: 'rp-copy-btn',
  text: 'Copy to clipboard',
});
…
this.registerDomEvent(copyBtn, 'click', () => {
  const finalText = this.previewTextarea?.value ?? capturedText;
  void navigator.clipboard.writeText(finalText).then(() => {
    new Notice('Copied to clipboard.');
  });
});
```

**Apply-to notes (Close button DOM):**
- Same `createEl('button', {...})` + `this.registerDomEvent(btn, 'click', ...)` idiom.
- Instead of `text:`, use icon-only via `setIcon(btn, 'x')` (D-05) after creation.
- Add `btn.setAttribute('aria-label', 'Close protocol')` and `btn.title = 'Close protocol'` (D-04).
- Class name (planner pick): e.g. `rp-close-btn`. Do NOT apply `mod-warning` (D-06 — neutral styling).

**Analog #4 — `selectorBarEl` construction — the prepend-survives-render pattern:**
`src/views/runner-view.ts` lines **200–217** (`onOpen()`) + lines **346–351** (`render()`) + lines **1025–1030** (`renderError()`):

```typescript
// onOpen() — created ONCE, lives outside contentEl.empty()
const selectorBarEl = this.contentEl.createDiv({ cls: 'rp-selector-bar' });
this.selectorBarEl = selectorBarEl;
this.selector = new CanvasSelectorWidget(
  this.app,
  this.plugin,
  selectorBarEl,
  (filePath) => { void this.handleSelectorSelect(filePath); },
);
```

```typescript
// render() — re-prepend after contentEl.empty()
this.contentEl.empty();
if (this.selectorBarEl !== null) {
  this.contentEl.prepend(this.selectorBarEl);
}
```

**Apply-to notes (Close button placement — D-02):**
- Close button lives inside `selectorBarEl` next to the selector trigger. Attach it **once in `onOpen()`** (same lifetime as selector) so that `contentEl.empty()` + `prepend(selectorBarEl)` re-insertion automatically carries the Close button along. Do NOT append the Close button inside `render()` — that would accumulate listeners on every re-render (same class of bug the Phase 30 WR-01 comment at lines 259-274 fixed).
- Visibility gate (D-12): Close must be hidden when `canvasFilePath === null`. Two approaches:
  - **(preferred)** Always attach, toggle `btn.style.display` (or `btn.toggleClass('is-hidden', ...)`) at the end of `render()` based on `this.canvasFilePath !== null`.
  - Alternative: always show, wire the click to no-op on null canvas. Planner chooses; preferred avoids misleading affordance.
- `onClose()` at line 279 must null out any new field (e.g. `this.closeBtn = null`) symmetrically with the existing `selectorBarEl = null` teardown.

---

### `src/runner/protocol-runner.ts` — new `skip()` method (D-08, D-10, D-11)

**Analog #5 — `chooseAnswer()` — the reference UndoEntry + advance pattern:**
`src/runner/protocol-runner.ts` lines **75–111**:

```typescript
/**
 * User selects a preset-text answer button.
 * Only valid in at-node state when the current node is a question.
 * Pushes undo entry BEFORE mutation (D-03, D-04).
 */
chooseAnswer(answerId: string): void {
  if (this.runnerStatus !== 'at-node') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const answerNode = this.graph.nodes.get(answerId);
  if (answerNode === undefined || answerNode.kind !== 'answer') {
    this.transitionToError(`Answer node '${answerId}' not found or is not an answer node.`);
    return;
  }

  // Push undo entry BEFORE any mutation (Pitfall 3 — snapshot must come first)
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });

  // Append the answer text
  this.accumulator.appendWithSeparator(answerNode.answerText, this.resolveSeparator(answerNode));

  // Advance to the next node after this answer.
  const neighbors = this.graph.adjacency.get(answerId);
  const next = neighbors !== undefined ? neighbors[0] : undefined;
  if (next === undefined) {
    this.advanceOrReturnToLoop(undefined);
    return;
  }
  this.advanceThrough(next);
}
```

**`UndoEntry` shape (from `src/runner/runner-state.ts` lines 93-105):**

```typescript
export interface UndoEntry {
  nodeId: string;                    // currentNodeId BEFORE this user action
  textSnapshot: string;              // accumulatedText BEFORE this user action
  loopContextStack: LoopContext[];   // deep spread-copy snapshot
  returnToBranchList?: boolean;      // Phase 31 D-08 — stepBack returns to question branch list
}
```

**Apply-to notes (new `skip()` method):**
- Place the new method **adjacent to `chooseAnswer()`** (after line 111) for discoverability — it is the Skip analog of chooseAnswer.
- Guard clauses mirror `chooseAnswer`:
  1. `if (this.runnerStatus !== 'at-node') return;`
  2. `if (this.graph === null || this.currentNodeId === null) return;`
  3. **NEW for Skip (D-07):** check the current node is a question — `const node = this.graph.nodes.get(this.currentNodeId); if (node === undefined || node.kind !== 'question') return;`
- D-08 target resolution:
  ```typescript
  const neighbors = this.graph.adjacency.get(this.currentNodeId) ?? [];
  // Skip chooses the FIRST ANSWER neighbor in adjacency order — snippet neighbors ignored (D-09)
  let skipTargetId: string | undefined;
  for (const nid of neighbors) {
    const n = this.graph.nodes.get(nid);
    if (n !== undefined && n.kind === 'answer') { skipTargetId = nid; break; }
  }
  if (skipTargetId === undefined) return;  // no-op; UI prevents this via disabled/hidden button
  ```
- **Undo push BEFORE mutation** (D-10 — Skip is a recordable step, full choice):
  ```typescript
  this.undoStack.push({
    nodeId: this.currentNodeId,  // question id — step-back returns to question's answer list
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });
  ```
  - Do **NOT** set `returnToBranchList: true` — that flag is specific to chooseSnippetBranch (Phase 31 D-08). Plain omission is correct: stepBack restores `currentNodeId = question`, `runnerStatus = 'at-node'`, accumulator unchanged → user sees the question with its answer buttons again, matching D-10 semantics.
- **NO accumulator mutation** — do NOT call `appendWithSeparator`. This is the single concrete divergence from `chooseAnswer` and the whole point of Skip (D-08: "without emitting the answer's text").
- Advance identical to `chooseAnswer`: walk from the **answer** node forward (the answer's own first neighbor), NOT from the question. Mirror lines 104-110:
  ```typescript
  const answerNeighbors = this.graph.adjacency.get(skipTargetId);
  const next = answerNeighbors !== undefined ? answerNeighbors[0] : undefined;
  if (next === undefined) {
    this.advanceOrReturnToLoop(undefined);
    return;
  }
  this.advanceThrough(next);
  ```
  This preserves the Phase 44 dead-end-in-loop contract documented at lines 101-103.
- JSDoc header: state D-08 (first answer neighbor), D-09 (snippet neighbors ignored), D-10 (pushes UndoEntry), D-11 is enforced by caller (RunnerView click handler) not here.

---

### `src/styles/runner-view.css` — Phase 53 rules (D-04, D-06)

**Analog #6 — Phase-comment footer convention:**
Last phase-comment block in `src/styles/runner-view.css` currently at line **229**:

```css
/* Phase 47: RUNFIX-03 — choice-button typography + narrow-sidebar overflow + Obsidian
 * default-button defeat. Three successive revisions (tight padding → sidebar overflow →
 * Obsidian's base `button { height: var(--input-height); align-items: center;
 * white-space: nowrap }` clipping wrapped labels) converged on the declarations below.
 * Do NOT compress further without testing Cyrillic descenders in a narrow sidebar. */
.rp-answer-btn,
.rp-snippet-branch-btn {
  height: auto;
  …
}
```

**Also relevant:** `rp-answer-list` at line 80, `rp-answer-btn` at line 86 (the container Skip lives inside, per D-01). Last line of the file is **245** (terminating `}` of the Phase 47 block).

**Apply-to notes (Phase 53 CSS block):**
- Append at **EOF** (after line 245) with header `/* Phase 53: Skip & Close buttons */`.
- Rules needed (minimum):
  - `.rp-skip-btn` — icon-only button inside `rp-answer-list` / `rp-question-zone`. Suggested: `display: inline-flex; align-items: center; justify-content: center; padding: var(--size-4-1); background: transparent; border: 1px solid var(--background-modifier-border); border-radius: var(--radius-s); cursor: pointer;` + `:hover` neutral tint.
  - `.rp-skip-btn[disabled]` (if planner picks disabled-rather-than-hidden for the no-answer case) — `opacity: 0.5; cursor: not-allowed;`.
  - `.rp-close-btn` — neutral (D-06): same transparent + border treatment as Skip; do NOT use `--background-modifier-error` or `mod-warning`. Icon sized via `width/height` on its inner `svg` to match Obsidian's native 16px affordance.
  - If Close lives in the selector bar: a flex-row adjustment may belong in `src/styles/canvas-selector.css` instead (planner chooses which feature file is authoritative per CLAUDE.md "do NOT add CSS to an unrelated feature file"). Runner-view.css is the safer default since Close is a runner-level action reusing selector-bar's layout.
- **NEVER** edit earlier Phase blocks. CLAUDE.md append-only rule.
- After CSS edit, run `npm run build` to regenerate `styles.css` (CLAUDE.md — `styles.css` is generated, never committed by hand).

---

## Shared Patterns

### Capture-before-advance (BUG-01 / D-11)
**Source:** every forward-advance click handler in runner-view.ts — canonical reference at line **409** inside the answer-click handler.
```typescript
this.runner.syncManualEdit(this.previewTextarea?.value ?? '');
```
**Apply to:** Skip click handler (D-11), BEFORE calling `runner.skip()`. Also `capturePendingTextareaScroll()` (line 408) if the re-render should preserve textarea scroll, identical to the answer path.

### registerDomEvent (no raw addEventListener)
**Source:** every DOM listener in runner-view.ts (lines 407, 451, 483, 555, 570, 605, 725, 959, 1000, 1007, 1014).
```typescript
this.registerDomEvent(btn, 'click', () => { … });
```
**Apply to:** Skip click handler, Close click handler. Obsidian auto-cleans these on view close — raw `addEventListener` leaks.

### CanvasSwitchModal reuse (D-15)
**Source:** `src/views/canvas-switch-modal.ts` lines **20–25** (constructor + `result: Promise<boolean>`):
```typescript
const modal = new CanvasSwitchModal(this.app);
modal.open();
const confirmed = await modal.result;
```
**Apply to:** Close handler's `needsConfirmation` branch — identical API. Zero modal changes. Existing copy "Switch protocol canvas? / The active session will be reset." is accepted per D-15.

### Selector reset API
**Source:** `src/views/canvas-selector-widget.ts` lines **44-48**:
```typescript
setSelectedPath(filePath: string | null): void {
  this.selectedFilePath = filePath;
  this.updateTriggerLabel();
}
```
`updateTriggerLabel()` at lines 68-82 explicitly handles the `null` case by showing `"Select a protocol…"` + `rp-selector-placeholder` class — this is the exact D-16 placeholder target.
**Apply to:** Close teardown step 4 — call `this.selector?.setSelectedPath(null)`. No new widget API needed.

### Session clear (D-14 step 1)
**Source:** `handleSelectorSelect` line **315** and `restartCanvas` line **332**:
```typescript
await this.plugin.sessionService.clear(this.canvasFilePath);
```
**Apply to:** Close confirmed path, FIRST step in teardown (before nulling fields).

---

## No Analog Found

None — every new surface in Phase 53 has a concrete, same-file analog. Planner should copy patterns directly from the line ranges listed above rather than inventing structure.

---

## CLAUDE.md Compliance Checklist (propagate to every plan)

- [ ] runner-view.ts edits: add Skip render + click, add Close render + click, extend obsidian import with `setIcon`. NEVER delete existing functions, event listeners, or imports not introduced in Phase 53.
- [ ] protocol-runner.ts edits: add `skip()` method adjacent to `chooseAnswer()`. NEVER modify other methods.
- [ ] runner-view.css edits: append-only at EOF under `/* Phase 53: Skip & Close buttons */`. NEVER touch Phase 3/30/31/36/47 blocks.
- [ ] Run `npm run build` after any CSS change to regenerate `styles.css` (do not hand-edit the generated file at repo root).

---

## Metadata

**Analog search scope:** `src/views/`, `src/runner/`, `src/styles/`
**Files scanned:** 6 (runner-view.ts, protocol-runner.ts, runner-state.ts, canvas-switch-modal.ts, canvas-selector-widget.ts, runner-view.css + canvas-selector.css)
**Pattern extraction date:** 2026-04-20
