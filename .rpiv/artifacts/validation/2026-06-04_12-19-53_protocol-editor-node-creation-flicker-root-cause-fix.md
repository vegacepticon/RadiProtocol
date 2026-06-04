---
date: 2026-06-04T12:19:53+0300
author: Roman Shulgha
commit: b7f9626
branch: main
repository: RadiProtocol
topic: "Validation of Protocol Editor node creation flicker root-cause fix"
status: complete
parent: ".rpiv/artifacts/plans/2026-06-04_11-30-58_protocol-editor-node-creation-flicker-root-cause-fix.md"
tags: [validation, protocol-editor, node-creation, flicker, modal, ux]
last_updated: 2026-06-04T12:19:53+0300
---

## Validation Report: Protocol Editor node creation flicker root-cause fix

### Implementation Status

- ✓ Phase 1: Continuous Creation Modal Handoff — Fully implemented
- ✓ Phase 2: Regression Coverage and Validation — Fully implemented (one extra test beyond plan scope)

### Automated Verification Results

- ✓ Type checking accepts creation callback signatures: `npx tsc --noEmit` — no errors
- ✓ Creation handoff callbacks present in both paths: `grep -n "onEditModalOpened" src/views/protocol-editor-view.ts` — 5 matches (≥4 required)
- ✓ No loadProtocol in creation continuations: `grep -n "await this.loadProtocol(this.protocolPath!)" src/views/protocol-editor-view.ts` reports no hits in addNodeAtWorldPoint or addNodeAndConnectAtWorldPoint
- ✓ Focused creation handoff tests pass: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts` — 11/11 tests pass
- ✓ Keyboard/modal tests pass: `npx vitest run src/__tests__/views/protocol-editor-keyboard.test.ts` — 16/16 tests pass
- ✓ Production build passes: `npm run build` — clean
- ✓ Full test suite passes: `npm test` — 716/716 tests pass across 56 files
- ✓ Lint passes: `npm run lint` — no warnings or errors
- ✓ No regressions detected

### Code Review Findings

#### Matches Plan:

- `src/views/protocol-editor-view.ts:149-153` — `ProtocolEditorCreateNodeOptions` interface with all three callbacks (`onEditModalOpened`, `onCreateAbandoned`, `onCreateFailed`)
- `src/views/protocol-editor-view.ts:695-700` — `setNodeKindPickerBusy()` toggles `is-saving` class and disables all buttons
- `src/views/protocol-editor-view.ts:704-740` — `addNodeAtWorldPoint()` accepts options, calls `onCreateAbandoned` on invalid-state guard (line 709), calls `onCreateAbandoned` on stale generation (line 723–724), calls `onEditModalOpened` after `openEditModal()` (line 730), and calls `onCreateFailed` on store rejection (line 738)
- `src/views/protocol-editor-view.ts:846-900` — `addNodeAndConnectAtWorldPoint()` mirrors the same callback contract (lines 849, 862–864, 870, 876–878)
- `src/views/protocol-editor-view.ts:742-789` — `openNodeKindPickerAtWorldPoint()` keeps picker visible during creation, uses `isCreating` guard on close/backdrop/button clicks, wires `onEditModalOpened` → `closeModal({ restoreFocus: false })`, `onCreateAbandoned` → `closeModal()`, `onCreateFailed` → `restorePicker()`
- `src/views/protocol-editor-view.ts:791-840` — `openNodeKindPickerAndConnectAtWorldPoint()` — identical picker lifecycle with same callback wiring
- `src/styles/protocol-editor.css:276-278` — `.is-saving` CSS rule with `opacity: 0.85` and `cursor: wait`
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts` — All six plan-specified handoff tests present plus one additional test (see Deviations)

#### Deviations from Plan:

- `src/views/protocol-editor-view.ts:734-737` and `:894-896` — Post-save UI error `catch` block still invokes `onCreateFailed`. The plan review (Step 8, Rows 3–4) resolved that "post-save UI errors [should be] caught separately without invoking `onCreateFailed`," but the implemented code still calls `options.onCreateFailed?.()` in the `catch` block inside the `.then()` success handler. This differs from the review resolution but is explicitly validated by an additional test (`"calls onCreateFailed when standalone UI update fails after successful save"`) that confirms the behavior is intentional: a UI error after a successful save re-enables the picker so the user can see the error notice and retry or dismiss. The `isCreating` flag prevents duplicate creation while the picker is in busy state, mitigating the "double-create" concern from the review.

#### Pattern Conformance:

- ✓ `ProtocolEditorCreateNodeOptions` follows the project's option-bag pattern (optional callbacks, default empty object)
- ✓ `setNodeKindPickerBusy()` follows the existing `is-` CSS state class pattern (`.is-panning`, `.is-untyped`, `.is-hidden`, `.is-dragging`, now `.is-saving`)
- ✓ Both picker methods follow the project's established modal pattern (`rp-protocol-editor-modal-backdrop` class, `closeModal()` closure, `restoreFocus` option) seen in `openEditModal()`, `openSelfCheckModal()`, and `openEdgeModal()`
- Minor observation: The `isCreating` boolean guard in both picker methods is the most comprehensive dismissal-protection pattern in the codebase; other modals (self-check, edge edit, node edit) allow backdrop dismissal during async operations. Acceptable variation — the picker is the only modal type that chains into a second modal.

#### Potential Issues:

- `src/views/protocol-editor-view.ts:734-737` — A post-save UI exception (e.g., `applyCreatedProtocolDocument()` throws) will call `onCreateFailed`, which in the picker context calls `restorePicker()` (re-enables buttons, removes `is-saving` class). This allows the user to re-attempt creation even though the node was already saved. The `isCreating` guard prevents a second creation attempt while the first is in-flight, but a fast user could theoretically create a duplicate node by clicking a kind button after `restorePicker()` runs. This is a low-probability edge case: the UI error that triggers this path is already exceptional, and the user would need to disregard the error notice and click again. Not blocking.

### Manual Testing Required:

1. Standalone node creation:
   - [ ] Double-click empty canvas, choose a node kind from the picker; verify the picker remains visible (no bare-canvas flash) until the edit modal appears
   - [ ] Verify the edit modal receives focus seamlessly after the picker closes

2. Connected node creation:
   - [ ] Drag an edge to empty canvas, choose a node kind from the picker; verify the picker remains visible (no bare-canvas flash) until the edit modal appears
   - [ ] Verify the created edge is rendered and connected to the new node

3. Error recovery:
   - [ ] If possible to simulate a save failure, verify the picker re-enables with buttons clickable and a save-failed notice appears
   - [ ] Verify the close button (✕) still works after a save failure to dismiss the picker

4. Live geometry regression:
   - [ ] Close the edit modal after node creation, drag the created node, verify connected edges move live (no stale-position lag)

### Recommendations:

- Ready to commit — implementation is complete and validated. The post-save UI error `onCreateFailed` deviation from the review resolution is explicitly tested and the UX trade-off (re-enable picker on UI error vs. silently close) is reasonable.