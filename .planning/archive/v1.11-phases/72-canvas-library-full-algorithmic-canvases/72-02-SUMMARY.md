---
phase: 72-canvas-library-full-algorithmic-canvases
plan: 02
id: 72-02-obp-full-canvas
subsystem: content-authoring (Obsidian Canvas JSON, no plugin code touched)
tags:
  - canvas-authoring
  - content
  - obsidian
  - obp
  - contrast-fanout
requires:
  - CANVAS-LIB-02
provides:
  - ОБП (органы брюшной полости) full algorithmic canvas with sex-agnostic contrast fan-out (D-27)
  - Two parallel trunks — contrast (Да болюсно + Да вручную) and no-contrast (Нет) — each routing through its own per-organ flow with branch-specific normal-finding text
  - 2 organ-discovery loops per trunk (ПЕЧЕНЬ + ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА) per D-07
  - Conditional СОСУДЫ section (contrast only) vs «Аорта в брюшном отделе...» linear text (no-contrast only)
  - Verbatim Заключение and Рекомендации emitted at terminus (D-19, D-22)
affects:
  - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОБП full 1.0.0.canvas (author's vault — not in repo)"
tech-stack:
  added: []
patterns:
  - Two-trunk parallel design — single «Контраст вводился?» fan-out branches into independent contrast/no-contrast spines
  - Convergence into shared terminal text-block (Заключение + Рекомендации identical for both trunks)
  - 4 organ-discovery loops total (2 per trunk × 2 trunks)
  - Phase-27 `==fill-in==` chips for cursor(N) placeholders mapped per D-29 (11 distinct chip types)
  - Per-branch norm answers preserved verbatim from matching .md template
key-files:
  created:
    - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОБП full 1.0.0.canvas"
    - .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-obp.mjs
  modified: []
key-decisions:
  - "D-01: Mixed structure — linear sections + 2 organ-discovery loops per trunk"
  - "D-02: Standalone canvas with own conclusion"
  - "D-04: No cross-canvas snippet leakage — only ОБП/* and КОСТИ/* paths used"
  - "D-07: ПЕЧЕНЬ + ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА carry loops; spleen, kidneys, GI, lymph nodes, aorta linear"
  - "D-11: Each loop has exactly one `+`-prefix exit edge (`+Все указано, продолжаем`)"
  - "D-13/D-14: Snippet folder pickers reference RESEARCH §2 paths; author may re-point per D-14"
  - "D-19/D-22: Single shared terminal text-block carries verbatim Заключение + Рекомендации"
  - "D-27: ONE canvas with «Контраст вводился?» fan-out into 3 answer nodes; «Да болюсно» and «Да вручную» share contrast trunk; «Нет» owns no-contrast trunk"
  - "D-29: 11 cursor(N) Templater placeholders mapped to descriptive `==fill-in==` chips (e.g., `==размер правой доли мм==`, `==длина селезенки==`)"
  - "Trunk topology decision: TWO PARALLEL TRUNKS chosen over conditional-routing single trunk — cleaner DAG, fewer state-tracking gymnastics, matches Plan Task 1 recommendation"
requirements-completed:
  - CANVAS-LIB-02
verification:
  static: passed (44/44 invariant checks I1-I10 + per-loop / per-snippet)
  manual: pending (Task 8 — author runs both contrast branches in Obsidian Protocol Runner)
---

## Summary

Authored `ОБП full 1.0.0.canvas` in author's vault.
Two parallel trunks — contrast and no-contrast — sharing only the start, the «Контраст вводился?» question, and the terminal Заключение/Рекомендации text-block.
Every per-organ section has branch-specific norm-finding text drawn verbatim from the matching `.md` template.

## Topology

| Metric | Value |
|---|---|
| Nodes | 110 |
| Edges | 157 |
| Sections (per trunk) | 9 (contrast: ПЕЧЕНЬ, ЖЕЛЧНЫЙ, ПЖ, СЕЛ, КИШ, ЛУ, СОСУДЫ, МТ, КОСТИ) / (no-contrast: same minus СОСУДЫ + Аорта linear sentence) |
| Loops | 4 (2 per trunk: ПЕЧЕНЬ + ПЖ × 2 trunks) |
| Snippet nodes | 21 (1 per organ section + 1 per organ-discovery loop body) |
| Free-text `==…==` chips | many (norm answers + ==напишу что не так== per section + loop free-text branches) |
| Distinct fill-in chip identifiers | 13 (cursor(1)..cursor(11) → descriptive labels, plus ==воротная вена мм==, ==селезёночная вена мм==) |
| Start nodes | 1 |

## Snippet Paths Used

All paths originate from `SNIPPETS\ОБП\<organ>\` or `SNIPPETS\КОСТИ\` per RESEARCH §2.
No cross-canvas leakage (Pitfall 9 / D-04 verified).

| Trunk | Section | subfolderPath |
|---|---|---|
| Both | ПЕЧЕНЬ section + loop body | `ОБП/ПЕЧЕНЬ` |
| Both | ЖЕЛЧНЫЙ ПУЗЫРЬ | `ОБП/ЖЕЛЧНЫЙ ПУЗЫРЬ` |
| Both | ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА section + loop body | `ОБП/ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА` |
| Both | СЕЛЕЗЕНКА | `ОБП/СЕЛЕЗЕНКА` |
| Both | КИШЕЧНИК | `ОБП/КИШЕЧНИК` |
| Contrast | СОСУДЫ | `ОБП/СОСУДЫ` |
| Both | ЛИМФАТИЧЕСКИЕ УЗЛЫ | `ОБП/ЛИМФАТИЧЕСКИЕ УЗЛЫ` |
| Both | МЯГКИЕ ТКАНИ | `ОБП/МЯГКИЕ ТКАНИ` |
| Both | КОСТНЫЕ СТРУКТУРЫ | `КОСТИ` |

## Trunk Modeling Choice

**TWO PARALLEL TRUNKS** chosen over single-trunk-with-conditionals.

Rationale: per-organ norm text differs by contrast (D-27 forces this — ПЕЧЕНЬ contrast norm mentions «фокусов накопления контрастного средства», ПЖ contrast norm mentions «Накопление контрастного препарата равномерное», СЕЛ contrast norm mentions «фазам контрастирования», ЖЕЛЧНЫЙ contrast adds «и патологических фокусов накопления контрастного средства», МТ differs «Не изменены.» vs «Без патологических изменений.», and section ordering diverges contrast vs no-contrast at КИШЕЧНИК → ЛУ vs КИШЕЧНИК → Аорта → ЛУ).

Conditional-routing on a single trunk would require either re-asking the user contrast disposition mid-canvas (bad UX) or storing state via duplicate norm-A/norm-B answers per section (graph topology equivalent to two trunks but with cross-trunk wiring complexity).

## Static Invariant Results (I1-I10)

All 44 checks pass:
- I1 (start = 1) ✓
- I2[loop × 4] (each loop has `+`-prefix exit) ✓ — 4 distinct `+Все указано, продолжаем` edges
- I3[loop × 4] (each loop has body edges) ✓ — 3 body edges per loop
- I4[snippet × 21] (each snippet has exactly one of subfolderPath / snippetPath) ✓
- I5[section × 9] (every header from .md as text-block) ✓
- I6 (Заключение verbatim) ✓
- I7 (Рекомендации verbatim) ✓
- I8 (no dangling refs) ✓
- I9 (BFS reaches all 110 nodes) ✓
- I10 (all `==…==` placeholders well-formed) ✓

## Manual Verification (Task 8 — checkpoint:human-verify)

Pending. Author runs **both contrast branches**:
1. Open canvas in Obsidian.
2. **Run 1 — no-contrast:** Pick «Нет» → walk via ПЕЧЕНЬ→ЖЕЛЧ→ПЖ→СЕЛ→КИШ→Аорта-line→ЛУ→МТ→КОСТИ→terminal. Verify СОСУДЫ section is NOT visited; «Аорта...» linear sentence IS emitted.
3. **Run 2 — contrast:** Pick «Да, болюсно» (or «Да, вручную») → walk via ПЕЧЕНЬ→ЖЕЛЧ→ПЖ→СЕЛ→КИШ→ЛУ→СОСУДЫ→МТ→КОСТИ→terminal. Verify СОСУДЫ IS visited.
4. Visual diff each output against the matching `.md` template (`ОБП без контраста.md` for run 1, `ОБП с контрастом.md` for run 2).
5. Type "approved" to mark CANVAS-LIB-02 satisfied.

## Build Reproducibility

Re-run: `node .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-obp.mjs`.
