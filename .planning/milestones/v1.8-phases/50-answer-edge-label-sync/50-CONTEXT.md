# Phase 50: Answer ↔ Edge Label Sync - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

`Answer.displayLabel` is the single source of truth for the label on every incoming Question→Answer edge. Edits on either side propagate through:

- **Node Editor** Answer form (Display label field, `editor-panel-view.ts:443-451`)
- **Canvas save path** — both Pattern B (canvas open) via a new `CanvasLiveEditor.saveLiveEdges()` and Strategy A (canvas closed) via `vault.modify()`
- **Canvas edge label rendering** — by mutating canvas edge `.label` JSON so Obsidian Canvas redraws

Multi-incoming Answer nodes share one label across all incoming edges (per-edge override is explicitly out of scope per REQUIREMENTS Out-of-Scope row 1).

**Scope-in:** EDGE-02 only. Question→Answer edge labels.
**Scope-out:** Phase 49 (loop exit edges), Phase 51 (snippet picker), Phase 52 (placeholders), Node-Editor inline warnings beyond a single Russian help line, vault-wide migration of legacy canvases.

</domain>

<decisions>
## Implementation Decisions

### Detector — how plugin notices canvas-side edge label edits
- **D-01:** Subscribe to `app.vault.on('modify', file)` for `.canvas` files via `registerEvent` from a long-lived owner (RadiProtocolPlugin or a dedicated `EdgeLabelSyncService`). On every modify event for a `.canvas`, run a debounced reconcile pass.
- **D-02:** The reconcile pass: read canvas JSON (Pattern B `canvasLiveEditor.getCanvasJSON()` if open, else `vault.read()`), parse with `CanvasParser`, walk every Question→Answer edge, compare `edge.label` (trimmed semantics per Phase 49 D-05 rule reused here — whitespace ≡ unlabeled) against the target Answer node's `displayLabel`. If a divergence is found, run the edge-wins propagation (D-04).
- **D-03:** Reconcile runs on every canvas at the moment its `.canvas` file fires `modify`. No vault-wide sweep; no startup scan; no polling.

### Conflict resolution — bi-directional sync rule
- **D-04 (Edge-wins):** When `edge.label !== Answer.displayLabel` for any incoming Question→Answer edge of a given Answer:
  1. Pick the **first non-empty** incoming edge label (deterministic order — same order returned by `reverseAdjacency.get(answerId)`).
  2. If all incoming edges are empty → see D-08 (clearing semantics).
  3. Set `Answer.displayLabel` to that picked label (trimmed per Phase 49 D-05).
  4. Re-sync **every other** incoming edge of the same Answer to the picked label (so siblings stay consistent).
- **D-05:** D-04 applies uniformly: cold-open of legacy canvases, mid-session canvas modifies, and new-edge creation events. There is **no** "first parse" vs "live edit" distinction — the same `edge-wins` rule covers both.
- **D-06:** When Node Editor's Display label field is edited, the write path is the inverse: `displayLabel` → propagate to every incoming edge. `editor-panel-view.ts:448` (`pendingEdits['radiprotocol_displayLabel'] = v || undefined`) stays as-is for the node write; the Answer-side handler additionally collects every incoming edge id (via `ProtocolGraph.reverseAdjacency`) and submits an edge-batch to the same Pattern B / Strategy A fork.

### Loop guard — preventing infinite reconcile cycles
- **D-07:** **Idempotency via content-diff.** The reconciler's first step is a scan that produces a list of `(edgeId, currentLabel, targetLabel)` mismatches. If the list is empty, the reconciler returns immediately with no writes. Therefore when the plugin's own write (Pattern B or Strategy A) lands on disk and triggers a follow-up `modify` event, the next reconciler pass finds diff = ∅ and self-terminates after one re-entry. **No mutable suppress flags, no in-flight counters.**

### Empty / clearing semantics
- **D-08 (Display label cleared in Node Editor):** When the user clears Display label to empty / whitespace, `radiprotocol_displayLabel` is removed (`undefined`, mirroring `editor-panel-view.ts:448` `v || undefined`). The reconciler **strips the `label` JSON key** from every incoming Question→Answer edge — symmetric to the existing canvas-parser normalisation at `canvas-parser.ts:207-209` (undefined ≡ key-absent). Canvas re-renders edges without a label ribbon. No fallback to `answerText` — that would break the single-source-of-truth invariant.
- **D-09 (Edge label cleared on canvas):** When the user clears any incoming edge's label to empty / whitespace, the same edge-wins rule (D-04) reads the diff, treats whitespace as unlabeled (Phase 49 D-05 reused), then symmetrically sets `Answer.displayLabel = undefined` and clears the `label` key on every other incoming edge. Edge-wins works in both directions: setting and clearing.

### Multi-incoming Answer
- **D-10:** Trade-off (all incoming edges share one label) is enforced by D-04's "re-sync every other incoming edge" step. No Notice, no inline Node Editor warning. **Document the constraint via a code comment** at the reconciler entry point AND at `editor-panel-view.ts:443` near the Display label Setting block, citing `.planning/notes/answer-label-edge-sync.md` so future maintainers see the design rationale.

### New edge creation
- **D-11:** No special-case logic. A newly created Question→Answer edge with a label is just another `(edgeId, currentLabel, targetLabel)` mismatch the reconciler picks up via D-04 — covered automatically. The "new edge with label seeds `displayLabel` if empty" behaviour described in `.planning/notes/answer-label-edge-sync.md` falls out of the edge-wins rule when `Answer.displayLabel` was previously empty: the new edge is the first non-empty incoming edge → its label seeds `displayLabel`.

### Pattern B vs Strategy A — write paths
- **D-12 (Extend CanvasLiveEditor for edges):** Add `saveLiveEdges(filePath, edgeEdits)` to `src/canvas/canvas-live-editor.ts`. Same `getData → mutate → setData → debouncedRequestSave` pattern already used by `saveLive` and `saveLiveBatch`. `edgeEdits` shape: `Array<{ edgeId: string; label: string | undefined }>`. `undefined` ≡ delete the `label` key from the edge JSON object. Same rollback-on-throw semantics as `saveLive` (line 124-132).
- **D-13 (Strategy A for edges):** When Pattern B returns false (canvas closed), Strategy A path mutates the parsed `canvasData.edges[]` array in `vault.modify()` flow. New helper colocated with `saveNodeEdits` in `editor-panel-view.ts` OR factored out alongside the parser — Claude's Discretion. Same protected-fields and undefined-deletes-key semantics as the existing node path (`editor-panel-view.ts:258-265`).
- **D-14 (Atomicity of node + edge write from Node Editor):** When Display label is edited, the Answer node's `radiprotocol_displayLabel` AND the labels on every incoming edge must end up in the same disk write. Use `saveLiveBatch` for Pattern B (atomic `setData`) extended to accept edge edits in the same call (matches the WR-01 lesson cited in `canvas-live-editor.ts:148-205`). For Strategy A, both happen inside one `vault.modify()` call. **Never** ship the node update and edge updates as two separate writes — that re-creates the WR-01 race.
- **D-15 (Canvas-internal typings):** Lift `CanvasData.edges` from `unknown[]` (current `src/types/canvas-internal.d.ts:20`) to a typed `CanvasEdgeData[]` with `id: string`, `fromNode: string`, `toNode: string`, `label?: string`, plus index signature for forward-compat. Mirrors `CanvasNodeData`. This is the prerequisite that unlocks D-12.

### Canonical refs
- **D-16:** No new ADRs. The single design source is `.planning/notes/answer-label-edge-sync.md` (already exists). Add it to `<canonical_refs>`. Code comments at the reconciler entry + Node Editor field (D-10) cite this note.

### Test surface
- **D-17:** Test fixtures already exercise `radiprotocol_displayLabel`: `branching.canvas`, `cycle.canvas`, `linear.canvas`, `snippet-block.canvas`, `text-block.canvas`, `two-questions.canvas`. Add a new fixture (or extend `branching.canvas`) covering the multi-incoming case so D-04's "re-sync siblings" rule is asserted. Add a fixture covering "edge.label ≠ displayLabel" cold-open so D-04/D-05 reconcile is covered. **Do not** alter Phase 49's `unified-loop-*` fixtures.
- **D-18:** Reconciler unit tests are pure — feed in a `ProtocolGraph` + a list of "Question→Answer" edges, assert the diff list, do not exercise vault.modify. The disk-write side is covered through existing `canvas-write-back.test.ts` patterns (extended for edges).

### Claude's Discretion
- Exact module organisation: whether the reconciler lives in `src/graph/edge-label-reconciler.ts`, `src/canvas/edge-label-sync.ts`, or as a method on `CanvasLiveEditor` / `RadiProtocolPlugin`. One implementation, single owner.
- Debounce delay for the modify→reconcile loop. Default to 250ms unless profiling shows thrash; must NOT exceed Obsidian's own 500ms canvas requestSave debounce so user keystrokes feel responsive.
- Whether to surface a single console.warn when reconcile rewrites edges on cold-open (debug-only telemetry, not user-facing).
- Whether D-13's Strategy A edge-write helper goes inside `editor-panel-view.ts` next to `saveNodeEdits` or in a new shared util consumed by both Node Editor and the modify-event reconciler.
- Test file naming for the new fixtures (`branching-multi-incoming.canvas`, `displayLabel-edge-mismatch.canvas`, etc.).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 50 scope / convention
- `.planning/notes/answer-label-edge-sync.md` — the bi-directional sync rule, multi-incoming trade-off, motivation. **Single design source.**
- `.planning/ROADMAP.md` §Phase 50 — Goal, Depends on, Success Criteria 1-3.
- `.planning/REQUIREMENTS.md` EDGE-02 + Out-of-Scope row 1 — locks "no per-edge override".
- `.planning/STATE.md` §v1.8 Design Decisions item 2 — Answer.displayLabel ↔ edge label bi-directional sync.

### Current code touchpoints
- `src/graph/graph-model.ts:38-43` — `AnswerNode.displayLabel` (optional). Phase 50 keeps it optional; clearing collapses to `undefined`.
- `src/graph/canvas-parser.ts:202-215` — Answer parser arm. `displayLabel` already normalised to `undefined` when JSON key absent.
- `src/graph/canvas-parser.ts:103-127` — edge parsing; `RPEdge.label` is `string | undefined`.
- `src/views/editor-panel-view.ts:443-451` — Display label form Setting + auto-save handler. Edits land via `pendingEdits['radiprotocol_displayLabel']`.
- `src/views/editor-panel-view.ts:165-274` — `saveNodeEdits` Pattern B / Strategy A fork (the model the new edge writers follow).
- `src/canvas/canvas-live-editor.ts:75-205` — `saveLive` and `saveLiveBatch`; D-12's `saveLiveEdges` extends this file with the same shape.
- `src/types/canvas-internal.d.ts:18-21` — `CanvasData.edges: unknown[]` — must be typed (D-15) before D-12 can ship.
- `src/graph/node-label.ts:22` — `nodeLabel()` for Answer returns `displayLabel ?? answerText`. Stays unchanged: empty-displayLabel still falls back to answerText for *runner display purposes*, but **NOT** for edge label propagation (D-08 / D-09 are explicit: empty displayLabel ≡ no edge label).

### Test surface
- `src/__tests__/canvas-write-back.test.ts:145-156` — existing `radiprotocol_displayLabel` write coverage; extend with edge-label round-trips.
- `src/__tests__/canvas-parser.test.ts` — extend with multi-incoming + label-mismatch fixtures.
- `src/__tests__/fixtures/branching.canvas` / `cycle.canvas` / `linear.canvas` / `two-questions.canvas` — current `radiprotocol_displayLabel` carriers; new fixtures co-locate here per `<code_context>` Established Patterns.

### Standing pitfalls touching Phase 50
- STATE.md Standing Pitfall #1 (no `vault.modify()` while canvas open) — Pattern B path (D-12) is the answer. Strategy A path is the closed-canvas fallback (D-13).
- STATE.md Standing Pitfall #2 (`vault.modify()` race) — D-14's atomic batched write avoids this for the node+edge combined save. WriteMutex usage applies if Strategy A edge-write becomes a separate path; prefer single-modify call instead.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CanvasLiveEditor.saveLive` / `saveLiveBatch` (src/canvas/canvas-live-editor.ts:75-205) — Pattern B template. New `saveLiveEdges` (D-12) is a near-copy targeting `data.edges` instead of `data.nodes`.
- `ProtocolGraph.reverseAdjacency` (src/graph/graph-model.ts:130) — gives "incoming nodes for X" in O(1); reconciler enumerates incoming edges via this map cross-checked against `edges[]`.
- `CanvasParser` (src/graph/canvas-parser.ts) — pure module, zero Obsidian deps; reused by reconciler to deserialise vault.read() result.
- `editor-panel-view.ts:165-274` — full Pattern B → Strategy A fallback boilerplate that the edge writers mirror.
- `nodeLabel()` shared util (src/graph/node-label.ts, Phase 49 D-13) — already factored; do NOT reshape it.

### Established Patterns
- Test fixtures are hand-authored `.canvas` JSON under `src/__tests__/fixtures/`; new D-17 fixtures continue the pattern.
- Empty/missing-key normalisation: `undefined` is the canonical "no value" representation throughout the parser. Edge label clearing (D-08) follows this pattern by deleting the `label` key.
- `registerEvent` is the standard for vault subscriptions (`runner-view.ts:200`, `snippet-manager-view.ts:135`); D-01's modify-listener registers the same way for auto-detach.
- WriteMutex (src/utils/write-mutex.ts) — used for snippet-file writes; Phase 50 prefers single-modify atomicity (D-14) over per-write mutex.

### Integration Points
- Node Editor Display label field (`editor-panel-view.ts:443-451`) — call site for outbound sync (Answer → edges).
- vault.on('modify') subscription owned by RadiProtocolPlugin or a dedicated EdgeLabelSyncService — call site for inbound sync (canvas → Answer).
- `CanvasLiveEditor.saveLiveEdges` (new) — single Pattern B write entry-point shared by both directions.

</code_context>

<specifics>
## Specific Ideas

- The bi-directional rule should "feel like a single field viewed from two angles" — user clicks edge label in canvas, types, sees Display label in Node Editor follow; or types Display label, sees the canvas edge ribbon update. No timing surprises.
- Strategy A edge-clear must use `undefined` to remove the `label` JSON key (same shape as canvas without a labeled edge), not `label: ""` — consistency with how Obsidian itself omits the field on un-labeled edges.

</specifics>

<deferred>
## Deferred Ideas

- Per-edge label override on multi-incoming Answer nodes — explicitly out of scope per REQUIREMENTS Out-of-Scope row 1; user has no current multi-incoming topologies. Revisit if multi-incoming workflow appears.
- Inline Node Editor warning when reconciler detects a multi-incoming Answer (D-10 chose code-comment only).
- Notice/toast on cold-open reconcile rewrites — debug-only console.warn instead (Claude's Discretion in D-decisions).
- Vault-wide one-shot migration sweep on plugin load — not needed; per-canvas modify-driven reconcile (D-03) covers organic re-saves.
- Undo/redo of bi-directional sync — Obsidian Canvas owns its own undo stack for direct canvas edits; Node Editor's auto-save flow already does not enroll in canvas undo. Out of scope for Phase 50.
- Telemetry / opt-in metric of how often reconcile fires.

</deferred>

---

*Phase: 50-answer-edge-label-sync*
*Context gathered: 2026-04-19*
