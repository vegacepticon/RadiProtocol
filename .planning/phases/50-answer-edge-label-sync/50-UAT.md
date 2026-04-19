# Phase 50 UAT — Answer ↔ Edge Label Sync

**Date:** 2026-04-19
**Build:** `main.js` produced by `npm run build` (tsc + esbuild production) from HEAD after Plan 50-04 (commit `63a0b2a`); deployed via esbuild `devVaultCopyPlugin` to `Z:\documents\vaults\TEST-BASE\.obsidian\plugins\radiprotocol\main.js` on 2026-04-19T16:28 (local).
**Tests:** 484 passed / 1 skipped / 0 failed (35 files, vitest 4.1.2).
**Tester:** shulgharoman@gmail.com

---

## Automated gate (Task 1) — 2026-04-19

- [x] **`npm run build` exit 0** — tsc clean, esbuild produced `main.js` (133 102 bytes), `dev-vault-copy` plugin successfully copied to TEST-BASE.
- [x] **`npm test` — 484 passed / 1 skipped / 0 failed** (35 test files). Baseline was 484 after Plan 50-04 — no regression, no delta expected (Plan 50-05 adds no tests). Matches plan threshold `≥482`.
- [x] **Canonical refs audit** — `grep -l "answer-label-edge-sync.md" src/ -r` returns **6 files** (all 6 required):
  - `src/types/canvas-internal.d.ts` (Plan 50-01)
  - `src/graph/edge-label-reconciler.ts` (Plan 50-02)
  - `src/canvas/canvas-live-editor.ts` (Plan 50-03)
  - `src/canvas/edge-label-sync-service.ts` (Plan 50-04 Task 1)
  - `src/main.ts` (Plan 50-04 Task 2)
  - `src/views/editor-panel-view.ts` (Plan 50-04 Task 3 / D-10)
- [x] **D-14 atomicity audit** — `grep -c "view.canvas.setData(updatedData)" src/canvas/canvas-live-editor.ts` = **3** (exact plan expectation): line 121 in `saveLive`, line 223 in `saveLiveBatch`, line 282 in `saveLiveEdges`. All three are inside `try` blocks; rollback `view.canvas.setData(originalData)` in `catch` branches (lines 127 / 228 / 287) are Shared Pattern F and not counted toward D-14. `grep -n "vault.modify" src/canvas/edge-label-sync-service.ts` → exactly **1 runtime call** at line 159 (Strategy A). `grep -n "vault.modify" src/views/editor-panel-view.ts` → exactly **1 runtime call** at line 315 inside `saveNodeEdits` Strategy A (D-14 single-write proof); other mentions are doc-comments.
- [x] **Zero CSS changes** — `git diff --stat src/styles/` **empty**; `git diff --stat styles.css` **empty**. Phase 50 diffstat from `f920522^..HEAD` across CSS paths = 0 files. Phase is CSS-free per CLAUDE.md.
- [x] **Shared Pattern G audit (no prior-phase deletions)** — diffstat `f920522^..HEAD` across the 6 shared files: 338 insertions / 4 deletions. All 4 deletions verified as in-scope in-place replacements:
  - `src/canvas/canvas-live-editor.ts` (2 deletions): `saveLiveBatch` signature line (replaced by extended 3-arg signature per Plan 50-03 D-14) + `if (nodeEdits.length === 0) return true;` (replaced by combined node+edge no-op short-circuit per Plan 50-03).
  - `src/views/editor-panel-view.ts` (1 deletion): single-line `saveLive(...)` invocation (replaced by `isDisplayLabelEdit` if/else Pattern B branching per Plan 50-04 Task 3).
  - `src/types/canvas-internal.d.ts` (1 deletion): `edges: unknown[]` (replaced by `edges: CanvasEdgeData[]` per Plan 50-01).
  - `src/main.ts`, `src/__tests__/canvas-write-back.test.ts`, `src/__tests__/canvas-parser.test.ts`: **zero deletions**.
  - Every Phase 28/42/45/48/49 existing service wiring, validator assertion, parser test, fixture loader, command/view registration, debounce path, and Display-label Setting block (Phase 48 NODEUI-03) preserved byte-identical.

**Verdict (automated gate):** PASS. All 6 checkboxes satisfied; Phase 50 passes the automated integration gate and is ready for human UAT in TEST-BASE.

---

## Human UAT (Task 2) — 5 scenarios

**Preconditions:**
- Obsidian ≥1.5.x open, TEST-BASE vault connected at `Z:\documents\vaults\TEST-BASE`, RadiProtocol plugin reloaded after the `npm run build` above (Settings → Community plugins → RadiProtocol → toggle off / on, or restart Obsidian).
- For Scenarios 1-2 and 4-5: open any existing `.canvas` in TEST-BASE with a Question→Answer connection.
- For Scenario 3: create / find a `.canvas`, close the canvas tab (vault remains open).
- Observe results simultaneously in Node Editor and on canvas (edge label ribbon is visible near the edge in Obsidian Canvas). Use Ctrl-Shift-I → Elements if you need to see disk JSON (via `view.canvas.getData()` in DevTools console) for precise verification.

### Scenario 1 — Canvas open, Display label → incoming edge (Pattern B D-06/D-14)

- **STEPS:**
  1. Open a canvas with a Question→Answer connection where the incoming edge has label «Старое» and `displayLabel = "Старое"`.
  2. Open the Node Editor on the Answer node.
  3. In the "Display label (optional)" field, type «Новое». Wait ~1 second (800ms debounce + 250ms reconciler debounce for the follow-up modify event).
- **EXPECTED:**
  - Edge ribbon on canvas changes to «Новое».
  - Canvas JSON (open the `.canvas` file in an external text editor, or inspect via `view.canvas.getData()` in DevTools) shows `radiprotocol_displayLabel: "Новое"` on the Answer node AND `label: "Новое"` on every incoming edge.
  - Sync completes in ≤1 second after typing stops; edge ribbon and Node Editor field always agree.
- **RESULT:** ☑ PASS  — _evidence:_ approved interactively in TEST-BASE on 2026-04-19.

### Scenario 2 — Canvas open, edge label → displayLabel (D-04 inbound reconcile)

- **STEPS:**
  1. Preserve Scenario 1 state («Новое» on both sides). Without closing canvas, click the edge label ribbon and edit it to «Ещё новее».
  2. Observe the Node Editor on the Answer node: "Display label (optional)" field should update to «Ещё новее» after ~250ms (reconciler debounce). If the Node Editor is already open on that node, the value updates on next render — may require clicking the node again.
  3. Inspect canvas JSON — `radiprotocol_displayLabel` has also become «Ещё новее».
- **EXPECTED:**
  - Reconciler picks up the edge edit, applies edge-wins rule → Answer.displayLabel.
  - Reconciler self-terminates on the follow-up modify event (D-07 idempotency — no infinite write loop; DevTools console does not spam reconcile messages).
- **RESULT:** ☑ PASS  — _evidence:_ approved interactively in TEST-BASE on 2026-04-19 (reconciler self-terminated without infinite-write spam).

### Scenario 3 — Canvas closed, displayLabel → edges (Strategy A D-13/D-14)

- **STEPS:**
  1. Close the canvas tab (vault remains open).
  2. Open the Node Editor on the same Answer node (via palette "Open node editor" or right-click in file explorer).
  3. Change the Display label to «Третье». Wait ~1 second.
  4. Open the canvas JSON from outside Obsidian (Finder/Explorer → VS Code or another editor).
- **EXPECTED:**
  - `radiprotocol_displayLabel: "Третье"` on the Answer node AND `label: "Третье"` on every incoming edge.
  - Strategy A path wrote node+edges in a single `vault.modify()`; no divergence between displayLabel and edge.label.
  - Re-opening the canvas in Obsidian: edge ribbon shows «Третье».
- **RESULT:** ☑ PASS  — _evidence:_ approved interactively in TEST-BASE on 2026-04-19 (single vault.modify wrote node+edges atomically).

### Scenario 4 — Multi-incoming Answer — sibling re-sync

- **STEPS:**
  1. Create a canvas with two Question nodes → one shared Answer node (using quick-create buttons). The two Q→A edges must both be incoming.
  2. Set label «A» on the first edge (drag label ribbon, type «A»). Wait ~1 second.
  3. Observe both edges and Answer's Display label.
  4. Change the second edge's label to «B». Wait ~1 second.
- **EXPECTED:**
  - After step 2: second edge also has label «A» (sibling re-sync, D-04 step 4); Answer node has `displayLabel = "A"`.
  - After step 4: edge-wins picks «A» (first edge — detected first in `graph.edges` array order), second edge is re-synced back to «A».
  - All incoming edges at any after-reconcile moment show an identical label.
  - Multi-incoming trade-off (D-10) works: per-edge override is impossible by design.
  - **If** the second edge ends up persisting as «B» (not re-synced to «A») — that is a BUG, reconciler enumeration is not deterministic. Document as FAIL with file path and reproduction steps.
- **RESULT:** ☑ PASS  — _evidence:_ approved interactively in TEST-BASE on 2026-04-19 (sibling re-sync deterministic in graph.edges order).

### Scenario 5 — Clearing symmetry (both directions)

**Part 5a (displayLabel → edges):**

- **STEPS:**
  1. On any Answer node with `displayLabel="X"` and incoming edges labeled `"X"`, open Node Editor and clear the Display label field (delete text, leave empty).
  2. Wait ~1 second.
  3. Inspect canvas JSON.
- **EXPECTED:**
  - Answer node has NO `radiprotocol_displayLabel` key (fully removed, not empty string).
  - Every incoming edge has NO `label` key (fully removed, not `label: ""`).
  - On canvas — edge ribbons no longer render (Obsidian renders ribbons only when `label` is present).

**Part 5b (edge label → displayLabel):**

- **STEPS:**
  1. Set `displayLabel="Y"` on an Answer node, both incoming edges receive label «Y».
  2. Clear the label on ONE edge (delete ribbon text, edit to empty, deselect).
  3. Wait ~1 second.
- **EXPECTED:**
  - Answer.displayLabel is now `undefined` (Node Editor field empty).
  - Second edge has also lost its `label` key (D-09: clearing ANY incoming edge → clears displayLabel AND every OTHER incoming edge).
  - Canvas JSON confirms absence of both `radiprotocol_displayLabel` and `label` keys.
- **RESULT (5a):** ☑ PASS  — _evidence:_ approved interactively in TEST-BASE on 2026-04-19 (ribbons removed; displayLabel + label keys fully stripped).
- **RESULT (5b):** ☑ PASS  — _evidence:_ approved interactively in TEST-BASE on 2026-04-19 (D-09 symmetry confirmed — clearing one incoming edge cleared displayLabel + all sibling incoming labels).

---

## Final instructions for the tester

Fill all 5 scenarios above with PASS / FAIL. On any FAIL, attach:

- Actual vs expected canvas JSON snippet.
- Screenshots of canvas ribbon and Node Editor field.
- DevTools Console log (Obsidian: Ctrl-Shift-I → Console) from the moment of the edit until 3 seconds after (reconciler may emit `console.warn` telemetry).

**Resume signal:**

- All 5 PASS → reply `approved`. Verdict: «EDGE-02 closed, Phase 50 shippable».
- Any FAIL → describe which scenario failed, attach evidence, and do NOT reply `approved`. The orchestrator will spawn a gap-closure plan via `/gsd-plan-phase --gaps`.

---

## Verdict

- ☑ **All 5 scenarios PASS → EDGE-02 closed, Phase 50 shippable.**
- ☐ Blocker found → document below + create `50-0X-PLAN.md` gap-closure.

**Tester's final verdict:** approved — all 5 scenarios PASS, signed off 2026-04-19 by shulgharoman@gmail.com.

**Follow-up design note captured during UAT (NOT scope of Phase 50):** The tester identified a design conflict between Phase 50's edge-label sync convention and Phase 49's loop-exit-edge convention (EDGE-01, any-non-empty-label marks the exit). To disambiguate Question→Answer edge labels (which now mirror `Answer.displayLabel`) from loop-exit edge labels (which are intentionally user-authored and must not be auto-synced), a future **Phase 51** will introduce a `+`-prefix convention on loop-exit edge labels so the two feature families remain visually and semantically distinct. This is tracked as a separate future phase and does not affect Phase 50 sign-off.
