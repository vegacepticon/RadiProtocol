# Phase 16: Runner Textarea Edit Preservation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix BUG-01: manual text edits typed into the runner preview textarea must survive when the user advances to the next protocol step. The accumulated text after each advance must include both the runner-appended content and any manual edits made before that step. Undo must restore the pre-advance state including manual edits. No other capabilities are in scope.

</domain>

<decisions>
## Implementation Decisions

### Edit Capture Timing
- **D-01:** Edit is captured **before each advance action** — capture-before-advance pattern. In each button click handler, read `this.previewTextarea?.value` and call `runner.syncManualEdit(text)` before calling the runner action (`chooseAnswer`, `enterFreeText`, `chooseLoopAction`). No live sync on every keystroke.

### Coverage — Which Advance Actions
- **D-02:** All three interactive advance actions must sync the manual edit before firing:
  - `chooseAnswer(answerId)` — answer button clicks (question nodes)
  - `enterFreeText(text)` — Submit button (free-text-input nodes)
  - `chooseLoopAction('again' | 'done')` — loop-end buttons
- Step-back (`stepBack()`) does **not** sync textarea — reverting intentionally discards in-progress edits.

### Complete State — Copy / Save / Insert
- **D-03:** When the protocol is complete, Copy / Save / Insert buttons read from `this.previewTextarea?.value` at click time, not from the runner's `finalText`. This allows the user to make quick final touch-ups to the report without re-running the protocol. Consistent with active-state behavior (D-01).

### Claude's Discretion
- New `ProtocolRunner.syncManualEdit(text: string)` method: updates the accumulator to the given text without pushing a new undo entry. Calling it before a runner action means the undo snapshot captured inside `chooseAnswer()` / `enterFreeText()` / `chooseLoopAction()` will naturally include the manual edit.
- `TextAccumulator` gets a companion method (e.g., `overwrite(text: string)`) used only by `syncManualEdit` — mirrors `restoreTo` semantics without undo semantics.
- Exact method names are Claude's discretion; no user input needed.
- `renderOutputToolbar` currently uses a `capturedText` closure for complete-state buttons — this must be replaced with a live textarea read to satisfy D-03.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Core source files to read before planning
- `src/views/runner-view.ts` — all button click handlers (chooseAnswer, enterFreeText, chooseLoopAction, copy/save/insert); `renderPreviewZone()` (where `this.previewTextarea` is assigned); `renderOutputToolbar()` (capturedText closure to replace for complete state)
- `src/runner/protocol-runner.ts` — public API; `chooseAnswer()`, `enterFreeText()`, `chooseLoopAction()`, `stepBack()`; add `syncManualEdit(text)` here
- `src/runner/text-accumulator.ts` — add `overwrite(text: string)` method (used only by `syncManualEdit`)
- `src/runner/runner-state.ts` — no changes expected; reviewed for context

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `this.previewTextarea` — already tracked as a class field in `RunnerView`; set in `renderPreviewZone()`, reset to null in `render()`. No new DOM reference needed.
- `TextAccumulator.restoreTo(snapshot)` — same pattern for the new `overwrite()` method (string assignment, O(1), no deep clone).

### Established Patterns
- Undo snapshots are captured INSIDE `chooseAnswer()` / `enterFreeText()` / `chooseLoopAction()` before any mutation. Injecting the edit via `syncManualEdit()` before the call means the snapshot automatically captures the manual edit — undo will restore the correct pre-advance state.
- Auto-save (`autoSaveSession()`) is called after each runner action — since the accumulator is updated before the action, the saved session will include the manual edit without extra changes.
- All button handlers already follow the pattern: `action → autoSaveSession → render`. The sync call inserts before the action.

### Integration Points
- `renderOutputToolbar()` passes `capturedText` as a closure to copy/save/insert handlers. For complete state (D-03), these handlers must instead read `this.previewTextarea?.value ?? capturedText` at click time.
- `ProtocolRunner` is pure (zero Obsidian imports) — `syncManualEdit` stays pure; it only calls the accumulator method.

</code_context>

<specifics>
## Specific Ideas

No specific UI references — fix is backend/wiring only; no visual changes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 16-runner-textarea-edit-preservation*
*Context gathered: 2026-04-09*
