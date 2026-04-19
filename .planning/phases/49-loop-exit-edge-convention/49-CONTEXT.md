# Phase 49: Loop Exit Edge Convention - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the v1.7 exit discriminator (literal `label === 'выход'`) with a label-based convention:

- **Exit edge** = the sole outgoing edge of a `loop` node whose `label` is non-empty (after trim). The label's text becomes the caption of the exit button in Protocol Runner verbatim.
- **Body edges** = all unlabeled outgoing edges. Runner iteration over body branches is unchanged.
- **Validator** (GraphValidator) rejects a loop node with 0 labeled outgoing edges, ≥2 labeled outgoing edges, or 0 unlabeled outgoing edges, with plain-Russian error messages that name the offending node and, for the ≥2 case, list the offending edge ids.
- **No auto-migration.** Canvases that happened to use «выход» under v1.7 keep working because «выход» is still a valid label for the sole labeled edge.

Phase 49 touches `GraphValidator`, `ProtocolRunner` dispatch, and `RunnerView` loop picker. Node Editor is **not** touched.

</domain>

<decisions>
## Implementation Decisions

### Validator Error Copy (Russian)
- **D-01:** Zero labeled edges — error text: `Loop-узел "{label}" не имеет выхода. Пометьте ровно одно исходящее ребро — его метка станет подписью кнопки выхода.`
- **D-02:** Two or more labeled edges — error text: `Loop-узел "{label}" имеет несколько помеченных исходящих рёбер: {edgeIds}. Должно быть ровно одно выходное ребро — снимите метки с остальных.` `{edgeIds}` is a comma-joined list of offending edge ids (same shape as current graph-validator.ts:112).
- **D-03:** Zero body edges — error text: `Loop-узел "{label}" не имеет тела — добавьте исходящее ребро без метки.` Reuses the existing D-08.3 invariant (see D-09 below) with updated wording for the new semantics.
- **D-04:** `{label}` placeholder resolves via the existing `nodeLabel()` helper in `graph-validator.ts:243-248` (loop → `headerText || node.id`). Keep the current style of quoting the label in the message.

### Label Semantics
- **D-05:** "Labeled edge" means `edge.label != null && edge.label.trim() !== ''`. Whitespace-only labels are considered unlabeled. This rule is used consistently by:
  - `GraphValidator` when counting labeled vs body edges
  - `ProtocolRunner` / `RunnerView` when identifying the exit edge at runtime
  - Any helper exposed to runner-view for CSS-class / caption selection
- **D-06:** Runner exit button caption uses the **trimmed** label value (so `'выход '` renders as `'выход'`). Validator enforces that trim produces a non-empty string, so the Runner never has to fall back to a placeholder for the exit button.

### Exit Edge Detection in Runner Runtime
- **D-07:** Introduce a helper — e.g. `isExitEdge(edge, graph)` or `findExitEdge(loopNode, graph)` — that returns / identifies the sole outgoing edge of the loop node whose label is non-empty (per D-05).
  - **No caching / precomputation** on `LoopContext` — keep Runner state shape unchanged (undo/redo snapshots and session persistence stay as-is).
  - **No `isExit` discriminant** on the edge model — keep `GraphEdge` schema unchanged.
  - The helper is safe because `GraphValidator` guarantees uniqueness of the labeled edge before the Runner starts.
- **D-08:** Call sites to update:
  - `src/runner/protocol-runner.ts:194` — replace `edge.label === 'выход'` with the new helper in `chooseLoopBranch`'s dispatch (pop vs body branch walk).
  - `src/views/runner-view.ts:484` — replace `isExit = edge.label === 'выход'` with the new helper for CSS class selection (`rp-loop-exit-btn` vs `rp-loop-body-btn`). Keep class names as-is.
  - Anywhere else that pattern-matches `'выход'` as a literal (audit during plan).

### Body Edge Invariant (D-08.3 Carry-Over)
- **D-09:** Keep the existing "loop must have ≥1 body edge" check from Phase 43 D-08.3. Reformulate the filter under the new convention:
  - Old: `bodyEdges = outgoing.filter(e => e.label !== 'выход')`
  - New: `bodyEdges = outgoing.filter(e => isUnlabeled(e))` where `isUnlabeled` is the complement of D-05.
- **D-10:** The error text when 0 body edges are detected is D-03 above.

### Runner Body-Branch Button Caption
- **D-11:** When an unlabeled body edge is rendered as a button in `RunnerView`'s loop picker, the caption shows the **target node's preview** (not `(no label)` or a numbered stand-in).
- **D-12:** Preview extraction follows the same rules as `GraphValidator.nodeLabel()` in `graph-validator.ts:243-248`:
  - `question` → node body text
  - `answer` → `displayLabel || body`
  - `snippet` → folder or filename of the bound snippet target (match the shape currently surfaced by the snippet picker UI)
  - `loop` → `headerText || node.id`
  - fallback → `node.id`
- **D-13:** To avoid duplication, extract `nodeLabel()` (or equivalent) into a shared util consumable by both `graph-validator.ts` and `runner-view.ts`. Location: Claude's Discretion (e.g., `src/graph/node-label.ts`), but callers must share **one** implementation so validator error text and runner button captions stay in lock-step.
- **D-14:** No JS truncation. Long previews are handled by existing CSS (`.rp-loop-body-btn` styles in `src/styles/runner-view.css`) via `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, matching how other picker buttons already render overflow. (If the current CSS does not do this, the plan must add it as part of Phase 49.)

### Legacy Canvases / Migration
- **D-15:** **No migration pass** and no pre-scan of the vault for broken canvases. If a real v1.7 canvas had labels on body edges (i.e., a second labeled edge beyond «выход»), the D-02 error message — which lists `{edgeIds}` — is enough to let the user repair it manually.
- **D-16:** Fixtures under `src/__tests__/fixtures/unified-loop-*.canvas` that use `label: 'выход'` for the sole labeled edge continue to be valid under the new convention (D-05 treats «выход» as just another non-empty label). Fixtures that deliberately test the failure cases need to be audited / augmented as part of the test-update task:
  - `unified-loop-duplicate-exit.canvas` — still tests "≥2 labeled edges"; keep or rename for clarity (Claude's Discretion).
  - `unified-loop-no-body.canvas` — still tests the D-03 case under D-09's reformulation.
  - Add a new fixture (or extend an existing one) that covers "body edge with a stray label" → expects D-02 error.

### Node Editor / Canvas-side UX
- **D-17:** Out of scope for Phase 49. No realtime validation, no inline warning in the loop-node form. Validation remains where it is today — on save (canvas parse) and before starting a Runner session. If richer editor-side UX is wanted later, it is a separate phase.

### Claude's Discretion
- Exact module organisation for the `nodeLabel()` / `isExitEdge()` helpers (where they live, whether they are co-located or split).
- Whether to rename `unified-loop-duplicate-exit.canvas` to reflect the convention-agnostic meaning; behaviour must be preserved either way.
- Wording of JSDoc comments on the new helpers.
- Exact test structure for the new error-copy assertions, provided each of D-01/D-02/D-03 is asserted at least once against a realistic fixture.
- Whether to keep both CSS classes (`rp-loop-exit-btn` / `rp-loop-body-btn`) or collapse — **recommend keeping** so the exit button retains its visual accent.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 49 scope / convention
- `.planning/notes/loop-node-exit-edge-convention.md` — the full rule (labeled = exit, unlabeled = body), validation cases, and motivation for the convention.
- `.planning/ROADMAP.md` §Phase 49 — Goal, Depends on, Success Criteria.
- `.planning/REQUIREMENTS.md` EDGE-01 + Out-of-Scope row 3 — locks "no auto-migration".

### Current loop semantics (v1.7 baseline to replace)
- `src/graph/graph-validator.ts` §Check LOOP-04 (lines 91-124) — current D-08.1 / D-08.2 / D-08.3 checks against the literal `'выход'`. Phase 49 rewrites this check.
- `src/graph/graph-validator.ts` §`nodeLabel()` (lines 243-248) — reference implementation for the shared label helper (D-13).
- `src/runner/protocol-runner.ts` §`chooseLoopBranch` (line ~194) — dispatch uses `edge.label === 'выход'`; Phase 49 swaps to the new helper (D-08).
- `src/views/runner-view.ts` §loop picker arm (lines ~460-498) — `isExit` check + button rendering with `edge.label ?? '(no label)'`; Phase 49 rewires both.

### Test surface
- `src/__tests__/graph-validator.test.ts` — existing tests for LOOP-04; update assertions to new error copy + semantics.
- `src/__tests__/runner/protocol-runner-loop-picker.test.ts` — existing Runner loop-picker tests; verify dispatch still routes correctly through the new helper.
- `src/__tests__/fixtures/unified-loop-*.canvas` — see D-16 for per-fixture audit.

### CSS
- `src/styles/runner-view.css` §loop picker — styles for `.rp-loop-exit-btn` / `.rp-loop-body-btn` / `.rp-loop-picker-list`. Verify ellipsis handling per D-14.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GraphValidator.nodeLabel()` — already formats loop / question / answer / snippet previews. Extract into a shared util (D-13) and reuse in `runner-view.ts` for body-branch button captions.
- `GraphValidator.LOOP-04` check (graph-validator.ts:91-124) — close in shape to what Phase 49 needs; rewrite in place rather than create a parallel check.
- Existing Runner `rp-loop-exit-btn` / `rp-loop-body-btn` CSS classes — keep and drive off the new helper, not the literal `'выход'`.

### Established Patterns
- Validator emits `Error` objects whose messages are user-facing Russian strings that name the offending node via a label-or-id helper — D-01/D-02/D-03 follow this pattern verbatim.
- Runner uses runtime lookups against the `graph` object for edge-property queries (no cached per-loop state); D-07 preserves this.
- Test fixtures are hand-authored `.canvas` JSON files under `src/__tests__/fixtures/`; the test update task continues that pattern.

### Integration Points
- `GraphValidator` is called from canvas parse / save and from pre-Runner start — both call-sites automatically pick up the new error messages.
- `ProtocolRunner.chooseLoopBranch` and `RunnerView` loop arm are the only runtime consumers of the exit discriminator; both are updated in lock-step via the shared helper.

</code_context>

<specifics>
## Specific Ideas

- Error text for 0 labeled edges is worded as UX guidance ("его метка станет подписью кнопки выхода"), matching the motivation in `loop-node-exit-edge-convention.md`.
- Error text for ≥2 labeled edges keeps the current habit of listing offending edge ids (graph-validator.ts:112) so the user can locate them in Obsidian canvas.
- Runner exit button caption is the **trimmed** label verbatim; no rewriting, no decoration, no trailing whitespace (D-06).

</specifics>

<deferred>
## Deferred Ideas

- Node Editor / canvas-side realtime validation of the exit-edge invariant (warning inside the loop-node form). Belongs in a future Node Editor UX phase.
- Static help text / inline hint on the loop-node header explaining the convention. Tied to the same future Node Editor UX work.
- Automatic migration pass for v1.7 canvases with labeled body edges. User opted for manual repair via validator error. Revisit if multi-user canvases become a concern.
- Renaming test fixtures (`unified-loop-duplicate-exit.canvas` → convention-agnostic name). Cosmetic; Claude may do it inside Phase 49 under D-16 or defer.

</deferred>

---

*Phase: 49-loop-exit-edge-convention*
*Context gathered: 2026-04-19*
