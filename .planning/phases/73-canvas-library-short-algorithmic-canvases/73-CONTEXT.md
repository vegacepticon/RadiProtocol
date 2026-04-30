# Phase 73: Canvas Library — Short Algorithmic Canvases - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Three hand-authored short-version `.canvas` files (ОГК short, ОБП short, ОМТ short) exist in the author's local vault at `Z:\documents\vaults\TEST-BASE\Protocols\`, each modeled on the corresponding section of the combined short `.md` text templates at `Z:\projects\references\` (`short - ОГК ОБП ОМТ жен.md` and `short - ОГК ОБП ОМТ муж.md`). Each canvas runs end-to-end in the Protocol Runner producing a structurally complete shortened report matching its source text. None of these canvases are bundled with the plugin distribution or committed to this repository.

</domain>

<decisions>
## Implementation Decisions

### Canvas internal structure (per organ system)
- **D-01:** Each short canvas is split into per-organ-system text-blocks (NOT a single monolithic text-block) — even though the source `.md` describes each system as a single paragraph. Provides discrete entry points for future per-system extension while staying linear in v1.
- **D-02:** Per-organ-system normal/non-normal branching: each organ-system text-block is preceded by its own Question «Норма?» → Да = verbatim normal text-block / Нет = `==напишу что не так==` fill-in chip (or snippet picker, see D-09). Mirrors Phase 72 D-23 «==напишу что не так==» pattern for non-standard findings.
- **D-03:** Each canvas terminates with two final fixed text-blocks: `## Заключение` containing `РКТ-признаки [==fill-in==]` and `## Рекомендации` containing `Консультация направившего специалиста.` (verbatim from short templates).
- **D-04:** No loops in short canvases. Short templates contain no «несколько очагов / нескольких сегментов» scenarios — short = single normal-finding paragraph per system.

### ОМТ short — sex fan-out
- **D-05:** ОМТ short = ONE canvas with sex fan-out (Жен/Муж) at the top — analog of Phase 72 D-26 pattern. Initial Question «Пол?» branches into Жен sub-flow (МАТКА + ЯИЧНИКИ + ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ + КОСТНО-ДЕСТРУКТИВНЫЕ) and Муж sub-flow (ПРОСТАТА + СЕМ.ПУЗ + ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ + КОСТНО-ДЕСТРУКТИВНЫЕ). Keeps ROADMAP scope at exactly 3 canvases (CANVAS-LIB-06/07/08).
- **D-06:** ОМТ short does NOT include the «Контраст вводился?» fan-out. Short templates don't differentiate contrast — only sex matters for short ОМТ.
- **D-07:** After sex-specific organs and shared trailing systems, ОМТ short converges to one terminal Заключение + Рекомендации pair (no per-sex terminal divergence).

### Snippet strategy
- **D-08:** Use full snippet-node strategy as in Phase 72 — each clinical phrase variant referenced via snippet picker (subfolderPath) so author can choose appropriate variant at runtime. Even though short canvases have less branching than full, snippet-pickers are how authors override the "norm" path with specific clinical findings (the «Нет» branch of D-02).
- **D-09:** Snippet folders REUSE the same SNIPPETS\ subfolders established in Phase 72 — no new short-specific subfolders. ОГК short → `SNIPPETS\ОГК\…`; ОБП short → `SNIPPETS\ОБП\…`; ОМТ short → `SNIPPETS\ОМТ\…`. Cross-canvas isolation (Phase 72 D-04 / Pitfall 9) preserved.
- **D-10:** Per Phase 72 D-15 — do NOT pre-create snippet files or subfolders. Snippet nodes embed the folder path; author confirms or adjusts in EditorPanel after generation. Static verification check for snippet well-formedness (subfolderPath OR snippetPath, not both — Phase 72 I4) still applies.
- **D-11:** Shared «Костно-деструктивных изменений не выявлено.» line at the bottom of all three short reports may be authored either as a hardcoded text-block or as a single shared snippet under `SNIPPETS\КОСТИ\` — generator picks the simpler option (hardcoded text-block per canvas) unless duplication becomes excessive.

### Fill-in placeholders (Phase-27 chips)
- **D-12:** Templater-style empty measurement gaps in source `.md` templates (`Тело матки в поперечнике до  мм.`, `Шейка матки до  мм.`, `Придатки: справа -  , слева -  .`, `Простата в поперечнике до  мм.`) → wrapped as Phase-27 `==fill-in==` chips inside the relevant Text-block node text. Filled by author via Phase-27 fill-in modal at runtime. Direct continuation of Phase 72 D-29 pattern.
- **D-13:** The Заключение line `РКТ-признаки ` (trailing space + Templater cursor) → wrapped as a single `==fill-in==` chip for the diagnosis statement. Author types the diagnostic conclusion when running the canvas.
- **D-14:** Phase-27 chip well-formedness invariant (parser must accept generated chips without error) is a hard build-time invariant per Phase 72 I10.

### Generation approach
- **D-15:** Programmatic generation via per-canvas `.mjs` builders + shared `canvas-builder.mjs` helper — direct continuation of Phase 72 strategy note (PLAN.md «execution_context» originally said "manual authoring", but author authorized programmatic generation in Phase 72 since canvas JSON schema is documented and verbatim text is locked in source `.md` templates). Reuse / extend the existing `.planning/phases/72-canvas-library-full-algorithmic-canvases/build/canvas-builder.mjs` if helpful, or fork a Phase-73-local copy.
- **D-16:** Generated canvases deposited to `Z:\documents\vaults\TEST-BASE\Protocols\` (same path as Phase 72 outputs — outside the repo working tree, not committed to git).
- **D-17:** Static invariants I1-I10 from Phase 72 VALIDATION.md apply unchanged to Phase 73 canvases (snippet well-formedness, +-prefix exit edges if any loops introduced — none expected, reachability, terminal Заключение/Рекомендации present, Phase-27 chip well-formedness, no cross-canvas snippet leakage). Per-canvas builder must print invariant pass count.

### File naming and vault location
- **D-18:** File names: `ОГК short 1.0.0.canvas`, `ОБП short 1.0.0.canvas`, `ОМТ short 1.0.0.canvas` (parallel to Phase 72 `ОМТ full 1.0.0.canvas` / `ОБП full 1.0.0.canvas` pattern). The suffix `short` distinguishes from `full` versions; the `1.0.0` version segment matches Phase 72 convention.
- **D-19:** Author's vault path `Z:\documents\vaults\TEST-BASE\Protocols\` already contains: `ГМ 1.0.0.canvas`, `ОБП full 1.0.0.canvas`, `ОГК.canvas` (the existing reference, not `ОГК 1.10.0.canvas`), `ОЗП 1.0.0.canvas`, `ОМТ full 1.0.0.canvas`, `ПКОП 1.0.0.canvas`. The three new short canvases coexist alongside.

### Verification standard
- **D-20:** Static layer (verifier-runnable): all I1-I10 invariants pass per canvas, builder prints invariant counts. No git-committed `.canvas` artifacts (canvases live in author's vault outside repo working tree).
- **D-21:** Manual layer (`human_verification` array, mirroring Phase 72 verification report structure): author opens each generated canvas in Obsidian, runs from start through every primary branch (ОГК ×1, ОБП ×1, ОМТ ×2 — Жен and Муж), confirms output matches the corresponding section of `Z:\projects\references\short - ОГК ОБП ОМТ {жен,муж}.md` (visual structural diff, all sentences present, fill-in chips clickable and substitutable, terminal Заключение + Рекомендации emit).
- **D-22:** Per-canvas SUMMARY.md committed to `.planning/phases/73-…/` with frontmatter + verification dispositions (mirrors Phase 72 SUMMARY.md pattern).

### Author's Discretion
- Exact node positions in canvas (x/y coordinates) — generator may auto-layout or copy Phase 72's spatial conventions
- Specific Russian wording of Question prompts beyond «Норма?» (e.g., «Норма легких?» vs «ЛЕГКИЕ норма?») — generator picks consistent style
- Whether the «Костно-деструктивных» line is a separate per-canvas text-block or appended to the last organ-system text-block — generator may choose
- How to handle visible separation between organ-systems in the assembled output (blank lines between text-blocks — Phase 72 used `\n` prefixes on text-block content)
- Loop modeling NOT applicable — short canvases are loop-free per D-04

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source text templates (the ground truth for verbatim canvas text)
- `Z:\projects\references\short - ОГК ОБП ОМТ жен.md` — Combined short reference template, female track. Defines verbatim normal-finding text for ОГК + ОБП + ОМТ-жен sections plus shared Заключение/Рекомендации.
- `Z:\projects\references\short - ОГК ОБП ОМТ муж.md` — Combined short reference template, male track. Defines verbatim text for ОГК + ОБП + ОМТ-муж. ОГК + ОБП sections are byte-equivalent to the female file (use either as source for the ОГК short and ОБП short canvases). ОМТ-муж section is unique to this file.

### Phase 72 outputs (structural references for short canvas builders)
- `Z:\projects\references\ОГК 1.10.0.canvas` — Phase 72 reference template for canvas structure and node-modeling conventions (kinds, edges, snippet path conventions, Phase-27 chip embedding).
- `.planning/phases/72-canvas-library-full-algorithmic-canvases/72-CONTEXT.md` — Phase 72 decisions D-01..D-29 (loop conventions, snippet strategy, verification pattern). Phase 73 reuses much of this directly.
- `.planning/phases/72-canvas-library-full-algorithmic-canvases/72-RESEARCH.md` — Phase 72 research (canvas JSON schema, node-kind invariants, builder pattern).
- `.planning/phases/72-canvas-library-full-algorithmic-canvases/72-VALIDATION.md` — Static invariants I1-I10 (verifier-runnable checks). Phase 73 inherits the entire invariant set unchanged.
- `.planning/phases/72-canvas-library-full-algorithmic-canvases/72-VERIFICATION.md` — Verification report structure with `human_verification` frontmatter array. Phase 73 mirrors this exact pattern (per-canvas pending row, author sign-off after manual run-through).
- `.planning/phases/72-canvas-library-full-algorithmic-canvases/build/canvas-builder.mjs` — Shared canvas-construction helper (node factories, edge factories, layout). Phase 73 builders reuse or fork this.
- `.planning/phases/72-canvas-library-full-algorithmic-canvases/build/build-omt.mjs` — Reference for sex-fan-out pattern (ОМТ full uses sex × contrast 4-way; ОМТ short uses sex 2-way only — same fan-out skeleton, smaller branch count).

### Snippets folder (mapping target for snippet-node subfolderPath fields)
- `Z:\projects\references\SNIPPETS\` — Top-level snippet structure already established in Phase 72.
- `Z:\projects\references\SNIPPETS\ОГК\` — Subfolder for ОГК short snippet pickers (per D-09).
- `Z:\projects\references\SNIPPETS\ОБП\` — Subfolder for ОБП short snippet pickers.
- `Z:\projects\references\SNIPPETS\ОМТ\` — Subfolder for ОМТ short snippet pickers.
- `Z:\projects\references\SNIPPETS\КОСТИ\` — Optional shared «Костно-деструктивных» snippet target if D-11 chooses snippet over hardcoded text-block.

### Phase conventions (ratified earlier in project)
- Phase 27 — `==fill-in==` chip syntax and runner fill-in modal (Phase 72 D-29 reused here as D-12 / D-13).
- Phase 50.1 — `+`-prefix loop exit convention (NOT used in Phase 73 since short canvases are loop-free per D-04, but listed for completeness).
- Phase 43-46 — Unified loop node model (NOT used here for the same reason).
- ROADMAP §«Phase 73» — three CANVAS-LIB-06/07/08 success criteria locked.
- REQUIREMENTS.md §CANVAS-LIB-06..08 — locked requirement strings.

### Author vault state (current contents at start of Phase 73)
- `Z:\documents\vaults\TEST-BASE\Protocols\` — Already contains 6 Phase-72 outputs (ГМ, ОБП full, ОЗП, ОМТ full, ПКОП — five 1.0.0 canvases + the original `ОГК.canvas` reference). Phase 73 adds three more (`ОГК short 1.0.0.canvas`, `ОБП short 1.0.0.canvas`, `ОМТ short 1.0.0.canvas`) bringing total to 9.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`canvas-builder.mjs`** in `.planning/phases/72-…/build/` — Shared node/edge factories with auto-color, auto-position, snippet-path embedding, Phase-27 chip helpers. Phase 73 builders import or fork this.
- **`build-omt.mjs`** — Sex-fan-out builder pattern. Phase 73 ОМТ short uses the same skeleton minus the contrast inner fan-out (4 paths → 2 paths).
- **`build-gm.mjs` / `build-pkop.mjs`** — Simpler single-trunk builder patterns. Phase 73 ОГК short and ОБП short follow this shape (no top-level fan-out).
- **Phase 72 SUMMARY.md series** — Frontmatter format + verification disposition layout. Phase 73 mirrors per-plan.

### Established Patterns (carried from Phase 72 unchanged)
- Per-organ-system text-block with embedded `\n` prefix for visual separation (`"\nЛЕГКИЕ:"` style — though short canvases omit the section-header itself per D-01)
- Phase-27 `==fill-in==` chips embedded directly in text-block content (D-29 pattern)
- Snippet nodes with `subfolderPath` (folder picker) — runtime offers all variants under that folder
- Snippet nodes with `snippetPath` (specific file) — direct binding to one snippet
- Question → Answer (Да/Нет) → branching → join pattern for normal/non-normal split
- Auto-color via `NODE_COLOR_MAP[kind]` at node creation time

### Integration Points
- Each canvas verified by author opening it in Obsidian Protocol Runner and walking through every primary branch (manual layer of D-21).
- Snippet-node `subfolderPath` references resolve at runtime against `vault/.radiprotocol/snippets/...` (or whatever path the author has configured) — generator embeds the path, author confirms in EditorPanel after first open if path needs adjustment.
- Generated `.canvas` files written outside the repo working tree (`Z:\documents\vaults\TEST-BASE\Protocols\`) — never staged, never committed (Phase 72 invariant I-VAULT, restated as D-20 here).

### Build / Test Workflow
- `npm run build` / `npm run dev` produce `main.js` + `styles.css` — NOT involved in Phase 73 (no `src/` changes expected).
- `npm test` (vitest) — NOT involved (no engine changes).
- Per-canvas builder run: `node .planning/phases/73-…/build/build-{ogk,obp,omt}-short.mjs` — should print invariant pass count and write the `.canvas` to the author vault.

</code_context>

<specifics>
## Specific Ideas

- **Reference templates are combined files**, not per-organ. The two source `.md` files at `Z:\projects\references\short - ОГК ОБП ОМТ {жен,муж}.md` each contain ОГК + ОБП + ОМТ sections concatenated. Phase 73 builders extract the relevant section and emit it as the verbatim normal-finding text-block of the corresponding canvas.
- **ОГК section is byte-identical** between жен and муж short templates (lines 4-7 of each). One source for ОГК short canvas — pick either file.
- **ОБП section is functionally identical** between жен and муж short templates (lines 10-13 vs 10-14). Minor formatting (blank lines between sentences in муж version) — generator normalizes to one canonical form.
- **ОМТ section diverges by sex** — Жен (lines 15-17): «Тело матки в поперечнике до  мм. Шейка матки до  мм. Придатки: справа - , слева - . Подвздошные лимфоузлы не увеличены. Костно-деструктивных изменений не выявлено.» Муж (lines 17-21): «Простата в поперечнике до  мм. Семенные пузырьки интактны. Окружающая клетчатка не изменена. Подвздошные лимфоузлы не увеличены. Костно-деструктивных изменений не выявлено.»
- **Заключение string** in both templates is `РКТ-признаки ` (trailing space, no diagnosis). Cursor `<% tp.file.cursor() %>` lives at line 1 of each file (above `## Описание`) — the diagnosis fill-in chip per D-13 captures this Templater intent.
- **Рекомендации string** in both templates: `Консультация направившего специалиста.` (single line, no variation).
- **«Костно-деструктивных» line** appears at the bottom of each template's Описание section (line 17 жен, line 21 муж) — within the ОМТ block visually but conceptually a universal skeleton-system finding. D-11 leaves placement choice to generator.

</specifics>

<deferred>
## Deferred Ideas

- Public canvas library / community publication of the eight v1.11 canvases — out of scope (already deferred from Phase 72; needs UX/distribution design, not in v1.11).
- Snippet folder pre-creation in author's vault — explicitly deferred per D-10 / Phase 72 D-15 (author configures paths post-generation).
- Migration of full-canvas snippets to a shared library structure — out of scope.
- Optional `==fill-in==` chips on the Заключение Recommendations line for non-routine recommendations — only the diagnosis line gets a chip per D-13.
- Loop modeling for «несколько находок» in short canvases — short templates have no multi-instance scenarios; if author later wants multi-finding short canvases, that's a future phase.

</deferred>

---

*Phase: 73-canvas-library-short-algorithmic-canvases*
*Context gathered: 2026-04-30*
