# Phase 73: Canvas Library — Short Algorithmic Canvases — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 4 new builders (3 per-canvas + 1 optional shared helper)
**Analogs found:** 4 / 4

> Per CONTEXT.md: Phase 73 reuses Phase 72 conventions verbatim — no 73-RESEARCH.md was written. All patterns originate from `.planning/phases/72-canvas-library-full-algorithmic-canvases/build/`. The closest analogs are catalogued below with the exact code excerpts that the executor must replicate.

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `.planning/phases/73-…/build/canvas-builder.mjs` (optional fork) | helper / factory module | transform | `.planning/phases/72-…/build/canvas-builder.mjs` | exact (verbatim copy) |
| `.planning/phases/73-…/build/build-ogk-short.mjs` | per-canvas builder | transform → file-I/O | `.planning/phases/72-…/build/build-pkop.mjs` (linear, single-trunk, no fan-out) + `build-gm.mjs` (terminal Заключение pattern) | role-and-flow exact, simpler |
| `.planning/phases/73-…/build/build-obp-short.mjs` | per-canvas builder | transform → file-I/O | `.planning/phases/72-…/build/build-pkop.mjs` (linear, single-trunk) | role-and-flow exact, simpler |
| `.planning/phases/73-…/build/build-omt-short.mjs` | per-canvas builder | transform → file-I/O | `.planning/phases/72-…/build/build-omt.mjs` (sex fan-out skeleton, minus contrast inner fan-out) | role-and-flow exact, simpler (2-way instead of 4-way) |

**Phase 72 file size reference (sets order-of-magnitude expectation for Phase 73 outputs):**
- `canvas-builder.mjs` 7.7 KB (≈220 lines) — reused verbatim or forked unchanged
- `build-gm.mjs` 13.7 KB (linear + 1 loop) — Phase 73 builders will be smaller (no loops per D-04)
- `build-pkop.mjs` 17.5 KB (linear + 2 loops) — closest non-fan-out shape; short-OGK/OBP will be ~half this size
- `build-omt.mjs` 27.2 KB (4-way fan-out) — short-ОМТ uses the 2-way sex skeleton only; ~half this size

---

## Decision: Reuse vs Fork `canvas-builder.mjs`

**Recommendation:** **Reuse via relative import** (`import { Canvas, verifyInvariants, reportFindings } from '../../72-canvas-library-full-algorithmic-canvases/build/canvas-builder.mjs'`) rather than forking.

**Rationale:**
- Per Phase 73 D-15: «Reuse / extend the existing `canvas-builder.mjs` … or fork a Phase-73-local copy.» — explicit author authorization for either path.
- Per D-17: invariants I1-I10 inherit unchanged → the existing `verifyInvariants` and `reportFindings` are the authoritative implementations. Forking would duplicate ~220 lines and create a drift risk.
- The Phase 72 helper is API-stable (Canvas class with `start/textBlock/question/answer/loop/snippetFolder/snippetFile/edge/toJSON`); none of the Phase 73 builders need new node kinds.
- If the executor finds a missing helper (e.g. cleaner snippet-or-text-block toggle for the «Костно-деструктивных» line per D-11), extend Phase 72's file in-place — but per CLAUDE.md «never remove existing code you didn't add», only append.

**If the executor chooses to fork:** copy `canvas-builder.mjs` byte-identically into `.planning/phases/73-…/build/canvas-builder.mjs` and import locally. No edits to the copy. Document the choice in the per-plan SUMMARY.md.

---

## Pattern Assignments

### `build-ogk-short.mjs` (per-canvas builder, single-trunk, no fan-out)

**Analog:** `.planning/phases/72-…/build/build-pkop.mjs` (closest single-trunk shape with the `section()` + `converge()` helper). Terminal-block style follows `build-gm.mjs`.

**ID-prefix convention** (Canvas constructor takes a 1-hex-char namespace prefix per build-gm.mjs:8 / build-pkop.mjs:10 / build-omt.mjs:10):

```javascript
const c = new Canvas('1');  // ГМ
const c = new Canvas('2');  // ОБП full
const c = new Canvas('3');  // ОЗП
const c = new Canvas('4');  // ОМТ full
const c = new Canvas('5');  // ПКОП
```

Phase 73 must pick three unused single-hex chars. Recommended:
```javascript
const c = new Canvas('6');  // ОГК short
const c = new Canvas('7');  // ОБП short
const c = new Canvas('8');  // ОМТ short
```

**Imports + module preamble** (verbatim from `build-pkop.mjs:1-10` — adapt comment + ID prefix):

```javascript
// Build ОГК short 1.0.0.canvas per 73-01-PLAN.md.
// Source template: Z:\projects\references\short - ОГК ОБП ОМТ жен.md (lines 4-7; ОГК section is byte-equivalent in муж file)
// Reference shape: Phase 72 build-pkop.mjs (linear single-trunk, no fan-out)

import { writeFileSync } from 'node:fs';
import { Canvas, verifyInvariants, reportFindings } from '../../72-canvas-library-full-algorithmic-canvases/build/canvas-builder.mjs';

const c = new Canvas('6'); // ОГК short → prefix '6'
```

**Layout constants** (verbatim from `build-pkop.mjs:12-17`):

```javascript
const X = 0;
const X_NORM = -340;
const X_FREE = 340;
const X_SNIP = 720;
const STEP = 160;
```

**`section()` factory** — replicate verbatim from `build-pkop.mjs:31-49`. This is the Phase-73 work-horse for «text-block header → question Норма? → answer Норма / answer Опишу вручную / [optional snippet folder]» triplet that D-02 mandates per organ system:

```javascript
function section({ headerText, normText, normHeight, sectionName, snippetSubfolder, snippetLabel = 'Выберу шаблон', y }) {
  const header = c.textBlock({ text: `\n${headerText}`, x: X, y });
  const question = c.question({ text: `${headerText.replace(':', '')} — норма?`, x: X, y: y + STEP });
  const norm = c.answer({ text: normText, displayLabel: 'Норма', x: X_NORM, y: y + STEP * 2, height: normHeight ?? 60 });
  const free = c.answer({ text: `==напишу что не так${sectionName ? ' с ' + sectionName : ''}==`, displayLabel: 'Опишу вручную', x: X_FREE, y: y + STEP * 2, height: 80 });
  c.edge({ from: header, to: question });
  c.edge({ from: question, to: norm, label: 'Норма' });
  c.edge({ from: question, to: free, label: 'Опишу вручную' });
  const branchIds = [norm, free];
  if (snippetSubfolder) {
    const snip = c.snippetFolder({
      subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel,
      x: X_SNIP, y: y + STEP * 2, height: 80,
    });
    c.edge({ from: question, to: snip, label: snippetLabel });
    branchIds.push(snip);
  }
  return { header, branches: branchIds };
}
```

**`converge()` helper** (verbatim from `build-pkop.mjs:51-53`):

```javascript
function converge(branches, target) {
  for (const b of branches) c.edge({ from: b, to: target });
}
```

**Start node + per-section invocation pattern** (model on `build-pkop.mjs:20-58`, but ОГК short skips procedure text-block — short templates have no preamble):

```javascript
let y = -200;
const start = c.start({ x: X, y });
y += STEP;

// Section 1: ЛЕГКИЕ (verbatim from short-жен/short-муж line 4)
const sec1 = section({
  headerText: 'ЛЕГКИЕ:',
  normText: 'В легких свежих очаговых и инфильтративных изменений не выявлено.',
  sectionName: 'легкими',
  snippetSubfolder: 'ОГК/ЛЕГКИЕ',  // per Phase 72 D-09 reuse — see Snippet Folder Mapping section below
  y,
});
c.edge({ from: start, to: sec1.header });
y += STEP * 2 + 200;
```

**Per-organ-system normal text mapping** (CONTEXT.md D-01 + reference template `short - ОГК ОБП ОМТ жен.md` lines 4-7 — these four sentences become four separate sections per D-01, NOT one monolithic block):

| Section name | Norm text (verbatim) | Snippet subfolder |
|---|---|---|
| `ЛЕГКИЕ:` | `В легких свежих очаговых и инфильтративных изменений не выявлено.` | `ОГК/ЛЕГКИЕ` |
| `ТРАХЕЯ И БРОНХИ:` | `Трахея и главные бронхи проходимы, не деформированы, обычного диаметра.` | (optional — author may omit) |
| `СРЕДОСТЕНИЕ:` | `Лимфоузлы средостения не увеличены.` | `ОГК/СРЕДОСТЕНИЕ` |
| `ПЛЕВРАЛЬНЫЕ ПОЛОСТИ:` | `Плевральные полости и полость перикарда свободны.` | `ОГК/ПЛЕВРАЛЬНЫЕ ПОЛОСТИ` |

**Terminal Заключение/Рекомендации pattern** (model on `build-gm.mjs:194-201` — combine into a single text-block with `\n## Заключение\n…\n\n## Рекомендации\n…`). Per CONTEXT.md D-13, the Заключение line wraps `РКТ-признаки ` with a Phase-27 fill-in chip:

```javascript
const terminal = c.textBlock({
  text: '\n## Заключение\nРКТ-признаки ==диагноз==\n\n## Рекомендации\nКонсультация направившего специалиста.',
  x: X, y, height: 220,
});
converge(secLast.branches, terminal);
```

**Verify + write pattern** (verbatim shape from `build-pkop.mjs:196-215` — adjust paths and section list):

```javascript
const json = c.toJSON();
const findings = verifyInvariants(json, {
  sectionHeaders: ['ЛЕГКИЕ:', 'ТРАХЕЯ И БРОНХИ:', 'СРЕДОСТЕНИЕ:', 'ПЛЕВРАЛЬНЫЕ ПОЛОСТИ:'],
  zaklyuchenie: 'РКТ-признаки',  // I6 anchor — short anchor since fill-in chip follows
  rekomendatsii: 'Консультация направившего специалиста.',
});
const ok = reportFindings('ОГК short 1.0.0.canvas', findings);

const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОГК short 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}`);
console.log(`  loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}`);
process.exit(ok ? 0 : 1);
```

**Loop-related code MUST be omitted entirely** — short canvases are loop-free per D-04. The verifier still runs invariants I2/I3 but those checks are vacuously satisfied when no loop nodes exist (see `canvas-builder.mjs:127-135` — `for (const lp of loops)` is a no-op when `loops.length === 0`).

---

### `build-obp-short.mjs` (per-canvas builder, single-trunk, no fan-out)

**Analog:** Identical shape to `build-ogk-short.mjs` above. Use the same `section()` + `converge()` helpers from `build-pkop.mjs`.

**ID prefix:**
```javascript
const c = new Canvas('7'); // ОБП short → prefix '7'
```

**Per-organ-system normal text mapping** (from `short - ОГК ОБП ОМТ жен.md` lines 10-12, byte-equivalent across both short templates per CONTEXT.md «specifics» note about ОБП being functionally identical between sex variants):

| Section name | Norm text (verbatim) | Snippet subfolder |
|---|---|---|
| `ПАРЕНХИМАТОЗНЫЕ ОРГАНЫ:` | `Патологических образований (очагов патологической плотности) в паренхиме печени и почек, селезенки, надпочечников, поджелудочной железы не выявлено.` | `ОБП` |
| `ЖЕЛЧНЫЙ ПУЗЫРЬ:` | `Желчный пузырь не увеличен, R-контрастных включений в нем не выявлено.` | `ОБП` |
| `ЗАБРЮШИННЫЕ ЛИМФОУЗЛЫ:` | `Забрюшинные лимфоузлы не увеличены.` | `ОБП` |

(Author's-discretion per CONTEXT.md «agent's Discretion»: section names above are suggested — the executor may pick alternative Russian wording as long as it's consistent with Phase 72 vocabulary.)

**Vault output path:**
```javascript
const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОБП short 1.0.0.canvas';
```

**Section header list for invariants:**
```javascript
sectionHeaders: ['ПАРЕНХИМАТОЗНЫЕ ОРГАНЫ:', 'ЖЕЛЧНЫЙ ПУЗЫРЬ:', 'ЗАБРЮШИННЫЕ ЛИМФОУЗЛЫ:'],
```

All other patterns (start, terminal, verify-+-write block, Phase-27 chip on Заключение) identical to `build-ogk-short.mjs`.

---

### `build-omt-short.mjs` (per-canvas builder, sex 2-way fan-out, no contrast)

**Analog:** `.planning/phases/72-…/build/build-omt.mjs` — same sex-fan-out skeleton, but:
- **Drop the contrast question** (D-06: «ОМТ short does NOT include the «Контраст вводился?» fan-out»).
- **Drop 4-way → 2-way** — only `X_FNC`/`X_MNC` axes survive; `X_FC`/`X_MC` and bolus/manual answer nodes are removed entirely.
- **Drop both organ-discovery loops** (no МАТКА or ЯИЧНИКИ loops — D-04).
- **Per-sex sub-flows are linear `section()` chains** like ОГК-short / ОБП-short, just rooted at `X_FEM` and `X_MUZH` instead of `X = 0`.

**ID prefix:**
```javascript
const c = new Canvas('8'); // ОМТ short → prefix '8'
```

**Layout constants** (simplified from `build-omt.mjs:12-20` — keep only the two surviving trunks):

```javascript
const X_FEM = -1500;     // female trunk x-anchor
const X_MUZH = 1500;     // male trunk x-anchor
const NORM_DX = -340;
const FREE_DX = 340;
const SNIP_DX = 720;
const STEP = 160;
```

**Trunk-aware `section()` factory** — copy verbatim from `build-omt.mjs:22-40` (the `trunkX` parameter is what makes it sex-aware):

```javascript
function section(c, { trunkX, headerText, normText, normHeight, sectionName, snippetSubfolder, snippetLabel = 'Выберу шаблон', y }) {
  const header = c.textBlock({ text: `\n${headerText}`, x: trunkX, y });
  const question = c.question({ text: `${headerText.replace(':', '')} — норма?`, x: trunkX, y: y + STEP });
  const norm = c.answer({ text: normText, displayLabel: 'Норма', x: trunkX + NORM_DX, y: y + STEP * 2, height: normHeight ?? 60 });
  const free = c.answer({ text: `==напишу что не так${sectionName ? ' с ' + sectionName : ''}==`, displayLabel: 'Опишу вручную', x: trunkX + FREE_DX, y: y + STEP * 2, height: 80 });
  c.edge({ from: header, to: question });
  c.edge({ from: question, to: norm, label: 'Норма' });
  c.edge({ from: question, to: free, label: 'Опишу вручную' });
  const branchIds = [norm, free];
  if (snippetSubfolder) {
    const snip = c.snippetFolder({
      subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel,
      x: trunkX + SNIP_DX, y: y + STEP * 2, height: 80,
    });
    c.edge({ from: question, to: snip, label: snippetLabel });
    branchIds.push(snip);
  }
  return { header, branches: branchIds };
}

function converge(c, branches, target) {
  for (const b of branches) c.edge({ from: b, to: target });
}
```

**Sex fan-out at top — derived from `build-omt.mjs:60-70`** (drop everything below line 70 about Контраст; sex Q is the only fan-out):

```javascript
const start = c.start({ x: 0, y: -400 });
const qSex = c.question({ text: 'Пол пациента?', x: 0, y: -240 });
c.edge({ from: start, to: qSex });

const aFem = c.answer({ text: '', displayLabel: 'Жен', x: X_FEM, y: -80 });
const aMuzh = c.answer({ text: '', displayLabel: 'Муж', x: X_MUZH, y: -80 });
c.edge({ from: qSex, to: aFem, label: 'Жен' });
c.edge({ from: qSex, to: aMuzh, label: 'Муж' });
```

**Жен sub-flow per-system mapping** (verbatim from `short - ОГК ОБП ОМТ жен.md` line 15-17 — three sentences become three sections + the universal lymph + bones lines per CONTEXT.md «specifics»):

| Section name | Norm text (verbatim, with ==fill-in== chips per D-12) | Snippet subfolder |
|---|---|---|
| `МАТКА:` | `Тело матки в поперечнике до ==размер тела матки мм== мм. Шейка матки до ==размер шейки матки мм== мм.` | `ОМТ` |
| `ПРИДАТКИ:` | `Придатки: справа - ==придатки справа==, слева - ==придатки слева==.` | `ОМТ` |
| `ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ:` | `Подвздошные лимфоузлы не увеличены.` | `ОМТ` |
| `КОСТНЫЕ СТРУКТУРЫ:` (or hardcoded text-block per D-11) | `Костно-деструктивных изменений не выявлено.` | `КОСТИ` (optional) |

**Муж sub-flow per-system mapping** (verbatim from `short - ОГК ОБП ОМТ муж.md` line 17-21):

| Section name | Norm text (verbatim) | Snippet subfolder |
|---|---|---|
| `ПРОСТАТА:` | `Простата в поперечнике до ==размер простаты мм== мм.` | `ОМТ` |
| `СЕМЕННЫЕ ПУЗЫРЬКИ:` | `Семенные пузырьки интактны. Окружающая клетчатка не изменена.` | `ОМТ` |
| `ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ:` | `Подвздошные лимфоузлы не увеличены.` | `ОМТ` |
| `КОСТНЫЕ СТРУКТУРЫ:` (or hardcoded text-block per D-11) | `Костно-деструктивных изменений не выявлено.` | `КОСТИ` (optional) |

**Terminal convergence — pattern from `build-omt.mjs:399-407`** (both sex sub-trunks converge into a single Заключение/Рекомендации text-block per D-07):

```javascript
const yTerm = Math.max(yFem, yMuzh) + 200;
const terminal = c.textBlock({
  text: '\n## Заключение\nРКТ-признаки ==диагноз==\n\n## Рекомендации\nКонсультация направившего специалиста.',
  x: 0, y: yTerm, height: 240,
});
converge(c, femBonesOrLast.branches, terminal);
converge(c, muzhBonesOrLast.branches, terminal);
```

**Sub-trunk start edges** (from `build-omt.mjs:120 / 185-186` — answer node feeds directly into the first section header):

```javascript
let yFem = 200;
const fem_uterus = section(c, { trunkX: X_FEM, headerText: 'МАТКА:', /* ... */ y: yFem });
c.edge({ from: aFem, to: fem_uterus.header });
yFem += STEP * 2 + 200;
// ... continue per Жен sections
```

**Verify + write block** (model on `build-omt.mjs:412-429`):

```javascript
const json = c.toJSON();
const findings = verifyInvariants(json, {
  sectionHeaders: [
    'МАТКА:', 'ПРИДАТКИ:', 'ПРОСТАТА:', 'СЕМЕННЫЕ ПУЗЫРЬКИ:',
    'ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ:', 'КОСТНЫЕ СТРУКТУРЫ:',
  ],
  zaklyuchenie: 'РКТ-признаки',
  rekomendatsii: 'Консультация направившего специалиста.',
});
const ok = reportFindings('ОМТ short 1.0.0.canvas', findings);

const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОМТ short 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}`);
console.log(`  loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}`);
process.exit(ok ? 0 : 1);
```

---

## Shared Patterns (apply to all three new builders)

### S1. Phase-27 fill-in chip embedding (D-12, D-13, D-14)

**Source:** `build-omt.mjs:117` (`==размер матки мм==` inside answer text), `build-pkop.mjs:120-137` (per-segment chips), `build-gm.mjs:43` (`==напишу что не так со срединными структурами==`).

**Convention:** Phase-27 chips live INSIDE `text:` strings on `answer` / `text-block` / `snippet` nodes. They are paired `==…==` markers; the runtime chip-parser (Phase 27) substitutes user input. Static invariant I10 enforces well-formedness — every line must contain an even number of `==` occurrences.

**Excerpt — chip inside answer norm text** (`build-omt.mjs:117`):
```javascript
normText: 'В положении anteflexio/retroflexio, не смещена, размеры тела матки ==размер матки мм== мм, контуры четкие, ровные.\n…',
```

**Excerpt — chip inside «Опишу вручную» free-text answer** (auto-generated by `section()` from `sectionName` parameter — `build-pkop.mjs:35`):
```javascript
const free = c.answer({ text: `==напишу что не так${sectionName ? ' с ' + sectionName : ''}==`, /* ... */ });
```

**Excerpt — chip inside terminal Заключение** (Phase 73 D-13 — new pattern, required for short canvases since templates have trailing-space `РКТ-признаки `):
```javascript
text: '\n## Заключение\nРКТ-признаки ==диагноз==\n\n## Рекомендации\nКонсультация направившего специалиста.',
```

Apply S1 to: all three Phase 73 builders.

### S2. Snippet folder mapping (D-08, D-09)

**Source:** `build-gm.mjs:72,158-166` (`subfolderPath: 'ГМ'`), `build-pkop.mjs:42-44, 86,156` (`subfolderPath: 'ПОЗВОНОЧНИК'`, `'КОСТИ'`), `build-omt.mjs:118,124,148,162,…` (`subfolderPath: 'ОМТ'`).

**Convention:** Phase 73 REUSES Phase 72 subfolders verbatim (D-09: «no new short-specific subfolders»). The `Canvas.snippetFolder({ subfolderPath, text, snippetLabel, … })` factory embeds `radiprotocol_subfolderPath` and a human-readable `radiprotocol_snippetLabel`. Static invariant I4 enforces «exactly one of subfolderPath OR snippetPath» (`canvas-builder.mjs:138-144`).

**Phase-73 subfolder picks:**
- ОГК short → `ОГК/ЛЕГКИЕ`, `ОГК/СРЕДОСТЕНИЕ`, `ОГК/ПЛЕВРАЛЬНЫЕ ПОЛОСТИ` (mirrors what was used in the reference `ОГК 1.10.0.canvas`)
- ОБП short → `ОБП` (single top-level — mirrors Phase 72 ОБП full)
- ОМТ short → `ОМТ` (single top-level — mirrors Phase 72 ОМТ full)
- Optional shared «КОСТИ» — used by ОМТ-short last system, only if D-11 chooses snippet over hardcoded text-block

**Excerpt — snippetFolder invocation** (`build-pkop.mjs:42-46`):
```javascript
const snip = c.snippetFolder({
  subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel,
  x: X_SNIP, y: y + STEP * 2, height: 80,
});
c.edge({ from: question, to: snip, label: snippetLabel });
```

Apply S2 to: all three Phase 73 builders, every `section()` call that takes `snippetSubfolder`.

### S3. Static invariant verification + reporter (D-17, D-20)

**Source:** `canvas-builder.mjs:115-223` (full `verifyInvariants` + `reportFindings`).

**Convention:** Each builder must call `verifyInvariants(json, spec)` AFTER `c.toJSON()` and BEFORE `writeFileSync`, then call `reportFindings(canvasName, findings)`. The script returns non-zero exit code (`process.exit(ok ? 0 : 1)`) on any invariant failure. The author runs each builder via `node …/build-X-short.mjs` and visually confirms «N pass, 0 fail».

**Spec object shape** (`canvas-builder.mjs:147-164`):
```javascript
{
  sectionHeaders: string[],   // each must appear in some text-block.text (I5)
  zaklyuchenie: string,       // verbatim grep against the whole canvas JSON (I6)
  rekomendatsii: string,      // verbatim grep (I7)
}
```

**I5 substring match** (`canvas-builder.mjs:148-152`) — `n.text.includes(h)`. Because Phase 73 builders use `\n${headerText}` prefix (per `section()`), the header string itself appears verbatim — no escaping needed.

**I6/I7 substring match** (`canvas-builder.mjs:155-164`) — uses `JSON.stringify(canvasJSON).includes(spec.zaklyuchenie)`. **Important:** because Phase 73 wraps `РКТ-признаки ` in a fill-in chip (D-13), the verbatim string in the canvas JSON is `РКТ-признаки ==диагноз==`. The I6 anchor must therefore use the shorter prefix `РКТ-признаки` (without trailing space, without chip) so the substring check still passes. Same anchor used by `build-pkop.mjs:205` («РКТ-признаки нарушения статики…» — anchored on the first sentence).

Apply S3 to: all three Phase 73 builders' verify-+-write tail.

### S4. Vault write target + audit-log line (D-16, D-18)

**Source:** `build-gm.mjs:221-224`, `build-pkop.mjs:210-214`, `build-omt.mjs:424-428`.

**Convention:** Each builder writes a single `.canvas` file directly into the author's vault (NOT into the repo working tree per Phase 72 invariant restated as D-20). After write, prints a one-line audit summary.

**Excerpt — write + audit** (`build-pkop.mjs:210-214`):
```javascript
const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ПКОП 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}`);
console.log(`  loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}`);
process.exit(ok ? 0 : 1);
```

**Phase 73 file-name targets per D-18:**
- `Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОГК short 1.0.0.canvas`
- `Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОБП short 1.0.0.canvas`
- `Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОМТ short 1.0.0.canvas`

**JSON formatting:** `JSON.stringify(json, null, '\t')` — tab-indented, matching Phase 72 output style and Obsidian's own canvas serialization.

Apply S4 to: all three Phase 73 builders.

### S5. NO loops, NO procedure preamble text-block

**Negative pattern — Phase 73 omits both:**

1. **No loops** (D-04). Do NOT call `c.loop()`. Do NOT emit `+`-prefix exit edges. The verifier's I2/I3 loops over zero loop nodes and is vacuously OK (`canvas-builder.mjs:127`).

2. **No procedure preamble text-block.** Phase 72 builders emitted a long preamble after `start` (e.g. `build-gm.mjs:28-32` → `«МСКТ-исследование выполнено по стандартной программе…»`). Short templates at `Z:\projects\references\short - ОГК ОБП ОМТ {жен,муж}.md` have no preamble — the «Описание» block opens directly with the first organ-system sentence. Phase 73 builders' `start` node connects directly to the first section's header text-block.

Apply S5 to: all three Phase 73 builders.

---

## Per-canvas SUMMARY.md scaffold (D-22)

**Source:** Phase 72 SUMMARY series — `.planning/phases/72-canvas-library-full-algorithmic-canvases/72-{01,02,03,04,05}-SUMMARY.md`.

**Pattern:** YAML frontmatter (plan id, status, requirement coverage) + verification disposition table + author sign-off line. The mapping doc does not specify the exact frontmatter shape — refer to one of the Phase 72 SUMMARY files at planning time. Phase 73 produces three SUMMARY files: `73-01-SUMMARY.md` (ОГК short), `73-02-SUMMARY.md` (ОБП short), `73-03-SUMMARY.md` (ОМТ short) — keyed to ROADMAP CANVAS-LIB-06/07/08.

This is a planner-level concern — not a builder code pattern — but listed here for completeness so the planner doesn't miss it.

---

## No Analog Found

| File | Reason |
|------|--------|
| (none) | All three Phase 73 builders have direct Phase 72 analogs. No new node kinds, no new helpers, no new invariants. |

---

## Metadata

**Analog search scope:** `.planning/phases/72-canvas-library-full-algorithmic-canvases/build/` (6 files inspected: `canvas-builder.mjs`, `build-gm.mjs`, `build-obp.mjs`, `build-omt.mjs`, `build-ozp.mjs`, `build-pkop.mjs`).
**Source-template scope:** `Z:\projects\references\short - ОГК ОБП ОМТ жен.md`, `Z:\projects\references\short - ОГК ОБП ОМТ муж.md`.
**Pattern extraction date:** 2026-04-30
