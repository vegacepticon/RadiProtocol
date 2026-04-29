---
phase: 72
slug: canvas-library-full-algorithmic-canvases
date: 2026-04-29
researcher: gsd-researcher
domain: content-authoring (Obsidian Canvas JSON, no code/build changes)
confidence: HIGH
---

# Phase 72: Canvas Library — Full Algorithmic Canvases — Research

**Researched:** 2026-04-29
**Domain:** Hand-authored Obsidian `.canvas` files modeled on `ОГК 1.10.0.canvas`. Five deliverables: ГМ, ОБП full, ОЗП, ОМТ full, ПКОП. None bundled with the plugin, none committed to this repo.
**Confidence:** HIGH (reference canvas, .md templates, and SNIPPETS folder fully inspected; the plugin's runner contract is established by Phases 50.1 / 43–46 / 47–67 and unchanged in v1.11)

## Summary

Phase 72 is a content-authoring track. No `src/` is modified, no `vitest` runs, no styles change. The author hand-builds five `.canvas` files in their personal vault, each modeled on the **shape, conventions, and node-kind vocabulary** demonstrated by `Z:\projects\references\ОГК 1.10.0.canvas`.

The reference canvas is **84 nodes / 98 edges**, organised as a single linear spine that **branches per organ** into a small choice (free-text / "+пишу что не так==" answer / template-snippet) and **enters a loop** wherever the organ may carry multiple findings. Every loop terminates via a dedicated edge whose label starts with the `+` prefix per Phase 50.1. Snippet nodes use `radiprotocol_subfolderPath` (folder picker) for "many possible findings" and `radiprotocol_snippetPath` (file-bound) for a single named snippet.

**Primary recommendation for the planner:** produce **one authoring guide per canvas** (5 plans), each containing (a) a section list verbatim from the matching `.md` template, (b) a per-section linear-vs-loop classification, (c) a per-section snippet-insertion table referring to existing `Z:\projects\references\SNIPPETS\<area>\…` paths, (d) a fixed Заключение/Рекомендации text block to copy verbatim, and (e) a runtime walkthrough checklist (start → all sections → loop exits → snippet picker → conclusion text). The author writes the JSON; the plan tells the author **what to model, not how to write JSON**.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Canvas structure approach**
- D-01: Mixed structure as in ОГК 1.10.0 — linear for simple sections, loops for repeating elements
- D-02: Each canvas standalone: ГМ, ОБП, ОЗП, ОМТ, ПКОП — independent reports with own conclusions
- D-03: Optional "НА СКАНИРОВАННЫХ УРОВНЯХ" block at end of each canvas (like ОГК 1.10.0)
- D-04: Canvases do NOT reference each other — no cross-canvas snippet links at the end
- D-05: ПКОП standalone, does not reference other canvases

**Loop modeling conventions**
- D-06: ГМ — loop for multiple focal lesions in brain parenchyma
- D-07: ОБП full — loop for liver + pancreas; other organs (spleen, kidneys, GI, lymph nodes, aorta) linear
- D-08: ОЗП — loops for kidneys + adrenal glands (for lesions/masses); other structures linear
- D-09: ОМТ — loops ✓ (multiple fibroids/cysts/etc.)
- D-10: ПКОП — loop ✓ (multiple vertebral levels L1-L2, L2-L3, etc.)
- D-11: Exit from loop — "+" prefix label ("+Все указано, продолжаем") per Phase 50.1 convention
- D-12: Hybrid modeling as in ОГК 1.10.0 — per-organ linear + nested discovery loop for complex organs

**Snippet strategy**
- D-13: Snippet nodes inserted in canvas where appropriate (template placeholders)
- D-14: Paths to snippet folders will be configured manually by author later — no pre-created folder structure needed
- D-15: Do NOT create snippet folders in advance — author will specify paths according to own structure
- D-16: Format (.json with placeholder or .md verbatim) — author decides per snippet at creation time

**Canvas independence**
- D-17: Each canvas produces complete standalone report with own conclusion and recommendations
- D-18: No references between canvases — no snippet nodes linking to other canvases
- D-19: Each canvas ends with its own Заключение + Рекомендации (auto-output fixed text)

**Verification standard**
- D-20: Verification: canvas runs end-to-end without errors
- D-21: All sections from corresponding `.md` template are present in output
- D-22: Fixed blocks (Заключение, Рекомендации) output automatically at end of canvas
- D-23: "==напишу что не так==" branches are valid — for non-standard findings where no template fits
- D-24: Snippets with fill-in placeholders considered filled after user completes fill-in
- D-25: Author verification = visual comparison of output structure vs `.md` template (all sections present, no missing parts)

### Author's Discretion
- Exact node positions in canvas (x/y coordinates) — author arranges visually
- Specific answer text wording for each branch (author can adjust to match clinical language)
- Which specific snippets to insert at each "выберу шаблон" point (author decides at creation time)
- Loop iteration naming conventions (e.g., "очаг 1", "очаг 2" or clinical description)

### Deferred Ideas (OUT OF SCOPE)
- Phase 73: Short algorithmic canvases (ОГК short, ОБП short, ОМТ short)
- Snippet folder structure creation — deferred to author's local workflow
- Canvas publication / community sharing — out of scope, deferred
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CANVAS-LIB-01 | ГМ (головной мозг) canvas in author's vault, runs end-to-end, output matches ГМ.md | Per-canvas blueprint §ГМ — section list extracted from `Z:\projects\references\ГМ.md`; snippet folder `SNIPPETS\ГМ\` exists with 16 ready snippets |
| CANVAS-LIB-02 | ОБП full canvas, runs end-to-end, matches ОБП full template | Per-canvas blueprint §ОБП full — uses both `ОБП без контраста.md` and `ОБП с контрастом.md` (contrast question = first node, like ОГК 1.10.0); 8 ОБП subfolders pre-stocked under `SNIPPETS\ОБП\` |
| CANVAS-LIB-03 | ОЗП canvas, runs end-to-end, matches ОЗП template | Per-canvas blueprint §ОЗП — uses both `ОЗП без контраста.md` and `ОЗП с контрастом.md`; flat `SNIPPETS\ОЗП\` folder with 7 snippets |
| CANVAS-LIB-04 | ОМТ full canvas, runs end-to-end, matches ОМТ full template | Per-canvas blueprint §ОМТ full — uses 4 templates (жен/муж × без КУ/с КУ); flat `SNIPPETS\ОМТ\` (only 2 snippets — author will add) |
| CANVAS-LIB-05 | ПКОП canvas, runs end-to-end, matches ПКОП template | Per-canvas blueprint §ПКОП — uses `ПКОП остеохондроз.md`; vertebral-level loop is the dominant pattern; `SNIPPETS\ПОЗВОНОЧНИК\` has 5 snippets |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md governs the **plugin source code** — esbuild build process, CSS architecture, never-delete-existing-code rule, append-only CSS rule. **None of these apply to this phase** because:

- Phase 72 produces `.canvas` JSON files in the author's local vault — not under `src/`, not under `src/styles/`, not under `tests/`.
- No `npm run build` is needed.
- No vitest tests are added.
- No commit modifies `main.js` / `styles.css`.

The single CLAUDE.md-style discipline that **does** apply to this phase: **the reference canvas `Z:\projects\references\ОГК 1.10.0.canvas` is read-only**. Do not modify it while authoring; treat it as a frozen template.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Canvas JSON authoring | Author's local vault | — | Files never enter the plugin distribution; author owns the artifact entirely |
| Node-kind semantics (start / question / answer / text-block / loop / snippet) | Plugin runtime (existing) | — | Node-kinds are interpreted by the existing Protocol Runner; this phase only assembles them |
| Snippet body content | Author's `SNIPPETS\` folder (existing structure) | — | Bodies live as `.md` or `.json` files outside the canvas; the canvas references them by path |
| Loop exit semantics | Plugin runtime, Phase 50.1 contract | — | "+"-prefix label on the exit edge is enforced by `protocol-runner.ts`; not negotiable here |
| Output assembly (concatenation, separators) | Plugin runtime | — | The runner concatenates answer/snippet/text-block content; author controls only ordering |
| Verification | Author (manual) | — | No automated test runs against authored canvases; author runs them in live Obsidian and visually compares to `.md` |

## Reference Canvas Analysis (`ОГК 1.10.0.canvas`)

### Top-level shape

The canvas is a single connected DAG (with backward edges that close loops) flowing **top-to-bottom** along a vertical spine. Sections appear as **text-block nodes** acting as headers. Each section either uses (a) a question→answer chain (linear) or (b) a loop node with a body and a `+`-labeled exit.

### Node-kind inventory (84 nodes)

| Node kind | Count | Markers |
|-----------|-------|---------|
| `start` | 1 | `radiprotocol_nodeType:"start"`, `text:""`, `color:"4"` (green), at the very top |
| `question` | 18 | `radiprotocol_nodeType:"question"`, `color:"5"` (blue) |
| `answer` | 33 | `radiprotocol_nodeType:"answer"`, `color:"2"` (red), with `radiprotocol_displayLabel` and optional `radiprotocol_answerText` |
| `text-block` | 11 | `radiprotocol_nodeType:"text-block"`, `color:"3"` (yellow); section headers like `"\nЛЕГКИЕ:"` (newline-prefixed) |
| `loop` | 8 | `radiprotocol_nodeType:"loop"`, `color:"1"` (red/loop), with `radiprotocol_headerText` |
| `snippet` | 13 | `radiprotocol_nodeType:"snippet"`, `color:"6"` (purple); ~half use `radiprotocol_subfolderPath` (folder picker), ~half use `radiprotocol_snippetPath` (file-bound) |

### Edge inventory (98 edges)

- All edges have `fromNode` / `toNode` and `fromSide` / `toSide` (`top` / `bottom` / `left` / `right`).
- ~40 of 98 edges carry a `label`. Labels with the `+` prefix mark loop-exit edges (e.g. `"+Все указано, продолжаем"`, `"+Все указано, идем далее"`, `"+Все указано, переходим к формированию заключения"`).
- Convergence is widespread: multiple incoming edges are normal (e.g. linear continuation after a 3-way answer fan-out at "Контраст вводился?" — 3 different answer nodes converge into a single text-block "Исследование произведено в положении пациента лежа на спине.").

### Conventions the 5 new canvases must follow

The reference canvas establishes **eight conventions** that every Phase 72 canvas must inherit. The planner should encode these as a checklist that each authoring guide repeats verbatim.

1. **Single `start` node, empty text, color 4.** Always the entry point. Phase 72 canvases inherit this exact shape.
2. **First-after-start question is "Контраст вводился?"** for every CT-with-contrast-eligible canvas (ОБП, ОЗП, ОМТ; ГМ and ПКОП are typically without contrast — section heading reflects "по стандартной программе"). The three answers ("Да, болюсно" / "Да, вручную" / "Нет") all fan **into the same** "положение пациента" text-block, then continue.
3. **Section headers are text-block nodes with newline prefix** — `"\nЛЕГКИЕ:"`, `"\nСРЕДОСТЕНИЕ:"`, etc. The leading `\n` is what produces the blank-line separation in output.
4. **Per-organ pattern = question + 2-3 answers + optional snippet picker + optional `==пишу что не так==` free-text answer.** "Norm" answer carries the verbatim normal-finding sentence from the .md template. Free-text answer carries `==<placeholder>==` text the author types into during runner playback.
5. **Loops use a `+`-prefixed exit label** on exactly one outgoing edge (Phase 50.1). The body branches return to the loop header; the `+`-edge proceeds past the loop.
6. **Nested loops** appear in the lung section (the lung-parenchyma loop is the body of the chest loop) — see "Loop Modeling Pattern" below.
7. **Snippet nodes carry one of two path keys**: `radiprotocol_subfolderPath` (folder picker) for "pick from many" decisions, or `radiprotocol_snippetPath` (file path including extension) for "this exact snippet" decisions. Never both, never neither.
8. **Conclusion is fixed text in a terminal `text-block` node** (or an `answer` node with the conclusion in `radiprotocol_answerText` for the "scanned levels — no" branch). The conclusion text is **copied verbatim** from the `.md` template's `## Заключение` and `## Рекомендации` sections.

### JSON excerpts

#### Excerpt A — question → answer (linear branch, normal finding)

```json
// node ids: 9d261e136b2ae458 (question), 9e3c1719cdded987 (answer "Нет")
{"id":"9d261e136b2ae458","type":"text","text":"Атеросклероз есть?",
 "radiprotocol_nodeType":"question","color":"5"},
{"id":"9e3c1719cdded987","type":"text",
 "text":"Обызвествления в стенке аорты, коронарных артериях не выявлены.",
 "radiprotocol_nodeType":"answer","radiprotocol_displayLabel":"Нет","color":"2"}
// edge:
{"fromNode":"9d261e136b2ae458","toNode":"9e3c1719cdded987","label":"Нет"}
```

#### Excerpt B — loop with body branches and `+`-prefix exit

```json
// loop header
{"id":"8673b0d4899ccc2a","type":"text",
 "text":"Есть изменения со стороны мягких тканей грудной клетки?",
 "radiprotocol_nodeType":"loop",
 "radiprotocol_headerText":"Есть изменения со стороны мягких тканей грудной клетки?",
 "color":"1"},
// body branches — outgoing from loop on side "right"
// (returns implicit; 6b0ea84b56ee5067 is "Нет" answer that loops back)
{"fromNode":"8673b0d4899ccc2a","toNode":"6b0ea84b56ee5067","label":"Нет"},
{"fromNode":"8673b0d4899ccc2a","toNode":"7a5ca405cf41d28a","label":"Выберу готовый шаблон изменений"},
{"fromNode":"8673b0d4899ccc2a","toNode":"ce583b1b2e8cf658","label":"Да, есть изменения, опишу вручную"},
// EXIT EDGE — "+" prefix; goes from loop to next section
{"fromNode":"8673b0d4899ccc2a","toNode":"a7c2dbc461a19d9d","label":"+Все указано, продолжаем"}
```

#### Excerpt C — snippet node with `subfolderPath` (folder picker)

```json
{"id":"7a5ca405cf41d28a","type":"text",
 "text":"ОГК/ГРУДНАЯ КЛЕТКА",
 "radiprotocol_nodeType":"snippet",
 "radiprotocol_snippetLabel":"Выберу готовый шаблон изменений",
 "radiprotocol_subfolderPath":"ОГК/ГРУДНАЯ КЛЕТКА",
 "color":"6"}
```

#### Excerpt D — snippet node with `snippetPath` (file-bound, single named snippet)

```json
{"id":"7dbe6483901eeb65","type":"text",
 "text":"АТЕРОСКЛЕРОЗ аорты и коронарных артерий",
 "radiprotocol_nodeType":"snippet",
 "radiprotocol_snippetPath":"ОГК/СРЕДОСТЕНИЕ/АТЕРОСКЛЕРОЗ аорты и коронарных артерий.md",
 "color":"6"}
```

#### Excerpt E — nested loop (lung-parenchyma loop nested inside chest-section flow)

```json
// Outer flow: грудная клетка loop -> ЛЕГКИЕ section -> nested loops
//   loop "Пневматизация паренхимы удовлетворительная?" (id 802b958c0bb48f4e)
//     body: answer "Да" / snippet picker / free-text answer
//     exit: -> next loop "Видны ли очаговые..." (id 70e05a337a49cd18) labeled "+Все указано, идем далее"
//   loop "Видны ли очаговые..."
//     body: answer "Нет" / snippet picker / free-text answer
//     exit: -> next question "Центральное трахеобронхиальное дерево" labeled "+Все указано, продолжаем"

// Two consecutive sibling loops within the same section share the same anatomical scope (lung parenchyma).
// The "Outer chest loop" (мягкие ткани) feeds into the linear ЛЕГКИЕ section; that section internally
// chains two loops back-to-back. This is the "nested-discovery within an organ" pattern.
```

> **Note on terminology:** ОГК does not contain a true "loop body that is itself a loop" — instead it chains **sequential** loops within an organ section (мягкие ткани → пневматизация → очаговые изменения). This sequential-loop pattern is what D-12 ("hybrid modeling as in ОГК 1.10.0") refers to. True nested loops (loop-inside-loop body) are **not used** in the reference canvas. The fixture `unified-loop-nested.canvas` shows that nested loops are **runtime-supported** but the reference canvas **does not exercise them**. Authors of Phase 72 canvases should default to the **sequential-loop chain** pattern.

## Loop Modeling Pattern

### Anatomy of a loop (per Phase 50.1 / Phases 43–46)

A loop in the runner is exactly:

1. **A `loop` node** with `radiprotocol_nodeType:"loop"` and `radiprotocol_headerText` (the question shown in the picker).
2. **Body branches** — one or more outgoing edges from the loop node, each leading to an `answer`, `snippet`, or another node. Each body branch's terminal node has an edge **back to the loop header** (implicit re-entry — runtime returns to the loop header after a body branch completes).
3. **Exactly one exit edge** — the outgoing edge whose `label` starts with `"+"`. When the user clicks the corresponding picker button, the runner advances past the loop.

### Author-facing checklist for any loop

```
[ ] Loop node has radiprotocol_nodeType:"loop"
[ ] radiprotocol_headerText is set (matches text in the bubble)
[ ] At least one body edge (no label or non-"+"-prefixed label)
[ ] Exactly one exit edge with label starting with "+"
[ ] Each body branch eventually returns to the loop header (otherwise the loop becomes a one-shot)
[ ] Exit edge target is a downstream node (next section or the final conclusion text-block)
```

### Sequential-loop chain (the "nested-discovery" idiom in ОГК)

When a single anatomical region requires multiple yes/no discovery questions, the reference canvas chains loops sequentially, **not** nests them:

```
ЛЕГКИЕ: (text-block)
  -> question "Оба легких расправлены?"
       answers: "Да" / "укажу что не так"
  -> loop "Пневматизация паренхимы удовлетворительная?"   (loop A)
       body: "Да" / snippet ОГК/ЛЕГКИЕ / free-text
       exit (+) -> loop B
  -> loop "Видны ли очаговые, интерстициальные изменения?" (loop B)
       body: "Нет" / snippet ОГК/ЛЕГКИЕ / free-text
       exit (+) -> next question "Центральное трахеобронхиальное дерево"
  -> ...continues linearly...
```

**Authoring guidance:** when modeling an organ that has 2+ discovery dimensions (e.g., for ОБП the liver: "размер?" + "плотность?" + "очаги?"), prefer **chained sequential loops** over true nesting. This matches ОГК.

### True nested loop (supported but not used in ОГК)

The fixture `src/__tests__/fixtures/unified-loop-nested.canvas` shows the inner loop's exit edge points to the **outer loop header** (not to the next section). This is allowed but **not used** in ОГК and **not recommended** for Phase 72 unless the author has a specific clinical reason.

## Per-Canvas Blueprints

The blueprints below extract section names verbatim from each `.md` template. Linear/loop classification follows the locked decisions D-06..D-10 plus organ complexity in the reference canvas.

### §1 — ГМ (Головной Мозг) — CANVAS-LIB-01

**Source template:** `Z:\projects\references\ГМ.md` (single file, 44 lines, no contrast variant — head CT is typically without contrast in this template).

**Section list (verbatim from .md):**

| # | Section header (text-block) | Linear/Loop | Notes |
|---|----------------------------|-------------|-------|
| 1 | `СРЕДИННЫЕ СТРУКТУРЫ:` | Linear | "Не смещены." (1-line normal answer) |
| 2 | `ВЕЩЕСТВО ГОЛОВНОГО МОЗГА:` | **Loop** (D-06: focal lesions) | Normal answer = 4 lines from template; loop = "Очагов патологической плотности есть?" with body "укажу очаги" / snippet picker / free-text |
| 3 | `ЛИКВОРОСОДЕРЖАЩИЕ ПРОСТРАНСТВА:` | Linear | 4-line normal answer; snippet picker for "ЖЕЛУДОЧКИ - расширенное описание" / "РАСШИРЕНИЕ ликоврных пространств" |
| 4 | `СЕЛЛЯРНАЯ ОБЛАСТЬ:` | Linear | 3-line normal answer |
| 5 | `ОКОЛОНОСОВЫЕ ПАЗУХИ:` | Linear | 1-line normal answer |
| 6 | `ОРБИТЫ:` | Linear | 2-line normal answer; snippet "ФТИЗИС глазного яблока" |
| 7 | `КОСТНЫЕ СТРУКТУРЫ:` | Linear (or short loop) | 3-line normal answer; snippet picker `КОСТИ` |
| 8 | (Optional) `НА СКАНИРОВАННЫХ УРОВНЯХ:` per D-03 | Loop | Only for findings outside the head; otherwise skip |

**Snippet insertion points (recommended subfolderPath / file paths — author swaps later):**

| Section | Suggested snippet | Path (existing in `Z:\projects\references\SNIPPETS\`) |
|---------|-------------------|-------------------------------------------------------|
| ВЕЩЕСТВО ГОЛОВНОГО МОЗГА | folder picker | `ГМ/` (16 ready snippets including КИСТОЗНО-АТРОФИЧЕСКИЕ изменения, ЛЕЙКОАРЕОЗ, субдуральное кровоизлияние) |
| ЛИКВОРОСОДЕРЖАЩИЕ ПРОСТРАНСТВА | file-bound | `ГМ/ЖЕЛУДОЧКИ - расширенное описание.md`, `ГМ/РАСШИРЕНИЕ ликоврных пространств.md` |
| ОРБИТЫ | file-bound | `ГМ/ФТИЗИС глазного яблока.md`, `ГМ/ДЕФОРМАЦИЯ медиальной стенки глазницы.md` |
| КОСТНЫЕ СТРУКТУРЫ | folder picker | `КОСТИ/` (6 ready snippets) |
| Заключение fallback | file-bound | `ГМ/блок БЕЗ ПАТАЛОГИЧЕСКИХ ИЗМЕНЕНИЙ.md`, `ГМ/ВАРИАНТ ЗАКЛЮЧЕНИЯ для дегенеративно-дистрофических изменений.md` |

**Fixed Заключение (verbatim from ГМ.md):**

```
РКТ-признаков патологических изменений в веществе головного мозга не выявлено.
```

**Fixed Рекомендации (verbatim):**

```
Консультация направившего специалиста.
```

**Estimated complexity:** ~20–25 nodes, ~25–30 edges, 1 loop. **Lowest complexity** of the five.

---

### §2 — ОБП full (Органы Брюшной Полости — full version) — CANVAS-LIB-02

**Source templates:** `Z:\projects\references\ОБП без контраста.md` AND `ОБП с контрастом.md`. The canvas first asks "Контраст вводился?" (3 answers as in ОГК) and the answer determines which section bodies are emitted.

**Section list (union of both templates):**

| # | Section header | Linear/Loop | Notes |
|---|----------------|-------------|-------|
| 0 | First "Контраст?" question fans 3 ways into "Исследование произведено в положении пациента лежа на спине." | — | Mirror ОГК node convergence pattern |
| 0a | `Наддиафрагмальные отделы легких не изменены.` | Linear | 1-line normal |
| 0b | `Свободной жидкости в брюшной полости не выявлено.` | Linear | 1-line normal |
| 1 | `ПЕЧЕНЬ:` | **Loop** (D-07) | Many measurements + 3 fill-in placeholders + "очаги/гемангиомы/кисты" loop. Folder picker → `ОБП/ПЕЧЕНЬ/` (5 snippets) |
| 2 | `ЖЕЛЧНЫЙ ПУЗЫРЬ:` | Linear | Normal text + folder picker → `ОБП/ЖЕЛЧНЫЙ ПУЗЫРЬ/` |
| 3 | `ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА:` | **Loop** (D-07) | 4 fill-in placeholders + "образование/изменения" loop. Folder picker → `ОБП/ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА/` |
| 4 | `СЕЛЕЗЕНКА:` | Linear | 4 fill-in placeholders. Folder picker → `ОБП/СЕЛЕЗЕНКА/` |
| 5 | `КИШЕЧНИК:` | Linear | 1-line normal. Folder picker → `ОБП/КИШЕЧНИК/` |
| 6 | (контраст) `СОСУДЫ:` OR (без КУ) `Аорта в брюшном отделе не расширена.` | Linear (branch on contrast) | Folder picker → `ОБП/СОСУДЫ/` |
| 7 | `ЛИМФАТИЧЕСКИЕ УЗЛЫ:` | Linear | Folder picker → `ОБП/ЛИМФАТИЧЕСКИЕ УЗЛЫ/` |
| 8 | `МЯГКИЕ ТКАНИ:` | Linear | Folder picker → `ОБП/МЯГКИЕ ТКАНИ/` |
| 9 | `КОСТНЫЕ СТРУКТУРЫ:` | Linear (or short loop) | Same dual-degeneration question as ОГК ("Умеренно/Нерезко") |
| 10 | (Optional) `НА СКАНИРОВАННЫХ УРОВНЯХ:` per D-03 | Loop | Only when findings outside abdomen |

**Snippet insertion points** — every organ has a dedicated subfolder under `Z:\projects\references\SNIPPETS\ОБП\`:

```
ОБП/ЖЕЛЧНЫЙ ПУЗЫРЬ
ОБП/КИШЕЧНИК
ОБП/ЛИМФАТИЧЕСКИЕ УЗЛЫ
ОБП/МЯГКИЕ ТКАНИ
ОБП/ПЕЧЕНЬ          (5 snippets: КИСТА, ПЕЧЕНЬ УВЕЛИЧЕНА, ФЛЕШ-ГЕМАНГИОМА, гемангиома, стеатоз)
ОБП/ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА
ОБП/СЕЛЕЗЕНКА
ОБП/СОСУДЫ
```

**Note on placeholders:** ОБП templates use `<% tp.file.cursor(N) %>` Templater syntax. In the canvas, replace each with a `==fill-in==` placeholder (the radiologist-runner equivalent — see Phase 27 placeholder chip editor); or pre-bake size measurements into snippets.

**Fixed Заключение (verbatim, both contrast variants share this):**

```
РКТ-признаки патологических изменений органов брюшной полости не выявлены.
```

**Fixed Рекомендации:**

```
Консультация направившего специалиста.
```

**Estimated complexity:** ~50–60 nodes, ~70–80 edges, 2 loops + contrast fan-out. **Highest complexity** of the five.

---

### §3 — ОЗП (Органы Забрюшинного Пространства) — CANVAS-LIB-03

**Source templates:** `ОЗП без контраста.md` + `ОЗП с контрастом.md`. Same dual-template pattern as ОБП.

**Section list:**

| # | Section header | Linear/Loop | Notes |
|---|----------------|-------------|-------|
| 0 | `Контраст вводился?` fan-out → `Исследование произведено в положении пациента лежа на спине.` | — | Mirror ОГК pattern |
| 1 | `НАДПОЧЕЧНИКИ:` | **Loop** (D-08) | Normal text + "образования есть?" loop |
| 2 | `ПРАВАЯ ПОЧКА:` | **Loop** (D-08) | Normal text with size placeholders + "образования/конкременты" loop |
| 3 | `ЛЕВАЯ ПОЧКА:` | **Loop** (D-08) | Same shape as right kidney (separate loop instance) |
| 4 | `МОЧЕТОЧНИКИ:` | Linear | 1-line normal |
| 5 | (contrast) `МОЧЕВОЙ ПУЗЫРЬ:` | Linear (only with contrast) | Conditional on contrast branch |
| 6 | (contrast) `СОСУДЫ:` OR (no contrast) `Жидкости в забрюшинном пространстве не выявлено.` | Linear | |
| 7 | `ЛИМФАТИЧЕСКИЕ УЗЛЫ:` | Linear | |
| 8 | `МЯГКИЕ ТКАНИ:` | Linear | |
| 9 | `КОСТНЫЕ СТРУКТУРЫ:` | Linear | Mirror ОГК degeneration question |

**Snippet insertion points** — flat folder, 7 snippets:

```
ОЗП/АНГИОМИОЛИПОМА.md
ОЗП/аденома надпочечника.md
ОЗП/киста КТА.md
ОЗП/киста НАТИВ.md
ОЗП/кисты почек КТА.md
ОЗП/кисты почек НАТИВ.md
ОЗП/неполное удвоение ЧЛС.md
```

**Insertion guidance for the planner:**
- ПРАВАЯ ПОЧКА / ЛЕВАЯ ПОЧКА loops → folder picker `ОЗП/` (the runner picker can show all 7 — author can refine paths later per D-14)
- НАДПОЧЕЧНИКИ loop → folder picker `ОЗП/` (or file-bound to `аденома надпочечника.md`)
- The contrast-vs-native split for kidney/cyst snippets is reflected by separate snippet files (`киста КТА.md` vs `киста НАТИВ.md`); the canvas should branch the snippet picker on the early "Контраст вводился?" answer if the author wants strict separation, or leave both visible in a single picker for author convenience.

**Fixed Заключение (verbatim, both variants):**

```
РКТ-признаков патологических изменений органов забрюшинного пространства не выявлено.
```

**Fixed Рекомендации:**

```
Консультация направившего специалиста.
```

**Estimated complexity:** ~35–45 nodes, ~50–60 edges, 3 loops + contrast fan-out.

---

### §4 — ОМТ full (Органы Малого Таза — full version) — CANVAS-LIB-04

**Source templates (FOUR — most complex template ensemble):**
- `ОМТ жен без КУ норма.md`
- `ОМТ жен с КУ норма.md`
- `ОМТ муж без контраста.md`
- `ОМТ муж с контрастом.md`

The canvas must branch **twice** at the top: (a) "Контраст вводился?" (3 answers, ОГК pattern), (b) "Пол пациента?" (2 answers: жен / муж). The cartesian product = 4 leaves, each pointing to the matching template body.

> **Author convenience tip:** model gender first (top-level question after start), then within each gender branch ask the contrast question. This halves the visual fan-out (2×3 instead of 3×2) and keeps gender-specific organs (МАТКА/ЯИЧНИКИ vs ПРЕДСТАТЕЛЬНАЯ ЖЕЛЕЗА/СЕМЕННЫЕ ПУЗЫРЬКИ) cleanly inside their gender branch.

**Section list (union, gender-keyed):**

| # | Section | Жен | Муж | Linear/Loop |
|---|---------|-----|-----|-------------|
| 0 | Sex question + contrast question | ✓ | ✓ | Question fan-outs |
| 1 | `МОЧЕВОЙ ПУЗЫРЬ:` | ✓ | ✓ | Linear |
| 2 | `МАТКА:` | ✓ | — | **Loop** (D-09: миомы/изменения) |
| 3 | `ЯИЧНИКИ:` | ✓ | — | **Loop** (D-09: кисты — left + right ovaries each may carry a cyst) |
| 4 | `ПРЕДСТАТЕЛЬНАЯ ЖЕЛЕЗА:` | — | ✓ | Linear (or short loop for аденома/гиперплазия) |
| 5 | `СЕМЕННЫЕ ПУЗЫРЬКИ:` | — | ✓ | Linear |
| 6 | `КИШЕЧНИК:` | ✓ | ✓ | Linear |
| 7 | (contrast) `СОСУДЫ:` | conditional | conditional | Linear |
| 8 | `ЛИМФАТИЧЕСКИЕ УЗЛЫ:` | ✓ | ✓ | Linear |
| 9 | `МЯГКИЕ ТКАНИ:` | ✓ | ✓ | Linear |
| 10 | `Паховые каналы не расширены.` (свободная строка, не secнелся как заголовок) | ✓ (с КУ) | ✓ (with all variants) | Linear |
| 11 | `КОСТНЫЕ СТРУКТУРЫ:` | ✓ | ✓ | Linear |

**Snippet insertion points** — `SNIPPETS\ОМТ\` is sparse (only 2 files: `вероятно аднексит.md`, `придатки не визуализируются.md`). Author will need to expand this folder, but per D-14 the canvas references `ОМТ/` subfolder paths now and snippets get added later.

**Fixed Заключение (verbatim):**

| Variant | Заключение text |
|---------|----------------|
| Жен без КУ | `Патологических изменений органов малого таза не выявлено.` |
| Жен с КУ | `РКТ-признаков патологических изменений органов малого таза не выявлено.` |
| Муж без контраста | `РКТ-признаков патологических изменений в органах малого таза не выявлено.` |
| Муж с контрастом | `РКТ-признаков патологических изменений в органах малого таза не выявлено.` |

> **Note for planner:** the four conclusion strings differ slightly. The author can either use a single normalised conclusion (recommended — pick one canonical phrasing) OR keep four distinct terminal text-blocks. **Recommendation:** normalise to a single conclusion per D-19 ("each canvas ends with its own Заключение") — minor wording differences in the source `.md` files appear to be drift, not clinical intent.

**Fixed Рекомендации (verbatim, all four):**

```
Консультация направившего специалиста.
```

**Estimated complexity:** ~55–70 nodes, ~80–100 edges, 2 loops, 2 fan-outs (sex + contrast = 6 paths).

---

### §5 — ПКОП (Пояснично-Крестцовый Отдел Позвоночника) — CANVAS-LIB-05

**Source template:** `Z:\projects\references\ПКОП остеохондроз.md` (longest single template — 70 lines, dominated by a 6-iteration vertebral-level pattern).

**Section list:**

| # | Section | Linear/Loop | Notes |
|---|---------|-------------|-------|
| 1 | `АНОМАЛИИ РАЗВИТИЯ:` | Linear | "Не выявлено." or free-text |
| 2 | `СТАТИКА:` | Linear with placeholders | Лордоз (выражен/усилен/сглажен) + ось (не нарушена/влево/вправо) — small choice fan-out |
| 3 | `ПОЗВОНКИ:` | **Loop** (vertebral-level findings: грыжи Шморля, листезы, спондилоартроз, костные разрастания) | Multi-finding section |
| 4 | `МЕЖПОЗВОНКОВЫЕ ДИСКИ:` | **Loop** (D-10) | The biggest section. The template enumerates 5 segments: L1-L2, L2-L3, L3-L4, L4-L5, L5-S1. Each segment has the same shape: выбухание/протрузия/экструзия + межпозвонковые отверстия + позвоночный канал + сагиттальный размер. The natural model is a **loop iterating per segment**, with answers picked per iteration (тип grand: выбухание/протрузия/экструзия/дискоостеофитный комплекс) |
| 5 | `ПОЗВОНОЧНЫЙ КАНАЛ:` | Linear | Single fill-in placeholder for size |
| 6 | `ИЛЕО-САКРАЛЬНЫЕ СОЧЛЕНЕНИЯ:` | Linear | Normal "не сужены" or "сужены" with placeholder |
| 7 | `КРЕСТЕЦ:` | Linear | 4-line normal |
| 8 | `ПАРАВЕРТЕБРАЛЬНЫЕ МЯГКИЕ ТКАНИ:` | Linear | "Не изменены." |

**Loop modeling for МЕЖПОЗВОНКОВЫЕ ДИСКИ (the dominant pattern):**

The author has **two valid approaches** — the planner should let the author pick:

- **Approach A — single loop, level-as-iteration.** One loop "Опишу следующий сегмент?". Body = answer set "L1-L2 / L2-L3 / L3-L4 / L4-L5 / L5-S1". Each answer carries a per-segment text fragment (with `==fill-in==` placeholders for sagittal sizes). Exit `+` = "Все сегменты описаны". Pros: compact (~10 nodes). Cons: per-iteration text is long.
- **Approach B — five linear sub-sections (no loop).** One sub-section per segment, with a yes/no question "Есть изменения в L1-L2?". Pros: matches the linear section idiom; easier to read. Cons: ~30 extra nodes.

**Recommendation:** Approach A — matches D-10 ("loop ✓ multiple vertebral levels L1-L2, L2-L3, etc.").

**Snippet insertion points** — `SNIPPETS\ПОЗВОНОЧНИК\` (5 ready snippets):

```
ПОЗВОНОЧНИК/ОТНОСИТЕЛЬНЫЙ АНАТОМИЧЕСКИЙ СТЕНОЗ позвоночного канала..md
ПОЗВОНОЧНИК/ЭКСТРУЗИЯ.md
ПОЗВОНОЧНИК/артроз атлантоосевого сустава.md     (note: cervical, may not apply — author may filter)
ПОЗВОНОЧНИК/без признаков грыж.md
ПОЗВОНОЧНИК/состояние после СПОНДИЛОДЕЗА.md
```

Plus `SNIPPETS\КОСТИ\` for КОСТНЫЕ-related findings (болезнь Форестье, остеопороз).

**Fixed Заключение (verbatim from ПКОП остеохондроз.md):**

```
РКТ-признаки нарушения статики поясничного отдела позвоночника.
Дегенеративные изменения межпозвонковых дисков, протрузии дисков L-L.
Остеохондроз пояснично-крестцового отдела позвоночника 2 степени.
Деформирующий спондилоартроз.
Деформирующий спондилез 2 степени.
Внутрителовые узлы (грыжи) Шморля L.
Артроз илеосакральных сочленений 2 степени.
Спондилоартроз крестцово-копчикового сочленения.
```

> **Note on placeholders in conclusion:** "L-L" and "L" are spine-level placeholders the radiologist fills in at runtime. Model them as `==fill-in==` placeholders inside the terminal text-block, OR break the conclusion into multiple terminal answers where each finding is conditional on whether it was observed.

**Fixed Рекомендации (verbatim):**

```
Консультация направившего специалиста.
Консультация невролога, нейрохирурга, ортопеда-травматолога по показаниям.
```

**Estimated complexity:** ~30–35 nodes, ~45–55 edges, 2 loops (vertebral bodies + intervertebral discs).

---

## Filename and Vault Path Convention

The reference canvas is named `ОГК 1.10.0.canvas` — pattern `<area> <semver>.canvas` with **space** as separator and **no leading/trailing modifiers**.

**Recommended filenames for Phase 72** (mirror the reference pattern, version `1.0.0` since these are new authored artifacts):

| Canvas | Filename | Goes into |
|--------|----------|-----------|
| ГМ | `ГМ 1.0.0.canvas` | author's vault root or chosen subfolder |
| ОБП full | `ОБП full 1.0.0.canvas` | same |
| ОЗП | `ОЗП 1.0.0.canvas` | same |
| ОМТ full | `ОМТ full 1.0.0.canvas` | same |
| ПКОП | `ПКОП 1.0.0.canvas` | same |

**Vault location:** the existing reference canvas lives in a flat `references` folder (`Z:\projects\references\`). The author may put the new canvases anywhere in their vault — the only runtime requirement is that snippet paths inside each canvas resolve relative to the configured Snippets folder (per Phase 56/61 settings). **Recommendation:** drop them in the same vault folder where the author keeps their working canvases (vault root or `Protocols/`); avoid `references/` since that is the read-only template area.

**Out of scope:** committing these files to the plugin repository. None of these `.canvas` files enter `RadiProtocolObsidian` — they live in the author's local vault only (per phase-72 deliverable definition and `.planning/STATE.md` v1.11 phase-specific notes line 95).

## Validation Architecture

`workflow.nyquist_validation: true` in `.planning/config.json`. This phase has no automated tests — but it does have **structural invariants** that are author-verifiable per canvas. Treat each canvas's per-section walkthrough as a manual test case.

### Test framework

| Property | Value |
|----------|-------|
| Framework | None (content-authoring phase) |
| Config file | None |
| Quick run command | Open canvas in Obsidian → run via Protocol Runner sidebar |
| Full suite command | Run all 5 canvases sequentially in Obsidian, copy output, diff-check vs `.md` |

### Phase requirements → manual-test map

| Req ID | Behavior | Test type | Author-runnable command | Files exist? |
|--------|----------|-----------|--------------------------|--------------|
| CANVAS-LIB-01 | ГМ canvas runs end-to-end, output structurally matches `ГМ.md` | manual-only | Open `ГМ 1.0.0.canvas` → Run from start → click through → copy result → visual diff vs ГМ.md | ❌ canvas does not exist yet (this phase creates it) |
| CANVAS-LIB-02 | ОБП full canvas runs end-to-end, both contrast variants produce structurally complete output | manual-only | Same workflow; run twice (once per contrast branch) | ❌ |
| CANVAS-LIB-03 | ОЗП canvas runs end-to-end (both contrast variants) | manual-only | Same | ❌ |
| CANVAS-LIB-04 | ОМТ full runs end-to-end (4 sex×contrast combinations) | manual-only | Run 4× | ❌ |
| CANVAS-LIB-05 | ПКОП runs end-to-end, produces 5 vertebral-level segments | manual-only | Run 1× minimum, ideally per-segment | ❌ |

**Manual-only justification:** authoring-track phase. The plugin's vitest fixtures (`src/__tests__/fixtures/`) exercise the runner against synthetic canvases, but Phase 72 deliverables live in the author's vault — not under `src/__tests__/fixtures/` and not committed. There is no harness that loads an external `.canvas` from `Z:\projects\references\` into vitest.

### Sampling rate

- **Per canvas authored:** Open in Obsidian, run end-to-end at least once for each top-level branch (1× for ГМ, 2× for ОБП/ОЗП [contrast yes/no], 4× for ОМТ [sex × contrast], 1× for ПКОП).
- **Per phase merge:** All 5 canvases run end-to-end without the runner throwing.
- **Phase gate:** `/gsd-verify-work` step runs the structural invariants checklist (below) against each canvas file (the verifier can `Read` the JSON and verify shape statically without executing the runner).

### Wave 0 gaps

None — there is no test infrastructure to set up because this is content-authoring. The "Wave 0" equivalent is **the planner emitting an authoring-checklist** that each per-canvas plan inherits.

### Structural invariants per canvas (author + verifier checklist)

These are statically verifiable by reading the JSON. Each plan's verification step should walk this list:

| # | Invariant | How to verify |
|---|-----------|---------------|
| I1 | Exactly one node has `radiprotocol_nodeType:"start"` | grep node array |
| I2 | Every `loop` node has at least one outgoing edge with `label` starting with `"+"` | per-loop edge scan |
| I3 | Every `loop` node has at least one body edge (no label OR non-`+` label) | per-loop edge scan |
| I4 | Every `snippet` node carries exactly one of `radiprotocol_subfolderPath` OR `radiprotocol_snippetPath` | per-snippet attr check |
| I5 | Every section header from the matching `.md` `## Описание` block appears as a `text-block` node text | grep text-block contents vs section list |
| I6 | The `## Заключение` text from the `.md` appears verbatim somewhere in the canvas (in a `text-block` or terminal `answer.radiprotocol_answerText`) | grep raw canvas |
| I7 | The `## Рекомендации` text from the `.md` appears verbatim | grep raw canvas |
| I8 | No edge points to a missing node (referential integrity) | edge.fromNode and edge.toNode resolve to a node id |
| I9 | All nodes are reachable from the `start` node via the edge DAG (no orphaned subgraphs) | BFS from start |
| I10 | Every `==…==` placeholder in an answer's text is well-formed (matched `==`) | regex scan |

The verifier agent can execute this as a JSON shape check on each authored canvas — no Obsidian instance needed for I1–I10.

## Authoring Workflow Recommendation

### Suggested authoring order (lowest risk → highest)

1. **§1 ГМ** (~25 nodes, 1 loop, no contrast, no sex split) — **start here**. Simplest. Establishes author's mechanical fluency with the reference pattern.
2. **§5 ПКОП** (~30 nodes, 2 loops, no contrast, no sex split). Single template, but loop modeling for vertebral segments is non-trivial. Best second target — author can apply ГМ lessons.
3. **§3 ОЗП** (~40 nodes, 3 loops + contrast). First multi-template canvas. Good rehearsal for ОБП.
4. **§2 ОБП full** (~55 nodes, 2 loops + contrast). Highest section count.
5. **§4 ОМТ full** (~65 nodes, 2 loops + sex × contrast). Most fan-out — saves it for last so the author has maximum experience by then.

### Shared sub-structures across the 5 canvases

| Pattern | Where it appears | Reuse strategy |
|---------|------------------|----------------|
| Start + "Контраст вводился?" 3-fan + "Исследование произведено..." converge | ОБП, ОЗП, ОМТ | Author copies the 5-node + 4-edge skeleton from ОГК as a starting template |
| `КОСТНЫЕ СТРУКТУРЫ:` section with "Дегенеративно-дистрофические изменения... Умеренно/Нерезко" | ОБП, ОЗП, ОГК (already), ПКОП (different shape) | Reusable ~6-node block |
| `ЛИМФАТИЧЕСКИЕ УЗЛЫ:` section ("Не увеличены" + free-text + folder picker) | ОБП, ОЗП, ОМТ | Reusable ~4-node block |
| `МЯГКИЕ ТКАНИ:` section ("Не изменены" + free-text) | All 5 (in some form) | Reusable ~3-node block |
| Optional `НА СКАНИРОВАННЫХ УРОВНЯХ:` end-block (D-03) | All 5 (optional) | Author may copy the full ~6-node ОГК sub-structure (the "scanned levels" loop near the end of ОГК), but **strip cross-canvas snippets** per D-04 (no `ОБП` / `ОЗП` snippet folder pickers from inside ГМ). For ГМ this would point to "lower neck"; for ПКОП it could be a pelvis reference; per D-05 ПКОП is standalone, so just omit the cross-references |
| Terminal Заключение/Рекомендации `text-block` | All 5 | Each canvas has its own text — no template, but the **shape** (single terminal text-block node) is shared |

### Plan structure recommendation

The planner should emit **5 plans (one per canvas) + optionally a "shared skeleton" plan-0 that documents the common sub-structures**, OR alternatively **5 self-contained plans** with the shared skeleton inlined. Given the author works manually in Obsidian Canvas UI (not by editing JSON), the shared-skeleton plan is overkill — **prefer 5 self-contained per-canvas plans**, each repeating the structural invariants checklist verbatim.

## Pitfalls and Landmines

These are the failure modes that have empirically broken canvases in prior phases. The planner should include a "things to check before declaring done" list in each authoring plan referencing this section.

### Pitfall 1: Missing `+`-prefix on the loop exit edge

**What goes wrong:** the loop never advances to the next section; the runner just keeps showing the loop picker forever (no infinite loop in code, but a deadlock for the user).
**Why it happens:** the author forgets to type the `+` prefix at the start of the exit edge label, or types `Все указано, продолжаем` (no `+`).
**How to avoid:** Phase 50.1 enforces `+` as the marker. Visually scan every loop's outgoing edges; one and only one must start with `+`.
**Warning signs:** Phase 70 (LOOP-EXIT-01) added a visual hint to the runner picker — the exit button has a distinct background. If during testing the author sees no visually-distinguishable button at a loop, the `+` is missing.

### Pitfall 2: Loop body branch doesn't return to the loop header

**What goes wrong:** the body branch becomes a one-shot (clicking the body picker option exits the loop instead of cycling).
**Why it happens:** author drew a body-branch edge and forgot to draw the return edge from the body's terminal node back to the loop header.
**How to avoid:** for every body branch, verify there is a path from the branch's terminal node back to the loop header node (typically a single edge). The reference canvas does this for all 8 loops.
**Warning signs:** running the canvas, picking a body option, and getting jumped directly into the next section instead of back to the loop picker.

### Pitfall 3: Snippet node carries both `subfolderPath` and `snippetPath`, or neither

**What goes wrong:** runtime ambiguity — the runner has handling for "folder picker" vs "file-bound" and the wrong key combination either crashes or silently misbehaves.
**Why it happens:** author copies a snippet node from one place to another and edits one key but not the other.
**How to avoid:** invariant I4 above. Verifier checks each snippet node has **exactly one** of the two keys.
**Warning signs:** the runner throws, or the snippet picker shows nothing/everything wrongly.

### Pitfall 4: Section header text-block missing leading `\n`

**What goes wrong:** in the assembled output, sections run together without blank-line separation.
**Why it happens:** the convention `"\nЛЕГКИЕ:"` (with leading newline) creates the visual gap. Without it, output is squashed.
**How to avoid:** copy the leading `\n` literally from the ОГК reference text-block nodes.
**Warning signs:** runner output does not match `.md` template formatting visually.

### Pitfall 5: Free-text answer's `==…==` placeholder not closed

**What goes wrong:** the runner emits unmatched `==` in output; downstream Obsidian markdown parsing flags it.
**Why it happens:** author types `==укажу что не так` and forgets the closing `==`.
**How to avoid:** invariant I10 — every `==` must pair.
**Warning signs:** Phase 27 placeholder chip editor shows broken/unmatched chips.

### Pitfall 6: `radiprotocol_displayLabel` differs from edge `label`

**What goes wrong:** runner UI shows the picker button label from one source (edge label per Phase 50.1 / Phase 51) and the answer's `displayLabel` is ignored or causes confusion in Node Editor sync (Phase 63).
**Why it happens:** author edits the answer node's `displayLabel` but doesn't update the parent question's outgoing edge `label`.
**How to avoid:** Phase 51 reversal made edge label the source of truth for picker buttons, BUT Phase 63 introduced bidirectional sync — keep them aligned.
**Warning signs:** picker button text doesn't match the answer's intent during runtime test.

### Pitfall 7: Convergence node receives multiple incoming edges from same parent

**What goes wrong:** duplicate output text (the runner concatenates each path's contributions).
**Why it happens:** author drew 2 edges from one question to the same downstream node by mistake (e.g., dragging twice).
**How to avoid:** for any node with high in-degree, audit the source nodes — each source should appear once.
**Warning signs:** runner output shows duplicated sentences.

### Pitfall 8: Section heading text-block reused (stale reference) from ОГК

**What goes wrong:** if the author duplicates ОГК's structure and forgets to retitle a section, ГМ's report could contain `ЛЕГКИЕ:` or `ПЛЕВРАЛЬНЫЕ ПОЛОСТИ:` (chest sections) which is clinically nonsensical for a brain CT.
**How to avoid:** when copy-skeletoning, immediately walk the canvas and replace each section header text. Cross-check against the canvas's matching `.md` template's section list.
**Warning signs:** section header in the runner output does not appear in the matching `.md` template.

### Pitfall 9: Cross-canvas snippet pickers leaking into a standalone canvas

**What goes wrong:** D-04, D-05, D-18 forbid this. The author copies the ОГК "НА СКАНИРОВАННЫХ УРОВНЯХ" tail (which includes `ОБП` / `ОЗП` / `ШЕЯ` snippet folder pickers) and forgets to strip them.
**How to avoid:** if copying the "scanned levels" tail, remove all snippet nodes that point to other canvases' folders. ГМ should reference at most `ШЕЯ/` (lower neck on a brain scan) — never `ОБП/` or `ОЗП/`.
**Warning signs:** `radiprotocol_subfolderPath` value contains a sister-canvas's name (`ОБП`, `ОЗП`, `ОМТ`, `ПКОП`).

### Pitfall 10: `ОМТ full` collapses gender × contrast 4 leaves into 2

**What goes wrong:** author only models жен-with-contrast and 1 male variant, misses 2 of the 4 templates.
**How to avoid:** explicit checklist — verify all 4 of `ОМТ жен без КУ норма.md`, `ОМТ жен с КУ норма.md`, `ОМТ муж без контраста.md`, `ОМТ муж с контрастом.md` are reachable from the start node by some path.
**Warning signs:** running the runner with one of the 4 combinations produces output missing organ-system sections that the corresponding `.md` template lists.

## State of the Art

The conventions used here are **not** changing in v1.11 — Phases 69/70/71 do not modify the runner's edge/loop semantics. Phase 70 adds a CSS-only visual hint to loop-exit buttons but does not change the underlying `+`-prefix contract. Phase 72 inherits the runtime contract as-is.

| Aspect | Established by | Status in v1.11 |
|--------|---------------|-----------------|
| `+`-prefix loop exit | Phase 50.1 | Stable; Phase 70 adds visual hint only |
| Snippet node `subfolderPath` vs `snippetPath` | Phases 28–31 (snippet node), Phase 56 (file-bound), Phase 67 (file-bound parity in all traversal paths) | Stable |
| `radiprotocol_displayLabel` ↔ edge `label` sync | Phases 51, 63 | Stable (bidirectional sync as of Phase 63) |
| Inline-mode appends each step to active note | Phase 54 | Stable |
| Node Editor + Canvas live sync | Phase 63 | Stable |
| Loop unified node model | Phases 43–46 | Stable; Phase 47 removed free-text-input |

**No deprecated features apply.** The reference canvas `ОГК 1.10.0.canvas` was authored against the v1.10 runtime — fully compatible with v1.11.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Author intends ОБП full to cover both contrast variants in a single canvas (mirroring ОГК's "Контраст вводился?" pattern) | §2 ОБП full | LOW — if author wants 2 separate canvases (ОБП-без-КУ + ОБП-с-КУ), the requirement CANVAS-LIB-02 still passes for either one; planner can clarify with author |
| A2 | Author intends ОМТ full to cover both sexes in a single canvas with sex+contrast fan-out | §4 ОМТ full | MEDIUM — if author wants 2 separate canvases (ОМТ-жен + ОМТ-муж), CANVAS-LIB-04 traceability becomes ambiguous; planner should ask |
| A3 | "ОБП full" filename should literally include "full" to disambiguate from future short version | Filename convention | LOW — filename is author's discretion per CONTEXT.md |
| A4 | The reference canvas `ОГК 1.10.0.canvas` author-side conventions are stable and reflect runtime-supported semantics in v1.11 | All sections | LOW — verified by reading canvas + checking STATE.md v1.11 phase notes (lines 90–96) |
| A5 | The four ОМТ template wording differences in Заключение ("Патологических..." vs "РКТ-признаков патологических..." vs "...в органах малого таза не выявлено") are template drift, not clinical intent — single normalized conclusion is acceptable | §4 fixed Заключение | LOW — author can override if drift is intentional |
| A6 | The recommended authoring order (ГМ → ПКОП → ОЗП → ОБП → ОМТ) matches author's preference | Authoring workflow | LOW — order is recommendation only; author may pick any order |
| A7 | The "Approach A" single-loop-iterates-per-segment recommendation for ПКОП МЕЖПОЗВОНКОВЫЕ ДИСКИ matches what the author wants | §5 ПКОП | LOW — both approaches produce CANVAS-LIB-05-compliant output; planner can offer choice |
| A8 | Snippet picker can show all snippets in `SNIPPETS\ОЗП\` (flat folder) without per-contrast filtering | §3 ОЗП snippet insertion | LOW — runtime supports filtering by selecting `subfolderPath` carefully; the existing flat layout is the author's deliberate choice |

**Of these 8 assumptions, A2 carries the highest planning risk** — the planner should explicitly ask the author whether ОМТ full = one canvas (sex+contrast fan-out) or two canvases (one per sex). A1 has a similar but lower-stakes question for ОБП.

## Open Questions for the Planner

1. **ОМТ full structure (A2):** Is CANVAS-LIB-04 satisfied by a single canvas with sex+contrast fan-out, or by two canvases (ОМТ-жен.canvas + ОМТ-муж.canvas)? The deliverable text says "An ОМТ canvas exists" (singular), suggesting one — but author has 4 templates, suggesting maybe two.
2. **ОБП and ОЗП single-vs-double canvas (A1):** Same question for the contrast-yes/no split. ОГК reference uses single canvas with "Контраст вводился?" fan-out — recommend mirroring that.
3. **ПКОП disc loop modeling (A7):** Approach A (single loop, segment as iteration) vs Approach B (5 linear sub-sections). Both pass CANVAS-LIB-05. Author preference?
4. **Optional "НА СКАНИРОВАННЫХ УРОВНЯХ" tail (D-03):** include in each canvas or skip? D-03 says "optional". Recommend including in ГМ and ПКОП at least, since they may pick up findings in adjacent regions.
5. **Templater placeholders (`<% tp.file.cursor() %>`)** in source `.md` files — replace with `==fill-in==` in canvas (Phase 27 chip editor convention) or pre-bake via snippets? **Recommend `==fill-in==`** because it stays runtime-editable without Templater being installed.

These can be raised at planning time or at execution time during the first canvas (ГМ) — the answers transfer to the other 4.

## Environment Availability

The phase has **no external tool dependencies** beyond Obsidian itself with the RadiProtocol plugin installed and the existing reference canvas + `.md` templates + SNIPPETS folder all of which already exist at `Z:\projects\references\`.

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Obsidian | Running the canvas to verify | ✓ (author's local install) | n/a | — |
| RadiProtocol plugin | Interpreting canvas JSON | ✓ (v1.10 currently shipped; v1.11 in flight but not required) | 1.10 → 1.11 | — |
| Reference canvas `ОГК 1.10.0.canvas` | Structural template | ✓ | 1.10.0 | — |
| `.md` templates | Section list + fixed text | ✓ (all 5 areas covered, multiple variants per area) | n/a | — |
| `SNIPPETS\` folder | Snippet picker targets | ✓ (partial — ОМТ has only 2 snippets) | n/a | Author adds snippets later per D-14/D-15 |
| `gsd-sdk` | Plan/research commits | ✓ (project tooling) | n/a | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `SNIPPETS\ОМТ\` is sparse — author will add per-organ snippets at canvas-creation time (D-13/D-14/D-15 explicitly defer this).

## Sources

### Primary (HIGH confidence)
- `Z:\projects\references\ОГК 1.10.0.canvas` — full read; 84 nodes, 98 edges; complete structural inventory
- `Z:\projects\references\ГМ.md` — full read; section list + fixed text
- `Z:\projects\references\ОБП без контраста.md` + `ОБП с контрастом.md` — full read
- `Z:\projects\references\ОЗП без контраста.md` + `ОЗП с контрастом.md` — full read
- `Z:\projects\references\ОМТ жен без КУ норма.md` + `ОМТ жен с КУ норма.md` + `ОМТ муж без контраста.md` + `ОМТ муж с контрастом.md` — full read
- `Z:\projects\references\ПКОП остеохондроз.md` — full read
- `Z:\projects\references\SNIPPETS\` directory tree — listed 3 levels deep; 8 ОБП subfolders, 5 ОГК subfolders, flat ОМТ/ОЗП/ГМ/КОСТИ/ПОЗВОНОЧНИК/ШЕЯ
- `.planning/phases/72-canvas-library-full-algorithmic-canvases/72-CONTEXT.md` — locked decisions D-01..D-25
- `.planning/REQUIREMENTS.md` lines 27–45 — CANVAS-LIB-01..05 verbatim
- `.planning/STATE.md` lines 90–96 — v1.11 Phase 72/73 domain notes
- `.planning/ROADMAP.md` lines 224–237 — Phase 72 success criteria
- `src/__tests__/fixtures/unified-loop-nested.canvas` — confirms nested loop runtime support

### Secondary (MEDIUM confidence)
- Phase 50.1 `+`-prefix exit convention — referenced by CONTEXT.md and STATE.md, not re-verified against runner source
- Phase 27 placeholder chip editor — referenced by STATE.md "Standing Pitfalls"; treated as available

### Tertiary (LOW confidence)
- None — phase scope is fully covered by primary sources.

## Metadata

**Confidence breakdown:**
- Reference canvas analysis: HIGH — full file read
- Per-canvas section lists: HIGH — every `.md` template read verbatim
- Loop modeling pattern: HIGH — direct excerpts from reference canvas + matching unit-test fixture
- Snippet folder paths: HIGH — directory listing
- Authoring order recommendation: MEDIUM — based on complexity heuristic, not author preference (A6)
- Filename convention: MEDIUM — extrapolated from single reference (`ОГК 1.10.0.canvas`); author may prefer different
- Pitfall list: HIGH — derived from CLAUDE.md + STATE.md "Standing Pitfalls" + CONTEXT.md

**Research date:** 2026-04-29
**Valid until:** end of v1.11 milestone (canvas runtime contract is stable; if Phases 73 or future v1.12 changes loop semantics, re-validate)

## RESEARCH COMPLETE

Planner can now lay out 5 per-canvas authoring guides — one plan per canvas (CANVAS-LIB-01..05), each plan emitting a structured authoring checklist (section list from `.md`, linear/loop classification per section, snippet insertion table, fixed Заключение/Рекомендации text, structural invariants I1–I10 verification). Recommended plan order matches recommended authoring order: ГМ → ПКОП → ОЗП → ОБП full → ОМТ full. The 5 plans are independent (no inter-plan dependencies) and can run in parallel waves if author works on multiple canvases simultaneously, but sequential authoring is the lower-cognitive-load path.
