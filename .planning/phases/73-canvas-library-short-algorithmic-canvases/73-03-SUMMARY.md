---
phase: 73-canvas-library-short-algorithmic-canvases
plan: 03
id: 73-03-omt-short-canvas
subsystem: content-authoring (Obsidian Canvas JSON, no plugin code touched)
tags:
  - canvas-authoring
  - content
  - obsidian
  - omt
  - short
  - sex-fanout
requires:
  - CANVAS-LIB-08
provides:
  - ОМТ (органы малого таза) short-version algorithmic canvas
  - Single canvas with sex 2-way fan-out at the top per D-05 (Жен / Муж)
  - 4 sections per Жен sub-flow (МАТКА, ПРИДАТКИ, ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ, КОСТНЫЕ СТРУКТУРЫ)
  - 4 sections per Муж sub-flow (ПРОСТАТА, СЕМЕННЫЕ ПУЗЫРЬКИ, ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ, КОСТНЫЕ СТРУКТУРЫ)
  - Shared terminal Заключение + Рекомендации per D-07 (single node — no per-sex divergence)
  - Phase-27 ==fill-in== chips for measurement gaps (D-12) + ==диагноз== chip on Заключение (D-13)
  - Zero loops (D-04), zero contrast fan-out (D-06), zero procedure preamble (Pattern S5)
affects:
  - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОМТ short 1.0.0.canvas (author's vault — not in repo per D-16/D-20)"
tech-stack:
  added: []
patterns:
  - Sex 2-way fan-out (Phase 72 build-omt.mjs sex layer minus contrast inner fan-out)
  - Linear per-sex sub-flow with section() + converge() helpers from Phase 72 build-omt.mjs (trunk-aware variant)
  - Shared terminal text-block both sub-trunks converge into per D-07
  - Phase-27 ==fill-in== chips embedded in answer norm-text and terminal Заключение
  - Reuse Phase 72 canvas-builder.mjs via relative import (D-15) — no fork, no duplication
key-files:
  created:
    - "Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОМТ short 1.0.0.canvas"
    - .planning/phases/73-canvas-library-short-algorithmic-canvases/build/build-omt-short.mjs
  modified: []
key-decisions:
  - "D-01: per-organ-system text-blocks (NOT monolithic) — per-sex sub-flows of 4 sections each"
  - "D-02: per-system Норма? gate — Да-branch verbatim norm / Нет-branch ==напишу что не так== chip"
  - "D-03: terminal `## Заключение` + `## Рекомендации` text-block (D-07: single shared)"
  - "D-04: NO loops in short canvases"
  - "D-05: ОМТ short = ONE canvas with sex 2-way fan-out at top (Жен/Муж)"
  - "D-06: NO Контраст fan-out (short ОМТ does not differentiate contrast — only sex matters)"
  - "D-07: After per-sex sub-trunks both converge to ONE shared terminal Заключение + Рекомендации"
  - "D-08, D-09: snippet-node strategy reusing Phase 72's `SNIPPETS\\ОМТ\\` subfolder"
  - "D-10: did NOT pre-create snippet files; embedded paths in nodes only"
  - "D-11: КОСТНЫЕ СТРУКТУРЫ section terminating each sub-flow uses hardcoded text-block (no КОСТИ snippet picker — generator's recommended choice)"
  - "D-12: Phase-27 ==fill-in== chips for measurement gaps — МАТКА (==размер тела матки мм==, ==размер шейки матки мм==), ПРИДАТКИ (==придатки справа==, ==придатки слева==), ПРОСТАТА (==размер простаты мм==)"
  - "D-13: Phase-27 ==диагноз== chip on Заключение line"
  - "D-14: chip well-formedness invariant I10 enforced"
  - "D-15: programmatic per-canvas .mjs builder reusing Phase 72 `canvas-builder.mjs` via relative import"
  - "D-16: builder writes to `Z:\\documents\\vaults\\TEST-BASE\\Protocols\\` (outside repo working tree)"
  - "D-17: I1-I10 invariants inherited from Phase 72 VALIDATION.md unchanged; builder prints invariant pass count"
  - "D-18: file name `ОМТ short 1.0.0.canvas`"
  - "D-19: [informational] vault state observation — `ОМТ short 1.0.0.canvas` coexists alongside the existing `ОМТ full 1.0.0.canvas` and Phase 72's other canvases"
  - "D-20: static layer — builder prints I1-I10 invariant pass count; no .canvas committed to repo"
  - "D-21: manual layer — Task 3 (`checkpoint:human-verify`) is the human_verification entry; author walks BOTH Жен AND Муж paths"
  - "D-22: per-canvas `73-03-SUMMARY.md` committed to `.planning/phases/73-…/`"
  - "PATTERNS.md: ID prefix `'8'` for ОМТ short Canvas constructor (avoiding Phase 72 prefixes 1-5 and Phase 73-01/02 prefixes 6/7)"
requirements-completed:
  - CANVAS-LIB-08
verification:
  static: passed (18/18 invariant checks I1-I10)
  manual: pending (Task 3 — author walks BOTH Жен AND Муж paths in Obsidian)
---

## Summary

The ОМТ (органы малого таза) short single-canvas algorithmic structure was authored programmatically via `build-omt-short.mjs`, reusing Phase 72's `canvas-builder.mjs` helper through a relative import (D-15) — no fork. The canvas implements the sex 2-way fan-out pattern at the top per D-05: an initial Question «Пол пациента?» fans out into Жен and Муж answer nodes, each feeding its own linear sub-flow of 4 organ-system sections with `section()` + `converge()` helpers. The Жен sub-flow contains the verbatim sentences from `Z:\projects\references\short - ОГК ОБП ОМТ жен.md` lines 15-17 (МАТКА, ПРИДАТКИ, ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ, КОСТНЫЕ СТРУКТУРЫ), and the Муж sub-flow contains the verbatim sentences from `Z:\projects\references\short - ОГК ОБП ОМТ муж.md` lines 17-21 (ПРОСТАТА, СЕМЕННЫЕ ПУЗЫРЬКИ, ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ, КОСТНЫЕ СТРУКТУРЫ). Per D-07 both sub-trunks converge to ONE shared terminal Заключение/Рекомендации text-block — there is no per-sex terminal divergence. The canvas has zero loops per D-04, zero Контраст fan-out per D-06, and no procedure preamble per Pattern S5. Phase-27 `==fill-in==` chips embed all measurement gaps from the source MD per D-12 (5 measurement chips total) plus the terminal `==диагноз==` chip per D-13. All static invariants I1-I10 pass (18/18 checks); the file is written to `Z:\documents\vaults\TEST-BASE\Protocols\ОМТ short 1.0.0.canvas` (outside the repo per D-16/D-20).

## Topology

| Metric | Value |
|---|---|
| Nodes | 43 |
| Edges | 57 |
| Sections (Жен) | 4 (МАТКА, ПРИДАТКИ, ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ, КОСТНЫЕ СТРУКТУРЫ) |
| Sections (Муж) | 4 (ПРОСТАТА, СЕМЕННЫЕ ПУЗЫРЬКИ, ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ, КОСТНЫЕ СТРУКТУРЫ) |
| Sex fan-out | 2-way (Жен/Муж) per D-05 |
| Loops | 0 (per D-04) |
| Contrast fan-out | 0 (per D-06) |
| Snippet nodes | 6 (МАТКА, ПРИДАТКИ, ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ on Жен trunk; ПРОСТАТА, СЕМЕННЫЕ ПУЗЫРЬКИ, ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ on Муж trunk; КОСТНЫЕ СТРУКТУРЫ omits picker per D-11 on both trunks) |
| Free-text `==…==` chip occurrences | 14 total (5 measurement chips per D-12 + 8 ==напишу что не так с …== chips across 8 sections + 1 ==диагноз== chip per D-13) |
| Terminal text-blocks | 1 (shared, per D-07) |
| Start nodes | 1 |
| Node-type breakdown | start=1, text-block=9 (8 section headers + 1 terminal), question=9 (1 sex + 8 section gates), answer=18 (2 sex answers + 16 norm/free across 8 sections), snippet=6 |

## Snippet Paths Used

| Section | Sub-flow | Snippet folder path |
|---|---|---|
| МАТКА | Жен | `ОМТ` |
| ПРИДАТКИ | Жен | `ОМТ` |
| ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ | Жен | `ОМТ` |
| КОСТНЫЕ СТРУКТУРЫ | Жен | (no snippet picker — D-11 hardcoded text-block) |
| ПРОСТАТА | Муж | `ОМТ` |
| СЕМЕННЫЕ ПУЗЫРЬКИ | Муж | `ОМТ` |
| ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ | Муж | `ОМТ` |
| КОСТНЫЕ СТРУКТУРЫ | Муж | (no snippet picker — D-11 hardcoded text-block) |

**Cross-canvas leakage audit:** All 6 snippet paths point at the single top-level `ОМТ` folder (mirroring Phase 72 ОМТ full's snippet strategy per D-09). No `ОГК`, `ОБП`, `ГМ`, `ОЗП`, `ПОЗВОНОЧНИК`, or `КОСТИ` paths used — D-11 chose a hardcoded text-block for КОСТНЫЕ СТРУКТУРЫ rather than a `КОСТИ` snippet picker, eliminating any potential bone-snippet folder reference. Verified via static invariant I9 BFS reachability + per-snippet I4 well-formedness, confirmed by inspection of all six `radiprotocol_subfolderPath` values in the emitted canvas JSON.

## Sex Fan-Out Modeling

ОМТ short uses the Phase 72 `build-omt.mjs` sex fan-out skeleton **minus** the Контраст inner fan-out per D-06. Two surviving x-trunks (`X_FEM = -1500`, `X_MUZH = 1500`) each carry their own linear `section()` chain rooted at the corresponding answer node from the top-level «Пол пациента?» Question. Both sub-flows terminate by converging into ONE shared terminal text-block at `x = 0` per D-07 — not per-sex divergent terminals. Compare:

- **Phase 72 ОМТ full** (`build-omt.mjs`): 4-way fan-out (sex × contrast = `X_FNC`/`X_FC`/`X_MNC`/`X_MC`), 4 sub-trunks each ~10 sections, 4 organ-discovery loops, all 4 trunks converge to one terminal.
- **Phase 73 ОМТ short** (this canvas): 2-way fan-out (sex only — `X_FEM`/`X_MUZH`), 2 sub-trunks of 4 sections each, 0 loops per D-04, both trunks converge to one terminal per D-07.

The structural simplification is roughly proportional to the source-MD difference between full ОМТ description (~30 lines per sex × contrast) and short ОМТ description (3-5 sentences per sex).

## Static Invariant Results (I1-I10)

Builder output: `[ОМТ short 1.0.0.canvas] 18 pass, 0 fail (18 checks)`.

Applicable invariants:

| Invariant | Status | Note |
|---|---|---|
| I1 (single start node) | pass | exactly 1 |
| I2 (every loop has +-prefix exit edge) | vacuous | 0 loop nodes per D-04 |
| I3 (every loop has body edges) | vacuous | 0 loop nodes per D-04 |
| I4 × 6 (each snippet has subfolderPath XOR snippetPath) | pass | 6 snippet nodes, all `subfolderPath = 'ОМТ'` |
| I5 × 6 (each unique section header text-block present) | pass | МАТКА, ПРИДАТКИ, ПРОСТАТА, СЕМЕННЫЕ ПУЗЫРЬКИ, ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ, КОСТНЫЕ СТРУКТУРЫ — note that ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ and КОСТНЫЕ СТРУКТУРЫ appear in BOTH sub-flows but I5's `n.text.includes(h)` only requires substring be findable in some text-block, so each header counts once in the spec list |
| I6 (Заключение anchor `РКТ-признаки`) | pass | substring match |
| I7 (Рекомендации `Консультация направившего специалиста.`) | pass | verbatim |
| I8 (edge referential integrity) | pass | all 57 edges reference valid node ids |
| I9 (BFS from start reaches every node) | pass | 43/43 reachable |
| I10 (==…== chip well-formedness) | pass | every line has even number of `==` (14 chip occurrences = 28 markers) |

Total: I1 + I4×6 + I5×6 + I6 + I7 + I8 + I9 + I10 = **18 pass / 18 checks**, with I2/I3 vacuously satisfied per D-04.

## Manual Verification (Task 3)

Pending. Author runs:

1. Open Obsidian on the `TEST-BASE` vault. Open `Protocols/ОМТ short 1.0.0.canvas`. Click "Run from start".
2. **Path 1 (Жен):** At the «Пол пациента?» Question, pick «Жен». Walk all 4 Жен sections (МАТКА → ПРИДАТКИ → ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ → КОСТНЫЕ СТРУКТУРЫ). Confirm:
   - МАТКА **Норма** answer renders `Тело матки в поперечнике до ==размер тела матки мм== мм. Шейка матки до ==размер шейки матки мм== мм.` — both chips clickable in Phase-27 fill-in modal.
   - ПРИДАТКИ **Норма** answer renders `Придатки: справа - ==придатки справа==, слева - ==придатки слева==.` — both chips clickable.
   - ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ **Норма** renders `Подвздошные лимфоузлы не увеличены.` verbatim.
   - КОСТНЫЕ СТРУКТУРЫ **Норма** renders `Костно-деструктивных изменений не выявлено.` verbatim.
   - On at least one Жен section, pick **Опишу вручную** — confirm the `==напишу что не так с …==` chip is rendered and clickable.
   - On at least one Жен section that has a snippet picker (МАТКА / ПРИДАТКИ / ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ), pick **Выберу шаблон** — confirm picker shows entries from `SNIPPETS\ОМТ\` ONLY (no cross-canvas leakage from `ОГК`/`ОБП`/`ГМ`/`ОЗП`/etc.).
   - Reach shared terminal Заключение/Рекомендации; the `==диагноз==` chip is clickable.
3. **Path 2 (Муж):** Re-run the canvas. At sex Question pick «Муж». Walk all 4 Муж sections (ПРОСТАТА → СЕМЕННЫЕ ПУЗЫРЬКИ → ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ → КОСТНЫЕ СТРУКТУРЫ). Confirm:
   - ПРОСТАТА **Норма** renders `Простата в поперечнике до ==размер простаты мм== мм.` — chip clickable.
   - СЕМЕННЫЕ ПУЗЫРЬКИ **Норма** renders `Семенные пузырьки интактны. Окружающая клетчатка не изменена.` verbatim.
   - ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ + КОСТНЫЕ СТРУКТУРЫ render verbatim norm strings.
   - Reach the SAME shared terminal as Walkthrough 1 (per D-07 — single terminal node).
4. **Cross-walkthrough check (D-07):** Confirm both walkthroughs converge to ONE terminal Заключение/Рекомендации — visually inspect the canvas to verify there is exactly ONE terminal text-block at `x = 0`, not two divergent per-sex terminals.
5. Visual diff Жен output against `Z:\projects\references\short - ОГК ОБП ОМТ жен.md` lines 15-17 + 19-26.
6. Visual diff Муж output against `Z:\projects\references\short - ОГК ОБП ОМТ муж.md` lines 17-21 + 23-30.
7. Confirm zero parser errors, zero deadlocks, zero unreachable nodes across both walkthroughs; confirm Phase 70 `+`-prefix loop-exit visual hint is NOT present anywhere (no loops in this canvas per D-04).
8. Type "approved" to mark CANVAS-LIB-08 as manually verified.

## Build Reproducibility

Re-run: `node .planning/phases/73-canvas-library-short-algorithmic-canvases/build/build-omt-short.mjs`.

## Self-Check: PASSED

- File exists: `.planning/phases/73-canvas-library-short-algorithmic-canvases/build/build-omt-short.mjs`
- File exists: `.planning/phases/73-canvas-library-short-algorithmic-canvases/73-03-SUMMARY.md`
- File exists: `Z:\documents\vaults\TEST-BASE\Protocols\ОМТ short 1.0.0.canvas`
- Commit: `66bfada` (Task 1 — feat(73-03): generate ОМТ short algorithmic canvas)
- Static layer: 18/18 invariant checks pass (Task 1 builder output)
- Manual layer: pending Task 3 author Obsidian walkthrough (`checkpoint:human-verify`) — BOTH Жен AND Муж paths required
