---
phase: 72-canvas-library-full-algorithmic-canvases
plan: 05
id: 72-05-pkop-canvas
subsystem: content-authoring (Obsidian Canvas JSON, no plugin code touched)
tags:
  - canvas-authoring
  - content
  - obsidian
  - pkop
  - vertebral-loop
requires:
  - CANVAS-LIB-05
provides:
  - ПКОП (пояснично-крестцовый отдел позвоночника) algorithmic canvas, single-template (no contrast variant per D-05)
  - 8 linear sections from `ПКОП остеохондроз.md` plus 2 loops
  - ПОЗВОНКИ findings loop (3 body branches + `+`-prefix exit per D-10)
  - МЕЖПОЗВОНКОВЫЕ ДИСКИ per-segment loop with 5 body answers L1-L2 → L5-S1 (Approach A from RESEARCH §5, D-28)
  - Verbatim Заключение and Рекомендации at terminus (D-19, D-22)
affects:
  - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ПКОП 1.0.0.canvas (author's vault — not in repo)"
tech-stack:
  added: []
patterns:
  - Single linear spine top-to-bottom (no contrast fan-out — non-contrast spine MSCT)
  - Per-segment loop with 5 body answers (Approach A): one body answer per vertebral segment, exit `+Все сегменты описаны` advances to ПОЗВОНОЧНЫЙ КАНАЛ
  - Phase-27 `==fill-in==` chips for clinically-variable placeholders (segment sizes, narrowing degrees, asymmetry sides)
key-files:
  created:
    - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ПКОП 1.0.0.canvas"
    - .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-pkop.mjs
  modified: []
key-decisions:
  - "D-01: Mixed structure — linear sections + 2 loops"
  - "D-05: ПКОП standalone, does not reference other canvases"
  - "D-10: МЕЖПОЗВОНКОВЫЕ ДИСКИ loop iterates 5 vertebral segments L1-L2 → L5-S1"
  - "D-11: Both loops have `+`-prefix exit edges (`+Все указано, продолжаем` for ПОЗВОНКИ; `+Все сегменты описаны` for МЕЖПОЗВОНКОВЫЕ ДИСКИ)"
  - "D-12: Hybrid linear + loop modeling per ОГК"
  - "D-13/D-14: 3 snippet folder pickers (ПОЗВОНОЧНИК ×2, КОСТИ ×1); author may add file-bound paths later"
  - "D-19/D-22: Single terminal text-block carries verbatim multi-line Заключение + Рекомендации"
  - "D-28: APPROACH A from RESEARCH §5 — single per-segment loop with 5 body answers; each segment text emitted when picked; `+` exit when all segments described"
  - "D-29: Multiple `==fill-in==` chips per segment for sagittal sizes, narrowing degrees, asymmetry sides; conclusion includes `==L-L дисков==` and `==L Шморля==` chips for vertebral level placeholders"
requirements-completed:
  - CANVAS-LIB-05
verification:
  static: passed (21/21 invariant checks I1-I10 + per-loop / per-snippet)
  manual: pending (Task 8 — author runs in Obsidian, ideally walking all 5 disc segments)
---

## Summary

Authored `ПКОП 1.0.0.canvas` in author's vault.
Single-template canvas with the dominant pattern being the per-segment МЕЖПОЗВОНКОВЫЕ ДИСКИ loop iterating L1-L2 → L5-S1 per D-28.

## Topology

| Metric | Value |
|---|---|
| Nodes | 45 |
| Edges | 61 |
| Sections | 8 (АНОМАЛИИ, СТАТИКА, ПОЗВОНКИ, МЕЖПОЗВОНКОВЫЕ ДИСКИ, ПОЗВОНОЧНЫЙ КАНАЛ, ИЛЕО-САКРАЛЬНЫЕ, КРЕСТЕЦ, ПАРАВЕРТ. МТ) |
| Loops | 2 (ПОЗВОНКИ findings + МЕЖПОЗВОНКОВЫЕ ДИСКИ per-segment) |
| Disc loop body answers | 5 (L1-L2, L2-L3, L3-L4, L4-L5, L5-S1) — per D-28 Approach A |
| Snippet nodes | 3 (ПОЗВОНКИ loop body → ПОЗВОНОЧНИК; ПОЗВОНОЧНЫЙ КАНАЛ → ПОЗВОНОЧНИК; КРЕСТЕЦ → КОСТИ) |
| Free-text `==…==` chips | many (per-segment fill-ins for sagittal sizes, narrowing degrees; conclusion-level placeholders) |
| Start nodes | 1 |

## Snippet Paths Used

| Section / loop | Path |
|---|---|
| ПОЗВОНКИ findings loop body | `ПОЗВОНОЧНИК` (folder) |
| ПОЗВОНОЧНЫЙ КАНАЛ section | `ПОЗВОНОЧНИК` (folder) |
| КРЕСТЕЦ section | `КОСТИ` (folder) |

ИЛЕО-САКРАЛЬНЫЕ СОЧЛЕНЕНИЯ + ПАРАВЕРТЕБРАЛЬНЫЕ МЯГКИЕ ТКАНИ sections intentionally lack snippet pickers per Plan Task 4 ("author's call" — current ПОЗВОНОЧНИК folder has no clean match for these).
No cross-canvas snippet leakage (verified — only `ПОЗВОНОЧНИК` and `КОСТИ` paths used; no `ОБП`/`ОЗП`/`ОМТ`/`ОГК`/`ГМ`/`ШЕЯ`).

## Per-Segment Loop Modeling

The МЕЖПОЗВОНКОВЫЕ ДИСКИ loop uses **Approach A** from RESEARCH §5 (D-28):

- Loop header: `Опишу следующий сегмент?`
- 5 body answers (one per segment), each with verbatim per-segment text from ПКОП остеохондроз.md lines 28-36 with literal placeholders («__», «мм», «вправо/влево», «нерезко/умеренно/выражено», «справа/слева») converted to descriptive `==…==` chips.
- Each body returns to loop header so user can pick the next segment.
- Exit `+Все сегменты описаны` advances to ПОЗВОНОЧНЫЙ КАНАЛ.

This is more compact than Approach B (5 linear sub-sections with yes/no questions) — 5 body nodes vs ~30 linear nodes.

## Static Invariant Results (I1-I10)

All 21 checks pass:
- I1, I2[loop × 2], I3[loop × 2], I4[snippet × 3], I5[section × 8], I6, I7, I8, I9 (BFS reaches all 45 nodes), I10.

I6 anchored to first conclusion line «РКТ-признаки нарушения статики поясничного отдела позвоночника.» — full multi-line conclusion preserved verbatim with `==fill-in==` chips substituting for the original `L-L` / `L` placeholders.

## Manual Verification (Task 8)

Pending. Author runs:
1. Open canvas in Obsidian. Click "Run from start".
2. Walk linear sections 1-3 (АНОМАЛИИ → СТАТИКА → ПОЗВОНКИ) picking norm or freetext.
3. At ПОЗВОНКИ loop pick «Нет» once, then `+Все указано, продолжаем` → advances to МЕЖПОЗВОНКОВЫЕ ДИСКИ.
4. **Critical: At МЕЖПОЗВОНКОВЫЕ ДИСКИ loop, pick all 5 segments in order (L1-L2 → L2-L3 → L3-L4 → L4-L5 → L5-S1), then `+Все сегменты описаны`.** Verify each segment emits its verbatim per-segment text.
5. Walk ПОЗВОНОЧНЫЙ КАНАЛ → ИЛЕО-САКРАЛЬНЫЕ → КРЕСТЕЦ → ПАРАВЕРТ. МТ → terminal.
6. Visual diff output against `Z:\projects\references\ПКОП остеохондроз.md` lines 4-69.
7. Type "approved" to mark CANVAS-LIB-05.

## Build Reproducibility

Re-run: `node .planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-pkop.mjs`.
