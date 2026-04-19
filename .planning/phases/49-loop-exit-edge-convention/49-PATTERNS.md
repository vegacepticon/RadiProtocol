# Phase 49: Loop Exit Edge Convention — Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 8 (modify) + 2 (create) = 10
**Analogs found:** 10 / 10

All files to be touched in this phase have clear in-repo analogs (often the file itself, since Phase 49 is a surgical rewrite of existing code sites). No external research patterns are needed — every pattern below is grounded in a concrete current excerpt.

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `src/graph/graph-validator.ts` | validator | request-response (pure fn) | self (lines 91-124, 238-249) | exact — in-place rewrite |
| `src/runner/protocol-runner.ts` | runtime-dispatch | event-driven (user pick) | self (line 194 in `chooseLoopBranch`) | exact — one-line swap |
| `src/views/runner-view.ts` | view | event-driven (render + click) | self (lines 460-514, `awaiting-loop-pick` arm) | exact — two substitutions |
| `src/styles/runner-view.css` | css | n/a | **`src/styles/loop-support.css`** (owns `.rp-loop-body-btn` / `.rp-loop-exit-btn`) | exact — CSS actually lives in `loop-support.css`, **not** in `runner-view.css` — see Shared Patterns §CSS file routing |
| `src/__tests__/graph-validator.test.ts` | test | n/a | self (lines 197-309, LOOP-04 block) | exact — copy-diff assertions |
| `src/__tests__/runner/protocol-runner-loop-picker.test.ts` | test | n/a | self (lines 59-90, RUN-03 / RUN-04) | exact — dispatch regression guard |
| `src/__tests__/fixtures/unified-loop-duplicate-exit.canvas` | fixture | n/a | self (valid under new D-02 semantics) | exact — reused as-is or renamed |
| `src/__tests__/fixtures/unified-loop-no-body.canvas` | fixture | n/a | self (valid under new D-03 semantics) | exact — reused as-is |
| **CREATE** `src/graph/node-label.ts` (or similar) | shared-util | pure fn | `src/graph/graph-validator.ts` `nodeLabel()` lines 238-249 + `isExit`/filter patterns at 99-100 | exact — extract + promote |
| **CREATE** `src/__tests__/fixtures/unified-loop-stray-body-label.canvas` (or extend existing) | fixture | n/a | `unified-loop-duplicate-exit.canvas` (same author style) | exact — sibling fixture |

---

## Pattern Assignments

### `src/graph/graph-validator.ts` — validator (rewrite LOOP-04 in place)

**Analog:** self, same method.

**Current LOOP-04 check** (lines 91-124) — this is the code being **replaced**. Planner needs both the old and the new so acceptance criteria can be written as a diff:

```typescript
// Check (LOOP-04): каждый unified loop-узел должен иметь
//  1) ровно одно исходящее ребро с label === 'выход' (Phase 43 D-08.1)
//  2) не более одного ребра «выход» (Phase 43 D-08.2) — дубликаты флагаем отдельно
//  3) минимум одно body-ребро (label !== 'выход') (Phase 43 D-08.3)
// «выход» — exact-match, case-sensitive, без trim. Контракт с автором.
for (const [id, node] of graph.nodes) {
  if (node.kind !== 'loop') continue;
  const outgoing = graph.edges.filter(e => e.fromNodeId === id);
  const exitEdges = outgoing.filter(e => e.label === 'выход');
  const bodyEdges = outgoing.filter(e => e.label !== 'выход');
  const label = this.nodeLabel(node);
  // D-08.1 — missing «выход»
  if (exitEdges.length === 0) {
    errors.push(
      `Loop node "${label}" не имеет ребра «выход». ` +
      `Добавьте исходящее ребро с меткой «выход», обозначающее ветвь выхода из цикла.`
    );
  }
  // D-08.2 — duplicate «выход»
  if (exitEdges.length > 1) {
    const dupIds = exitEdges.map(e => e.id).join(', ');
    errors.push(
      `Loop node "${label}" имеет несколько рёбер «выход»: ${dupIds}. ` +
      `Должно быть ровно одно исходящее ребро с меткой «выход».`
    );
  }
  // D-08.3 — no body
  if (bodyEdges.length === 0) {
    errors.push(
      `Loop node "${label}" не имеет ни одной body-ветви. ` +
      `Добавьте хотя бы одно исходящее ребро с меткой, отличной от «выход».`
    );
  }
}
```

**Required rewrite shape** (per CONTEXT D-01 / D-02 / D-03 / D-05):

- `exitEdges = outgoing.filter(e => isLabeledEdge(e))` where `isLabeledEdge(e)` = `e.label != null && e.label.trim() !== ''` (D-05).
- `bodyEdges = outgoing.filter(e => !isLabeledEdge(e))` (D-09).
- Error text for 0 labeled: `Loop-узел "{label}" не имеет выхода. Пометьте ровно одно исходящее ребро — его метка станет подписью кнопки выхода.` (D-01).
- Error text for ≥2 labeled: `Loop-узел "{label}" имеет несколько помеченных исходящих рёбер: {edgeIds}. Должно быть ровно одно выходное ребро — снимите метки с остальных.` (D-02).
- Error text for 0 body: `Loop-узел "{label}" не имеет тела — добавьте исходящее ребро без метки.` (D-03).
- `{label}` still produced via the shared `nodeLabel()` helper (D-04 / D-13).
- `{edgeIds}` formatted as `exitEdges.map(e => e.id).join(', ')` — same shape as current line 111 (specified in D-02).

**Adjacent code to leave alone** (CLAUDE.md "Never remove code you didn't add"):

- Legacy loop-start/loop-end migration check (lines 36-52) — unchanged, still returns early before LOOP-04.
- `detectUnintentionalCycles` (lines 172-233) — Phase 43 D-09 logic, untouched.
- Dead-end question check (lines 79-89) — untouched.
- BFS reachability (lines 54-71, 145-164) — untouched.
- `nodeLabel()` (lines 238-249) — **stays here as a delegating wrapper** after extraction, or becomes a re-export; see Shared Patterns §Shared `nodeLabel()`.

**Also purge literal-`'выход'` references in comments** (lines 48, 92-95): the migration-error message at line 48 still says `метка «выход»` — under the new convention it should say `произвольная метка` or equivalent. Planner must decide whether to touch this or leave it (migration error is a one-shot legacy string; safe to leave OR safe to neutralise).

---

### `src/runner/protocol-runner.ts` — runtime-dispatch (one-line swap at line 194)

**Analog:** self, `chooseLoopBranch` method.

**Current dispatch** (lines 175-211):

```typescript
chooseLoopBranch(edgeId: string): void {
  if (this.runnerStatus !== 'awaiting-loop-pick') return;
  if (this.graph === null || this.currentNodeId === null) return;

  const edge = this.graph.edges.find(e => e.id === edgeId);
  if (edge === undefined || edge.fromNodeId !== this.currentNodeId) {
    this.transitionToError(
      `Loop picker edge '${edgeId}' not found or does not originate at current loop node.`,
    );
    return;
  }

  // Undo-before-mutate (Pitfall 1)
  this.undoStack.push({
    nodeId: this.currentNodeId,
    textSnapshot: this.accumulator.snapshot(),
    loopContextStack: [...this.loopContextStack],
  });

  if (edge.label === 'выход') {            // ← line 194, REPLACE with isExitEdge(edge)
    // RUN-03: pop frame (top-of-stack, nested-safe)
    this.loopContextStack.pop();
  }
  // ...
  this.runnerStatus = 'at-node';
  this.advanceThrough(edge.toNodeId);
}
```

**Required swap** (D-08):

```typescript
if (isExitEdge(edge)) {    // import from shared util — D-05 semantics (labeled & non-empty after trim)
  this.loopContextStack.pop();
}
```

**Comment update candidates** (non-blocking but aligned with convention):

- Line 167: `*   - 'выход'  → pop the current loop frame, advance along the exit edge` → `*   - labeled edge → pop the current loop frame, advance along the exit edge`
- Line 200: `// re-entry AND on inner-«выход» landing on outer)` → `// re-entry AND on inner-exit landing on outer)`
- Line 313, 580: similar stale references.

Planner should mark these as "comment hygiene, non-blocking" so executors don't silently delete adjacent unrelated comments (CLAUDE.md "Never remove code you didn't add").

**Adjacent code to leave alone:**

- `undoStack.push` block (lines 188-192) — Pitfall 1, do not reorder.
- Body-branch iteration rationale comment (lines 199-208) — non-trivial invariant, verbatim preserve.
- `stepBack` (lines 213+) — untouched.

---

### `src/views/runner-view.ts` — view (two substitutions in `awaiting-loop-pick` arm)

**Analog:** self, lines 460-514.

**Current render** (lines 479-496):

```typescript
// RUN-01: one button per outgoing edge (Pitfall 4 — filter edges, not adjacency).
const outgoing = this.graph.edges.filter(e => e.fromNodeId === state.nodeId);
const list = questionZone.createDiv({ cls: 'rp-loop-picker-list' });
for (const edge of outgoing) {
  const label = edge.label ?? '(no label)';                      // ← REPLACE caption for body edges (D-11/D-12)
  const isExit = edge.label === 'выход'; // exact-match contract — Phase 43 D-08    // ← REPLACE (D-08)
  const btn = list.createEl('button', {
    cls: isExit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
    text: label,
  });
  this.registerDomEvent(btn, 'click', () => {
    this.capturePendingTextareaScroll();  // RUNFIX-02: preserve scroll across re-render
    this.runner.syncManualEdit(this.previewTextarea?.value ?? '');  // Pitfall 7
    this.runner.chooseLoopBranch(edge.id);                          // per locked decision: edge.id
    void this.autoSaveSession();
    void this.renderAsync();
  });
}
```

**Required rewrite shape** (D-06 / D-08 / D-11 / D-12):

```typescript
for (const edge of outgoing) {
  const exit = isExitEdge(edge);                        // D-08: shared helper, not literal
  let caption: string;
  if (exit) {
    caption = (edge.label ?? '').trim();                // D-06: trimmed label verbatim
  } else {
    // D-11 / D-12: body-button caption is the target node's preview, using the same
    // label-extraction rules as GraphValidator.nodeLabel() (now shared via the util).
    const target = this.graph.nodes.get(edge.toNodeId);
    caption = target !== undefined ? nodeLabel(target) : edge.toNodeId;
  }
  const btn = list.createEl('button', {
    cls: exit ? 'rp-loop-exit-btn' : 'rp-loop-body-btn',
    text: caption,
  });
  this.registerDomEvent(btn, 'click', () => { /* unchanged */ });
}
```

**Adjacent code to leave alone:**

- `questionZone.createEl('p', { text: node.headerText, cls: 'rp-loop-header-text' })` (lines 472-476) — Phase 44 RUN-01, untouched.
- `renderPreviewZone` / `renderOutputToolbar` calls (lines 511-512) — untouched.
- Step-back button (lines 499-509) — untouched.
- `capturePendingTextareaScroll` / `syncManualEdit` / `autoSaveSession` / `renderAsync` ordering in click handler — load-bearing (RUNFIX-02, Pitfall 7); DO NOT reorder.
- Other switch arms (`awaiting-snippet-pick`, `awaiting-snippet-fill`, etc.) — untouched.

---

### `src/styles/runner-view.css` (actually `src/styles/loop-support.css`) — css (D-14 audit)

**IMPORTANT CORRECTION:** The CONTEXT.md references `src/styles/runner-view.css §loop picker`, but the canonical location of `.rp-loop-body-btn` / `.rp-loop-exit-btn` / `.rp-loop-picker-list` / `.rp-loop-header-text` in this repo is **`src/styles/loop-support.css`** (per CLAUDE.md's per-feature CSS routing table: "loop-support.css → Loop iteration UI"). Planner must route all Phase 49 CSS edits to `loop-support.css`, not to `runner-view.css`, per CLAUDE.md's strict per-feature rule ("Do NOT add CSS to an unrelated feature file").

**Analog:** `src/styles/loop-support.css` lines 56-111 (Phase 44 + Phase 47 rules).

**Current rules** (lines 47-111 of `loop-support.css`):

```css
/* Phase 44: Unified loop picker (RUN-01) ────────────────────────────────── */

.rp-loop-header-text {
  font-size: var(--font-ui-medium);
  font-weight: var(--font-semibold);
  color: var(--text-normal);
  margin-bottom: var(--size-2-3);
}

.rp-loop-picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--size-2-2);
  margin-top: var(--size-2-3);
}

.rp-loop-body-btn,
.rp-loop-exit-btn {
  text-align: left;
  padding: var(--size-2-3) var(--size-4-2);
  border-radius: var(--radius-s);
  border: none;
  cursor: pointer;
  font-size: var(--font-ui-small);
}

.rp-loop-body-btn { background: var(--interactive-accent); color: var(--text-on-accent); }
.rp-loop-body-btn:hover { background: var(--interactive-accent-hover); }
.rp-loop-exit-btn { background: var(--background-modifier-border); color: var(--text-normal); }
.rp-loop-exit-btn:hover { background: var(--background-modifier-border-hover, var(--background-modifier-border)); opacity: 0.9; }

/* Phase 47: RUNFIX-03 — loop picker button typography + narrow-sidebar overflow ... */
.rp-loop-body-btn,
.rp-loop-exit-btn {
  height: auto;
  align-items: flex-start;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: var(--size-4-2) var(--size-4-4);
  line-height: 1.55;
  min-height: 44px;
  white-space: normal;           /* ← CURRENT — NOT nowrap */
  word-break: break-word;        /* ← CURRENT — wraps, does not truncate */
  overflow-wrap: anywhere;       /* ← CURRENT — wraps, does not truncate */
  max-width: 100%;
}
```

**D-14 conflict to flag in the plan:**

Phase 47 explicitly set `white-space: normal; word-break: break-word; overflow-wrap: anywhere` to **wrap** Cyrillic long-body labels in a narrow sidebar (see inline comment lines 92-96: *"Do NOT compress further without testing Cyrillic descenders in a narrow sidebar"*).

CONTEXT D-14 calls for `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. These two approaches are **mutually exclusive**:

| Approach | Long-body behaviour |
|---|---|
| Phase 47 (current) | Multi-line wrap; button grows vertically |
| D-14 (requested) | Single line, clipped with `…` ellipsis |

**Plan must pick one and document the regression surface** (Phase 47 tested Cyrillic descenders; switching to `nowrap + ellipsis` could hide information). Recommended path per CLAUDE.md append-only rule: add a new Phase 49 block at the bottom of `loop-support.css` that overrides the Phase 47 rule set on `.rp-loop-body-btn` only (exit button may retain its own handling). Example append:

```css
/* Phase 49: body-button single-line ellipsis (D-14) */
.rp-loop-body-btn {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: normal;
  overflow-wrap: normal;
}
```

Do **not** rewrite the Phase 44 or Phase 47 blocks (CLAUDE.md "CSS files: append-only per phase"). After the edit, `npm run build` must regenerate `styles.css` (CLAUDE.md "After any CSS change").

---

### `src/__tests__/graph-validator.test.ts` — test (update LOOP-04 assertions)

**Analog:** self, lines 197-309.

**Current assertion style** (lines 202-250) — planner copies this shape and only changes the error-substring literals:

```typescript
it('unified-loop-valid.canvas passes LOOP-04 checks (no «выход» / body errors)', () => {
  const graph = parseFixture('unified-loop-valid.canvas');
  const validator = new GraphValidator();
  const errors = validator.validate(graph);
  expect(errors.some(e => e.includes('не имеет ребра «выход»'))).toBe(false);
  expect(errors.some(e => e.includes('имеет несколько рёбер «выход»'))).toBe(false);
  expect(errors.some(e => e.includes('не имеет ни одной body-ветви'))).toBe(false);
});

it('unified-loop-missing-exit.canvas flags missing «выход» edge (D-08.1)', () => {
  const graph = parseFixture('unified-loop-missing-exit.canvas');
  const validator = new GraphValidator();
  const errors = validator.validate(graph);
  expect(errors.some(e => e.includes('«выход»') && e.includes('не имеет ребра'))).toBe(true);
});

it('unified-loop-duplicate-exit.canvas flags duplicate «выход» edges with edge IDs (D-08.2)', () => {
  const graph = parseFixture('unified-loop-duplicate-exit.canvas');
  const validator = new GraphValidator();
  const errors = validator.validate(graph);
  expect(errors.some(e => e.includes('несколько рёбер «выход»'))).toBe(true);
  const duplicateErr = errors.find(e => e.includes('несколько рёбер «выход»'));
  expect(duplicateErr).toBeDefined();
  if (duplicateErr === undefined) return;
  expect(duplicateErr).toContain('e3');
  expect(duplicateErr).toContain('e4');
});
```

**Required diff** (driven by D-01 / D-02 / D-03 text):

- Replace substring `не имеет ребра «выход»` → `не имеет выхода` (D-01).
- Replace substring `имеет несколько рёбер «выход»` / `несколько рёбер «выход»` → `имеет несколько помеченных исходящих рёбер` (D-02).
- Replace substring `не имеет ни одной body-ветви` → `не имеет тела` (D-03).
- Keep the `duplicateErr.toContain('e3')` / `toContain('e4')` pattern for the `{edgeIds}` assertion (unchanged).
- Keep the migration-check test at lines 253-296 (mentions `«выход»` as a literal inside legacy migration message text, which is a different subsystem — line 48 of `graph-validator.ts`). **Do not rewrite** unless the plan decides to also update the migration message's wording.

**Add new test case** for stray-label-on-body-edge (D-02 via D-16):

```typescript
it('unified-loop-stray-body-label.canvas flags a body edge that accidentally has a label (D-02)', () => {
  const graph = parseFixture('unified-loop-stray-body-label.canvas');
  const validator = new GraphValidator();
  const errors = validator.validate(graph);
  expect(errors.some(e => e.includes('несколько помеченных исходящих рёбер'))).toBe(true);
});
```

**Adjacent blocks to leave alone:**

- `describe('valid protocols'...)` (lines 21-35) — untouched.
- `describe('error detection (PARSE-07, PARSE-08)'...)` (lines 37+) — untouched.
- MIGRATE-01 tests (lines 253-296) — untouched unless migration message is also updated.
- D-09 cycle-through-loop test (lines 299-309) — untouched.

---

### `src/__tests__/runner/protocol-runner-loop-picker.test.ts` — test (dispatch regression guard)

**Analog:** self, lines 59-170.

**Current RUN-03 test** (lines 59-69) — verifies `chooseLoopBranch('e3')` pops frame and advances. `e3` is the labeled edge in `unified-loop-valid.canvas` (label: `"выход"`). Under the new convention, `e3` is still the **sole labeled edge**, so `isExitEdge(e3) === true` and behaviour is preserved.

```typescript
it('RUN-03: choosing «выход» pops frame and advances along exit edge', () => {
  const runner = new ProtocolRunner();
  runner.start(loadGraph('unified-loop-valid.canvas'));
  // e3 is the «выход» edge (n-loop → n-end, text-block terminal)
  runner.chooseLoopBranch('e3');
  const state = runner.getState();
  expect(state.status).toBe('complete');
  const serialized = runner.getSerializableState();
  expect(serialized).toBeNull();
});
```

**Required change:** none to the behavioural assertions — test should pass as-is because `unified-loop-valid.canvas` continues to have exactly one labeled edge and the helper treats it as the exit. Planner should add one reinforcing test:

```typescript
it('RUN-03 (convention): choosing a labeled edge with a non-«выход» word pops frame via isExitEdge (D-05/D-08)', () => {
  // New fixture or inline graph where the labeled edge reads "done" (not "выход")
  // Verify the runner still pops the frame and advances — proves behaviour is label-state-based,
  // not literal-«выход»-based.
});
```

This guards against regression if someone re-introduces a literal `'выход'` match.

**Adjacent tests to leave alone:**

- RUN-01, RUN-02, RUN-04, RUN-05 (lines 26-165) — untouched.
- `RUNFIX-01 Test 2` (line 204+) — untouched.

---

### `src/__tests__/fixtures/unified-loop-duplicate-exit.canvas` — fixture (keep / optionally rename)

**Current content** (D-16: still valid under new semantics):

```json
{
  "nodes": [ /* n-start, n-loop, n-q1, n-a1, n-end1, n-end2 */ ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-loop" },
    { "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1",   "label": "проверка" },
    { "id": "e3", "fromNode": "n-loop",  "toNode": "n-end1", "label": "выход" },
    { "id": "e4", "fromNode": "n-loop",  "toNode": "n-end2", "label": "выход" },
    { "id": "e5", "fromNode": "n-q1",    "toNode": "n-a1" },
    { "id": "e6", "fromNode": "n-a1",    "toNode": "n-loop" }
  ]
}
```

Under D-05, this has **three** labeled outgoing edges from `n-loop` (`e2`, `e3`, `e4`) — so it triggers D-02 (≥2 labeled) for sure. The prior intent ("two «выход» edges") is now a subset of the new rule. Fixture stays valid; planner may optionally rename per D-16 + Claude's Discretion. If renamed, update test file references.

---

### `src/__tests__/fixtures/unified-loop-no-body.canvas` — fixture (still exercises D-03)

**Current content:**

```json
{
  "nodes": [ /* n-start, n-loop, n-end */ ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-loop" },
    { "id": "e2", "fromNode": "n-loop",  "toNode": "n-end",  "label": "выход" }
  ]
}
```

Under D-05/D-09, `n-loop` has one labeled edge (`e2`) and zero unlabeled edges → triggers D-03. Unchanged; no edits.

---

### `src/__tests__/fixtures/unified-loop-valid.canvas` — fixture (regression reference)

Already surveyed above (used by RUN-03 and LOOP-04 happy-path). Stays valid because `e3` is the sole labeled edge (label=`"выход"`, which under D-05 is just a non-empty string) and `e2` is the sole unlabeled edge (label=`"проверка"` — wait, this has a label too).

**⚠️ Correction / planner must verify:** In `unified-loop-valid.canvas` line 11 `e2` has `"label": "проверка"`. Under D-05 both `e2` and `e3` are **labeled**, so this fixture would now fail D-02 (≥2 labeled edges). The fixture **must be adjusted** (or a new valid fixture created) so that `e2` has no label — making it the body edge — and `e3` retains its label as the exit.

Recommended edit (planner to decide whether to modify in place or add a v49 fixture):

```json
{ "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1"   },          // ← drop the label
{ "id": "e3", "fromNode": "n-loop",  "toNode": "n-end",  "label": "выход" }
```

The same concern applies to `unified-loop-nested.canvas` and `unified-loop-long-body.canvas` — both have "проверка"-labeled body edges (per grep hits). **Plan must audit every `unified-loop-*.canvas` fixture** and strip labels from body edges.

---

### **CREATE** `src/graph/node-label.ts` — shared-util (D-13)

**Analog for module layout:** `src/graph/graph-model.ts` — pure types module, zero Obsidian imports. Follow the same convention: comment banner "Pure module — zero Obsidian API imports (NFR-01, PARSE-07)", named exports.

**Analog for function body:** `GraphValidator.nodeLabel()` at lines 238-249:

```typescript
private nodeLabel(node: RPNode): string {
  switch (node.kind) {
    case 'start': return `start (${node.id})`;
    case 'question': return node.questionText || node.id;
    case 'answer': return (node.displayLabel ?? node.answerText) || node.id;
    case 'text-block': return node.content.slice(0, 30) || node.id;
    case 'loop-start': return node.loopLabel || node.id;
    case 'loop-end': return `loop-end (${node.id})`;
    case 'snippet': return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';
    case 'loop': return node.headerText || node.id;
  }
}
```

**Required promoted shape** (D-12 + D-13):

```typescript
// graph/node-label.ts
// Pure module — zero Obsidian API imports (NFR-01, PARSE-07)
// Phase 49 D-13: shared label extractor for validator error messages and runner picker captions.

import type { RPNode, RPEdge } from './graph-model';

/** Human-readable label for a node. Used by GraphValidator error messages (D-04)
 *  and by RunnerView loop-picker body-button captions (D-11/D-12). ONE implementation —
 *  validator wording and runner caption wording must stay in lock-step. */
export function nodeLabel(node: RPNode): string {
  switch (node.kind) {
    case 'start': return `start (${node.id})`;
    case 'question': return node.questionText || node.id;
    case 'answer': return (node.displayLabel ?? node.answerText) || node.id;
    case 'text-block': return node.content.slice(0, 30) || node.id;
    case 'loop-start': return node.loopLabel || node.id;
    case 'loop-end': return `loop-end (${node.id})`;
    case 'snippet': return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';
    case 'loop': return node.headerText || node.id;
  }
}

/** D-05: an edge is "labeled" iff its label is non-null and non-empty after trim.
 *  Whitespace-only labels are NOT labeled. Consumed by GraphValidator (LOOP-04 check)
 *  and by RunnerView / ProtocolRunner (exit-edge detection). */
export function isLabeledEdge(edge: RPEdge): boolean {
  return edge.label != null && edge.label.trim() !== '';
}

/** Alias spelling the runtime intent. Under the Phase 49 convention, the sole labeled
 *  outgoing edge of a loop node IS the exit edge (GraphValidator guarantees uniqueness
 *  before Runner starts, per D-07). */
export const isExitEdge = isLabeledEdge;
```

**Validator delegation pattern:** After extraction, `graph-validator.ts` should import and use the shared function while keeping its private wrapper for minimal diff churn:

```typescript
import { nodeLabel as sharedNodeLabel } from './node-label';
// ...
private nodeLabel(node: RPNode): string { return sharedNodeLabel(node); }
```

OR fully replace the private method with direct `sharedNodeLabel(node)` call sites. Claude's Discretion per D-13. Either way, the **body of the switch-case must not be duplicated**.

**JSDoc tone:** match the existing `graph-model.ts` JSDoc style — short English sentence + Russian parenthetical citing the locked decision ID (D-05, D-11, D-12, etc.).

---

### **CREATE** `src/__tests__/fixtures/unified-loop-stray-body-label.canvas` — fixture (D-16)

**Analog:** `src/__tests__/fixtures/unified-loop-duplicate-exit.canvas` (same author, identical node-positioning and edge-id style).

**Required shape:** exactly one labeled edge is the genuine exit, **plus one additional labeled edge on what was meant to be a body branch** — so D-02 fires.

```json
{
  "nodes": [
    { "id": "n-start", "type": "text", "text": "Start",       "x": 0,   "y": 0,   "width": 200, "height": 60, "radiprotocol_nodeType": "start" },
    { "id": "n-loop",  "type": "text", "text": "Lesion loop", "x": 0,   "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "loop",      "radiprotocol_headerText": "Lesion loop" },
    { "id": "n-q1",    "type": "text", "text": "Size?",       "x": 260, "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "question",  "radiprotocol_questionText": "Size?" },
    { "id": "n-a1",    "type": "text", "text": "1 cm",        "x": 520, "y": 120, "width": 200, "height": 60, "radiprotocol_nodeType": "answer",    "radiprotocol_answerText": "1 cm" },
    { "id": "n-end",   "type": "text", "text": "Done",        "x": 0,   "y": 240, "width": 200, "height": 60, "radiprotocol_nodeType": "text-block","radiprotocol_content": "Done" }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n-start", "toNode": "n-loop" },
    { "id": "e2", "fromNode": "n-loop",  "toNode": "n-q1",   "label": "проверка" },   // stray label on body
    { "id": "e3", "fromNode": "n-loop",  "toNode": "n-end",  "label": "выход" },      // legit exit
    { "id": "e4", "fromNode": "n-q1",    "toNode": "n-a1" },
    { "id": "e5", "fromNode": "n-a1",    "toNode": "n-loop" }
  ]
}
```

Expected validator output: error matching `несколько помеченных исходящих рёбер` listing `e2, e3` (D-02).

---

## Shared Patterns

### Shared `nodeLabel()` extraction (D-13)

**Source:** `src/graph/graph-validator.ts` lines 238-249.
**Apply to:** validator LOOP-04 error text AND runner body-button caption.
**Module:** new `src/graph/node-label.ts` (per §CREATE above).
**Rule:** ONE implementation — if validator and runner diverge on how `question`/`answer`/`snippet`/`loop` nodes are labeled, UX bugs follow silently.

### Shared `isExitEdge(edge)` / `isLabeledEdge(edge)` (D-05, D-07, D-08)

**Source:** new `src/graph/node-label.ts`.
**Apply to:** `graph-validator.ts` (LOOP-04 filter), `protocol-runner.ts` line 194 (dispatch), `runner-view.ts` line 484 (CSS class + caption selection).
**Rule:** `edge.label != null && edge.label.trim() !== ''`. Whitespace-only labels are NOT labeled. Validator and runtime MUST use the same predicate, or the "validator guarantees uniqueness" contract that makes runtime cache-free (D-07) breaks.

### Validator error-message convention

**Source:** existing `graph-validator.ts` error strings — Russian sentences, double-quoted label via `nodeLabel()`, space-joined follow-up guidance. D-01/D-02/D-03 follow this convention verbatim; only wording changes.

### CSS file routing (CLAUDE.md)

**Rule:** loop-picker CSS lives in `src/styles/loop-support.css`, NOT `runner-view.css`. Append `/* Phase 49: ... */` block at the bottom of `loop-support.css`. Run `npm run build` to regenerate `styles.css`. Do NOT commit `styles.css` edits by hand.

### CLAUDE.md "Never remove code you didn't add"

**Apply to:** every file in this phase. Multiple files (`graph-validator.ts`, `runner-view.ts`, `protocol-runner.ts`, `loop-support.css`, test files) contain Phase 43/44/45/47 blocks that are NOT part of Phase 49. Plans MUST delimit edit windows to the specific line ranges called out in this PATTERNS.md and leave everything else untouched.

### Audit surface for literal `'выход'` (D-08 "anywhere else that pattern-matches")

Files where the literal appears and the planner must decide the resolution:

| File | Line(s) | Nature | Action |
|------|---------|--------|--------|
| `src/graph/graph-validator.ts` | 48, 92-95, 99-100, 105-106, 113-114, 121 | LOOP-04 check + migration-error body | Rewrite LOOP-04 per D-01/D-02/D-03; migration message at line 48 may be softened or left |
| `src/runner/protocol-runner.ts` | 167, 194, 200, 313, 580 | line 194 is the dispatch; others are comments | Swap line 194 to `isExitEdge(edge)`; comment updates are cosmetic/non-blocking |
| `src/views/runner-view.ts` | 484 | dispatch + CSS class selector | Swap to `isExitEdge(edge)` |
| `src/runner/runner-state.ts` | 38 | comment only | Cosmetic; optional |
| `src/__tests__/graph-validator.test.ts` | multiple (see above) | assertion substrings | Update substrings per new error copy |
| `src/__tests__/runner/protocol-runner.test.ts` | 213 | TODO comment | Leave alone |
| `src/__tests__/runner/protocol-runner-loop-picker.test.ts` | 59, 71, 91, 106, 161, 170, 204, 211 | test descriptions + comments | Leave alone (tests assert behaviour, not literal text) |
| `src/__tests__/node-picker-modal.test.ts` | 84, 137 | `loopStart('ls1', 'inner', 'выход')` — legacy LoopStartNode fixture factory | **Leave alone** — this exercises the deprecated `LoopStartNode.exitLabel` field, unrelated to Phase 49 |
| `src/__tests__/fixtures/unified-loop-*.canvas` | various | edge labels in fixture data | Most are STILL valid; audit body edges that incidentally have a label (see §unified-loop-valid.canvas correction above) |

---

## No Analog Found

*(None — every file has a concrete in-repo analog; Phase 49 is a surgical rewrite, not a greenfield addition.)*

---

## Metadata

**Analog search scope:** `src/graph/**`, `src/runner/**`, `src/views/**`, `src/styles/**`, `src/__tests__/**`.
**Files scanned:** 13 source files + 6 fixtures + 4 test files.
**Pattern extraction date:** 2026-04-19.
