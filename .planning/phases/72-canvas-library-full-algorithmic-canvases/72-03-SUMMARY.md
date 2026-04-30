---
phase: 72-canvas-library-full-algorithmic-canvases
plan: 03
id: 72-03-ozp-canvas
subsystem: content-authoring (Obsidian Canvas JSON, no plugin code touched)
tags:
  - canvas-authoring
  - content
  - obsidian
  - ozp
  - contrast-fanout
requires:
  - CANVAS-LIB-03
provides:
  - ОЗП (органы забрюшинного пространства) algorithmic canvas with contrast fan-out (D-27)
  - Two parallel trunks with 3 organ-discovery loops per trunk (НАДПОЧЕЧНИКИ + ПРАВАЯ ПОЧКА + ЛЕВАЯ ПОЧКА per D-08)
  - Conditional sections — МОЧЕВОЙ ПУЗЫРЬ + СОСУДЫ on contrast trunk only; «Жидкости в забрюшинном...» linear sentence on no-contrast trunk only
  - Verbatim Заключение and Рекомендации at terminus (D-19, D-22)
affects:
  - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОЗП 1.0.0.canvas (author's vault — not in repo)"
tech-stack:
  added: []
patterns:
  - Two-trunk parallel design — same as ОБП full
  - 6 organ-discovery loops total (3 per trunk × 2 trunks) all using flat `ОЗП` snippet folder picker per RESEARCH §3
  - «положении пациента» text-block exists on contrast trunk only (no-contrast .md omits this line)
  - Phase-27 `==fill-in==` chips for kidney size placeholders («Х-Х-Х мм» → `==размер ___ почки мм==`)
key-files:
  created:
    - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОЗП 1.0.0.canvas"
    - .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-ozp.mjs
  modified: []
key-decisions:
  - "D-01: Mixed structure — linear sections + 3 organ-discovery loops per trunk"
  - "D-04: No cross-canvas snippet leakage — only ОЗП/ and КОСТИ paths used"
  - "D-08: Loops on НАДПОЧЕЧНИКИ + ПРАВАЯ ПОЧКА + ЛЕВАЯ ПОЧКА (kidneys + adrenal glands)"
  - "D-11: Each of 6 loops has exactly one `+Все указано, продолжаем` exit edge"
  - "D-13/D-14: Snippet folder pickers reference flat `ОЗП` folder; author may refine to file-bound paths (киста КТА.md vs киста НАТИВ.md) per D-14"
  - "D-19/D-22: Single shared terminal text-block carries verbatim Заключение + Рекомендации"
  - "D-27: ONE canvas with «Контраст вводился?» fan-out; 2 contrast answers share contrast trunk; 1 no-contrast answer routes to no-contrast trunk"
  - "D-29: Kidney size placeholders «до Х-Х-Х мм» replaced with `==размер правой почки мм==` / `==размер левой почки мм==` chips"
  - "Trunk topology: TWO PARALLEL TRUNKS chosen — section ordering and conditional sections (МОЧЕВОЙ ПУЗЫРЬ, СОСУДЫ vs «Жидкости...» line) differ enough to warrant duplication"
requirements-completed:
  - CANVAS-LIB-03
verification:
  static: passed (43/43 invariant checks I1-I10 + per-loop / per-snippet)
  manual: pending (Task 8 — author runs both contrast branches in Obsidian)
---

## Summary

Authored `ОЗП 1.0.0.canvas` in author's vault.
Two parallel trunks routing through 9 sections each, with contrast trunk including additional МОЧЕВОЙ ПУЗЫРЬ + СОСУДЫ sections per `ОЗП с контрастом.md`, and no-contrast trunk including the standalone «Жидкости в забрюшинном пространстве не выявлено.» line per `ОЗП без контраста.md`.

## Topology

| Metric | Value |
|---|---|
| Nodes | 106 |
| Edges | 151 |
| Sections (contrast) | 9 (НАДПОЧЕЧНИКИ, ПРАВ ПОЧКА, ЛЕВ ПОЧКА, МОЧЕТОЧНИКИ, МОЧЕВОЙ ПУЗЫРЬ, СОСУДЫ, ЛУ, МТ, КОСТИ) |
| Sections (no-contrast) | 7 + standalone «Жидкости...» line (НАДПОЧЕЧНИКИ, ПРАВ ПОЧКА, ЛЕВ ПОЧКА, МОЧЕТОЧНИКИ, ЛУ, МТ, КОСТИ; +Жидкости text-block) |
| Loops | 6 (3 per trunk × 2 trunks) |
| Snippet nodes | 16 (4 per trunk: 3 loop-body + 1 per non-loop section + 1 КОСТИ; some sections without snippet) |
| Start nodes | 1 |

## Snippet Paths Used

| Trunk | Section / loop | Path |
|---|---|---|
| Both | НАДПОЧЕЧНИКИ loop body | `ОЗП` (folder) |
| Both | ПРАВАЯ ПОЧКА loop body | `ОЗП` |
| Both | ЛЕВАЯ ПОЧКА loop body | `ОЗП` |
| Both | МОЧЕТОЧНИКИ section | `ОЗП` |
| Contrast | МОЧЕВОЙ ПУЗЫРЬ | `ОЗП` |
| Contrast | СОСУДЫ | `ОЗП` |
| Both | ЛИМФАТИЧЕСКИЕ УЗЛЫ | `ОЗП` |
| Both | МЯГКИЕ ТКАНИ | `ОЗП` |
| Both | КОСТНЫЕ СТРУКТУРЫ | `КОСТИ` |

Per D-14, the flat `ОЗП` folder picker enumerates all 7 ready snippets at runtime — author can later refine specific organs to file-bound paths (`киста КТА.md` for kidneys-with-contrast, `аденома надпочечника.md` for НАДПОЧЕЧНИКИ).

## Static Invariant Results (I1-I10)

All 43 checks pass:
- I1, I2[loop × 6], I3[loop × 6], I4[snippet × 16], I5[section × 9], I6, I7, I8, I9 (BFS reaches all 106 nodes), I10.

## Manual Verification (Task 8)

Pending. Author runs both contrast branches:
1. Run no-contrast: pick «Нет» → НАДПОЧЕЧНИКИ→...→МОЧЕТОЧНИКИ→Жидкости-line→ЛУ→МТ→КОСТИ→terminal. Verify МОЧЕВОЙ ПУЗЫРЬ + СОСУДЫ NOT visited; «Жидкости в забрюшинном...» IS emitted.
2. Run contrast: pick «Да, болюсно» → with «положении пациента» line + МОЧЕВОЙ ПУЗЫРЬ + СОСУДЫ. Verify «Жидкости...» standalone NOT emitted.
3. Visual diff each output against matching `.md` template.
4. Type "approved" to mark CANVAS-LIB-03.

## Build Reproducibility

Re-run: `node .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-ozp.mjs`.
