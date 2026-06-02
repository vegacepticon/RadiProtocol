---
date: 2026-06-02T11:21:14+0300
author: Roman Shulgha
commit: 081e95d
branch: fixes-with-pi
repository: RadiProtocol
topic: "Validation of Protocol editor review fixes"
status: complete
parent: ".rpiv/artifacts/plans/2026-06-02_10-40-04_protocol-editor-review-fixes.md"
tags: [validation, protocol-editor, edge-rendering, minimap, async-save]
last_updated: 2026-06-02T11:21:14+0300
---

## Validation Report: Protocol Editor Review Fixes

### Implementation Status

- ✓ Phase 1: Safe edge-bend clamp — Fully implemented
- ✓ Phase 2: Guarded geometry save refresh — Fully implemented

### Automated Verification Results

- ✓ Route helper tests: `npm test -- src/__tests__/protocol-editor-helpers.test.ts` — 35 passed (2 new short-delta tests)
- ✓ Geometry-save tests: `npm test -- src/__tests__/views/protocol-editor-save-node-geometry.test.ts` — 2 passed
- ✓ Full test suite: `npm test` — 727/728 passed (1 pre-existing locale-ordering failure in `library-browser-modal.test.ts`, unrelated)
- ✓ Type/build validation: `npm run build` — type-check + esbuild bundle, no errors
- ✓ Unsafe bend absent: `grep -n "Math.max(MIN_BEND, maxBend)" src/views/protocol-editor-view.ts` — no matches (grep exit 1)
- ✓ Guard exists: `grep -n "this.protocolPath !== protocolPath" src/views/protocol-editor-view.ts` — line 1469, inside `saveNodeGeometry()`
- ✓ Minimap refresh: `grep -n "this.renderMinimap()" src/views/protocol-editor-view.ts` — line 1478, inside `saveNodeGeometry()`
- ✓ No regressions detected

### Code Review Findings

#### Matches Plan:

- `src/views/protocol-editor-view.ts:307-334` — `computeEdgeBend()` forward branch returns `Math.max(0, Math.min(rankDelta/2, Math.abs(normalDelta)/2, CONFIGURED_MAX_BEND))` per Phase 1 §1.1
- `src/views/protocol-editor-view.ts:330` — backward branch simplified to `Math.max(0, Math.min(BACKWARD_OFFSET/2, CONFIGURED_MAX_BEND))`, `MIN_BEND` constant removed
- `src/views/protocol-editor-view.ts:340` — `protocolEditorEdgeRoute()` calls `computeEdgeBend()` instead of hardcoded `const bend = 24`
- `src/views/protocol-editor-view.ts:1448` — `saveNodeGeometry()` captures `const protocolPath = this.protocolPath` before `await`, matching stale-guard pattern
- `src/views/protocol-editor-view.ts:1451-1458` — geometry and viewport snapshots pre-computed synchronously before async store update
- `src/views/protocol-editor-view.ts:1471` — `if (this.protocolPath !== protocolPath) return;` gates all post-await mutations
- `src/views/protocol-editor-view.ts:1478-1479` — `updateEdgePaths()` then `renderMinimap()` called after guarded inline save
- `src/__tests__/protocol-editor-helpers.test.ts:220-269` — `routeRankCoordinates()`, `expectNoForwardRankBacktracking()` helpers + 2 short-delta no-backtracking tests
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts` — NEW: 2 tests (successful save verifies DOM/edges/minimap; stale-path bail-out verifies no mutation)

#### Deviations from Plan:

None. Implementation is a faithful realization of the plan. The only minor note: the plan's top-level Desired End State snippet uses `{ ...n, ...geometry }` spread, while the Phase 2 §2.1 code block and actual implementation use explicit field assignments (`x: geometry.x, y: geometry.y, ...`). This is not a deviation — the detailed plan block matches the implementation exactly. Behavior is identical.

#### Pattern Conformance:

- ✓ Async guard pattern (`capture before await + bail if changed`) matches the canonical `renderSnippetPicker()` T-30-04 pattern in `src/runner/render/render-snippet-picker.ts:83-107`
- ✓ `updateEdgePaths()` for incremental rAF updates, `renderMinimap()` only on final commit — consistent with existing render strategy
- ✓ Test structure follows existing conventions: `vi.mock('obsidian', ...)` + `makeNode()`/`makeDoc()` factories
- ✓ New test validates both the happy path and the stale-path guard path
- Minor observation: `persistViewportState()` at line 1771 does not use the async guard pattern (pre-existing; not introduced by this change). Acceptable variation — lower risk due to 400ms debounce.

### Manual Testing Required:

1. **Edge rendering**:
   - [ ] Very short forward LR and TB routes render without backwards folds/cusps at multiple zoom levels

2. **Minimap refresh**:
   - [ ] After drag/resize release, the minimap node rectangle and edge line reflect the saved geometry

3. **Stale-path guard**:
   - [ ] Loading another protocol while a geometry save is pending does not replace the active view with the stale saved document

4. **Drag smoothness**:
   - [ ] Drag remains smooth — `renderMinimap()` runs only after save completion, not during rAF mousemove updates

### Recommendations:

Ready to commit — implementation is complete and validated. All automated checks pass, code matches the plan, no regressions. The one pre-existing test failure (`library-browser-modal.test.ts` locale ordering) is unrelated to these changes.
