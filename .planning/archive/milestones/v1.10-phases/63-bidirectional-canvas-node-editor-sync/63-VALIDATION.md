---
phase: 63
slug: bidirectional-canvas-node-editor-sync
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (Node env, hand-rolled DOM doubles) |
| **Config file** | `vitest.config.ts` (already in repo) |
| **Quick run command** | `npm test -- --run src/__tests__/edge-label-reconciler.test.ts src/__tests__/canvas-write-back.test.ts src/__tests__/views/editor-panel-canvas-sync.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | quick ~5s · full ~30s |

---

## Sampling Rate

- **After every task commit:** Run quick command above (only the three target test files)
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run build` must succeed (regenerates `styles.css` if any CSS file in `src/styles/` changed; Phase 63 doesn't add CSS but the build still needs to pass)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> The planner fills in concrete task IDs once PLAN.md files are produced. Rows below are the expected coverage skeleton derived from the Validation Architecture in `63-RESEARCH.md`. Each PLAN.md task MUST link back to one of these rows (or add a new one).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 63-01-01 | 01 | 1 | EDITOR-03 | — | Reconciler picks first non-empty incoming Question→Snippet edge label, mirrors to `snippetLabel` and sibling edges (D-02, D-04) | unit | `npm test -- --run src/__tests__/edge-label-reconciler.test.ts -t "snippet"` | ❌ W0 | ⬜ pending |
| 63-01-02 | 01 | 1 | EDITOR-03 | — | Cold-open migration (D-03): node has `snippetLabel`, edge has empty `label` → first reconcile writes label to edge | unit | `npm test -- --run src/__tests__/edge-label-reconciler.test.ts -t "cold-open"` | ❌ W0 | ⬜ pending |
| 63-01-03 | 01 | 1 | EDITOR-03 | — | `EdgeLabelDiff` discriminated-union (`kind: 'answer' \| 'snippet'`) routes writer to correct node field (`radiprotocol_displayLabel` vs `radiprotocol_snippetLabel`) | unit | `npm test -- --run src/__tests__/canvas-write-back.test.ts -t "snippet edge"` | ❌ W0 | ⬜ pending |
| 63-02-01 | 02 | 2 | EDITOR-03, EDITOR-05 | — | `EdgeLabelSyncService` dispatches `canvas-changed-for-node` event after every reconcile pass with `{ filePath, nodeId, kind, fieldUpdates }`; idempotent reconcile produces no event (D-07 short-circuit) | unit | `npm test -- --run src/__tests__/edge-label-sync-service.test.ts -t "dispatch"` | ❌ W0 | ⬜ pending |
| 63-02-02 | 02 | 2 | EDITOR-05 | — | `lastSnapshotByFilePath` baseline diff: when canvas modify changes only node text fields (no edge changes), service still dispatches `fieldUpdates` for the open node | unit | `npm test -- --run src/__tests__/edge-label-sync-service.test.ts -t "snapshot"` | ❌ W0 | ⬜ pending |
| 63-02-03 | 02 | 2 | EDITOR-05 | — | Snapshot cleanup on `vault.on('rename')` and `vault.on('delete')` — service does not leak stale baselines | unit | `npm test -- --run src/__tests__/edge-label-sync-service.test.ts -t "snapshot cleanup"` | ❌ W0 | ⬜ pending |
| 63-03-01 | 03 | 3 | EDITOR-05 | — | `EditorPanelView` builds `formFieldRefs` Map during `renderForm` / `buildKindForm`; map cleared on node switch and `onClose` | unit | `npm test -- --run src/__tests__/views/editor-panel-canvas-sync.test.ts -t "formFieldRefs"` | ❌ W0 | ⬜ pending |
| 63-03-02 | 03 | 3 | EDITOR-05 | — | Inbound patch sets `.value` on non-focused field; never dispatches synthetic input event; never writes to `pendingEdits` | unit | `npm test -- --run src/__tests__/views/editor-panel-canvas-sync.test.ts -t "patch non-focused"` | ❌ W0 | ⬜ pending |
| 63-03-03 | 03 | 3 | EDITOR-03, EDITOR-05 | — | In-flight detector (D-05): when target field equals `document.activeElement`, patch is skipped and stored in `pendingCanvasUpdate` slot | unit | `npm test -- --run src/__tests__/views/editor-panel-canvas-sync.test.ts -t "in-flight"` | ❌ W0 | ⬜ pending |
| 63-03-04 | 03 | 3 | EDITOR-05 | — | Apply-post-blur (D-07): `blur` event on focused field flushes `pendingCanvasUpdate` slot to `.value` | unit | `npm test -- --run src/__tests__/views/editor-panel-canvas-sync.test.ts -t "post-blur"` | ❌ W0 | ⬜ pending |
| 63-03-05 | 03 | 3 | EDITOR-05 | — | NodeType change (D-09): inbound patch with different `radiprotocol_nodeType` triggers full `renderNodeForm` (not in-place patch) | unit | `npm test -- --run src/__tests__/views/editor-panel-canvas-sync.test.ts -t "nodeType change"` | ❌ W0 | ⬜ pending |
| 63-03-06 | 03 | 3 | EDITOR-05 | — | Node deletion (D-10): canvas removes currently-selected node → view goes to `renderIdle`, `currentNodeId/currentFilePath = null` | unit | `npm test -- --run src/__tests__/views/editor-panel-canvas-sync.test.ts -t "node deleted"` | ❌ W0 | ⬜ pending |
| 63-03-07 | 03 | 3 | EDITOR-03, EDITOR-05 | — | Re-entrancy (Phase 42 WR-01/WR-02): patch arriving during `renderForm` flush is deferred via `queueMicrotask`; no stale closure overwrites | unit | `npm test -- --run src/__tests__/views/editor-panel-canvas-sync.test.ts -t "re-entrant"` | ❌ W0 | ⬜ pending |
| 63-04-01 | 04 (regression) | 3 | EDITOR-03 | — | `runner-snippet-sibling-button.test.ts` remains green — D-02 mirror keeps `node.snippetLabel` truthy for runner read-path | unit | `npm test -- --run src/__tests__/views/runner-snippet-sibling-button.test.ts` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/edge-label-sync-service.test.ts` — NEW file; covers dispatch contract + snapshot baseline + cleanup (rows 63-02-01..03). The Phase 50 service has no unit-test file today; Phase 63 introduces it.
- [ ] `src/__tests__/views/editor-panel-canvas-sync.test.ts` — NEW file; covers formFieldRefs lifecycle, in-flight detector, post-blur apply, nodeType change, deletion, re-entrancy (rows 63-03-01..07). EditorPanelView has no unit tests today; this is the first.
- [ ] `src/__tests__/edge-label-reconciler.test.ts` — EXTEND with snippet describe-block + cold-open migration test (rows 63-01-01..02).
- [ ] `src/__tests__/canvas-write-back.test.ts` — EXTEND with `kind: 'snippet'` discriminated-union write coverage (row 63-01-03).
- [ ] vitest framework already installed; no new install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ~750 ms end-to-end latency feels acceptable when typing on canvas while form is open | EDITOR-03, EDITOR-05 | Latency perception is subjective; can't be asserted in unit tests | 1. Open Obsidian, open a `.canvas` with a Question→Snippet branch; 2. Open Node Editor on the Snippet; 3. Edit the edge label directly on canvas → confirm form's branch-label field updates after a brief pause (~750 ms) without focus jumps. |
| In-flight protection feels invisible (no jank when typing in form while canvas changes) | EDITOR-03, EDITOR-05 | Visual smoothness — can't be asserted in unit tests | 1. Focus the Question text field in Node Editor; 2. From canvas, edit a sibling Answer node's text; 3. Confirm the Question field's caret/selection is undisturbed and adjacent fields still update. |
| Cold-open migration runs once silently on legacy `.canvas` files | EDITOR-03 | Requires real Obsidian vault.modify event | 1. Open a pre-Phase-63 canvas with `radiprotocol_snippetLabel` on node but no `label` on incoming Question→Snippet edge; 2. Make any edit → confirm edge now has `label` matching `snippetLabel`; 3. No user-visible Notice shown. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (2 NEW test files + 2 EXTEND existing)
- [ ] No watch-mode flags (all `npm test -- --run` invocations)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner finalises task IDs)

**Approval:** pending
