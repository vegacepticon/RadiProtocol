# Phase 69: Inline Runner — Hide Result-Export Buttons in Complete State — Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 6 (2 source + 2 docs + 2 test)
**Analogs found:** 6 / 6 (every modified or new file has an in-tree analog)

> **Surgical, deletion-focused phase.** All four production-code anchors (one TS render path, one TS private method, three CSS blocks) are pre-located by CONTEXT.md with file:line precision. No discovery search required — every pattern below is keyed off existing in-repo precedent (Phase 67 D-13 for the docs amend, Phase 67 D-14 for the CLAUDE.md exception, Phase 67 D-18 Test Layer #2/#3 for the cross-mode regression tests).

---

## File Classification

| Modified / New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/views/inline-runner-modal.ts` | view (Obsidian Modal — DOM render switch on `state.status`) | request-response (state machine → DOM) | same file's `case 'awaiting-snippet-fill'` arm at lines 520-528 (post-D-03 minimal-render shape) and Phase 65 `renderRunnerFooter` removal precedent in same file | exact (delete-in-place inside the same `render()` switch) |
| `src/styles/inline-runner.css` | config (CSS, append-only per phase — Phase 69 is rare exception with negative diff) | n/a | Phase 67 D-14 "load-bearing wrong code" deletion precedent (`protocol-runner.ts:736-741`); CSS append-only rule from `CLAUDE.md` "CSS Architecture" + "Critical Rules for Editing Shared Files" | exact (same exception phrasing applies) |
| `.planning/REQUIREMENTS.md` | docs (requirement re-wording, scope-amend) | n/a | Phase 67 D-13 ROADMAP/STATE amend precedent — same shape: "explicit scope amend in first plan when discuss-phase widens INLINE-CLEAN-01 buffer" | exact |
| `.planning/ROADMAP.md` | docs (phase Goal + Success Criteria edit) | n/a | Phase 67 D-13 — same shape, same docstrings touched | exact |
| `src/__tests__/views/inline-runner-modal-output-toolbar.test.ts` (NEW — name per planner discretion) | test (vitest, InlineRunnerModal fake-DOM cycling 6 states) | n/a | `inline-runner-modal-loop-body-file-bound.test.ts` (Phase 67 D-18 Test Layer #3) for harness; `inline-runner-modal.test.ts` lines 1-360 for `MockEl` + `obsidian` mock + `setupModal` | exact (MockEl harness already supports `querySelectorAll('.rp-copy-btn')` etc. via `walk` + `buildMatcher`) |
| `src/__tests__/views/runner-view-output-toolbar.test.ts` (NEW — name per planner discretion) | test (vitest, RunnerView fake-DOM, sidebar complete-state regression) | n/a | `runner-snippet-loop-body-file-bound.test.ts` (Phase 67 D-18 Test Layer #2) for harness; `runner-snippet-sibling-button.test.ts` lines 1-235 for FakeNode + `mountAtQuestion`-style harness | exact |

---

## Pattern Assignments

### `src/views/inline-runner-modal.ts` (view, request-response — DELETE only)

**Analog:** the same file's existing render switch (single render path through `render()` at lines 321-547). Phase 69 deletes one line in `render()` (the `outputToolbar` div creation at line 334), six call sites of `this.renderOutputToolbar(...)`, and the entire private method at lines 960-1002. No additions.

**Anchor 1 — `outputToolbar` div creation to DELETE** (line 334, `VERIFIED`):
```typescript
// LINE 333: const questionZone = this.contentEl.createDiv({ cls: 'rp-question-zone' });
const outputToolbar = this.contentEl.createDiv({ cls: 'rp-output-toolbar' });  // ← DELETE ENTIRE LINE
// LINE 336: switch (state.status) {
```
Per D-03 + Discretion bullet ("variant 'не создавать вообще' предпочтительнее"): remove the entire line 334 — do NOT replace with `const outputToolbar = null;` or similar placeholder. The variable name disappears; all six readers (lines 342, 455, 460, 516, 525, 532) are deleted in the same diff.

**Anchor 2 — six call sites to DELETE** (verbatim, `VERIFIED`):

The six lines below are deleted *one-line-each*; the surrounding case bodies are preserved. Note that the surrounding `break;` and any other lines in each case stay verbatim — Phase 69 does NOT re-shape the case structure.

```typescript
// LINE 342  (case 'idle')                       — DELETE THIS LINE:
        this.renderOutputToolbar(outputToolbar, null, false);

// LINE 455  (case 'at-node', after renderRunnerFooter) — DELETE THIS LINE:
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);

// LINE 460  (case 'awaiting-snippet-pick', first stmt) — DELETE THIS LINE:
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);

// LINE 516  (case 'awaiting-loop-pick', after renderRunnerFooter) — DELETE THIS LINE:
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);

// LINE 525  (case 'awaiting-snippet-fill', before handleSnippetFill) — DELETE THIS LINE:
        this.renderOutputToolbar(outputToolbar, state.accumulatedText, false);

// LINE 532  (case 'complete', after <h2>) — DELETE THIS LINE:
        this.renderOutputToolbar(outputToolbar, state.finalText, true);
```

**Anchor 3 — `case 'complete':` block AFTER deletion** (D-07 — minimalism: only `<h2>` + Close (X) in header remain):
```typescript
case 'complete': {
  questionZone.createEl('h2', { text: 'Protocol complete', cls: 'rp-complete-heading' });
  break;
}
```
No additions: no status line "Текст записан в [name].md", no preview, no Run again button (D-06: deferred).

**Anchor 4 — private method `renderOutputToolbar` to DELETE** (lines 960-1002, `VERIFIED` — full block reproduced for the executor's diff verification):
```typescript
  // ── Sub-renders ───────────────────────────────────────────────────────────

  /** Render the output toolbar for complete state. */
  private renderOutputToolbar(
    toolbar: HTMLElement,
    text: string | null,
    enabled: boolean,
  ): void {
    const copyBtn = toolbar.createEl('button', {
      cls: 'rp-copy-btn',
      text: 'Copy to clipboard',
    });
    const saveBtn = toolbar.createEl('button', {
      cls: 'rp-save-btn',
      text: 'Save to note',
    });
    const insertBtn = toolbar.createEl('button', {
      cls: 'rp-insert-btn',
      text: 'Insert into note',
    });

    if (!enabled || text === null) {
      copyBtn.disabled = true;
      saveBtn.disabled = true;
      insertBtn.disabled = true;
      return;
    }

    const capturedText = text;

    copyBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(capturedText).then(() => {
        new Notice('Copied to clipboard.');
      });
    });

    saveBtn.addEventListener('click', () => {
      void this.plugin.saveOutputToNote(capturedText).then(() => {
        new Notice('Report saved to note.');
      });
    });

    insertBtn.addEventListener('click', () => {
      void this.plugin.insertIntoCurrentNote(capturedText, this.targetNote);
    });
  }
```
Delete this entire 43-line block including the `// ── Sub-renders ───` heading comment IF no other private "sub-render" methods follow it in the file. (Verify by reading: `renderSnippetPicker` follows at line 1004 — keep the section heading and only remove lines 959-1002, the `/** Render the output toolbar for complete state. */` JSDoc plus the method body.)

**Imports survey** (no changes needed): `Notice` (used by `renderOutputToolbar` for clipboard/save toasts) MAY become unused after D-04. Verify with `npx tsc --noEmit` and remove from the import list if Inline-mode no longer references it elsewhere. (Other Inline call sites: search for `new Notice(` in the file before removing.)

**Phase 65 footer (DO NOT TOUCH)** — `renderRunnerFooter` invocation at lines 442-453 (`case 'at-node'`) and 508-514 (`case 'awaiting-loop-pick'`) is the Back/Skip row, lives inside `rp-question-zone`, unrelated to `outputToolbar`. Phase 69 deletion does not touch any of these lines.

**Phase 60/67 drag/resize state (DO NOT TOUCH)** — header at lines 296-316 (drag handle, Close button) and constructor-time wiring of `enableDragging`, `applyPosition`, `clampInlineRunnerPosition`, `ResizeObserver` are independent of the content render. Phase 69 deletion does not touch any of these.

---

### `src/styles/inline-runner.css` (config, CSS — DELETE only with explicit CLAUDE.md exception)

**Analog:** Phase 67 D-14 "load-bearing wrong code" deletion of the 4-line block at `protocol-runner.ts:736-741` — same shape, same exception phrasing, same commit-message convention.

**Anchor 1 — base block to DELETE** (lines 74-80, `VERIFIED`):
```css
.rp-inline-runner-content .rp-output-toolbar {
  display: flex;
  gap: var(--size-4-2);
  margin-top: var(--size-4-3);
  padding-top: var(--size-4-2);
  border-top: 1px solid var(--background-modifier-border);
}
```

**Anchor 2 — Phase 60 compact override to DELETE** (lines 234-239, `VERIFIED`):
```css
.rp-inline-runner-content .rp-output-toolbar {
  gap: var(--size-2-3);
  margin-top: var(--size-4-2);
  padding-top: var(--size-2-3);
  flex-wrap: wrap;
}
```

**Anchor 3 — Phase 60 compact button override to DELETE** (lines 241-244, `VERIFIED`):
```css
.rp-inline-runner-content .rp-output-toolbar button {
  padding: var(--size-2-2) var(--size-4-2);
  min-height: 26px;
}
```

**Adjacent rules to PRESERVE — DO NOT TOUCH:**
- Lines 1-73: Phase 54 base layout (`.rp-inline-runner-container`, header, `.rp-inline-runner-content` shell, `.rp-question-text`, `.rp-answer-list / .rp-snippet-branch-list`).
- Lines 82-93: Snippet picker host + loop picker (used by `awaiting-snippet-pick` / `awaiting-loop-pick`).
- Lines 95-162: snippet fill-form, error panel — unrelated.
- Lines 164-244 (Phase 60 compact runner): everything EXCEPT lines 234-244 above. Specifically lines 224-232 (`.rp-answer-btn / .rp-snippet-branch-btn / ...` compact padding) MUST stay — they style the buttons that REMAIN in Inline.
- Lines 246-258 (Phase 67 resize block): untouched.

**CLAUDE.md exception phrasing for PLAN.md and commit message** (modeled verbatim on Phase 67 D-14 commit `e7e3175`):

> CLAUDE.md mandate exception — Phase 69 D-05 explicitly REMOVES three CSS blocks at `src/styles/inline-runner.css:74-80, 234-239, 241-244`:
>
> The selector `.rp-inline-runner-content .rp-output-toolbar` (and its `… button` descendant) was load-bearing for the now-deleted `<div class="rp-output-toolbar">` element created at `inline-runner-modal.ts:334`. After D-03 (the div is no longer created) and D-04 (the `renderOutputToolbar` method that populated it is removed), these three blocks match no DOM in any Inline Runner state. Leaving them in place would constitute dead CSS that future agents would be misled to extend — exactly the failure mode the CLAUDE.md "Critical Rules" rule was written to prevent for the *opposite* direction.
>
> Per CLAUDE.md "Never remove existing code you didn't add": EXCEPT for these three blocks at `src/styles/inline-runner.css:74-80, 234-239, 241-244` — explicit phase mandate per Phase 69 D-05 (CONTEXT). The base `.rp-output-toolbar` rule at `src/styles/runner-view.css:58` is NOT touched (still load-bearing for sidebar/tab `<div class="rp-output-toolbar">`).

**No `/* Phase 69: ... */` comment is added** — per CONTEXT.md guardrail "CSS Architecture — Phase 69 ничего не дополняет в `inline-runner.css`, только удаляет; никакого `/* Phase 69: ... */` комментария добавлять не нужно."

**Mandatory post-delete build step:** `npm run build` to regenerate the concatenated `styles.css`. Per CLAUDE.md: never commit `styles.css` edits directly — it is a generated file.

---

### `.planning/REQUIREMENTS.md` (docs — re-word INLINE-CLEAN-01 line)

**Analog:** Phase 67 D-13 ROADMAP amend precedent (commit `c523b45`). Same shape: `discuss-phase widens scope → first plan rewrites the requirement bullet so SC↔code traceability stays in sync for milestone audit`.

**Anchor — current INLINE-CLEAN-01 wording at line 11** (`VERIFIED`):
```markdown
- [ ] **INLINE-CLEAN-01**: When the Inline Runner reaches the protocol-complete state, the Insert / Copy to clipboard / Save to note buttons are no longer rendered — only the Close (and Run Again, where applicable) controls remain. The Inline Runner already appends every answer/snippet directly to the active note as the protocol runs, so the result-export buttons are redundant in this mode. The sidebar Runner View and the tab Runner View continue to show all three buttons unchanged — this requirement is Inline-mode-only.
```

**Pattern for the rewrite (planner drafts exact wording per CONTEXT.md Discretion):**
- Replace "When the Inline Runner reaches the protocol-complete state" → "In every Inline Runner state (`idle`, `at-node`, `awaiting-snippet-pick`, `awaiting-loop-pick`, `awaiting-snippet-fill`, `complete`)" or equivalent "no longer rendered in any Inline Runner state".
- Drop the "where applicable" parenthetical for Run Again — D-06 has confirmed Run Again is NOT added in Phase 69 for Inline. Keep the sentence accurate to scope.
- Preserve sentences 2 and 3 verbatim ("The Inline Runner already appends…" + "The sidebar Runner View and the tab Runner View continue to show…") — they remain accurate.

**Out of scope to touch:** the table at line 78 ("Removing buttons from sidebar/tab Runner views | INLINE-CLEAN-01 is Inline-mode-only by design") — its scope-fence statement remains accurate after the re-word; do NOT delete or change.

---

### `.planning/ROADMAP.md` (docs — Phase 69 Goal + SC#1 expansion)

**Analog:** Phase 67 D-13 ROADMAP amend precedent. Same shape, same file, similar lines (Phase 67 was around line 403; Phase 69 is at line 182).

**Anchor — current Phase 69 §Goal + Success Criteria at lines 182-189** (`VERIFIED`):
```markdown
### Phase 69: Inline Runner — Hide Result-Export Buttons in Complete State
**Goal**: When the Inline Runner reaches the protocol-complete state, the user no longer sees the redundant Insert / Copy to clipboard / Save to note buttons — only Close (and Run Again, where applicable) remains. Sidebar Runner View and tab Runner View are unaffected.
**Depends on**: Nothing (Inline-mode-only render-time conditional in `InlineRunnerModal`; isolated from sidebar/tab runner code paths)
**Requirements**: INLINE-CLEAN-01
**Success Criteria** (what must be TRUE):
  1. Running a protocol to completion in Inline mode renders a footer/toolbar with Close (and Run Again where applicable) — Insert, Copy to clipboard, and Save to note buttons are absent from the DOM (INLINE-CLEAN-01)
  2. Running the same protocol to completion in sidebar Runner View shows all three result-export buttons exactly as before — no cross-mode regression (INLINE-CLEAN-01)
  3. Running the same protocol to completion in tab Runner View shows all three result-export buttons exactly as before — no cross-mode regression (INLINE-CLEAN-01)
```

**Pattern for the rewrite (planner drafts per CONTEXT.md Discretion):**
- Goal sentence: replace "When the Inline Runner reaches the protocol-complete state, the user no longer sees..." → broaden to all 6 inline states. Keep the second sentence ("Sidebar Runner View and tab Runner View are unaffected") verbatim — accurate.
- SC#1: replace "Running a protocol to completion in Inline mode renders…" → assert the three button classes (`.rp-copy-btn` / `.rp-save-btn` / `.rp-insert-btn`) are absent from the DOM in every Inline state, not just `complete`. Drop the "footer/toolbar with Close (and Run Again where applicable)" clause — D-06 confirms no Run Again is added.
- SC#2 + SC#3: leave verbatim. They remain accurate (cross-mode regression promise unchanged).
- Add no new SC entries — the existing 3 cover the full Phase 69 contract after rewording SC#1.

**Out of scope to touch:** lines 184 (`**Depends on**`), 185 (`**Requirements**`), and any progress table row for Phase 69 elsewhere in ROADMAP.md (planner verifies — STATE.md may have a phase row that uses generic "Open" status, no semantic change needed).

---

### `src/__tests__/views/inline-runner-modal-output-toolbar.test.ts` (test — NEW or extend `inline-runner-modal.test.ts`)

**Analog (PRIMARY):** `src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts` (Phase 67 D-18 Test Layer #3) — full file. This is the most recent Inline cross-state regression harness, mounts `InlineRunnerModal`, drives state transitions through the real `ProtocolRunner`, and asserts on `containerEl` DOM via `querySelectorAll`.

**Analog (SECONDARY):** `src/__tests__/views/inline-runner-modal.test.ts` lines 1-361 — the canonical `MockEl` harness with `walk` + `buildMatcher` (already supports `.rp-copy-btn`/`.rp-save-btn`/`.rp-insert-btn` class selectors), the `obsidian` mock with `Modal/TFile/TFolder`, and `setupModal()` factory.

**Imports pattern** (lines 1-5 of `inline-runner-modal-loop-body-file-bound.test.ts`, `VERIFIED`):
```typescript
// src/__tests__/views/inline-runner-modal-output-toolbar.test.ts
// Phase 69 INLINE-CLEAN-01 — Inline Runner regression for output-toolbar absence
// across all 6 inline states (D-01, D-08).
import { describe, it, expect, beforeEach, vi } from 'vitest';
```

**MockEl harness pattern** — copy lines 14-181 verbatim from `inline-runner-modal-loop-body-file-bound.test.ts` (the `interface MockEl`, `function makeEl`, `function walk`, `function buildMatcher`). The `buildMatcher` already supports `.rp-copy-btn` / `.rp-save-btn` / `.rp-insert-btn` (class-prefix selector) and `'div[cls="rp-output-toolbar"]'`-like queries via the tag+attr branch. No harness extension needed.

**`obsidian` mock pattern** — copy lines 183-233 (the `vi.mock('obsidian', ...)` block) verbatim. `Modal`, `Notice`, `TFile`, `TFolder` are all the test needs for Phase 69.

**Plugin/App fixtures** — copy `makeTargetNote` / `makePlugin` / `makeApp` from `inline-runner-modal-loop-body-file-bound.test.ts:348-388` verbatim. `_vaultModifyCalls` etc. are not asserted by Phase 69 tests but harmless to keep.

**State-cycling pattern** (the only Phase 69-specific bit) — for each of the 6 statuses, mock `runner.getState` and call `(modal as any).render()`. Mirror the spy pattern from `inline-runner-modal.test.ts:369-377`:
```typescript
import { InlineRunnerModal } from '../../views/inline-runner-modal';

function setupModalAndRender(status: string, extras: Record<string, unknown> = {}): MockEl {
  const targetNote = makeTargetNote();
  const plugin = makePlugin();
  const app = makeApp(plugin);
  const modal = new InlineRunnerModal(app as any, plugin as any, 'test.canvas', targetNote);
  // The InlineRunnerModal builds its container in onOpen → render(). The MockEl
  // assigned to `this.contentEl` (set up in inline-runner-modal.test.ts setupModal()
  // pattern via Modal-mock contentEl field) accumulates the render output.
  vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
    status,
    accumulatedText: 'sample',
    finalText: 'sample',
    canStepBack: false,
    ...extras,
  } as any));
  // Drive render — exact entry point depends on the test author's preference:
  //   (modal as any).render();              // direct private call (matches test.ts:374 pattern)
  // OR: simulate onOpen via Modal.open() + spy on the actual render lifecycle.
  (modal as any).contentEl ??= makeEl('div');
  (modal as any).render();
  return (modal as any).contentEl as MockEl;
}

describe('Phase 69 INLINE-CLEAN-01 — Inline output toolbar absent in all 6 states', () => {
  const states = ['idle', 'at-node', 'awaiting-snippet-pick', 'awaiting-loop-pick', 'awaiting-snippet-fill', 'complete'] as const;
  for (const status of states) {
    it(`status=${status}: rp-copy-btn / rp-save-btn / rp-insert-btn are absent from DOM`, () => {
      const root = setupModalAndRender(status);
      expect(root.querySelectorAll('.rp-copy-btn')).toHaveLength(0);
      expect(root.querySelectorAll('.rp-save-btn')).toHaveLength(0);
      expect(root.querySelectorAll('.rp-insert-btn')).toHaveLength(0);
      // D-09 additional assertion: the rp-output-toolbar div container is also absent.
      expect(root.querySelectorAll('.rp-output-toolbar')).toHaveLength(0);
    });
  }
});
```

**Caveats for the planner / executor:**
- `at-node` requires a graph fixture (so `this.graph.nodes.get(state.currentNodeId)` resolves to a `question` node). Either copy the graph factory pattern from `inline-runner-modal-loop-body-file-bound.test.ts:299-344` (`makeStart`, `makeQuestion`-equivalent, `buildGraph`), OR mock `this.graph` to a minimal fake that returns a `question` node with `questionText: 'sample?'`. The latter is shorter and Phase 69-scope-disciplined.
- `awaiting-snippet-pick` triggers `void this.renderSnippetPicker(...)` which mounts `SnippetTreePicker`. Mock `'../../views/snippet-tree-picker'` exactly like `inline-runner-modal-loop-body-file-bound.test.ts:236-246` to keep the test deterministic and Phase 69-focused.
- `awaiting-snippet-fill` triggers `void this.handleSnippetFill(state.snippetId, questionZone)` which constructs a `SnippetFillInModal`. Mock `'../../views/snippet-fill-in-modal'` exactly like `inline-runner-modal.test.ts:254-286`.
- `awaiting-loop-pick` requires a `loop` node in the graph. Same minimal fake-graph pattern.
- The existing `inline-runner-modal.test.ts:374-700` test set mocks `runner.completeSnippet` and asserts `vault.modify` calls — none of those depend on the toolbar. Per CONTEXT.md D-09 "стоит ли в этом же phase обновить тесты `inline-runner-modal.test.ts:374,396,...` — планнер проверяет, остаются ли они зелёными после D-03/D-04." Expected: they remain green (no toolbar references).

**Discretion bullet** — the planner may choose between (a) creating the new file `inline-runner-modal-output-toolbar.test.ts` (cleaner, focused, name-per-content) or (b) extending `inline-runner-modal.test.ts` with a new `describe('Phase 69 INLINE-CLEAN-01 — output toolbar absent', () => {...})` block at the end of the file (lower file count, but mixes phase-69 content into a Phase 59 file). CONTEXT.md Discretion bullet 1 explicitly leaves this to the planner. **Recommendation:** new file — matches the precedent established by Phase 67 D-18 Test Layers #2/#3 (each phase gets its own test file).

---

### `src/__tests__/views/runner-view-output-toolbar.test.ts` (test — NEW or extend `runner-snippet-*.test.ts`)

**Analog (PRIMARY):** `src/__tests__/views/runner-snippet-loop-body-file-bound.test.ts` (Phase 67 D-18 Test Layer #2) — full file. This mounts `RunnerView`, drives the runner via `ProtocolRunner` (or spies), and asserts on `contentEl` (FakeNode tree) — the canonical sidebar regression harness in v1.10+.

**Analog (SECONDARY):** `src/__tests__/views/runner-snippet-sibling-button.test.ts` lines 1-235 — `FakeNode` + `findByClass(root, cls)` + `mountAtQuestion(graph)` harness.

**Imports + harness pattern** (verbatim from `runner-snippet-sibling-button.test.ts:1-32`):
```typescript
// src/__tests__/views/runner-view-output-toolbar.test.ts
// Phase 69 INLINE-CLEAN-01 — sidebar/tab RunnerView regression: in complete-state,
// rp-copy-btn / rp-save-btn / rp-insert-btn are STILL rendered (cross-mode
// guarantee against Phase 69 D-03/D-04 inline-only deletion). Validates SC#2 + SC#3
// of ROADMAP.md §Phase 69.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('obsidian');

// Mock SnippetTreePicker — complete-state never reaches the picker; mock to silence.
vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(_options: unknown) {}
    async mount(): Promise<void> {}
    unmount(): void {}
  }
  return { SnippetTreePicker };
});

import { RunnerView } from '../../views/runner-view';
import type RadiProtocolPlugin from '../../main';
import type { ProtocolGraph } from '../../graph/graph-model';
```

**FakeNode + findByClass** — copy lines 39-111 verbatim from `runner-snippet-sibling-button.test.ts`. The `findByClass(contentEl, 'rp-copy-btn' | 'rp-save-btn' | 'rp-insert-btn')` helper is what the assertion calls.

**`mountAtQuestion` analog → `mountAtComplete`**: adapt lines 168-236 of `runner-snippet-sibling-button.test.ts`. Two adjustments:
1. Mock `runner.getState` to return `{ status: 'complete', finalText: 'final-output' }`.
2. **Crucially**: do NOT neutralise `renderOutputToolbar` (that line in the analog is `(view as unknown as { renderOutputToolbar: () => void }).renderOutputToolbar = () => {};`). Phase 69 cross-mode test must let the real `renderOutputToolbar` run so the three buttons get into the DOM.

**Test pattern:**
```typescript
describe('Phase 69 cross-mode regression — sidebar RunnerView complete-state still renders all 3 result-export buttons', () => {
  it('rp-copy-btn / rp-save-btn / rp-insert-btn present in complete-state DOM', () => {
    const view = mountAtComplete();
    const copy = findByClass((view as any).contentEl, 'rp-copy-btn');
    const save = findByClass((view as any).contentEl, 'rp-save-btn');
    const insert = findByClass((view as any).contentEl, 'rp-insert-btn');
    expect(copy).toHaveLength(1);
    expect(save).toHaveLength(1);
    expect(insert).toHaveLength(1);
  });
});
```

**Caveats:**
- Sidebar `runner-view.ts:686-704` includes `renderPreviewZone` and `renderOutputToolbar` calls. The analog harness already neutralises `renderPreviewZone`; do the same. But leave `renderOutputToolbar` real (the assertion target).
- `runner-view.ts:1101` reads `this.lastActiveMarkdownFile` to set `insertBtn.disabled`. Initialize the field on the harnessed view to `null` (the existing harness pattern doesn't set it; default-undefined is fine — the `=== null` check passes).
- `restartCanvas` is called by the `Run again` button click handler — not invoked in the test, but the button construction path requires `this.canvasFilePath`. Set it on the view: `(view as any).canvasFilePath = 'test.canvas';`.

**Discretion bullet** — same shape as the inline test: new file vs extend an existing `runner-snippet-*.test.ts`. CONTEXT.md Discretion leaves this to the planner. **Recommendation:** new file `runner-view-output-toolbar.test.ts` — symmetric with the inline counterpart, easy to grep, same Phase 67 D-18 precedent.

---

## Shared Patterns

### CLAUDE.md "never remove existing code you didn't add" — explicit exception (Phase 67 D-14 precedent)

**Source:** Phase 67 commit `e7e3175` (`fix(67-02): runner-core file-bound snippet dispatch (D-14, D-15) — replace 736-741 unconditional picker halt with radiprotocol_snippetPath branch`).

**Apply to:** `src/styles/inline-runner.css` (3 deleted blocks) AND `src/views/inline-runner-modal.ts` (the `renderOutputToolbar` private method deleted at lines 960-1002 — this method was added in Phase 54, not by the executor of Phase 69, so the same exception clause applies for completeness).

**Exception template** (planner copies into PLAN.md `<constraints>` section AND into the commit message body, modeled on `e7e3175`):

```text
CLAUDE.md mandate exception — Phase 69 D-04 + D-05 explicitly REMOVE existing
code that the executor did not add:

  1. src/views/inline-runner-modal.ts:960-1002 — the private method
     renderOutputToolbar(...) (added in Phase 54, modified in Phase 59).
     After D-03 deletes its 6 call sites at lines 342, 455, 460, 516, 525, 532,
     the method has zero callers in Inline Runner. Leaving it in place would
     constitute dead code that ESLint / future agents would either re-call
     incorrectly or have to delete anyway. Sidebar parallel
     `runner-view.ts:1071-1128` is NOT touched (still has callers).

  2. src/styles/inline-runner.css:74-80, 234-239, 241-244 — three CSS blocks
     selecting `.rp-inline-runner-content .rp-output-toolbar` and its `button`
     descendant. Load-bearing for the now-deleted `<div class="rp-output-toolbar">`
     element. After D-03 removes the div creation at inline-runner-modal.ts:334,
     these blocks match no DOM in any Inline state. The base
     `src/styles/runner-view.css:58 .rp-output-toolbar` rule is NOT touched
     (still load-bearing for sidebar/tab).

Per CLAUDE.md "Never remove existing code you didn't add": EXCEPT for the
listed line ranges — explicit phase mandate per Phase 69 D-04 + D-05 (CONTEXT).
```

### CSS append-only per phase — exception phrasing

**Source:** `CLAUDE.md` "CSS Architecture" section.

**Apply to:** `src/styles/inline-runner.css` only.

**Phase 69 contract:**
- No new rules added to `inline-runner.css` (or any other `src/styles/*.css` file).
- No `/* Phase 69: ... */` comment (per CONTEXT.md guardrail).
- Three blocks deleted with explicit exception (above).
- `npm run build` MUST run after the CSS edit to regenerate the concatenated `styles.css` in repo root. `styles.css` is generated; never commit edits to it directly.

### Phase 67 D-13 ROADMAP/STATE amend pattern (for D-02)

**Source:** Phase 67 commit `c523b45` (`docs(phase-67): plan Inline Runner resize + file-bound Snippet parity`) — the precedent that Phase 69 D-02 mirrors.

**Apply to:** `.planning/REQUIREMENTS.md` line 11 + `.planning/ROADMAP.md` lines 182-189 (Phase 69 §Goal + SC#1).

**Pattern:**
- Edit happens in the FIRST plan of the phase (so downstream plans inherit the corrected wording).
- Edit is part of the same commit as the code change OR in a docs-only commit immediately preceding it. Phase 67 D-13 used the latter; Phase 69 may use either per planner discretion.
- Commit message references the discuss-decision ID (`Phase 69 D-02`).
- `STATE.md` "v1.11 Phase-Specific Domain Notes" already lists Phase 69 — verify whether SC#1 wording change requires a STATE.md note (CONTEXT.md guardrails do NOT request a STATE.md edit, only REQUIREMENTS.md + ROADMAP.md). Likely no STATE.md edit needed — confirm during planning.

### `console.debug` only — Standing Pitfall #6

**Source:** `.planning/STATE.md` Standing Pitfall #6.

**Apply to:** all source files in Phase 69 (`inline-runner-modal.ts`, both new test files).

**Phase 69 contract:** Phase 69 introduces no new logging. The deleted `renderOutputToolbar` private method had no `console.*` calls (`Notice` toasts only — those go away with the deletion). The test files use `vi`/`expect`, no console output.

### Cross-mode regression test pattern (Phase 67 D-18 Test Layer #2/#3 precedent)

**Source:** `runner-snippet-loop-body-file-bound.test.ts` (sidebar) + `inline-runner-modal-loop-body-file-bound.test.ts` (inline) — committed together in Phase 67 e7e3175.

**Apply to:** Phase 69 D-08 — paired regression tests, one per runner mode.

**Pattern:** for any phase where a change touches one runner surface but the other should be unchanged, ship a paired pair of view-layer regression tests — one mounting `InlineRunnerModal` (asserts the changed behaviour) + one mounting `RunnerView` (asserts the OPPOSITE — sidebar/tab unchanged). Both tests live in `src/__tests__/views/`, named after the phase contract noun (`-output-toolbar`, `-loop-body-file-bound`, etc.).

---

## No Analog Found

| File | Reason |
|---|---|
| (none) | All 6 modified/new files have direct, file-line-precise in-tree analogs. |

---

## Metadata

**Analog search scope:**
- `src/views/inline-runner-modal.ts` (single-file render switch — same-file analog)
- `src/views/runner-view.ts` (sidebar twin — used as cross-mode reference)
- `src/styles/inline-runner.css` (deletion target — same-file)
- `src/__tests__/views/inline-runner-modal*.test.ts` (test harness reuse)
- `src/__tests__/views/runner-snippet-*.test.ts` (sidebar test harness reuse)
- `.planning/milestones/v1.10-phases/67-inline-runner-resizable-modal-file-bound-snippet-parity/` (D-13 + D-14 + D-18 precedent — full phase corpus)
- Git log for Phase 67 commits (`c523b45`, `c8e731b`, `e7e3175`, `bd3cfd4`) — exact commit-message phrasing for D-14 exception clause.

**Files scanned:** 9 source/test files Read directly, 5 commits inspected, 4 prior-phase docs touched.

**Pattern extraction date:** 2026-04-29.
