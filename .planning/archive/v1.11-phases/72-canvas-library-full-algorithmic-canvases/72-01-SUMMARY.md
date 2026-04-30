---
phase: 72-canvas-library-full-algorithmic-canvases
plan: 01
id: 72-01-gm-canvas
subsystem: content-authoring (Obsidian Canvas JSON, no plugin code touched)
tags:
  - canvas-authoring
  - content
  - obsidian
  - gm
requires:
  - CANVAS-LIB-01
provides:
  - ГМ (головной мозг) algorithmic canvas in author's vault
  - Single-canvas head-CT report generator (no contrast variant — head CT modeled without «Контраст вводился?»)
  - Mixed structure (linear sections + 1 focal-lesion loop in ВЕЩЕСТВО ГОЛОВНОГО МОЗГА per D-06)
  - Verbatim Заключение and Рекомендации emitted at terminus (D-19, D-22)
affects:
  - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ГМ 1.0.0.canvas (author's vault — not in repo)"
tech-stack:
  added: []
patterns:
  - Single linear spine top-to-bottom, branches converge per ОГК reference
  - Loop with 3 body branches + 1 «+»-prefix exit (D-11 / Phase 50.1)
  - Snippet folder picker (`radiprotocol_subfolderPath`) for «pick from many» scenarios
  - Snippet file picker (`radiprotocol_snippetPath`) for single named snippets
  - Section header text-blocks prefixed with `\n` (Pitfall 4 mitigation)
  - Phase-27 `==fill-in==` chips for variable text (D-29)
key-files:
  created:
    - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ГМ 1.0.0.canvas"
    - .planning/phases/72-canvas-library-full-algorithmic-canvases/build/canvas-builder.mjs
    - .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-gm.mjs
  modified: []
key-decisions:
  - "D-01: Mixed structure as in ОГК 1.10.0 — linear sections + 1 focal-lesion loop"
  - "D-02: Standalone canvas with own conclusion (ГМ independent)"
  - "D-03: НА СКАНИРОВАННЫХ УРОВНЫХ tail intentionally skipped first pass (author can add later)"
  - "D-04: No cross-canvas snippet leakage — only ГМ/* and КОСТИ/* snippet paths used"
  - "D-06: Focal-lesion loop placed inside ВЕЩЕСТВО ГОЛОВНОГО МОЗГА section"
  - "D-11: Exit edge labelled `+Все указано, продолжаем`"
  - "D-13/D-14: 6 snippet nodes inserted with recommended paths from RESEARCH §1; author may re-point later"
  - "D-19/D-22: Terminal text-block carries verbatim Заключение + Рекомендации from ГМ.md"
  - "D-29: Procedure text-block prefixed with `==тип исследования==` fill-in chip (maps from ГМ.md line 1 Templater placeholder)"
requirements-completed:
  - CANVAS-LIB-01
verification:
  static: passed (21/21 invariant checks I1-I10 + per-loop / per-snippet)
  manual: pending (Task 8 — author runs in Obsidian Protocol Runner)
---

## Summary

Authored `ГМ 1.0.0.canvas` in author's vault (`Z:\documents\vaults\TEST-BASE\Protocols\ГМ 1.0.0.canvas`).
Section list extracted verbatim from `Z:\projects\references\ГМ.md` (7 sections + procedure + terminal).

## Topology

| Metric | Value |
|---|---|
| Nodes | 40 |
| Edges | 54 |
| Sections | 7 (СРЕДИННЫЕ, ВЕЩЕСТВО, ЛИКВОР, СЕЛЛЯРНАЯ, ПАЗУХИ, ОРБИТЫ, КОСТИ) |
| Loops | 1 (focal lesions in ВЕЩЕСТВО ГОЛОВНОГО МОЗГА) |
| Snippet nodes | 6 (1 folder + 5 file/folder split) |
| Free-text `==…==` chips | 9 (1 per section + 1 in loop body C + 1 procedure prefix) |
| Start nodes | 1 |

## Snippet Paths Used

Author can re-point any of these per D-14 (paths reference `Z:\projects\references\SNIPPETS\` layout).

| Section | Node text | Path key | Path value |
|---|---|---|---|
| ВЕЩЕСТВО ГОЛОВНОГО МОЗГА (loop body B) | `ГМ` | subfolderPath | `ГМ` |
| ЛИКВОРОСОДЕРЖАЩИЕ ПРОСТРАНСТВА | `ЖЕЛУДОЧКИ - расширенное описание` | snippetPath | `ГМ/ЖЕЛУДОЧКИ - расширенное описание.md` |
| ЛИКВОРОСОДЕРЖАЩИЕ ПРОСТРАНСТВА | `РАСШИРЕНИЕ ликворных пространств` | snippetPath | `ГМ/РАСШИРЕНИЕ ликоврных пространств.md` |
| ОРБИТЫ | `ФТИЗИС глазного яблока` | snippetPath | `ГМ/ФТИЗИС глазного яблока.md` |
| ОРБИТЫ | `ДЕФОРМАЦИЯ медиальной стенки глазницы` | snippetPath | `ГМ/ДЕФОРМАЦИЯ медиальной стенки глазницы.md` |
| КОСТНЫЕ СТРУКТУРЫ | `КОСТИ` | subfolderPath | `КОСТИ` |

## Deviations from Recommended Snippet Folders

None. All paths match RESEARCH §1 §"Snippet insertion points" exactly.

## Static Invariant Results (I1-I10)

All 21 checks pass:
- I1 (start count = 1) ✓
- I2[loop] (`+`-prefix exit edge) ✓ — `+Все указано, продолжаем`
- I3[loop] (≥1 body edge) ✓ — 3 body edges (Нет / snippet / freetext)
- I4[snippet × 6] (exactly one of subfolderPath / snippetPath) ✓
- I5[section × 7] (each header appears as text-block) ✓
- I6 (Заключение verbatim) ✓
- I7 (Рекомендации verbatim) ✓
- I8 (no dangling edge refs) ✓
- I9 (BFS from start reaches all 40 nodes — no orphans) ✓
- I10 (all `==…==` placeholders well-formed) ✓

## Manual Verification (Task 8 — checkpoint:human-verify)

Pending. Author needs to:
1. Open `Z:\documents\vaults\TEST-BASE\Protocols\ГМ 1.0.0.canvas` in Obsidian.
2. Click "Run from start" in Protocol Runner.
3. Walk one primary path: pick "Норма" / "+Все указано, продолжаем" through all 7 sections to terminal.
4. Confirm assembled output contains every section header from `ГМ.md` plus the verbatim Заключение and Рекомендации.
5. Optionally walk the loop: pick "Нет" once, then "+Все указано, продолжаем" — verify cycle + exit.
6. Type "approved" to mark CANVAS-LIB-01 satisfied (or report issue → re-open relevant earlier task).

## Build Reproducibility

Re-run: `node .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-gm.mjs`.
Output is deterministic (sequential IDs, fixed coordinates).
