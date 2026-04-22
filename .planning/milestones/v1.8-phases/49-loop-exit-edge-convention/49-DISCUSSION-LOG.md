# Phase 49: Loop Exit Edge Convention - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 49-loop-exit-edge-convention
**Areas discussed:** Validator error copy, Body-branch button caption, Runtime exit-edge signal, Legacy v1.7 canvases + Node Editor UX, D-08.3 body-edge invariant

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Тексты ошибок валидатора | Exact Russian error wording for 0 labeled / ≥2 labeled cases | ✓ |
| Caption кнопок body-branch в Runner | What unlabeled body-branch buttons display in Runner | ✓ |
| Сигнал exit edge в Runner runtime | Replacement for `edge.label === 'выход'` | ✓ |
| Legacy v1.7 канвасы + Node Editor UX | Migration policy + whether Node Editor gets realtime validation | ✓ |

---

## Validator error copy — zero labeled edges

| Option | Description | Selected |
|--------|-------------|----------|
| `'Loop-узел "{label}" не имеет выхода. Пометьте ровно одно исходящее ребро — его метка станет подписью кнопки выхода.'` | Explains fix + UX motivation | ✓ |
| `'Loop-узел "{label}" не имеет выхода: пометьте ровно одно исходящее ребро.'` | Short form without caption-motivation | |
| `'Loop-узел "{label}": нет выхода (0 помеченных исходящих рёбер).'` | Diagnostic style, close to ROADMAP wording | |

**User's choice:** Variant 1 (explanatory with UX motivation).
**Notes:** Matches the current validator style of naming the offending node and explaining how to repair.

---

## Validator error copy — two or more labeled edges

| Option | Description | Selected |
|--------|-------------|----------|
| `'Loop-узел "{label}" имеет несколько помеченных исходящих рёбер: {edgeIds}. Должно быть ровно одно выходное ребро — снимите метки с остальных.'` | Lists edge ids + repair guidance | ✓ |
| `'Loop-узел "{label}": больше одного помеченного ребра — должно быть ровно одно.'` | Short form without edgeIds | |
| `'Loop-узел "{label}" имеет {N} помеченных выходов вместо одного. Помеченные рёбра: {edgeIds}.'` | Count + edgeIds | |

**User's choice:** Variant 1 (edgeIds + explicit repair instruction).
**Notes:** Matches current graph-validator.ts:112 pattern. Covers v1.7 legacy canvases specifically.

---

## Body-branch button caption in Runner

| Option | Description | Selected |
|--------|-------------|----------|
| Target node preview (question/answer/snippet/loop text) | Button shows the label of where the branch goes | ✓ |
| `'Ветка N'` numbered | Index-based labels based on outgoing edge order | |
| Allow optional label on body edges as a hint | Breaks success criterion #2; discriminant would need another mechanism | |
| Target node preview, but labeled body edges fail validation | De-facto same as option 1 + enforcement of "body = unlabeled" | |

**User's choice:** Target node preview.
**Notes:** Leads to the preview-extraction follow-up.

### Preview extraction rules

| Option | Description | Selected |
|--------|-------------|----------|
| By kind, reuse `nodeLabel()` from graph-validator.ts:243-248, fallback to node.id | Extract as shared util; keeps validator / runner captions consistent | ✓ |
| Same rules + JS truncation at 40 chars + ellipsis | Defends layout; adds magic number | |
| Same rules, full-text, CSS-driven overflow | Simpler JS; relies on existing picker CSS | |

**User's choice:** Option 1. CSS overflow handling noted separately (D-14).

---

## Runtime exit-edge signal

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime filter: sole outgoing edge with non-empty label | Stateless helper; validator guarantees uniqueness | ✓ |
| Precompute `exitEdgeId` on LoopContext at loop entry | O(1) lookup but expands Runner state shape — risky for undo/redo and session persistence | |
| Discriminant `isExit` on edge model, computed by parser | Most explicit, but changes GraphEdge schema | |

**User's choice:** Runtime filter.

### "Labeled" definition

| Option | Description | Selected |
|--------|-------------|----------|
| `edge.label != null && edge.label.trim() !== ''` (whitespace unlabeled) | Defends against accidental whitespace from Obsidian canvas editor | ✓ |
| `edge.label != null && edge.label !== ''` (exact, no trim) | Preserves literal canvas content; whitespace-only becomes valid exit | |
| Only `null` unlabeled; `''` counts as labeled | Most primitive; Obsidian's "deleted label" state often becomes `''`, causing false-positive exit | |

**User's choice:** Trim-based definition.
**Notes:** Applies in both GraphValidator and Runner runtime helper. Runner exit button caption uses the trimmed value verbatim (D-06).

---

## Legacy v1.7 canvases

| Option | Description | Selected |
|--------|-------------|----------|
| Don't know — scan .canvas files in the vault | Add grep/scan task to plan; document migration scenario in SUMMARY | |
| Probably exist, but repair manually via validator error | Dry fail + explicit `{edgeIds}` is enough to locate and fix by hand | ✓ |
| No — test fixtures only | Only fixtures need updating; no production canvases | |

**User's choice:** Manual repair via validator error.

## Node Editor UX

| Option | Description | Selected |
|--------|-------------|----------|
| No — only on-save + pre-Runner validation (unchanged) | Keeps Phase 49 scope tight; Node Editor untouched | ✓ |
| Yes — inline warning in loop-form when exit edge missing | Better UX but expands scope; separate phase | |
| Yes — static hint in loop-node header | Cheaper; touches Node Editor form area worked on in Phase 48 | |

**User's choice:** No editor-side changes.

---

## D-08.3 body-edge invariant (Phase 43 carry-over)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep — ≥1 unlabeled outgoing edge required, reworded error | Preserves "loop has both body and exit" invariant | ✓ |
| Drop D-08.3 — loop with only exit edge is valid (degenerate) | Less validator code; semantically odd | |
| Keep with soft warning + Phase 43 wording | Reformulated filter but kept old error text | |

**User's choice:** Keep with reworded error text (D-03).

---

## Claude's Discretion

- Exact module organisation for shared `nodeLabel()` / `isExitEdge()` helpers.
- Whether to rename `unified-loop-duplicate-exit.canvas` fixture.
- JSDoc wording on new helpers.
- Exact test file structure (provided each of D-01/D-02/D-03 is asserted).
- Keeping both `rp-loop-exit-btn` / `rp-loop-body-btn` CSS classes (recommend keeping).

## Deferred Ideas

- Node Editor realtime validation of the exit-edge invariant.
- Static help text on the loop-node header.
- Automatic migration pass for v1.7 canvases with labeled body edges.
- Renaming `unified-loop-duplicate-exit.canvas` for convention-agnostic clarity.
