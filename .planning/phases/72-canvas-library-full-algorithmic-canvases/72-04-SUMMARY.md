---
phase: 72-canvas-library-full-algorithmic-canvases
plan: 04
id: 72-04-omt-full-canvas
subsystem: content-authoring (Obsidian Canvas JSON, no plugin code touched)
tags:
  - canvas-authoring
  - content
  - obsidian
  - omt
  - sex-fanout
  - contrast-fanout
requires:
  - CANVAS-LIB-04
provides:
  - ОМТ (органы малого таза) full algorithmic canvas with sex × contrast fan-out (D-26)
  - Four parallel trunks — Жен-Нет, Жен-Да, Муж-Нет, Муж-Да — each routing through gender-and-contrast-specific section flows
  - 4 organ-discovery loops (МАТКА + ЯИЧНИКИ on each жен trunk per D-09)
  - Conditional СОСУДЫ section on contrast trunks; «Паховые каналы не расширены.» line on contrast-Жен and BOTH муж trunks
  - Normalized verbatim Заключение and Рекомендации at terminus (D-19, D-22)
affects:
  - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОМТ full 1.0.0.canvas (author's vault — not in repo)"
tech-stack:
  added: []
patterns:
  - Gender-first / contrast-second fan-out (RESEARCH §4 author convenience tip — halves visual fan-out vs contrast-first 3×2)
  - Bolus-contrast and manual-contrast collapse into single contrast-yes trunk per gender
  - 4 distinct trunks at independent x-coordinates for visual separation
  - Phase-27 `==fill-in==` chips replace size placeholders («Х-Х-Х мм», «-- мм») in МАТКА, ЯИЧНИКИ, ПРЕДСТАТЕЛЬНАЯ ЖЕЛЕЗА norms
key-files:
  created:
    - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОМТ full 1.0.0.canvas"
    - .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-omt.mjs
  modified: []
key-decisions:
  - "D-09: Loops on МАТКА + ЯИЧНИКИ (жен trunks only); муж trunks remain linear (ПРЕДСТАТЕЛЬНАЯ ЖЕЛЕЗА kept linear per Plan Task 3 recommendation)"
  - "D-11: Each of 4 loops has exactly one `+Все указано, продолжаем` exit edge"
  - "D-13/D-14: Snippet folder pickers reference flat `ОМТ` folder (sparse — 2 ready files); author will expand per D-14"
  - "D-19/D-22: Single shared terminal text-block carries normalized Заключение `РКТ-признаков патологических изменений органов малого таза не выявлено.` (RESEARCH §4 recommendation — minor wording differences across the 4 source .md conclusions treated as drift)"
  - "D-26: ONE canvas with sex × contrast fan-out; gender-first then contrast-inside-each-gender per RESEARCH §4 author convenience tip"
  - "D-29: Size placeholders mapped to `==размер матки мм==`, `==размер правого яичника мм==`, `==размер левого яичника мм==`, `==размер простаты мм==` chips"
  - "Trunk topology: 4 PARALLEL TRUNKS (Жен-Нет / Жен-Да / Муж-Нет / Муж-Да) chosen — gender-specific organs (МАТКА/ЯИЧНИКИ vs ПРЕДСТАТЕЛЬНАЯ/СЕМ.ПУЗ) cannot share spine; contrast-conditional sections (СОСУДЫ, Паховые каналы) further differentiate"
requirements-completed:
  - CANVAS-LIB-04
verification:
  static: passed (54/54 invariant checks I1-I10 + per-loop / per-snippet)
  manual: pending (Task 8 — author runs all 4 sex×contrast paths in Obsidian)
---

## Summary

Authored `ОМТ full 1.0.0.canvas` in author's vault.
Most complex Phase 72 canvas — 4 parallel trunks corresponding to the 4 source `.md` templates, each carrying its own gender-and-contrast-specific organ flow. Per RESEARCH §4 author convenience tip, gender is asked first (2-fan), then contrast inside each gender (3-fan inside each gender = 2×3 visual fan-out instead of 3×2).

## Topology

| Metric | Value |
|---|---|
| Nodes | 178 |
| Edges | 250 |
| Trunks | 4 (Жен-Нет, Жен-Да, Муж-Нет, Муж-Да) |
| Sections per Жен-Нет | 7 (МПУЗ, МАТКА+loop, ЯИЧ+loop, КИШ, ЛУ, МТ, КОСТИ) |
| Sections per Жен-Да | 8 (+СОСУДЫ, +Паховые каналы line) |
| Sections per Муж-Нет | 7 (МПУЗ, ПРЕДСТАТ, СЕМ.ПУЗ, КИШ, ЛУ, МТ, +Паховые каналы line, КОСТИ) |
| Sections per Муж-Да | 8 (+СОСУДЫ) |
| Loops | 4 (МАТКА + ЯИЧНИКИ × 2 жен trunks) |
| Snippet nodes | 30 (per-section + loop bodies; flat ОМТ folder for non-bone sections, КОСТИ for bones) |
| Start nodes | 1 |

## Snippet Paths Used

| Path | Used By |
|---|---|
| `ОМТ` | All non-bone sections in all 4 trunks; both МАТКА + ЯИЧНИКИ loop bodies (sparse `SNIPPETS\ОМТ\` — only 2 ready files; author expands per D-14) |
| `КОСТИ` | КОСТНЫЕ СТРУКТУРЫ section in all 4 trunks |

No cross-canvas snippet leakage (verified — Pitfall 9 / D-04). No `ОБП`, `ОЗП`, `ПКОП`, `ОГК` paths anywhere.

## Заключение Normalization

The 4 source `.md` templates have slightly different Заключение wording:
- Жен без КУ: «Патологических изменений органов малого таза не выявлено.»
- Жен с КУ: «РКТ-признаков патологических изменений органов малого таза не выявлено.»
- Муж без КУ: «РКТ-признаков патологических изменений в органах малого таза не выявлено.»
- Муж с КУ: «РКТ-признаков патологических изменений в органах малого таза не выявлено.»

Per RESEARCH §4 recommendation, NORMALIZED to: `РКТ-признаков патологических изменений органов малого таза не выявлено.` (matches Жен с КУ).
Author can adjust to per-leaf conclusions if desired (would require splitting the terminal text-block into 4 leaf-specific terminals).

## Static Invariant Results (I1-I10)

All 54 checks pass:
- I1, I2[loop × 4], I3[loop × 4], I4[snippet × 30], I5[section × 10], I6, I7, I8, I9 (BFS reaches all 178 nodes — all 4 leaves accessible), I10.

## Manual Verification (Task 8)

Pending. Author runs **all 4 sex×contrast paths**:
1. **Run 1 (Жен × Нет):** Pick «Жен» → «Нет». Walk МПУЗ → МАТКА (loop pick "Нет" + "+exit") → ЯИЧ (loop pick "Нет" + "+exit") → КИШ → ЛУ → МТ → КОСТИ → terminal. Diff vs `ОМТ жен без КУ норма.md`.
2. **Run 2 (Жен × Да-болюсно):** Pick «Жен» → «Да, болюсно». Walk same female sections + СОСУДЫ + Паховые каналы. Diff vs `ОМТ жен с КУ норма.md`.
3. **Run 3 (Муж × Нет):** Pick «Муж» → «Нет». Walk МПУЗ → ПРЕДСТАТ → СЕМ.ПУЗ → КИШ → ЛУ → МТ → Паховые-каналы → КОСТИ → terminal. Diff vs `ОМТ муж без контраста.md`.
4. **Run 4 (Муж × Да-болюсно):** Pick «Муж» → «Да, болюсно». Walk male sections + СОСУДЫ. Diff vs `ОМТ муж с контрастом.md`.
5. Verify Pitfall 10: all 4 leaves were reachable (each run produced output matching its template).
6. Type "approved" to mark CANVAS-LIB-04.

## Build Reproducibility

Re-run: `node .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-omt.mjs`.
