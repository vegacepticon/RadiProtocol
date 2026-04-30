---
phase: 73-canvas-library-short-algorithmic-canvases
plan: 02
id: 73-02-obp-short-canvas
subsystem: content-authoring (Obsidian Canvas JSON, no plugin code touched)
tags:
  - canvas-authoring
  - content
  - obsidian
  - obp
  - short
requires:
  - CANVAS-LIB-07
provides:
  - ОБП (органы брюшной полости) short-version algorithmic canvas
  - 3 linear sections per D-01 (ПАРЕНХИМАТОЗНЫЕ ОРГАНЫ, ЖЕЛЧНЫЙ ПУЗЫРЬ, ЗАБРЮШИННЫЕ ЛИМФОУЗЛЫ)
  - Per-system Норма? gate with verbatim normal text (D-02)
  - Terminal Заключение with `==диагноз==` Phase-27 chip + Рекомендации (D-03, D-13)
  - Zero loops (D-04), zero contrast fan-out (D-06 spirit), zero procedure preamble (Pattern S5)
affects:
  - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОБП short 1.0.0.canvas (author's vault — not in repo per D-16/D-20)"
tech-stack:
  added: []
patterns:
  - Single linear trunk top-to-bottom — no fan-out, no loops, no Контраст question
  - section() + converge() helpers reused from Phase 72 build-pkop.mjs
  - Phase-27 ==fill-in== chip on Заключение line for clinical diagnosis substitution
  - Reuse Phase 72 canvas-builder.mjs via relative import (D-15) — no fork, no duplication
key-files:
  created:
    - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОБП short 1.0.0.canvas"
    - .planning/phases/73-canvas-library-short-algorithmic-canvases/build/build-obp-short.mjs
  modified: []
key-decisions:
  - "D-01: per-organ-system text-blocks (NOT monolithic) — 3 separate sections"
  - "D-02: per-system Норма? gate — Да-branch verbatim norm / Нет-branch ==напишу что не так== chip"
  - "D-03: terminal `## Заключение` + `## Рекомендации` text-block"
  - "D-04: NO loops in short canvases"
  - "D-08, D-09: snippet-node strategy reusing Phase 72's `SNIPPETS\\ОБП\\` subfolder (single top-level mirror of Phase 72 ОБП full)"
  - "D-10: did NOT pre-create snippet files; embedded paths in nodes only"
  - "D-12, D-13: Phase-27 ==fill-in== chip on Заключение line (`==диагноз==`)"
  - "D-14: chip well-formedness invariant I10 enforced"
  - "D-15: programmatic per-canvas .mjs builder reusing Phase 72 `canvas-builder.mjs` via relative import"
  - "D-16: builder writes to `Z:\\documents\\vaults\\TEST-BASE\\Protocols\\` (outside repo working tree)"
  - "D-17: I1-I10 invariants inherited from Phase 72 VALIDATION.md unchanged; builder prints invariant pass count"
  - "D-18: file name `ОБП short 1.0.0.canvas`"
  - "D-19: [informational] vault state observation — `ОБП short 1.0.0.canvas` coexists alongside the existing `ОБП full 1.0.0.canvas` and Phase 72's other canvases"
  - "D-20: static layer — builder prints I1-I10 invariant pass count; no .canvas committed to repo"
  - "D-21: manual layer — Task 3 (`checkpoint:human-verify`) is the human_verification entry"
  - "D-22: per-canvas `73-02-SUMMARY.md` committed to `.planning/phases/73-…/`"
  - "PATTERNS.md: ID prefix `'7'` for ОБП short Canvas constructor (avoiding Phase 72 prefixes 1-5 and Phase 73-01 prefix '6')"
requirements-completed:
  - CANVAS-LIB-07
verification:
  static: passed (12/12 invariant checks I1-I10)
  manual: pending (Task 3 — author runs in Obsidian)
---

## Summary

The ОБП (органы брюшной полости) short single-trunk linear algorithmic canvas was authored programmatically via `build-obp-short.mjs`, reusing Phase 72's `canvas-builder.mjs` helper through a relative import (D-15) — no fork. The canvas has zero loops and zero contrast fan-out per CONTEXT.md D-04 + D-06 spirit (short ОБП templates do not differentiate contrast) and skips the procedure preamble per Pattern S5; the three organ-system sections (ПАРЕНХИМАТОЗНЫЕ ОРГАНЫ, ЖЕЛЧНЫЙ ПУЗЫРЬ, ЗАБРЮШИННЫЕ ЛИМФОУЗЛЫ) are linear top-to-bottom with per-section Норма? gates. Each verbatim norm string comes from `Z:\projects\references\short - ОГК ОБП ОМТ жен.md` lines 10-12 — functionally identical to муж file lines 10-14 (only minor blank-line formatting between sentences in the муж version), normalized to the жен canonical form. The terminal Заключение/Рекомендации text-block carries the verbatim string `## Заключение\nРКТ-признаки ==диагноз==\n\n## Рекомендации\nКонсультация направившего специалиста.` with a Phase-27 fill-in chip wrapping the diagnosis line per D-13. All static invariants I1-I10 pass (12/12 checks); the file is written to `Z:\documents\vaults\TEST-BASE\Protocols\ОБП short 1.0.0.canvas` (outside the repo per D-16/D-20).

## Topology

| Metric | Value |
|---|---|
| Nodes | 17 |
| Edges | 22 |
| Sections | 3 (ПАРЕНХИМАТОЗНЫЕ ОРГАНЫ, ЖЕЛЧНЫЙ ПУЗЫРЬ, ЗАБРЮШИННЫЕ ЛИМФОУЗЛЫ) |
| Loops | 0 (per D-04) |
| Snippet nodes | 3 (one per section, all `ОБП`) |
| Free-text `==…==` chips | 4 distinct (3 ==напишу что не так с …== chips + 1 ==диагноз== chip) |
| Start nodes | 1 |
| Node-type breakdown | start=1, text-block=4 (3 section headers + 1 terminal), question=3, answer=6, snippet=3 |

## Snippet Paths Used

| Section | Snippet folder path |
|---|---|
| ПАРЕНХИМАТОЗНЫЕ ОРГАНЫ | `ОБП` |
| ЖЕЛЧНЫЙ ПУЗЫРЬ | `ОБП` |
| ЗАБРЮШИННЫЕ ЛИМФОУЗЛЫ | `ОБП` |

**Cross-canvas leakage audit:** All 3 snippet paths point at the single top-level `ОБП` folder (mirroring Phase 72 ОБП full's snippet strategy per D-09). No `ОГК`, `ОМТ`, `ГМ`, `ОЗП`, `ПОЗВОНОЧНИК`, or `КОСТИ` paths used — verified via static invariant I9 BFS reachability + per-snippet I4 well-formedness, confirmed by inspection of all three `radiprotocol_subfolderPath` values in the emitted canvas JSON.

## Static Invariant Results (I1-I10)

Builder output: `[ОБП short 1.0.0.canvas] 12 pass, 0 fail (12 checks)`.

Applicable invariants:

| Invariant | Status | Note |
|---|---|---|
| I1 (single start node) | pass | exactly 1 |
| I2 (every loop has +-prefix exit edge) | vacuous | 0 loop nodes per D-04 |
| I3 (every loop has body edges) | vacuous | 0 loop nodes per D-04 |
| I4 × 3 (each snippet has subfolderPath XOR snippetPath) | pass | 3 snippet nodes, all subfolderPath=`ОБП` |
| I5 × 3 (each section header text-block present) | pass | ПАРЕНХИМАТОЗНЫЕ ОРГАНЫ, ЖЕЛЧНЫЙ ПУЗЫРЬ, ЗАБРЮШИННЫЕ ЛИМФОУЗЛЫ |
| I6 (Заключение anchor `РКТ-признаки`) | pass | substring match |
| I7 (Рекомендации `Консультация направившего специалиста.`) | pass | verbatim |
| I8 (edge referential integrity) | pass | all 22 edges reference valid node ids |
| I9 (BFS from start reaches every node) | pass | 17/17 reachable |
| I10 (==…== chip well-formedness) | pass | every line has even number of `==` (8 markers / 4 chips) |

Total: I1 + I4×3 + I5×3 + I6 + I7 + I8 + I9 + I10 = **12 pass / 12 checks**, with I2/I3 vacuously satisfied per D-04.

## Manual Verification (Task 3)

Pending. Author runs:

1. Open Obsidian on the `TEST-BASE` vault. Open `Protocols/ОБП short 1.0.0.canvas`.
2. From the Protocol Runner sidebar/inline, click "Run from start". Walk all 3 sections (ПАРЕНХИМАТОЗНЫЕ ОРГАНЫ → ЖЕЛЧНЫЙ ПУЗЫРЬ → ЗАБРЮШИННЫЕ ЛИМФОУЗЛЫ), picking norm/freetext/snippet at each.
3. On a second walkthrough, pick **Опишу вручную** at one section — confirm the `==напишу что не так с …==` chip is rendered and clickable (Phase 27 fill-in modal opens).
4. On a third walkthrough, pick **Выберу шаблон** at any section — confirm the snippet picker shows entries from `SNIPPETS\ОБП\` and ONLY those (no cross-canvas leakage from `ОГК`/`ОМТ`/etc. per D-09 + Pitfall 9).
5. Confirm the runner reaches the terminal `## Заключение\nРКТ-признаки [клик по ==диагноз==]\n\n## Рекомендации\nКонсультация направившего специалиста.` text-block and that the `==диагноз==` chip is clickable.
6. Visual diff the runner's emitted output against `Z:\projects\references\short - ОГК ОБП ОМТ жен.md` lines 10-12 + 19-26 — all three verbatim norm sentences must appear in the Норма walkthrough; the terminal Заключение/Рекомендации must match.
7. Confirm zero parser errors, zero deadlocks, zero unreachable nodes; confirm Phase 70 `+`-prefix loop-exit visual hint is NOT present anywhere (no loops in this canvas per D-04).
8. Type "approved" to mark CANVAS-LIB-07 as manually verified.

## Build Reproducibility

Re-run: `node .planning/phases/73-canvas-library-short-algorithmic-canvases/build/build-obp-short.mjs`.
